begin;

create index if not exists task_events_project_occurred_scope_idx
  on public.task_events (organization_id, project_id, occurred_at desc);

create or replace function public.get_workspace_bootstrap(
  preferred_organization_id uuid default null,
  preferred_project_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, auth, extensions
as $$
declare
  bootstrap_organization_id uuid;
  bootstrap_project_id uuid;
  dashboard jsonb;
  organizations jsonb;
  projects jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select membership.organization_id
  into bootstrap_organization_id
  from public.organization_memberships membership
  where membership.user_id = auth.uid()
    and membership.organization_id = preferred_organization_id
  limit 1;

  if bootstrap_organization_id is null then
    select membership.organization_id
    into bootstrap_organization_id
    from public.organization_memberships membership
    where membership.user_id = auth.uid()
    order by membership.created_at, membership.organization_id
    limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', organization.id,
        'name', organization.name,
        'role', membership.role,
        'slug', organization.slug
      )
      order by membership.created_at, organization.id
    ),
    '[]'::jsonb
  )
  into organizations
  from public.organization_memberships membership
  join public.organizations organization
    on organization.id = membership.organization_id
  where membership.user_id = auth.uid();

  if bootstrap_organization_id is null then
    return jsonb_build_object(
      'dashboard', null,
      'organizations', organizations,
      'projects', '[]'::jsonb,
      'selected_organization_id', null,
      'selected_project_id', null
    );
  end if;

  select project.id
  into bootstrap_project_id
  from public.projects project
  where project.organization_id = bootstrap_organization_id
  order by
    case when project.id = preferred_project_id then 0 else 1 end,
    case when project.archived_at is null then 0 else 1 end,
    project.name,
    project.id
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'archived_at', project.archived_at,
        'description', project.description,
        'id', project.id,
        'name', project.name,
        'project_key', project.project_key,
        'team_id', project.team_id
      )
      order by project.name, project.id
    ),
    '[]'::jsonb
  )
  into projects
  from public.projects project
  where project.organization_id = bootstrap_organization_id;

  if bootstrap_project_id is not null then
    select to_jsonb(snapshot)
    into dashboard
    from public.get_project_dashboard_snapshot(
      bootstrap_organization_id,
      bootstrap_project_id
    ) snapshot;
  end if;

  return jsonb_build_object(
    'dashboard', dashboard,
    'organizations', organizations,
    'projects', projects,
    'selected_organization_id', bootstrap_organization_id,
    'selected_project_id', bootstrap_project_id
  );
end;
$$;

revoke execute on function public.get_workspace_bootstrap(uuid, uuid) from public;
grant execute on function public.get_workspace_bootstrap(uuid, uuid)
  to authenticated, service_role;

commit;
