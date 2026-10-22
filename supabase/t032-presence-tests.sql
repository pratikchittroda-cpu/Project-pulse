-- T032 database coverage. Every fixture and assertion rolls back.
begin;

do $$
declare
  organization_id uuid := '10000000-0000-0000-0000-000000000032';
  project_id uuid := '20000000-0000-0000-0000-000000000032';
  other_organization_id uuid := '10000000-0000-0000-0000-000000000033';
  other_project_id uuid := '20000000-0000-0000-0000-000000000033';
  member_id uuid := '00000000-0000-0000-0000-000000000032';
  outsider_id uuid := '00000000-0000-0000-0000-000000000033';
  operation_succeeded boolean;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (member_id, 'authenticated', 'authenticated', 't032-member@example.test', now(), now(), now()),
    (outsider_id, 'authenticated', 'authenticated', 't032-outsider@example.test', now(), now(), now());
  insert into public.organizations (id, name, slug)
  values
    (organization_id, 'T032 presence', 't032-presence'),
    (other_organization_id, 'T032 other presence', 't032-other-presence');
  insert into public.organization_memberships (organization_id, user_id, role)
  values (organization_id, member_id, 'member');
  insert into public.projects (id, organization_id, name, project_key)
  values
    (project_id, organization_id, 'T032 project', 'T032'),
    (other_project_id, other_organization_id, 'T032 other project', 'T32X');
  insert into public.project_memberships (organization_id, project_id, user_id, role)
  values (organization_id, project_id, member_id, 'member');

  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', member_id, 'role', 'authenticated')::text,
    true
  );
  if not public.can_access_presence_topic(
    'projectpulse:presence:' || organization_id || ':' || project_id
  ) then
    raise exception 'project member was denied the presence topic';
  end if;
  if public.can_access_presence_topic(
    'projectpulse:presence:' || other_organization_id || ':' || other_project_id
  ) then
    raise exception 'cross-organization presence topic was authorized';
  end if;
  if public.can_access_presence_topic('projectpulse:presence:not-a-uuid:not-a-uuid') then
    raise exception 'malformed presence topic was authorized';
  end if;

  perform set_config(
    'realtime.topic',
    'projectpulse:presence:' || organization_id || ':' || project_id,
    true
  );
  insert into realtime.messages (topic, extension, payload, event, private)
  values (
    'projectpulse:presence:' || organization_id || ':' || project_id,
    'presence',
    '{}'::jsonb,
    'presence',
    true
  );

  operation_succeeded := false;
  begin
    perform set_config(
      'realtime.topic',
      'projectpulse:presence:' || other_organization_id || ':' || other_project_id,
      true
    );
    insert into realtime.messages (topic, extension, payload, event, private)
    values (
      'projectpulse:presence:' || other_organization_id || ':' || other_project_id,
      'presence',
      '{}'::jsonb,
      'presence',
      true
    );
    operation_succeeded := true;
  exception when insufficient_privilege then null; end;
  if operation_succeeded then
    raise exception 'cross-organization presence write unexpectedly succeeded';
  end if;
end;
$$;

rollback;
