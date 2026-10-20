begin;

alter table public.cycles
  drop constraint if exists cycles_status_check;

alter table public.cycles
  add constraint cycles_status_check
    check (status in ('planned', 'active', 'paused', 'completed', 'canceled'));

alter table public.cycles
  add column if not exists paused_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists initial_commitment numeric(12, 2),
  add column if not exists committed_points numeric(12, 2) not null default 0,
  add column if not exists completed_points numeric(12, 2) not null default 0,
  add column if not exists added_points numeric(12, 2) not null default 0,
  add column if not exists removed_points numeric(12, 2) not null default 0,
  add column if not exists carried_over_points numeric(12, 2) not null default 0,
  add column if not exists started_at timestamptz;

alter table public.cycles
  add constraint cycles_initial_commitment_check
    check (initial_commitment is null or initial_commitment >= 0),
  add constraint cycles_totals_nonnegative_check
    check (committed_points >= 0 and completed_points >= 0 and added_points >= 0
      and removed_points >= 0 and carried_over_points >= 0),
  add constraint cycles_lifecycle_timestamps_check
    check (paused_at is null or started_at is not null),
  add constraint cycles_completed_timestamp_check
    check (completed_at is null or status = 'completed');

create unique index cycles_one_active_per_project_idx
  on public.cycles (organization_id, project_id)
  where status = 'active';

create index cycles_project_lifecycle_idx
  on public.cycles (organization_id, project_id, status, starts_at, ends_at);

create function public.refresh_cycle_totals(target_cycle_id uuid)
returns public.cycles
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  cycle public.cycles;
begin
  select * into cycle from public.cycles where id = target_cycle_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'Cycle is unavailable';
  end if;

  update public.cycles c
  set committed_points = coalesce(summary.total_points, 0),
      completed_points = coalesce(summary.completed_points, 0)
  from (
    select
      coalesce(sum(coalesce(t.estimate, 0)), 0) as total_points,
      coalesce(sum(case when t.status = 'completed' then coalesce(t.estimate, 0) else 0 end), 0) as completed_points
    from public.tasks t
    where t.cycle_id = target_cycle_id
      and t.archived_at is null
  ) summary
  where c.id = target_cycle_id
  returning * into cycle;
  return cycle;
end;
$$;

-- Extend the existing atomic task mutation RPC with cycle membership. The
-- signature stays stable so current clients keep using the same retry receipts.
create or replace function public.mutate_task(
  target_organization_id uuid,
  target_project_id uuid,
  request_id uuid,
  action text,
  target_task_id uuid default null,
  task_values jsonb default '{}'::jsonb,
  expected_updated_at timestamptz default null,
  change_source text default 'internal',
  change_reason text default null,
  change_correlation_id text default null
)
returns public.tasks
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  receipt public.task_mutation_receipts;
  fingerprint jsonb;
  saved public.tasks;
  proposed public.tasks;
  old_context text := current_setting('projectpulse.task_change', true);
begin
  if not service_call and (auth.uid() is null
    or not public.is_org_member(target_organization_id)
    or not public.can_write_project(target_project_id, target_organization_id)) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  if not exists (select 1 from public.projects where id = target_project_id and organization_id = target_organization_id) then
    raise exception using errcode = '42501', message = 'Project is unavailable';
  end if;
  if request_id is null or action is null or action not in ('create', 'update', 'archive', 'restore')
    or (action = 'create' and target_task_id is not null)
    or (action <> 'create' and (target_task_id is null or expected_updated_at is null)) then
    raise exception using errcode = '22023', message = 'Invalid task mutation request';
  end if;
  if task_values is null or jsonb_typeof(task_values) <> 'object' then
    raise exception using errcode = '22023', message = 'Task values must be an object';
  end if;
  if exists (select 1 from jsonb_object_keys(task_values) as keys(key)
    where key <> all(array['title','description','status','priority','assignee_id','labels','estimate','due_date','cycle_id']))
    or (action in ('archive','restore') and task_values <> '{}'::jsonb) then
    raise exception using errcode = '22023', message = 'Unsupported task fields';
  end if;
  if change_source is null or change_source !~ '^[a-z][a-z0-9_.-]{0,39}$'
    or (service_call and nullif(trim(change_reason), '') is null) then
    raise exception using errcode = '22023', message = 'Automated changes require a source and reason';
  end if;
  if not service_call and change_source <> 'internal' then
    raise exception using errcode = '42501', message = 'Only trusted services may set automated change sources';
  end if;

  fingerprint := jsonb_build_object('action', action, 'taskId', target_task_id,
    'values', task_values, 'expectedUpdatedAt', expected_updated_at,
    'source', change_source, 'reason', change_reason, 'correlationId', change_correlation_id);
  insert into public.task_mutation_receipts as receipts
    (organization_id, project_id, request_id, actor_id, request)
  values (target_organization_id, target_project_id, request_id, auth.uid(), fingerprint)
  on conflict on constraint task_mutation_receipts_pkey do nothing
  returning * into receipt;
  if not found then
    select * into receipt from public.task_mutation_receipts r
    where r.organization_id = target_organization_id and r.request_id = mutate_task.request_id;
    if receipt.project_id is distinct from target_project_id
      or receipt.actor_id is distinct from auth.uid() or receipt.request is distinct from fingerprint then
      raise exception using errcode = '23505', message = 'Request ID already used for a different change';
    end if;
    return jsonb_populate_record(null::public.tasks, receipt.response);
  end if;

  perform set_config('projectpulse.task_change', jsonb_build_object('requestId', request_id,
    'source', change_source, 'reason', change_reason, 'correlationId', change_correlation_id)::text, true);
  if action = 'create' then
    proposed := jsonb_populate_record(null::public.tasks,
      '{"status":"backlog","priority":"medium","labels":[]}'::jsonb || task_values);
    insert into public.tasks (organization_id, project_id, title, description, status, priority,
      assignee_id, labels, estimate, due_date, cycle_id, created_by)
    values (target_organization_id, target_project_id, proposed.title, proposed.description,
      proposed.status, proposed.priority, proposed.assignee_id, proposed.labels, proposed.estimate,
      proposed.due_date, proposed.cycle_id, auth.uid()) returning * into saved;
  else
    select * into saved from public.tasks t
    where t.id = target_task_id and t.project_id = target_project_id and t.organization_id = target_organization_id
    for update;
    if not found then
      raise exception using errcode = '42501', message = 'Task is unavailable';
    end if;
    if saved.updated_at is distinct from expected_updated_at then
      raise exception using errcode = '40001', message = 'Task changed. Reload before saving again';
    end if;
    if action = 'update' then
      proposed := jsonb_populate_record(saved, task_values);
      update public.tasks set title = proposed.title, description = proposed.description,
        status = proposed.status, priority = proposed.priority, assignee_id = proposed.assignee_id,
        labels = proposed.labels, estimate = proposed.estimate, due_date = proposed.due_date,
        cycle_id = proposed.cycle_id
      where id = target_task_id returning * into saved;
    else
      update public.tasks set archived_at = case when action = 'archive' then coalesce(archived_at, clock_timestamp()) end
      where id = target_task_id returning * into saved;
    end if;
  end if;
  perform set_config('projectpulse.task_change', coalesce(old_context, ''), true);
  update public.task_mutation_receipts r set response = to_jsonb(saved)
  where r.organization_id = target_organization_id and r.request_id = mutate_task.request_id;
  return saved;
end;
$$;

create function public.sync_cycle_task_totals()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  old_cycle public.cycles;
  new_cycle public.cycles;
  old_points numeric := 0;
  new_points numeric := 0;
begin
  if tg_op <> 'INSERT' and old.cycle_id is not null then
    select * into old_cycle from public.cycles where id = old.cycle_id;
    old_points := case when old.archived_at is null then coalesce(old.estimate, 0) else 0 end;
    if old_cycle.status = 'active' and old_cycle.started_at is not null
      and (old.cycle_id is distinct from new.cycle_id or old.estimate is distinct from new.estimate or old.archived_at is distinct from new.archived_at) then
      update public.cycles
      set removed_points = removed_points + old_points
      where id = old.cycle_id;
    end if;
  end if;
  if new.cycle_id is not null then
    select * into new_cycle from public.cycles where id = new.cycle_id;
    new_points := case when new.archived_at is null then coalesce(new.estimate, 0) else 0 end;
    if new_cycle.status = 'active' and new_cycle.started_at is not null
      and (tg_op = 'INSERT' or old.cycle_id is distinct from new.cycle_id or old.estimate is distinct from new.estimate or old.archived_at is distinct from new.archived_at) then
      update public.cycles
      set added_points = added_points + new_points
      where id = new.cycle_id;
    end if;
  end if;
  if tg_op <> 'INSERT' and old.cycle_id is not null then
    perform public.refresh_cycle_totals(old.cycle_id);
  end if;
  if new.cycle_id is not null then
    perform public.refresh_cycle_totals(new.cycle_id);
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_cycle_totals on public.tasks;
create trigger tasks_sync_cycle_totals
  after insert or update of cycle_id, estimate, status, archived_at on public.tasks
  for each row execute function public.sync_cycle_task_totals();

create function public.prevent_completed_cycle_task_edit()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  old_cycle_completed boolean := false;
  new_cycle_completed boolean := false;
begin
  if old.cycle_id is not null then
    select status = 'completed' into old_cycle_completed from public.cycles where id = old.cycle_id;
  end if;
  if new.cycle_id is not null then
    select status = 'completed' into new_cycle_completed from public.cycles where id = new.cycle_id;
  end if;
  if new_cycle_completed and (old.cycle_id is distinct from new.cycle_id or old.estimate is distinct from new.estimate) then
    raise exception using errcode = '55000', message = 'Completed cycle membership is immutable';
  end if;
  if old_cycle_completed and (
    old.cycle_id is distinct from new.cycle_id or old.estimate is distinct from new.estimate
    or old.status is distinct from new.status or old.archived_at is distinct from new.archived_at
  ) then
    raise exception using errcode = '55000', message = 'Completed cycle history is immutable';
  end if;
  return new;
end;
$$;

create function public.capture_task_cycle_event()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  context jsonb := coalesce(nullif(current_setting('projectpulse.task_change', true), '')::jsonb, '{}'::jsonb);
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  event_source text := case when service_call then coalesce(context ->> 'source', 'system') when auth.uid() is not null then 'internal' else 'system' end;
  event_name text;
begin
  if old.cycle_id is not distinct from new.cycle_id then return new; end if;
  event_name := case when new.cycle_id is null then 'task.cycle_removed' else 'task.cycle_added' end;
  insert into public.task_events (organization_id, project_id, task_id, event_type,
    source, entity_type, entity_id, idempotency_key, correlation_id, actor_id, payload, occurred_at)
  values (new.organization_id, new.project_id, new.id, event_name, event_source, 'task', new.id,
    'task-cycle-change:' || coalesce(context ->> 'requestId', extensions.gen_random_uuid()::text),
    context ->> 'correlationId', auth.uid(), jsonb_build_object(
      'version', 1,
      'changes', jsonb_build_object('cycle_id', jsonb_build_object('from', to_jsonb(old.cycle_id), 'to', to_jsonb(new.cycle_id))),
      'mode', case when event_source = 'internal' then 'manual' else 'automated' end,
      'reason', coalesce(context ->> 'reason', case when auth.uid() is null then 'Direct database change' end)
    ), clock_timestamp());
  return new;
end;
$$;

create function public.prevent_completed_cycle_edit()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if old.status = 'completed' and (
    new.name is distinct from old.name or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at or new.status is distinct from old.status
    or new.initial_commitment is distinct from old.initial_commitment
    or new.committed_points is distinct from old.committed_points
    or new.completed_points is distinct from old.completed_points
    or new.added_points is distinct from old.added_points
    or new.removed_points is distinct from old.removed_points
    or new.carried_over_points is distinct from old.carried_over_points
  ) then
    raise exception using errcode = '55000', message = 'Completed cycle history is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists cycles_prevent_completed_edit on public.cycles;
create trigger cycles_prevent_completed_edit
  before update on public.cycles
  for each row execute function public.prevent_completed_cycle_edit();

drop trigger if exists tasks_prevent_completed_cycle_edit on public.tasks;
create trigger tasks_prevent_completed_cycle_edit
  before update on public.tasks
  for each row execute function public.prevent_completed_cycle_task_edit();

drop trigger if exists tasks_capture_cycle_event on public.tasks;
create trigger tasks_capture_cycle_event
  after update of cycle_id on public.tasks
  for each row execute function public.capture_task_cycle_event();

create function public.manage_cycle(
  target_organization_id uuid,
  target_project_id uuid,
  action text,
  target_cycle_id uuid default null,
  cycle_name text default null,
  cycle_starts_at timestamptz default null,
  cycle_ends_at timestamptz default null
)
returns public.cycles
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  saved public.cycles;
begin
  if auth.uid() is null or not public.is_org_member(target_organization_id)
    or not public.can_write_project(target_project_id, target_organization_id) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  if action not in ('create', 'start', 'pause', 'complete', 'cancel') then
    raise exception using errcode = '22023', message = 'Invalid cycle action';
  end if;

  if action = 'create' then
    if nullif(trim(cycle_name), '') is null then
      raise exception using errcode = '22023', message = 'Cycle name is required';
    end if;
    insert into public.cycles (organization_id, project_id, name, starts_at, ends_at)
    values (target_organization_id, target_project_id, trim(cycle_name), cycle_starts_at, cycle_ends_at)
    returning * into saved;
    return saved;
  end if;

  select * into saved from public.cycles
  where id = target_cycle_id and project_id = target_project_id and organization_id = target_organization_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Cycle is unavailable';
  end if;
  if saved.status = 'completed' then
    raise exception using errcode = '55000', message = 'Completed cycle history is immutable';
  end if;

  if action = 'start' then
    if saved.status not in ('planned', 'paused') then
      raise exception using errcode = '22023', message = 'Only planned or paused cycles can start';
    end if;
    update public.cycles set status = 'active', started_at = coalesce(started_at, clock_timestamp()), paused_at = null,
      initial_commitment = coalesce(initial_commitment, committed_points)
    where id = saved.id returning * into saved;
    perform public.refresh_cycle_totals(saved.id);
    select * into saved from public.cycles where id = saved.id;
  elsif action = 'pause' then
    if saved.status <> 'active' then
      raise exception using errcode = '22023', message = 'Only active cycles can pause';
    end if;
    update public.cycles set status = 'paused', paused_at = clock_timestamp()
    where id = saved.id returning * into saved;
  elsif action = 'complete' then
    if saved.status not in ('active', 'paused') then
      raise exception using errcode = '22023', message = 'Only active or paused cycles can complete';
    end if;
    perform public.refresh_cycle_totals(saved.id);
    update public.cycles set status = 'completed', completed_at = clock_timestamp(), initial_commitment = coalesce(initial_commitment, committed_points), carried_over_points = greatest(committed_points - completed_points, 0)
    where id = saved.id returning * into saved;
  else
    if saved.status not in ('planned', 'paused') then
      raise exception using errcode = '22023', message = 'Only planned or paused cycles can cancel';
    end if;
    update public.cycles set status = 'canceled' where id = saved.id returning * into saved;
  end if;
  return saved;
end;
$$;

revoke execute on function public.refresh_cycle_totals(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.sync_cycle_task_totals() from public, anon, authenticated, service_role;
revoke execute on function public.prevent_completed_cycle_edit() from public, anon, authenticated, service_role;
revoke execute on function public.prevent_completed_cycle_task_edit() from public, anon, authenticated, service_role;
revoke execute on function public.capture_task_cycle_event() from public, anon, authenticated, service_role;
revoke execute on function public.manage_cycle(uuid, uuid, text, uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.manage_cycle(uuid, uuid, text, uuid, text, timestamptz, timestamptz) to authenticated;

commit;
