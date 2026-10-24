begin;

update public.organization_invitations
set status = 'revoked',
    updated_at = timezone('utc', now())
where status = 'pending'
  and email is not null;

commit;
