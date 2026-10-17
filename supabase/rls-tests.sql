-- Run after `corepack pnpm run supabase:reset` with:
--   docker exec supabase_db_projectpulse psql -U postgres -d postgres -f /path/to/this/file
-- The application test runner uses the same assertions through psql.

begin;

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  member_id uuid := '00000000-0000-0000-0000-000000000002';
  viewer_id uuid := '00000000-0000-0000-0000-000000000003';
  other_id uuid := '00000000-0000-0000-0000-000000000004';
  organization_id uuid := '10000000-0000-0000-0000-000000000001';
  other_organization_id uuid := '10000000-0000-0000-0000-000000000002';
  project_id uuid := '20000000-0000-0000-0000-000000000001';
  other_project_id uuid := '20000000-0000-0000-0000-000000000002';
  task_id uuid := '30000000-0000-0000-0000-000000000001';
  visible_count integer;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (owner_id, 'authenticated', 'authenticated', 'owner@example.test', now(), now(), now()),
    (member_id, 'authenticated', 'authenticated', 'member@example.test', now(), now(), now()),
    (viewer_id, 'authenticated', 'authenticated', 'viewer@example.test', now(), now(), now()),
    (other_id, 'authenticated', 'authenticated', 'other@example.test', now(), now(), now());

  insert into public.organizations (id, name, slug)
  values
    (organization_id, 'RLS Test Organization', 'rls-test'),
    (other_organization_id, 'Other Organization', 'other-test');
  insert into public.organization_memberships (organization_id, user_id, role)
  values
    (organization_id, owner_id, 'owner'),
    (organization_id, member_id, 'member'),
    (organization_id, viewer_id, 'viewer'),
    (other_organization_id, other_id, 'owner');
  insert into public.projects (id, organization_id, name, project_key)
  values
    (project_id, organization_id, 'RLS Project', 'RLST'),
    (other_project_id, other_organization_id, 'Other Project', 'OTHR');
  insert into public.project_memberships (organization_id, project_id, user_id, role)
  values
    (organization_id, project_id, owner_id, 'admin'),
    (organization_id, project_id, member_id, 'member'),
    (organization_id, project_id, viewer_id, 'viewer');
  insert into public.tasks (id, organization_id, project_id, task_number, title)
  values (task_id, organization_id, project_id, 1, 'RLS task');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*) into visible_count from public.tasks;
  if visible_count <> 1 then
    raise exception 'member should read one project task, found %', visible_count;
  end if;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  select count(*) into visible_count from public.tasks;
  if visible_count <> 0 then
    raise exception 'cross-organization member should read zero tasks, found %', visible_count;
  end if;

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  begin
    insert into public.tasks (organization_id, project_id, task_number, title)
    values (organization_id, project_id, 2, 'viewer write');
    raise exception 'viewer write unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  begin
    insert into public.webhook_events (organization_id, provider, provider_event_id, event_type)
    values (organization_id, 'github', 'client-delivery', 'pull_request');
    raise exception 'client webhook write unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
