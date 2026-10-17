begin;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = target_organization_id
        and membership.user_id = auth.uid()
    );
$$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = target_organization_id
        and membership.user_id = auth.uid()
        and membership.role = any (allowed_roles)
    );
$$;

create or replace function public.can_access_project(
  target_project_id uuid,
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_org_role(target_organization_id, array['owner', 'admin'])
    or exists (
      select 1
      from public.project_memberships membership
      where membership.project_id = target_project_id
        and membership.organization_id = target_organization_id
        and membership.user_id = auth.uid()
    );
$$;

create or replace function public.can_write_project(
  target_project_id uuid,
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_org_role(target_organization_id, array['owner', 'admin'])
    or exists (
      select 1
      from public.project_memberships membership
      where membership.project_id = target_project_id
        and membership.organization_id = target_organization_id
        and membership.user_id = auth.uid()
        and membership.role in ('admin', 'member')
    );
$$;

revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.has_org_role(uuid, text[]) from public;
revoke execute on function public.can_access_project(uuid, uuid) from public;
revoke execute on function public.can_write_project(uuid, uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.can_access_project(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_write_project(uuid, uuid) to authenticated, service_role;

create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner', 'admin']))
  with check (public.has_org_role(id, array['owner', 'admin']));
create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.has_org_role(id, array['owner']));

create policy organization_memberships_select on public.organization_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy organization_memberships_insert on public.organization_memberships
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy organization_memberships_update on public.organization_memberships
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy organization_memberships_delete on public.organization_memberships
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

create policy teams_select on public.teams
  for select to authenticated
  using (public.is_org_member(organization_id));
create policy teams_insert on public.teams
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy teams_update on public.teams
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy teams_delete on public.teams
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

create policy team_memberships_select on public.team_memberships
  for select to authenticated
  using (public.is_org_member(organization_id));
create policy team_memberships_insert on public.team_memberships
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy team_memberships_delete on public.team_memberships
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

create policy projects_select on public.projects
  for select to authenticated
  using (public.can_access_project(id, organization_id));
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy projects_update on public.projects
  for update to authenticated
  using (public.can_write_project(id, organization_id))
  with check (public.can_write_project(id, organization_id));
create policy projects_delete on public.projects
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

create policy project_memberships_select on public.project_memberships
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy project_memberships_insert on public.project_memberships
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy project_memberships_update on public.project_memberships
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy project_memberships_delete on public.project_memberships
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

create policy repositories_select on public.repositories
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy repositories_insert on public.repositories
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));
create policy repositories_update on public.repositories
  for update to authenticated
  using (public.can_write_project(project_id, organization_id))
  with check (public.can_write_project(project_id, organization_id));
create policy repositories_delete on public.repositories
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id));

create policy integrations_select on public.integrations
  for select to authenticated
  using (public.is_org_member(organization_id));
create policy integrations_insert on public.integrations
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy integrations_update on public.integrations
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy integrations_delete on public.integrations
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

create policy cycles_select on public.cycles
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy cycles_insert on public.cycles
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));
create policy cycles_update on public.cycles
  for update to authenticated
  using (public.can_write_project(project_id, organization_id))
  with check (public.can_write_project(project_id, organization_id));
create policy cycles_delete on public.cycles
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id));

create policy initiatives_select on public.initiatives
  for select to authenticated
  using (public.is_org_member(organization_id));
create policy initiatives_insert on public.initiatives
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy initiatives_update on public.initiatives
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy initiatives_delete on public.initiatives
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

create policy epics_select on public.epics
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy epics_insert on public.epics
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));
create policy epics_update on public.epics
  for update to authenticated
  using (public.can_write_project(project_id, organization_id))
  with check (public.can_write_project(project_id, organization_id));
create policy epics_delete on public.epics
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id));

create policy milestones_select on public.milestones
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy milestones_insert on public.milestones
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));
create policy milestones_update on public.milestones
  for update to authenticated
  using (public.can_write_project(project_id, organization_id))
  with check (public.can_write_project(project_id, organization_id));
create policy milestones_delete on public.milestones
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id));

create policy tasks_select on public.tasks
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.can_write_project(project_id, organization_id))
  with check (public.can_write_project(project_id, organization_id));
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id));

create policy task_relations_select on public.task_relations
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy task_relations_insert on public.task_relations
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));
create policy task_relations_delete on public.task_relations
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id));

create policy task_events_select on public.task_events
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy task_events_insert on public.task_events
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));

create policy comments_select on public.comments
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy comments_insert on public.comments
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));
create policy comments_update on public.comments
  for update to authenticated
  using (public.can_write_project(project_id, organization_id) and author_id = auth.uid())
  with check (public.can_write_project(project_id, organization_id) and author_id = auth.uid());
create policy comments_delete on public.comments
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id) and author_id = auth.uid());

create policy attachments_select on public.attachments
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id) and uploaded_by = auth.uid());
create policy attachments_delete on public.attachments
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id) and uploaded_by = auth.uid());

-- Webhook deliveries and audit records are intentionally service-role-only.
-- They have RLS enabled from T011 and no authenticated/anon policies.

commit;
