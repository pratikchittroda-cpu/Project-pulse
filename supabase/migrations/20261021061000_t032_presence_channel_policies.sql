begin;

-- Presence is ephemeral, but private channels still need an explicit Realtime
-- authorization boundary. The topic embeds only UUID scope identifiers; no
-- task, branch, or file content is used for authorization.
create or replace function public.can_access_presence_topic(target_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  target_organization_id uuid;
  target_project_id uuid;
begin
  if target_topic is null
    or target_topic !~ '^projectpulse:presence:[0-9a-fA-F-]{36}:[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  target_organization_id := split_part(target_topic, ':', 3)::uuid;
  target_project_id := split_part(target_topic, ':', 4)::uuid;
  return public.can_access_project(
    target_project_id,
    target_organization_id
  );
exception when invalid_text_representation then
  return false;
end;
$$;

revoke execute on function public.can_access_presence_topic(text)
  from public, anon;
grant execute on function public.can_access_presence_topic(text)
  to authenticated, service_role;

create policy projectpulse_presence_read
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'presence'
    and public.can_access_presence_topic(realtime.topic())
  );

create policy projectpulse_presence_write
  on realtime.messages
  for insert
  to authenticated
  with check (
    extension = 'presence'
    and public.can_access_presence_topic(realtime.topic())
  );

commit;
