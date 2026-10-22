begin;

alter table public.task_relations
  add column blocker_explanation text,
  add column blocker_target_date date,
  add constraint task_relations_explanation_check check (
    blocker_explanation is null or char_length(btrim(blocker_explanation)) between 1 and 2000
  ),
  add constraint task_relations_finite_target_date_check check (
    blocker_target_date is null or isfinite(blocker_target_date)
  );

create index task_relations_project_blocker_idx
  on public.task_relations (organization_id, project_id, task_id, created_at desc)
  where relation_type = 'blocks';
create index task_relations_project_blocked_idx
  on public.task_relations (organization_id, project_id, related_task_id, created_at desc)
  where relation_type = 'blocks';

create table public.task_relation_mutation_receipts (
  organization_id uuid not null,
  project_id uuid not null,
  request_id uuid not null,
  actor_id uuid,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, request_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);
alter table public.task_relation_mutation_receipts enable row level security;
revoke all on public.task_relation_mutation_receipts from anon, authenticated, service_role;

-- Relation changes go through the RPC so graph validation and receipts cannot be
-- bypassed by a client. Reads continue to use the existing project RLS policy.
revoke insert, update, delete on public.task_relations from anon, authenticated, service_role;
grant select on public.task_relations to authenticated, service_role;

create function public.manage_task_relation(
  target_organization_id uuid,
  target_project_id uuid,
  action text,
  request_id uuid,
  relation_id uuid default null,
  blocker_task_id uuid default null,
  blocked_task_id uuid default null,
  blocker_explanation text default null,
  blocker_target_date date default null
)
returns public.task_relations
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  receipt public.task_relation_mutation_receipts;
  saved public.task_relations;
  fingerprint jsonb;
  event_payload jsonb;
  event_source text := case when service_call then 'system' else 'internal' end;
begin
  if not service_call and (
    auth.uid() is null or
    not public.can_write_project(target_project_id, target_organization_id)
  ) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  if not exists (
    select 1 from public.projects p
    where p.id = target_project_id
      and p.organization_id = target_organization_id
      and p.archived_at is null
  ) then
    raise exception using errcode = '55000', message = 'Project is unavailable or archived';
  end if;
  if request_id is null or action not in ('create', 'delete') then
    raise exception using errcode = '22023', message = 'Invalid dependency request';
  end if;
  if action = 'create' and (
    relation_id is not null or blocker_task_id is null or blocked_task_id is null
    or blocker_task_id = blocked_task_id
    or nullif(btrim(blocker_explanation), '') is null
    or char_length(btrim(blocker_explanation)) > 2000
    or (blocker_target_date is not null and not isfinite(blocker_target_date))
  ) then
    raise exception using errcode = '22023', message = 'A dependency needs two different tasks and an explanation';
  end if;
  if action = 'delete' and (relation_id is null or blocker_task_id is not null or blocked_task_id is not null) then
    raise exception using errcode = '22023', message = 'Invalid dependency deletion request';
  end if;

  fingerprint := jsonb_build_object(
    'action', action,
    'relationId', relation_id,
    'blockerTaskId', blocker_task_id,
    'blockedTaskId', blocked_task_id,
    'explanation', nullif(btrim(blocker_explanation), ''),
    'targetDate', blocker_target_date
  );
  select * into receipt
  from public.task_relation_mutation_receipts r
  where r.organization_id = target_organization_id
    and r.request_id = manage_task_relation.request_id;
  if found then
    if receipt.project_id is distinct from target_project_id
      or receipt.actor_id is distinct from auth.uid()
      or receipt.request is distinct from fingerprint then
      raise exception using errcode = '23505', message = 'Request ID already used for a different dependency change';
    end if;
    return jsonb_populate_record(null::public.task_relations, receipt.response);
  end if;

  -- Serialize graph changes per project so concurrent edges cannot bypass the
  -- cycle check through a race.
  perform pg_advisory_xact_lock(hashtextextended(target_project_id::text, 0));

  if action = 'create' then
    if not exists (
      select 1 from public.tasks t
      where t.id = blocker_task_id
        and t.project_id = target_project_id
        and t.organization_id = target_organization_id
        and t.archived_at is null
    ) or not exists (
      select 1 from public.tasks t
      where t.id = blocked_task_id
        and t.project_id = target_project_id
        and t.organization_id = target_organization_id
        and t.archived_at is null
    ) then
      raise exception using errcode = '42501', message = 'Both dependency tasks must belong to this active project';
    end if;
    if exists (
      select 1 from public.task_relations r
      where r.organization_id = target_organization_id
        and r.project_id = target_project_id
        and r.task_id = blocker_task_id
        and r.related_task_id = blocked_task_id
        and r.relation_type = 'blocks'
    ) then
      raise exception using errcode = '23505', message = 'That dependency already exists';
    end if;
    if exists (
      with recursive reachable(task_id) as (
        select r.related_task_id
        from public.task_relations r
        where r.organization_id = target_organization_id
          and r.project_id = target_project_id
          and r.task_id = blocked_task_id
          and r.relation_type = 'blocks'
        union
        select r.related_task_id
        from public.task_relations r
        join reachable next_task on next_task.task_id = r.task_id
        where r.organization_id = target_organization_id
          and r.project_id = target_project_id
          and r.relation_type = 'blocks'
      )
      select 1 from reachable where task_id = blocker_task_id
    ) then
      raise exception using errcode = '22023', message = 'That dependency would create a cycle';
    end if;
    insert into public.task_relations (
      organization_id, project_id, task_id, related_task_id, relation_type,
      blocker_explanation, blocker_target_date
    ) values (
      target_organization_id, target_project_id, blocker_task_id, blocked_task_id, 'blocks',
      btrim(blocker_explanation), blocker_target_date
    ) returning * into saved;
    event_payload := jsonb_build_object(
      'version', 1, 'relationId', saved.id, 'relationType', saved.relation_type,
      'blockerTaskId', saved.task_id, 'blockedTaskId', saved.related_task_id,
      'explanation', saved.blocker_explanation, 'targetDate', saved.blocker_target_date,
      'action', 'created'
    );
  else
    select * into saved
    from public.task_relations r
    where r.id = relation_id
      and r.organization_id = target_organization_id
      and r.project_id = target_project_id
    for update;
    if not found then
      raise exception using errcode = '42501', message = 'Dependency is unavailable';
    end if;
    delete from public.task_relations where id = saved.id;
    event_payload := jsonb_build_object(
      'version', 1, 'relationId', saved.id, 'relationType', saved.relation_type,
      'blockerTaskId', saved.task_id, 'blockedTaskId', saved.related_task_id,
      'explanation', saved.blocker_explanation, 'targetDate', saved.blocker_target_date,
      'action', 'removed'
    );
  end if;

  insert into public.task_events (
    organization_id, project_id, task_id, event_type, source, entity_type, entity_id,
    idempotency_key, actor_id, payload, occurred_at
  ) values (
    target_organization_id, target_project_id, saved.task_id, 'task.dependency_changed',
    event_source, 'task_relation', saved.id, 'task-relation:' || request_id::text || ':blocker',
    auth.uid(), event_payload, clock_timestamp()
  );
  insert into public.task_events (
    organization_id, project_id, task_id, event_type, source, entity_type, entity_id,
    idempotency_key, actor_id, payload, occurred_at
  ) values (
    target_organization_id, target_project_id, saved.related_task_id, 'task.dependency_changed',
    event_source, 'task_relation', saved.id, 'task-relation:' || request_id::text || ':blocked',
    auth.uid(), event_payload, clock_timestamp()
  );
  insert into public.task_relation_mutation_receipts (
    organization_id, project_id, request_id, actor_id, request, response
  ) values (
    target_organization_id, target_project_id, request_id, auth.uid(), fingerprint, to_jsonb(saved)
  );
  return saved;
end;
$$;

revoke execute on function public.manage_task_relation(uuid, uuid, text, uuid, uuid, uuid, uuid, text, date)
  from public, anon, service_role;
grant execute on function public.manage_task_relation(uuid, uuid, text, uuid, uuid, uuid, uuid, text, date)
  to authenticated;

commit;
