begin;

alter table public.projects add column team_id uuid;
alter table public.projects
  add constraint projects_team_organization_fkey
  foreign key (team_id, organization_id)
  references public.teams(id, organization_id)
  on delete set null (team_id);

alter table public.tasks add column team_id uuid;
alter table public.tasks
  add constraint tasks_team_organization_fkey
  foreign key (team_id, organization_id)
  references public.teams(id, organization_id)
  on delete set null (team_id);

alter table public.team_memberships
  add constraint team_memberships_organization_member_fkey
  foreign key (organization_id, user_id)
  references public.organization_memberships(organization_id, user_id)
  on delete cascade;

alter table public.project_memberships
  add constraint project_memberships_organization_member_fkey
  foreign key (organization_id, user_id)
  references public.organization_memberships(organization_id, user_id)
  on delete cascade;

create index projects_team_idx on public.projects (team_id);
create index tasks_team_idx on public.tasks (team_id);

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    and (team_id is null or exists (
      select 1 from public.teams assigned_team
      where assigned_team.id = projects.team_id
        and assigned_team.organization_id = projects.organization_id
    ))
  );

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.can_write_project(id, organization_id))
  with check (
    public.can_write_project(id, organization_id)
    and (team_id is null or exists (
      select 1 from public.teams assigned_team
      where assigned_team.id = projects.team_id
        and assigned_team.organization_id = projects.organization_id
    ))
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    public.can_write_project(project_id, organization_id)
    and (team_id is null or exists (
      select 1 from public.teams assigned_team
      where assigned_team.id = tasks.team_id
        and assigned_team.organization_id = tasks.organization_id
    ))
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.can_write_project(project_id, organization_id))
  with check (
    public.can_write_project(project_id, organization_id)
    and (team_id is null or exists (
      select 1 from public.teams assigned_team
      where assigned_team.id = tasks.team_id
        and assigned_team.organization_id = tasks.organization_id
    ))
  );

create table public.organization_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default timezone('utc', now()) + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index organization_invitations_organization_idx
  on public.organization_invitations (organization_id, status);
create index organization_invitations_email_idx
  on public.organization_invitations (email, status);

alter table public.organization_invitations enable row level security;

create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    or email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy organization_memberships_insert on public.organization_memberships;
create policy organization_memberships_insert on public.organization_memberships
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    and role in ('admin', 'member', 'viewer')
  );

drop policy organization_memberships_update on public.organization_memberships;
create policy organization_memberships_update on public.organization_memberships
  for update to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    and role <> 'owner'
  )
  with check (
    public.has_org_role(organization_id, array['owner', 'admin'])
    and role in ('admin', 'member', 'viewer')
  );

drop policy organization_memberships_delete on public.organization_memberships;
create policy organization_memberships_delete on public.organization_memberships
  for delete to authenticated
  using (
    public.has_org_role(organization_id, array['owner', 'admin'])
    and role <> 'owner'
  );

create trigger organization_invitations_set_updated_at
  before update on public.organization_invitations
  for each row execute function public.set_updated_at();

create or replace function public.create_organization(
  organization_name text,
  organization_slug text
)
returns public.organizations
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  created_organization public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.organizations (name, slug)
  values (trim(organization_name), lower(trim(organization_slug)))
  returning * into created_organization;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (created_organization.id, auth.uid(), 'owner');

  return created_organization;
end;
$$;

create or replace function public.invite_organization_member(
  target_organization_id uuid,
  invitee_email text,
  invitee_role text default 'member'
)
returns table (
  invitation_id uuid,
  email text,
  role text,
  invitation_token text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  normalized_email text := lower(trim(invitee_email));
  raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  created_invitation public.organization_invitations;
begin
  if not public.has_org_role(target_organization_id, array['owner', 'admin']) then
    raise exception 'Organization admin access is required';
  end if;
  if invitee_role not in ('admin', 'member', 'viewer') then
    raise exception 'Unsupported organization role';
  end if;

  insert into public.organization_invitations (
    organization_id,
    email,
    role,
    invited_by,
    token_hash
  )
  values (
    target_organization_id,
    normalized_email,
    invitee_role,
    auth.uid(),
    encode(extensions.digest(raw_token, 'sha256'), 'hex')
  )
  returning * into created_invitation;

  return query select
    created_invitation.id,
    created_invitation.email,
    created_invitation.role,
    raw_token;
end;
$$;

create or replace function public.accept_organization_invitation(invitation_token text)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  invitation public.organization_invitations;
  accepted_membership public.organization_memberships;
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select * into invitation
  from public.organization_invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
    and status = 'pending'
    and expires_at > timezone('utc', now())
  for update;

  if invitation.id is null then
    raise exception 'Invitation is invalid or expired';
  end if;
  if invitation.email <> current_email then
    raise exception 'Invitation email does not match the authenticated user';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (invitation.organization_id, auth.uid(), invitation.role)
  on conflict (organization_id, user_id) do update
  set role = excluded.role,
      updated_at = timezone('utc', now())
  returning * into accepted_membership;

  update public.organization_invitations
  set status = 'accepted',
      accepted_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = invitation.id;

  return accepted_membership;
end;
$$;

create or replace function public.revoke_organization_invitation(
  target_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  invitation_organization_id uuid;
begin
  select organization_id into invitation_organization_id
  from public.organization_invitations
  where id = target_invitation_id;

  if invitation_organization_id is null
    or not public.has_org_role(invitation_organization_id, array['owner', 'admin']) then
    raise exception 'Organization admin access is required';
  end if;

  update public.organization_invitations
  set status = 'revoked',
      updated_at = timezone('utc', now())
  where id = target_invitation_id
    and status = 'pending';
end;
$$;

revoke execute on function public.create_organization(text, text) from public;
revoke execute on function public.invite_organization_member(uuid, text, text) from public;
revoke execute on function public.accept_organization_invitation(text) from public;
revoke execute on function public.revoke_organization_invitation(uuid) from public;
grant execute on function public.create_organization(text, text) to authenticated, service_role;
grant execute on function public.invite_organization_member(uuid, text, text) to authenticated, service_role;
grant execute on function public.accept_organization_invitation(text) to authenticated, service_role;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated, service_role;

commit;
