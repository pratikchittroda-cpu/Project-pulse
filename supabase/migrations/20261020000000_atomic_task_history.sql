begin;

-- Request receipts are private to the RPC. They commit/roll back with the task
-- and its history, including when two copies of a request arrive concurrently.
create table public.task_mutation_receipts (
  organization_id uuid not null,
  project_id uuid not null,
  request_id uuid not null,
  actor_id uuid,
  request jsonb not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, request_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);
alter table public.task_mutation_receipts enable row level security;
revoke all on public.task_mutation_receipts from anon, authenticated;

create index task_events_timeline_idx
  on public.task_events (organization_id, project_id, task_id, occurred_at, created_at, id);

create function public.touch_task_version()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
drop trigger tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.touch_task_version();

create function public.capture_task_history()
returns trigger language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  previous jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  current_task jsonb := to_jsonb(new);
  changes jsonb;
  context jsonb := coalesce(nullif(current_setting('projectpulse.task_change', true), '')::jsonb, '{}'::jsonb);
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  event_source text;
  event_name text;
begin
  select coalesce(jsonb_object_agg(field, jsonb_build_object('from', previous -> field, 'to', current_task -> field)), '{}')
  into changes
  from unnest(array['title', 'description', 'status', 'priority', 'assignee_id', 'labels',
    'estimate', 'due_date', 'archived_at', 'cycle_id', 'team_id', 'epic_id', 'milestone_id']) as fields(field)
  where (previous -> field) is distinct from (current_task -> field);

  if tg_op = 'UPDATE' and changes = '{}'::jsonb then return new; end if;
  event_name := case
    when tg_op = 'INSERT' then 'task.created'
    when changes ? 'archived_at' and new.archived_at is not null then 'task.archived'
    when changes ? 'archived_at' then 'task.restored'
    when changes ? 'status' then 'task.status_changed'
    else 'task.updated' end;
  event_source := case when service_call then coalesce(context ->> 'source', 'system')
    when auth.uid() is not null then 'internal' else 'system' end;

  insert into public.task_events (organization_id, project_id, task_id, event_type,
    source, entity_type, entity_id, idempotency_key, correlation_id, actor_id, payload, occurred_at)
  values (new.organization_id, new.project_id, new.id, event_name, event_source, 'task', new.id,
    'task-change:' || coalesce(context ->> 'requestId', extensions.gen_random_uuid()::text),
    context ->> 'correlationId', auth.uid(), jsonb_build_object(
      'version', 1, 'changes', changes,
      'mode', case when event_source = 'internal' then 'manual' else 'automated' end,
      'reason', coalesce(context ->> 'reason', case when auth.uid() is null then 'Direct database change' end)
    ), clock_timestamp());
  return new;
end;
$$;
create trigger tasks_capture_history after insert or update on public.tasks
  for each row execute function public.capture_task_history();
revoke execute on function public.touch_task_version() from public, anon, authenticated, service_role;
revoke execute on function public.capture_task_history() from public, anon, authenticated, service_role;

create function public.mutate_task(
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
    where key <> all(array['title','description','status','priority','assignee_id','labels','estimate','due_date']))
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
      assignee_id, labels, estimate, due_date, created_by)
    values (target_organization_id, target_project_id, proposed.title, proposed.description,
      proposed.status, proposed.priority, proposed.assignee_id, proposed.labels, proposed.estimate,
      proposed.due_date, auth.uid()) returning * into saved;
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
        labels = proposed.labels, estimate = proposed.estimate, due_date = proposed.due_date
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
revoke execute on function public.mutate_task(uuid, uuid, uuid, text, uuid, jsonb, timestamptz, text, text, text) from public, anon;
grant execute on function public.mutate_task(uuid, uuid, uuid, text, uuid, jsonb, timestamptz, text, text, text) to authenticated, service_role;

-- Replays must never return an event from another project or another actor.
-- Replace the earlier RPC without modifying the already-applied T030 migration.
create or replace function public.record_task_event(
  target_organization_id uuid, target_project_id uuid, target_task_id uuid,
  target_event_type text, target_source text, target_idempotency_key text,
  target_payload jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default timezone('utc', now()),
  target_correlation_id text default null, target_actor_id uuid default null
)
returns public.task_events
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  event_actor uuid := target_actor_id;
  saved_event public.task_events;
begin
  if not service_call then
    if auth.uid() is null or not public.is_org_member(target_organization_id)
      or not public.can_write_project(target_project_id, target_organization_id) then
      raise exception using errcode = '42501', message = 'Project write access is required';
    end if;
    if target_source not in ('internal', 'extension') or
      (target_actor_id is not null and target_actor_id <> auth.uid()) then
      raise exception using errcode = '42501', message = 'Event actor or source cannot be impersonated';
    end if;
    event_actor := auth.uid();
  end if;
  if target_event_type is null or target_event_type !~ '^[a-z0-9]+(?:[._][a-z0-9]+)+$'
    or target_source is null or target_source !~ '^[a-z][a-z0-9_.-]{0,39}$'
    or target_event_type like 'presence.%'
    or target_payload is null or jsonb_typeof(target_payload) <> 'object'
    or target_occurred_at is null or not isfinite(target_occurred_at)
    or target_idempotency_key is null or length(trim(target_idempotency_key)) not between 1 and 200
    or target_idempotency_key like 'task-change:%' then
    raise exception using errcode = '22023', message = 'Invalid durable task event';
  end if;
  if not exists (select 1 from public.tasks t where t.id = target_task_id
    and t.project_id = target_project_id and t.organization_id = target_organization_id) then
    raise exception using errcode = '23503', message = 'Task does not belong to the requested project';
  end if;
  insert into public.task_events (organization_id, project_id, task_id, event_type, source,
    entity_type, entity_id, idempotency_key, correlation_id, actor_id, payload, occurred_at)
  values (target_organization_id, target_project_id, target_task_id, target_event_type, target_source,
    'task', target_task_id, trim(target_idempotency_key), target_correlation_id, event_actor, target_payload, target_occurred_at)
  on conflict on constraint task_events_organization_idempotency_key_unique do nothing returning * into saved_event;
  if not found then
    select * into saved_event from public.task_events e
    where e.organization_id = target_organization_id and e.idempotency_key = trim(target_idempotency_key);
    if saved_event.project_id is distinct from target_project_id or saved_event.task_id is distinct from target_task_id
      or saved_event.actor_id is distinct from event_actor or saved_event.event_type is distinct from target_event_type
      or saved_event.source is distinct from target_source or saved_event.payload is distinct from target_payload
      or saved_event.correlation_id is distinct from target_correlation_id then
      raise exception using errcode = '23505', message = 'Event key already used for different content';
    end if;
  end if;
  return saved_event;
end;
$$;

-- Use the validated RPC for explicit events; lifecycle events are trigger-owned.
drop policy task_events_insert on public.task_events;
revoke insert, update, delete on public.task_events from authenticated, anon;

commit;
