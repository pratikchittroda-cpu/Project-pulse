begin;

create index if not exists organization_memberships_organization_created_idx
  on public.organization_memberships (organization_id, created_at);
create index if not exists team_memberships_organization_idx
  on public.team_memberships (organization_id);
create index if not exists projects_organization_name_idx
  on public.projects (organization_id, name);
create index if not exists tasks_organization_task_number_idx
  on public.tasks (organization_id, task_number);
create index if not exists tasks_project_active_updated_idx
  on public.tasks (organization_id, project_id, updated_at desc)
  where archived_at is null;

create or replace function public.get_organization_overview(
  target_organization_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, auth, extensions
as $$
declare
  overview jsonb;
begin
  if not public.is_org_member(target_organization_id) then
    raise exception 'Organization access is required';
  end if;

  select jsonb_build_object(
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', team.id,
          'name', team.name,
          'team_key', team.team_key
        )
        order by team.name
      )
      from public.teams team
      where team.organization_id = target_organization_id
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', membership.id,
          'role', membership.role,
          'user_id', membership.user_id
        )
        order by membership.created_at
      )
      from public.organization_memberships membership
      where membership.organization_id = target_organization_id
    ), '[]'::jsonb),
    'team_memberships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'team_id', membership.team_id,
          'user_id', membership.user_id
        )
      )
      from public.team_memberships membership
      where membership.organization_id = target_organization_id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', project.id,
          'name', project.name,
          'project_key', project.project_key,
          'team_id', project.team_id
        )
        order by project.name
      )
      from public.projects project
      where project.organization_id = target_organization_id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', task.id,
          'title', task.title,
          'task_number', task.task_number,
          'team_id', task.team_id
        )
        order by task.task_number
      )
      from public.tasks task
      where task.organization_id = target_organization_id
    ), '[]'::jsonb)
  ) into overview;

  return overview;
end;
$$;

create or replace function public.get_project_dashboard_snapshot(
  target_organization_id uuid,
  target_project_id uuid
)
returns table (
  active_task_count bigint,
  completed_task_count bigint,
  in_review_task_count bigint,
  total_task_count bigint,
  tasks jsonb,
  events jsonb
)
language plpgsql
stable
security invoker
set search_path = public, auth, extensions
as $$
begin
  if not public.can_access_project(target_project_id, target_organization_id) then
    raise exception 'Project access is required';
  end if;

  return query
  with scoped_tasks as (
    select task.id, task.status, task.task_number, task.title
    from public.tasks task
    where task.organization_id = target_organization_id
      and task.project_id = target_project_id
      and task.archived_at is null
  ),
  recent_events as (
    select event.task_id, event.event_type, event.occurred_at
    from public.task_events event
    where event.organization_id = target_organization_id
      and event.project_id = target_project_id
    order by event.occurred_at desc
    limit 5
  ),
  recent_tasks as (
    select distinct on (task.id)
      task.id,
      task.status,
      task.task_number,
      task.title
    from scoped_tasks task
    join recent_events event on event.task_id = task.id
    order by task.id
  )
  select
    count(*) filter (
      where scoped_task.status <> 'completed'
        and scoped_task.status <> 'canceled'
    ),
    count(*) filter (where scoped_task.status = 'completed'),
    count(*) filter (where scoped_task.status = 'in_review'),
    count(*),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', recent_task.id,
          'status', recent_task.status,
          'task_number', recent_task.task_number,
          'title', recent_task.title
        )
        order by recent_task.task_number
      )
      from recent_tasks recent_task
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'task_id', recent_event.task_id,
          'event_type', recent_event.event_type,
          'occurred_at', recent_event.occurred_at
        )
        order by recent_event.occurred_at desc
      )
      from recent_events recent_event
    ), '[]'::jsonb)
  from scoped_tasks scoped_task;
end;
$$;

revoke execute on function public.get_organization_overview(uuid) from public;
revoke execute on function public.get_project_dashboard_snapshot(uuid, uuid) from public;
grant execute on function public.get_organization_overview(uuid) to authenticated, service_role;
grant execute on function public.get_project_dashboard_snapshot(uuid, uuid) to authenticated, service_role;

commit;
