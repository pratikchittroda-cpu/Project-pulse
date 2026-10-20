-- Every fixture and assertion rolls back; no reset of local data is needed.
begin;

do $$
<<roadmap_test>>
declare
  owner_id uuid := extensions.gen_random_uuid();
  member_id uuid := extensions.gen_random_uuid();
  viewer_id uuid := extensions.gen_random_uuid();
  other_id uuid := extensions.gen_random_uuid();
  organization_id uuid := extensions.gen_random_uuid();
  other_organization_id uuid := extensions.gen_random_uuid();
  project_id uuid := extensions.gen_random_uuid();
  other_project_id uuid := extensions.gen_random_uuid();
  other_org_project_id uuid := extensions.gen_random_uuid();
  roadmap_initiative_id uuid := extensions.gen_random_uuid();
  roadmap_epic_id uuid := extensions.gen_random_uuid();
  other_epic_id uuid := extensions.gen_random_uuid();
  roadmap_milestone_id uuid := extensions.gen_random_uuid();
  task_request uuid := extensions.gen_random_uuid();
  task_id uuid;
  task_count integer;
  affected_count integer;
  event_payload jsonb;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (owner_id, 'authenticated', 'authenticated', owner_id || '@example.test', now(), now(), now()),
    (member_id, 'authenticated', 'authenticated', member_id || '@example.test', now(), now(), now()),
    (viewer_id, 'authenticated', 'authenticated', viewer_id || '@example.test', now(), now(), now()),
    (other_id, 'authenticated', 'authenticated', other_id || '@example.test', now(), now(), now());
  insert into public.organizations (id, name, slug)
  values
    (organization_id, 'Roadmap tests', 'roadmap-' || organization_id),
    (other_organization_id, 'Other roadmap tests', 'other-roadmap-' || other_organization_id);
  insert into public.organization_memberships (organization_id, user_id, role)
  values
    (organization_id, owner_id, 'owner'),
    (organization_id, member_id, 'member'),
    (organization_id, viewer_id, 'viewer'),
    (other_organization_id, other_id, 'owner');
  insert into public.projects (id, organization_id, name, project_key)
  values
    (project_id, organization_id, 'Roadmap project', 'ROAD'),
    (other_project_id, organization_id, 'Other project', 'OTHR'),
    (other_org_project_id, other_organization_id, 'Other org project', 'ORGP');
  insert into public.project_memberships (organization_id, project_id, user_id, role)
  values
    (organization_id, project_id, owner_id, 'admin'),
    (organization_id, project_id, member_id, 'member'),
    (organization_id, project_id, viewer_id, 'viewer'),
    (organization_id, other_project_id, member_id, 'member');

  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  insert into public.initiatives (id, organization_id, name, description, status)
  values (roadmap_initiative_id, organization_id, 'Platform reliability', 'Safer releases', 'active');
  insert into public.epics (id, organization_id, project_id, initiative_id, title, status)
  values
    (roadmap_epic_id, organization_id, project_id, roadmap_initiative_id, 'Release confidence', 'active'),
    (other_epic_id, organization_id, other_project_id, roadmap_initiative_id, 'Other project epic', 'planned');
  insert into public.milestones (id, organization_id, project_id, name, target_date, status)
  values (roadmap_milestone_id, organization_id, project_id, 'Beta release', date '2026-10-19', 'active');

  select id into task_id
  from public.mutate_task(
    organization_id,
    project_id,
    task_request,
    'create',
    task_values => jsonb_build_object(
      'title', 'Linked roadmap task',
      'estimate', 3.5,
      'epic_id', roadmap_epic_id,
      'milestone_id', roadmap_milestone_id
    )
  );
  select count(*) into task_count
  from public.tasks task_row
  where task_row.id = roadmap_test.task_id
    and task_row.epic_id = roadmap_test.roadmap_epic_id
    and task_row.milestone_id = roadmap_test.roadmap_milestone_id;
  if task_count <> 1 then raise exception 'task hierarchy links did not persist'; end if;

  select payload into event_payload
  from public.task_events event_row
  where event_row.task_id = roadmap_test.task_id
  order by occurred_at desc, created_at desc, id desc
  limit 1;
  if not (event_payload -> 'changes' ? 'epic_id') or not (event_payload -> 'changes' ? 'milestone_id') then
    raise exception 'task hierarchy change was not captured in task history';
  end if;

  update public.tasks set status = 'completed' where id = task_id;
  if not exists (select 1 from public.tasks where id = task_id and status = 'completed') then
    raise exception 'member task status update did not persist';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  update public.epics set title = 'Release confidence updated' where id = roadmap_epic_id;
  update public.milestones set status = 'completed' where id = roadmap_milestone_id;
  if not exists (select 1 from public.epics where id = roadmap_epic_id and title = 'Release confidence updated') then
    raise exception 'project member epic update did not persist';
  end if;
  if not exists (select 1 from public.milestones where id = roadmap_milestone_id and status = 'completed') then
    raise exception 'project member milestone update did not persist';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', viewer_id, 'role', 'authenticated')::text, true);
  if (select count(*) from public.initiatives where id = roadmap_initiative_id) <> 1 then
    raise exception 'viewer should read the organization initiative';
  end if;
  if (select count(*) from public.epics where id = roadmap_epic_id) <> 1 then
    raise exception 'viewer should read the assigned project epic';
  end if;
  if (select count(*) from public.milestones where id = roadmap_milestone_id) <> 1 then
    raise exception 'viewer should read the assigned project milestone';
  end if;
  begin
    update public.initiatives set name = 'Viewer cannot edit' where id = roadmap_initiative_id;
    get diagnostics affected_count = row_count;
    if affected_count > 0 then raise exception 'viewer initiative write unexpectedly succeeded'; end if;
  end;
  begin
    update public.epics set title = 'Viewer cannot edit' where id = roadmap_epic_id;
    get diagnostics affected_count = row_count;
    if affected_count > 0 then raise exception 'viewer epic write unexpectedly succeeded'; end if;
  end;
  begin
    update public.milestones set status = 'canceled' where id = roadmap_milestone_id;
    get diagnostics affected_count = row_count;
    if affected_count > 0 then raise exception 'viewer milestone write unexpectedly succeeded'; end if;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  begin
    perform public.mutate_task(
      organization_id,
      project_id,
      extensions.gen_random_uuid(),
      'update',
      task_id,
      jsonb_build_object('epic_id', other_epic_id),
      (select updated_at from public.tasks where id = task_id)
    );
    raise exception 'cross-project epic assignment unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.milestones (organization_id, project_id, name, target_date)
    values (organization_id, project_id, 'Infinite date', 'infinity');
    raise exception 'infinite milestone date unexpectedly succeeded';
  exception when check_violation then null; end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated')::text, true);
  if (select count(*) from public.epics epic_row where epic_row.organization_id = roadmap_test.organization_id) <> 0 then
    raise exception 'cross-organization member read roadmap rows';
  end if;
end $$;

rollback;
