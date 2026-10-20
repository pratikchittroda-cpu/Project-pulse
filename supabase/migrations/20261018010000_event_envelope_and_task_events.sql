begin;

alter table public.task_events
  add column source text,
  add column entity_type text,
  add column entity_id uuid,
  add column idempotency_key text,
  add column correlation_id text;

update public.task_events
set source = 'internal',
    entity_type = 'task',
    entity_id = task_id,
    idempotency_key = 'legacy-' || id::text
where source is null
   or entity_type is null
   or entity_id is null
   or idempotency_key is null;

alter table public.task_events
  alter column source set default 'internal',
  alter column source set not null,
  alter column entity_type set default 'task',
  alter column entity_type set not null,
  alter column entity_id set not null,
  alter column idempotency_key set not null;

alter table public.task_events
  add constraint task_events_source_check
    check (source ~ '^[a-z][a-z0-9_.-]{0,39}$'),
  add constraint task_events_entity_type_check
    check (entity_type ~ '^[a-z][a-z0-9_.-]{0,39}$'),
  add constraint task_events_entity_matches_task_check
    check (entity_type = 'task' and entity_id = task_id),
  add constraint task_events_idempotency_key_check
    check (char_length(trim(idempotency_key)) between 1 and 200),
  add constraint task_events_correlation_id_check
    check (correlation_id is null or char_length(trim(correlation_id)) between 1 and 200);

alter table public.task_events
  add constraint task_events_organization_idempotency_key_unique
  unique (organization_id, idempotency_key);

create index task_events_task_occurred_idx
  on public.task_events (task_id, occurred_at asc, created_at asc);
create index task_events_correlation_idx
  on public.task_events (organization_id, correlation_id)
  where correlation_id is not null;

create or replace function public.validate_task_event_actor()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.role() = 'authenticated' then
    if new.actor_id is null then
      new.actor_id := auth.uid();
    elsif new.actor_id is distinct from auth.uid() then
      raise exception using
        errcode = '42501',
        message = 'Authenticated task events must use the current actor';
    end if;
    if new.source not in ('internal', 'extension') then
      raise exception using
        errcode = '42501',
        message = 'Authenticated clients cannot impersonate provider event sources';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_task_event_actor() from public, anon, authenticated, service_role;

create trigger task_events_validate_actor
  before insert on public.task_events
  for each row execute function public.validate_task_event_actor();

create or replace function public.record_task_event(
  target_organization_id uuid,
  target_project_id uuid,
  target_task_id uuid,
  target_event_type text,
  target_source text,
  target_idempotency_key text,
  target_payload jsonb default '{}'::jsonb,
  target_occurred_at timestamptz default timezone('utc', now()),
  target_correlation_id text default null,
  target_actor_id uuid default null
)
returns public.task_events
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  saved_event public.task_events;
begin
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if auth.uid() is not null and not exists (
    select 1
    from public.organization_memberships organization_member
    where organization_member.organization_id = target_organization_id
      and organization_member.user_id = auth.uid()
      and (
        organization_member.role in ('owner', 'admin')
        or exists (
          select 1 from public.project_memberships project_member
          where project_member.organization_id = target_organization_id
            and project_member.project_id = target_project_id
            and project_member.user_id = auth.uid()
            and project_member.role in ('admin', 'member')
        )
      )
  ) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  if target_event_type !~ '^[a-z0-9]+(?:[._][a-z0-9]+)+$' then
    raise exception using errcode = '22023', message = 'Event type must be lower-case dot-separated text';
  end if;
  if target_source !~ '^[a-z][a-z0-9_.-]{0,39}$' then
    raise exception using errcode = '22023', message = 'Event source is invalid';
  end if;
  if auth.uid() is not null and target_source not in ('internal', 'extension') then
    raise exception using errcode = '42501', message = 'Authenticated clients cannot impersonate provider event sources';
  end if;
  if target_idempotency_key is null or char_length(trim(target_idempotency_key)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Event idempotency key is required';
  end if;
  if not exists (
    select 1
    from public.tasks task
    where task.id = target_task_id
      and task.project_id = target_project_id
      and task.organization_id = target_organization_id
  ) then
    raise exception using errcode = '23503', message = 'Task does not belong to the requested project';
  end if;

  insert into public.task_events (
    organization_id,
    project_id,
    task_id,
    event_type,
    source,
    entity_type,
    entity_id,
    idempotency_key,
    correlation_id,
    actor_id,
    payload,
    occurred_at
  )
  values (
    target_organization_id,
    target_project_id,
    target_task_id,
    target_event_type,
    target_source,
    'task',
    target_task_id,
    trim(target_idempotency_key),
    nullif(trim(target_correlation_id), ''),
    target_actor_id,
    coalesce(target_payload, '{}'::jsonb),
    target_occurred_at
  )
  on conflict (organization_id, idempotency_key) do update
    set id = public.task_events.id
  returning * into saved_event;

  return saved_event;
end;
$$;

revoke execute on function public.record_task_event(uuid, uuid, uuid, text, text, text, jsonb, timestamptz, text, uuid) from public;
grant execute on function public.record_task_event(uuid, uuid, uuid, text, text, text, jsonb, timestamptz, text, uuid) to authenticated, service_role;

drop policy task_events_insert on public.task_events;
create policy task_events_insert on public.task_events
  for insert to authenticated
  with check (
    public.can_write_project(project_id, organization_id)
    and actor_id = auth.uid()
  );

commit;
