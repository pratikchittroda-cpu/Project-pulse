begin;

-- The first T024 migration has already been applied. Extend it in place without
-- rewriting that migration or resetting local data.
alter table public.cycles
  add column initial_tasks jsonb not null default '[]',
  add column completion_tasks jsonb not null default '[]',
  add column task_count integer not null default 0,
  add column completed_task_count integer not null default 0,
  add column added_task_count integer not null default 0,
  add column removed_task_count integer not null default 0,
  add column carried_over_task_count integer not null default 0,
  add constraint cycles_finite_dates check (
    (starts_at is null or isfinite(starts_at)) and (ends_at is null or isfinite(ends_at))),
  add constraint cycles_snapshot_arrays check (
    jsonb_typeof(initial_tasks) = 'array' and jsonb_typeof(completion_tasks) = 'array');

create table public.cycle_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  cycle_id uuid not null,
  actor_id uuid,
  event_type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (cycle_id, project_id, organization_id)
    references public.cycles(id, project_id, organization_id) on delete cascade
);
create index cycle_events_timeline_idx on public.cycle_events (organization_id, project_id, cycle_id, occurred_at, id);
alter table public.cycle_events enable row level security;
create policy cycle_events_select on public.cycle_events for select to authenticated
  using (public.can_access_project(project_id, organization_id));
revoke all on public.cycle_events from anon, authenticated, service_role;
grant select on public.cycle_events to authenticated, service_role;

create table public.cycle_mutation_receipts (
  organization_id uuid not null,
  project_id uuid not null,
  request_id uuid not null,
  actor_id uuid not null,
  request jsonb not null,
  response jsonb not null,
  primary key (organization_id, request_id),
  foreign key (project_id, organization_id) references public.projects(id, organization_id) on delete cascade
);
alter table public.cycle_mutation_receipts enable row level security;
revoke all on public.cycle_mutation_receipts from anon, authenticated, service_role;

-- Clients cannot forge commitments, timestamps, lifecycle transitions or totals.
revoke insert, update, delete on public.cycles from anon, authenticated, service_role;
drop trigger cycles_set_updated_at on public.cycles;
create trigger cycles_set_updated_at before update on public.cycles
  for each row execute function public.touch_task_version();

create function public.cycle_task_snapshot(target_cycle_id uuid)
returns jsonb language sql volatile security definer set search_path = public, pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'number', t.task_number::text, 'key', p.project_key || '-' || t.task_number::text,
    'title', t.title, 'status', t.status, 'estimate', t.estimate,
    'completed', w.is_terminal and t.status <> 'canceled', 'terminal', w.is_terminal
  ) order by t.task_number, t.id), '[]'::jsonb)
  from public.tasks t join public.projects p on p.id = t.project_id
  join public.project_workflow_statuses w on w.project_id = t.project_id and w.status = t.status
  where t.cycle_id = target_cycle_id and t.archived_at is null;
$$;

create or replace function public.refresh_cycle_totals(target_cycle_id uuid)
returns public.cycles language plpgsql security definer set search_path = public, pg_catalog as $$
declare saved public.cycles; snapshot jsonb;
begin
  select * into saved from public.cycles where id = target_cycle_id for no key update;
  if not found or saved.status in ('completed', 'canceled') then return saved; end if;
  snapshot := public.cycle_task_snapshot(target_cycle_id);
  update public.cycles c set
    committed_points = coalesce((select sum(coalesce((item->>'estimate')::numeric, 0)) from jsonb_array_elements(snapshot) item), 0),
    completed_points = coalesce((select sum(coalesce((item->>'estimate')::numeric, 0)) from jsonb_array_elements(snapshot) item where (item->>'completed')::boolean), 0),
    task_count = jsonb_array_length(snapshot),
    completed_task_count = (select count(*) from jsonb_array_elements(snapshot) item where (item->>'completed')::boolean)
  where c.id = target_cycle_id returning * into saved;
  return saved;
end;
$$;

create or replace function public.prevent_completed_cycle_edit()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if old.status in ('completed', 'canceled') and to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    raise exception using errcode = '55000', message = 'Closed cycle history is immutable';
  end if;
  return new;
end;
$$;

-- Lifecycle locks cycle rows but never task rows. Task writes lock their old/new
-- cycles in UUID order before altering membership. This serializes snapshots
-- against assignments/estimates while keeping lock order consistent.
create or replace function public.prevent_completed_cycle_task_edit()
returns trigger language plpgsql security definer set search_path = public, auth, pg_catalog as $$
declare previous_cycle uuid; next_cycle uuid; saved public.cycles;
begin
  if tg_op <> 'INSERT' then previous_cycle := old.cycle_id; end if;
  if tg_op <> 'DELETE' then next_cycle := new.cycle_id; end if;
  for saved in select * from public.cycles where id in (previous_cycle, next_cycle) order by id for no key update loop
    if saved.id = next_cycle then
      if saved.organization_id <> new.organization_id or saved.project_id <> new.project_id then
        raise exception using errcode = '23503', message = 'Sprint must belong to the task project';
      end if;
      if next_cycle is distinct from previous_cycle and saved.status in ('completed', 'canceled') then
        raise exception using errcode = '55000', message = 'Tasks cannot be added to a closed sprint';
      end if;
      if next_cycle is distinct from previous_cycle and new.archived_at is not null then
        raise exception using errcode = '55000', message = 'Restore an archived task before planning it';
      end if;
    end if;
    if saved.id = previous_cycle and saved.status in ('completed', 'canceled') then
      if tg_op = 'DELETE' then
        if exists (select 1 from public.projects where id = saved.project_id) then
          raise exception using errcode = '55000', message = 'Archive tasks instead of deleting closed sprint history';
        end if;
      elsif previous_cycle is distinct from next_cycle then
        if old.estimate is distinct from new.estimate or old.status is distinct from new.status or old.archived_at is distinct from new.archived_at then
          raise exception using errcode = '55000', message = 'Carry over work before changing its estimate or status';
        end if;
      elsif old.estimate is distinct from new.estimate or old.status is distinct from new.status or old.archived_at is distinct from new.archived_at then
        raise exception using errcode = '55000', message = 'Closed sprint tasks must be carried over before replanning';
      end if;
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger tasks_prevent_completed_cycle_edit on public.tasks;
create trigger tasks_prevent_completed_cycle_edit before insert or update or delete on public.tasks
  for each row execute function public.prevent_completed_cycle_task_edit();

-- One task lifecycle event already contains the cycle_id before/after change.
-- The sprint-specific ledger below adds analytics without duplicating that event.
drop trigger tasks_capture_cycle_event on public.tasks;
drop function public.capture_task_cycle_event();

create or replace function public.sync_cycle_task_totals()
returns trigger language plpgsql security definer set search_path = public, auth, pg_catalog as $$
declare
  previous_task public.tasks; next_task public.tasks; saved public.cycles;
  was_member boolean; is_member boolean; previous_points numeric; next_points numeric;
  event_name text;
begin
  if tg_op <> 'INSERT' then previous_task := old; end if;
  if tg_op <> 'DELETE' then next_task := new; end if;
  for saved in select * from public.cycles where id in (previous_task.cycle_id, next_task.cycle_id) order by id loop
    was_member := coalesce(previous_task.cycle_id = saved.id and previous_task.archived_at is null, false);
    is_member := coalesce(next_task.cycle_id = saved.id and next_task.archived_at is null, false);
    previous_points := case when was_member then coalesce(previous_task.estimate, 0) else 0 end;
    next_points := case when is_member then coalesce(next_task.estimate, 0) else 0 end;
    event_name := case
      when was_member and not is_member and saved.status in ('completed', 'canceled') then 'cycle.task_carried_over'
      when was_member and not is_member then 'cycle.task_removed'
      when not was_member and is_member then 'cycle.task_added'
      when was_member and is_member and previous_task.estimate is distinct from next_task.estimate then 'cycle.estimate_changed'
      when was_member and is_member and previous_task.status is distinct from next_task.status then 'cycle.task_status_changed'
      else null end;
    if event_name is not null then
      insert into public.cycle_events (organization_id, project_id, cycle_id, actor_id, event_type, payload)
      values (saved.organization_id, saved.project_id, saved.id, auth.uid(), event_name, jsonb_build_object(
        'taskId', coalesce(next_task.id, previous_task.id),
        'fromCycleId', previous_task.cycle_id, 'toCycleId', next_task.cycle_id,
        'fromEstimate', previous_task.estimate, 'toEstimate', next_task.estimate,
        'fromStatus', previous_task.status, 'toStatus', next_task.status));
      if saved.status not in ('completed', 'canceled') then
        if saved.started_at is not null then
          update public.cycles set
            added_points = added_points + greatest(next_points - previous_points, 0),
            removed_points = removed_points + greatest(previous_points - next_points, 0),
            added_task_count = added_task_count + case when not was_member and is_member then 1 else 0 end,
            removed_task_count = removed_task_count + case when was_member and not is_member then 1 else 0 end
          where id = saved.id;
        end if;
        perform public.refresh_cycle_totals(saved.id);
      end if;
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger tasks_sync_cycle_totals on public.tasks;
create trigger tasks_sync_cycle_totals after insert or update or delete on public.tasks
  for each row execute function public.sync_cycle_task_totals();

drop function public.manage_cycle(uuid, uuid, text, uuid, text, timestamptz, timestamptz);
create function public.manage_cycle(
  target_organization_id uuid, target_project_id uuid, action text,
  target_cycle_id uuid default null, cycle_name text default null,
  cycle_starts_at timestamptz default null, cycle_ends_at timestamptz default null,
  request_id uuid default null, expected_updated_at timestamptz default null
)
returns public.cycles language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  saved public.cycles; previous_status text; snapshot jsonb; fingerprint jsonb;
  receipt public.cycle_mutation_receipts;
begin
  if auth.uid() is null or not public.can_write_project(target_project_id, target_organization_id) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  -- Serialize lifecycle requests (including receipt replay) in this project.
  perform 1 from public.projects where id = target_project_id and organization_id = target_organization_id
    and archived_at is null for no key update;
  if not found then raise exception using errcode = '55000', message = 'Project is unavailable or archived'; end if;
  if request_id is null or action is null or action not in ('create', 'edit', 'start', 'pause', 'complete', 'cancel')
    or (action = 'create' and target_cycle_id is not null)
    or (action <> 'create' and (target_cycle_id is null or expected_updated_at is null)) then
    raise exception using errcode = '22023', message = 'Invalid sprint request';
  end if;
  if action in ('create', 'edit') and (
    cycle_name is null or length(trim(cycle_name)) not between 1 and 160
    or (cycle_starts_at is not null and not isfinite(cycle_starts_at))
    or (cycle_ends_at is not null and not isfinite(cycle_ends_at))
    or cycle_ends_at < cycle_starts_at) then
    raise exception using errcode = '22023', message = 'Use a sprint name and valid ordered dates';
  end if;
  fingerprint := jsonb_build_object('action', action, 'cycleId', target_cycle_id,
    'name', cycle_name, 'startsAt', cycle_starts_at, 'endsAt', cycle_ends_at, 'expectedUpdatedAt', expected_updated_at);
  select * into receipt from public.cycle_mutation_receipts r
    where r.organization_id = target_organization_id and r.request_id = manage_cycle.request_id;
  if found then
    if receipt.actor_id <> auth.uid() or receipt.project_id <> target_project_id or receipt.request <> fingerprint then
      raise exception using errcode = '23505', message = 'Request ID already used for a different sprint change';
    end if;
    return jsonb_populate_record(null::public.cycles, receipt.response);
  end if;
  if action = 'create' then
    insert into public.cycles (organization_id, project_id, name, starts_at, ends_at)
    values (target_organization_id, target_project_id, trim(cycle_name), cycle_starts_at, cycle_ends_at) returning * into saved;
  else
    select * into saved from public.cycles where id = target_cycle_id
      and organization_id = target_organization_id and project_id = target_project_id for no key update;
    if not found then raise exception using errcode = '42501', message = 'Sprint is unavailable'; end if;
    if saved.updated_at <> expected_updated_at then
      raise exception using errcode = '40001', message = 'Sprint changed. Reload planning before trying again';
    end if;
    if saved.status in ('completed', 'canceled') then
      raise exception using errcode = '55000', message = 'Closed sprint history is immutable';
    end if;
    previous_status := saved.status;
    if action = 'edit' then
      update public.cycles set name = trim(cycle_name), starts_at = cycle_starts_at, ends_at = cycle_ends_at
      where id = saved.id returning * into saved;
    elsif action = 'start' then
      if saved.status not in ('planned', 'paused') then
        raise exception using errcode = '22023', message = 'Only planned or paused sprints can start';
      end if;
      saved := public.refresh_cycle_totals(saved.id);
      snapshot := public.cycle_task_snapshot(saved.id);
      update public.cycles set status = 'active', paused_at = null,
        initial_tasks = case when started_at is null then snapshot else initial_tasks end,
        initial_commitment = case when started_at is null then committed_points else initial_commitment end,
        started_at = coalesce(started_at, clock_timestamp())
      where id = saved.id returning * into saved;
    elsif action = 'pause' then
      if saved.status <> 'active' then raise exception using errcode = '22023', message = 'Only active sprints can pause'; end if;
      update public.cycles set status = 'paused', paused_at = clock_timestamp() where id = saved.id returning * into saved;
    else
      if action = 'complete' and saved.status not in ('active', 'paused') then
        raise exception using errcode = '22023', message = 'Only active or paused sprints can complete';
      end if;
      if action = 'cancel' and saved.status not in ('planned', 'paused') then
        raise exception using errcode = '22023', message = 'Pause an active sprint before canceling it';
      end if;
      saved := public.refresh_cycle_totals(saved.id);
      snapshot := public.cycle_task_snapshot(saved.id);
      update public.cycles set
        status = case when action = 'complete' then 'completed' else 'canceled' end,
        completed_at = case when action = 'complete' then clock_timestamp() end,
        completion_tasks = snapshot,
        carried_over_points = coalesce((select sum(coalesce((item->>'estimate')::numeric, 0)) from jsonb_array_elements(snapshot) item where not (item->>'terminal')::boolean), 0),
        carried_over_task_count = (select count(*) from jsonb_array_elements(snapshot) item where not (item->>'terminal')::boolean)
      where id = saved.id returning * into saved;
    end if;
  end if;
  insert into public.cycle_events (organization_id, project_id, cycle_id, actor_id, event_type, payload)
  values (target_organization_id, target_project_id, saved.id, auth.uid(), 'cycle.' || case
    when action = 'create' then 'created' when action = 'edit' then 'updated'
    when action = 'start' and previous_status = 'paused' then 'resumed'
    when action = 'start' then 'started' when action = 'pause' then 'paused'
    when action = 'complete' then 'completed' else 'canceled' end,
    jsonb_build_object('requestId', request_id, 'fromStatus', previous_status, 'toStatus', saved.status,
      'initialCommitment', saved.initial_commitment, 'points', saved.committed_points, 'completedPoints', saved.completed_points));
  insert into public.cycle_mutation_receipts values
    (target_organization_id, target_project_id, request_id, auth.uid(), fingerprint, to_jsonb(saved));
  return saved;
end;
$$;

-- Initialize live totals for pre-existing planned/active cycles. Legacy closed
-- history is not reconstructed from today's task state.
do $$ declare item record; begin
  for item in select id from public.cycles where status not in ('completed', 'canceled') loop
    perform public.refresh_cycle_totals(item.id);
  end loop;
end $$;

revoke execute on function public.cycle_task_snapshot(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.manage_cycle(uuid, uuid, text, uuid, text, timestamptz, timestamptz, uuid, timestamptz) from public, anon, service_role;
grant execute on function public.manage_cycle(uuid, uuid, text, uuid, text, timestamptz, timestamptz, uuid, timestamptz) to authenticated;

commit;
