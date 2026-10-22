-- Every fixture and assertion rolls back; no reset of local data is needed.
begin;

do $$
<<dependency_test>>
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
  task_a uuid := extensions.gen_random_uuid();
  task_b uuid := extensions.gen_random_uuid();
  task_c uuid := extensions.gen_random_uuid();
  other_task uuid := extensions.gen_random_uuid();
  relation_ab uuid;
  relation_bc uuid;
  create_request uuid := extensions.gen_random_uuid();
  replayed_relation uuid;
  delete_request uuid := extensions.gen_random_uuid();
  relation_count integer;
  operation_succeeded boolean;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (owner_id, 'authenticated', 'authenticated', owner_id || '@example.test', now(), now(), now()),
    (member_id, 'authenticated', 'authenticated', member_id || '@example.test', now(), now(), now()),
    (viewer_id, 'authenticated', 'authenticated', viewer_id || '@example.test', now(), now(), now()),
    (other_id, 'authenticated', 'authenticated', other_id || '@example.test', now(), now(), now());
  insert into public.organizations (id, name, slug)
  values
    (organization_id, 'Dependency tests', 'dependency-' || organization_id),
    (other_organization_id, 'Other dependency tests', 'other-dependency-' || other_organization_id);
  insert into public.organization_memberships (organization_id, user_id, role)
  values
    (organization_id, owner_id, 'owner'),
    (organization_id, member_id, 'member'),
    (organization_id, viewer_id, 'viewer'),
    (other_organization_id, other_id, 'owner');
  insert into public.projects (id, organization_id, name, project_key)
  values
    (project_id, organization_id, 'Dependency project', 'DEPS'),
    (other_project_id, organization_id, 'Other project', 'OTHD'),
    (other_org_project_id, other_organization_id, 'Other org project', 'ORGD');
  insert into public.project_memberships (organization_id, project_id, user_id, role)
  values
    (organization_id, project_id, owner_id, 'admin'),
    (organization_id, project_id, member_id, 'member'),
    (organization_id, project_id, viewer_id, 'viewer'),
    (organization_id, other_project_id, member_id, 'member');
  insert into public.tasks (id, organization_id, project_id, title)
  values
    (task_a, organization_id, project_id, 'Critical blocker'),
    (task_b, organization_id, project_id, 'Blocked task'),
    (task_c, organization_id, project_id, 'Downstream task'),
    (other_task, organization_id, other_project_id, 'Other project task');
  update public.tasks set priority = 'urgent' where id = task_a;

  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  select id into relation_ab
  from public.manage_task_relation(
    organization_id, project_id, 'create', create_request,
    blocker_task_id => task_a, blocked_task_id => task_b,
    blocker_explanation => 'Waiting for the security review',
    blocker_target_date => date '2026-11-01'
  );
  select id into replayed_relation
  from public.manage_task_relation(
    organization_id, project_id, 'create',
    create_request,
    blocker_task_id => task_a, blocked_task_id => task_b,
    blocker_explanation => 'Waiting for the security review',
    blocker_target_date => date '2026-11-01'
  );
  if relation_ab <> replayed_relation then raise exception 'dependency replay returned another relation'; end if;
  if not exists (
    select 1 from public.task_relations r
    where r.id = relation_ab
      and r.blocker_explanation = 'Waiting for the security review'
      and r.blocker_target_date = date '2026-11-01'
  ) then raise exception 'dependency metadata did not persist'; end if;

  select id into relation_bc
  from public.manage_task_relation(
    organization_id, project_id, 'create', extensions.gen_random_uuid(),
    blocker_task_id => task_b, blocked_task_id => task_c,
    blocker_explanation => 'Waiting for the blocked task'
  );
  begin
    perform public.manage_task_relation(
      organization_id, project_id, 'create', extensions.gen_random_uuid(),
      blocker_task_id => task_c, blocked_task_id => task_a,
      blocker_explanation => 'Would create a cycle'
    );
    raise exception 'dependency cycle unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.manage_task_relation(
      organization_id, project_id, 'create', extensions.gen_random_uuid(),
      blocker_task_id => task_a, blocked_task_id => task_a,
      blocker_explanation => 'Self dependency'
    );
    raise exception 'self dependency unexpectedly succeeded';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.manage_task_relation(
      organization_id, project_id, 'create', extensions.gen_random_uuid(),
      blocker_task_id => task_a, blocked_task_id => task_b,
      blocker_explanation => 'Duplicate dependency'
    );
    raise exception 'duplicate dependency unexpectedly succeeded';
  exception when unique_violation then null; end;
  begin
    perform public.manage_task_relation(
      organization_id, project_id, 'create', extensions.gen_random_uuid(),
      blocker_task_id => task_a, blocked_task_id => other_task,
      blocker_explanation => 'Cross project dependency'
    );
    raise exception 'cross-project dependency unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.task_relations (organization_id, project_id, task_id, related_task_id, relation_type)
    values (organization_id, project_id, task_a, task_b, 'blocks');
    raise exception 'direct relation insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  select count(*) into relation_count
  from public.task_events event_row
  where event_row.organization_id = dependency_test.organization_id
    and event_row.event_type = 'task.dependency_changed';
  if relation_count <> 4 then raise exception 'dependency events should be recorded for both sides'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', viewer_id, 'role', 'authenticated')::text, true);
  if (select count(*) from public.task_relations relation_row where relation_row.project_id = dependency_test.project_id) <> 2 then
    raise exception 'viewer should read project dependencies';
  end if;
  begin
    perform public.manage_task_relation(
      organization_id, project_id, 'delete', extensions.gen_random_uuid(), relation_id => relation_ab
    );
    raise exception 'viewer dependency write unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  select id into replayed_relation
  from public.manage_task_relation(
    organization_id, project_id, 'delete', delete_request, relation_id => relation_ab
  );
  if replayed_relation <> relation_ab then raise exception 'dependency delete returned another relation'; end if;
  select id into replayed_relation
  from public.manage_task_relation(
    organization_id, project_id, 'delete', delete_request, relation_id => relation_ab
  );
  if replayed_relation <> relation_ab then raise exception 'dependency delete replay failed'; end if;
  if exists (select 1 from public.task_relations where id = relation_ab) then
    raise exception 'dependency delete did not remove the relation';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  set local role authenticated;
  if (select count(*) from public.task_relations relation_row where relation_row.organization_id = dependency_test.organization_id) <> 0 then
    raise exception 'cross-organization member read dependency rows';
  end if;
end $$;

rollback;
