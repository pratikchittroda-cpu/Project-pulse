begin;

alter table public.organization_invitations
  alter column email drop not null;

alter table public.organization_invitations
  drop constraint if exists organization_invitations_email_check;

alter table public.organization_invitations
  add constraint organization_invitations_email_check check (
    email is null
    or (
      email = lower(trim(email))
      and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    )
  );

drop function if exists public.invite_organization_member(uuid, text, text);

create or replace function public.invite_organization_member(
  target_organization_id uuid,
  invitee_role text default 'member'
)
returns table (
  invitation_id uuid,
  role text,
  invitation_code text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  raw_code text := 'PP-' || upper(encode(extensions.gen_random_bytes(9), 'hex'));
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
    null,
    invitee_role,
    auth.uid(),
    encode(extensions.digest(raw_code, 'sha256'), 'hex')
  )
  returning * into created_invitation;

  return query select
    created_invitation.id,
    created_invitation.role,
    raw_code;
end;
$$;

drop function if exists public.accept_organization_invitation(text);

create or replace function public.accept_organization_invitation(invitation_code text)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  normalized_code text := upper(trim(invitation_code));
  invitation public.organization_invitations;
  accepted_membership public.organization_memberships;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select * into invitation
  from public.organization_invitations
  where token_hash = encode(extensions.digest(normalized_code, 'sha256'), 'hex')
    and status = 'pending'
    and expires_at > timezone('utc', now())
  for update;

  if invitation.id is null then
    raise exception 'Invitation code is invalid or expired';
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

revoke execute on function public.invite_organization_member(uuid, text) from public;
revoke execute on function public.accept_organization_invitation(text) from public;
grant execute on function public.invite_organization_member(uuid, text) to authenticated, service_role;
grant execute on function public.accept_organization_invitation(text) to authenticated, service_role;

commit;
