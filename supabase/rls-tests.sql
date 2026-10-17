-- Run after `corepack pnpm run supabase:reset` with:
--   docker exec supabase_db_projectpulse psql -U postgres -d postgres -f /path/to/this/file
-- The application test runner uses the same assertions through psql.

begin;

do $$
<<rls_test>>
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000001';
  member_id uuid := '00000000-0000-0000-0000-000000000002';
  viewer_id uuid := '00000000-0000-0000-0000-000000000003';
  other_id uuid := '00000000-0000-0000-0000-000000000004';
  invitee_id uuid := '00000000-0000-0000-0000-000000000005';
  organization_id uuid := '10000000-0000-0000-0000-000000000001';
  other_organization_id uuid := '10000000-0000-0000-0000-000000000002';
  project_id uuid := '20000000-0000-0000-0000-000000000001';
  other_project_id uuid := '20000000-0000-0000-0000-000000000002';
  task_id uuid := '30000000-0000-0000-0000-000000000001';
  assigned_team_id uuid := '40000000-0000-0000-0000-000000000001';
  visible_count integer;
  invitation_token text;
  invitation_succeeded boolean;
  operation_succeeded boolean;
  affected_count integer;
  generated_task_number bigint;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (owner_id, 'authenticated', 'authenticated', 'owner@example.test', now(), now(), now()),
    (member_id, 'authenticated', 'authenticated', 'member@example.test', now(), now(), now()),
    (viewer_id, 'authenticated', 'authenticated', 'viewer@example.test', now(), now(), now()),
    (other_id, 'authenticated', 'authenticated', 'other@example.test', now(), now(), now()),
    (invitee_id, 'authenticated', 'authenticated', 'invitee@example.test', now(), now(), now());

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
  insert into public.teams (id, organization_id, name, team_key)
  values (assigned_team_id, organization_id, 'RLS Team', 'RLST');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*) into visible_count from public.tasks;
  if visible_count <> 1 then
    raise exception 'member should read one project task, found %', visible_count;
  end if;

  update public.tasks
  set title = 'RLS task edited',
      priority = 'high',
      estimate = 3.5,
      due_date = date '2026-12-31',
      labels = array['security', 'planning'],
      assignee_id = member_id
  where id = task_id;
  if not exists (
    select 1
    from public.tasks edited_task
    where edited_task.id = task_id
      and edited_task.title = 'RLS task edited'
      and edited_task.priority = 'high'
      and edited_task.estimate = 3.5
      and edited_task.assignee_id = member_id
      and edited_task.labels = array['security', 'planning']
  ) then
    raise exception 'member task edit did not persist';
  end if;

  update public.tasks
  set archived_at = timezone('utc', now())
  where id = task_id;
  select count(*) into visible_count
  from public.tasks active_task
  where active_task.id = task_id
    and active_task.archived_at is null;
  if visible_count <> 0 then
    raise exception 'archived task remained in the active query';
  end if;
  update public.tasks
  set archived_at = null
  where id = task_id;

  operation_succeeded := false;
  begin
    update public.tasks
    set assignee_id = other_id
    where id = task_id;
    get diagnostics affected_count = row_count;
    operation_succeeded := affected_count > 0;
  exception when check_violation then
    null;
  end;
  if operation_succeeded then
    raise exception 'cross-organization assignee unexpectedly succeeded';
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

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  insert into public.tasks (organization_id, project_id, title)
  values (organization_id, project_id, 'Generated task two')
  returning task_number into generated_task_number;
  if generated_task_number <> 2 then
    raise exception 'first generated task number should be 2, found %', generated_task_number;
  end if;

  insert into public.tasks (organization_id, project_id, title)
  values (organization_id, project_id, 'Generated task three')
  returning task_number into generated_task_number;
  if generated_task_number <> 3 then
    raise exception 'second generated task number should be 3, found %', generated_task_number;
  end if;

  insert into public.tasks (organization_id, project_id, task_number, title)
  values (organization_id, project_id, 10, 'Explicit task ten');
  insert into public.tasks (organization_id, project_id, title)
  values (organization_id, project_id, 'Generated task eleven')
  returning task_number into generated_task_number;
  if generated_task_number <> 11 then
    raise exception 'generated task number should advance after explicit number, found %', generated_task_number;
  end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into public.project_workflow_statuses (
    organization_id,
    project_id,
    status,
    label,
    position
  )
  values (organization_id, project_id, 'qa_ready', 'QA ready', 9);

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  insert into public.tasks (organization_id, project_id, status, title)
  values (organization_id, project_id, 'qa_ready', 'Custom workflow task');

  operation_succeeded := false;
  begin
    insert into public.tasks (organization_id, project_id, status, title)
    values (organization_id, project_id, 'not_defined', 'Invalid status task');
    operation_succeeded := true;
  exception when foreign_key_violation then
    null;
  end;
  if operation_succeeded then
    raise exception 'invalid task status unexpectedly succeeded';
  end if;

  operation_succeeded := false;
  begin
    insert into public.tasks (organization_id, project_id, priority, title)
    values (organization_id, project_id, 'invalid', 'Invalid priority task');
    operation_succeeded := true;
  exception when check_violation then
    null;
  end;
  if operation_succeeded then
    raise exception 'invalid task priority unexpectedly succeeded';
  end if;

  operation_succeeded := false;
  begin
    insert into public.tasks (organization_id, project_id, estimate, title)
    values (organization_id, project_id, -1, 'Invalid estimate task');
    operation_succeeded := true;
  exception when check_violation then
    null;
  end;
  if operation_succeeded then
    raise exception 'negative task estimate unexpectedly succeeded';
  end if;

  operation_succeeded := false;
  begin
    insert into public.tasks (organization_id, project_id, labels, title)
    values (organization_id, project_id, array['duplicate', 'duplicate'], 'Duplicate labels task');
    operation_succeeded := true;
  exception when check_violation then
    null;
  end;
  if operation_succeeded then
    raise exception 'duplicate task labels unexpectedly succeeded';
  end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  operation_succeeded := false;
  begin
    update public.tasks
    set task_number = 99
    where id = task_id;
    get diagnostics affected_count = row_count;
    operation_succeeded := affected_count > 0;
  exception when others then
    null;
  end;
  if operation_succeeded then
    raise exception 'task identity update unexpectedly succeeded';
  end if;

  operation_succeeded := false;
  begin
    update public.projects
    set project_key = 'NEWK'
    where id = project_id;
    get diagnostics affected_count = row_count;
    operation_succeeded := affected_count > 0;
  exception when others then
    null;
  end;
  if operation_succeeded then
    raise exception 'project key changed after tasks were created';
  end if;

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  operation_succeeded := false;
  begin
    update public.tasks
    set title = 'Viewer task update'
    where id = task_id;
    get diagnostics affected_count = row_count;
    operation_succeeded := affected_count > 0;
  exception when insufficient_privilege then
    null;
  end;
  if operation_succeeded then
    raise exception 'viewer task update unexpectedly succeeded';
  end if;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*) into visible_count
  from public.projects visible_project
  where visible_project.organization_id = rls_test.organization_id;
  if visible_count <> 1 then
    raise exception 'project member should read one project, found %', visible_count;
  end if;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  select count(*) into visible_count
  from public.projects visible_project
  where visible_project.organization_id = rls_test.organization_id;
  if visible_count <> 0 then
    raise exception 'cross-organization member should read zero projects, found %', visible_count;
  end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  operation_succeeded := false;
  begin
    insert into public.projects (organization_id, name, project_key)
    values (organization_id, 'Invalid Key Project', 'bad-key');
    operation_succeeded := true;
  exception when check_violation then
    null;
  end;
  if operation_succeeded then
    raise exception 'invalid project key unexpectedly succeeded';
  end if;

  operation_succeeded := false;
  begin
    insert into public.projects (organization_id, name, project_key)
    values (organization_id, 'Duplicate Project', 'RLST');
    operation_succeeded := true;
  exception when unique_violation then
    null;
  end;
  if operation_succeeded then
    raise exception 'duplicate project key unexpectedly succeeded';
  end if;

  update public.projects
  set archived_at = timezone('utc', now())
  where id = project_id;
  operation_succeeded := false;
  begin
    insert into public.tasks (organization_id, project_id, title)
    values (organization_id, project_id, 'Archived project task');
    operation_succeeded := true;
  exception when sqlstate '55000' then
    null;
  end;
  if operation_succeeded then
    raise exception 'archived project task write unexpectedly succeeded';
  end if;
  update public.projects
  set archived_at = null
  where id = project_id;

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  operation_succeeded := false;
  begin
    update public.projects
    set name = 'Viewer Project Update'
    where id = project_id;
    get diagnostics affected_count = row_count;
    operation_succeeded := affected_count > 0;
  exception when insufficient_privilege then
    null;
  end;
  if operation_succeeded then
    raise exception 'viewer project update unexpectedly succeeded';
  end if;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  insert into public.repositories (
    organization_id,
    project_id,
    provider,
    name,
    url,
    default_branch
  )
  values (
    organization_id,
    project_id,
    'github',
    'RLS Repository',
    'https://github.com/example/rls-repository',
    'main'
  );

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  operation_succeeded := false;
  begin
    insert into public.repositories (
      organization_id,
      project_id,
      provider,
      name,
      url
    )
    values (
      organization_id,
      project_id,
      'github',
      'Viewer Repository',
      'https://github.com/example/viewer-repository'
    );
    operation_succeeded := true;
  exception when insufficient_privilege then
    null;
  end;
  if operation_succeeded then
    raise exception 'client repository write unexpectedly succeeded';
  end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  select result.invitation_token into invitation_token
  from public.invite_organization_member(organization_id, 'invitee@example.test', 'viewer')
    as result;
  if invitation_token is null then
    raise exception 'owner invitation did not return a token';
  end if;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  invitation_succeeded := false;
  begin
    perform public.invite_organization_member(organization_id, 'blocked@example.test', 'member');
    invitation_succeeded := true;
  exception when others then
    null;
  end;
  if invitation_succeeded then
    raise exception 'member invitation unexpectedly succeeded';
  end if;

  perform set_config('request.jwt.claim.sub', invitee_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', invitee_id::text, 'email', 'invitee@example.test')::text,
    true
  );
  perform public.accept_organization_invitation(invitation_token);
  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = rls_test.organization_id
      and membership.user_id = invitee_id
      and membership.role = 'viewer'
  ) then
    raise exception 'invitee membership was not created';
  end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into public.team_memberships (organization_id, team_id, user_id)
  values (organization_id, assigned_team_id, member_id);
  update public.projects project
  set team_id = assigned_team_id
  where project.id = project_id;
  update public.tasks task
  set team_id = assigned_team_id
  where task.id = task_id;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*) into visible_count
  from public.projects project
  where project.id = project_id and project.team_id = assigned_team_id;
  if visible_count <> 1 then
    raise exception 'team assignment was not visible to project member';
  end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  delete from public.organization_memberships membership
  where membership.organization_id = rls_test.organization_id
    and membership.user_id = member_id;

  select count(*) into visible_count
  from public.team_memberships team_membership
  where team_membership.organization_id = rls_test.organization_id
    and team_membership.user_id = member_id;
  if visible_count <> 0 then
    raise exception 'removed member team memberships were not cascaded';
  end if;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  select count(*) into visible_count from public.tasks;
  if visible_count <> 0 then
    raise exception 'removed member should read zero tasks, found %', visible_count;
  end if;
end;
$$;

rollback;
