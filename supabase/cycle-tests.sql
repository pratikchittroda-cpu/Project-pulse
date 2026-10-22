-- Every fixture and assertion rolls back; no reset of local data is needed.
begin;
create function pg_temp.assert_true(condition boolean, description text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception '%', description; end if; end $$;
create function pg_temp.cycle_action(org uuid, project uuid, cycle uuid, operation text)
returns public.cycles language plpgsql as $$
declare result public.cycles; version timestamptz;
begin
  select updated_at into version from public.cycles where id = cycle;
  result := public.manage_cycle(org, project, operation, cycle, request_id => extensions.gen_random_uuid(), expected_updated_at => version);
  return result;
end $$;

create function pg_temp.fail_cycle_audit() returns trigger language plpgsql as $$
begin
  if current_setting('projectpulse.cycle_test_failure', true) = 'yes' then
    raise exception using errcode = 'P0001', message = 'Injected cycle audit failure';
  end if;
  return new;
end $$;
create trigger test_cycle_audit_failure before insert on public.cycle_events for each row execute function pg_temp.fail_cycle_audit();

do $$
<<cycle_test>>
declare
  owner_id uuid := extensions.gen_random_uuid(); viewer_id uuid := extensions.gen_random_uuid();
  org uuid := extensions.gen_random_uuid(); project uuid := extensions.gen_random_uuid(); private_project uuid := extensions.gen_random_uuid();
  first public.cycles; second public.cycles; replay public.cycles; hidden public.cycles;
  task1 public.tasks; task2 public.tasks; task3 public.tasks; task4 public.tasks;
  initial_version timestamptz; frozen jsonb; task_request uuid := extensions.gen_random_uuid(); request uuid := extensions.gen_random_uuid();
  failed_task_request uuid := extensions.gen_random_uuid(); failed_cycle_request uuid := extensions.gen_random_uuid();
  audit_count bigint; history_count bigint;
begin
  insert into auth.users (id, email) values (owner_id, owner_id || '@example.test'), (viewer_id, viewer_id || '@example.test');
  insert into public.organizations (id, name, slug) values (org, 'Cycle tests', 'cycles-' || org);
  insert into public.organization_memberships (organization_id, user_id, role) values (org, owner_id, 'owner'), (org, viewer_id, 'viewer');
  insert into public.projects (id, organization_id, name, project_key) values (project, org, 'Cycles', 'CYC'), (private_project, org, 'Private cycles', 'PRIV');
  insert into public.project_memberships (project_id, organization_id, user_id, role) values (project, org, viewer_id, 'viewer');
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);

  first := public.manage_cycle(org, project, 'create', cycle_name => 'Sprint A', request_id => request);
  replay := public.manage_cycle(org, project, 'create', cycle_name => 'Sprint A', request_id => request);
  perform pg_temp.assert_true(first.id = replay.id, 'create retry should reuse its receipt');
  begin
    perform public.manage_cycle(org, project, 'create', cycle_name => 'Conflicting retry', request_id => request);
    raise exception 'conflicting request reuse succeeded';
  exception when unique_violation then null; end;
  second := public.manage_cycle(org, project, 'create', cycle_name => 'Sprint B', request_id => extensions.gen_random_uuid());
  hidden := public.manage_cycle(org, private_project, 'create', cycle_name => 'Private sprint', request_id => extensions.gen_random_uuid());
  initial_version := first.updated_at;
  task1 := public.mutate_task(org, project, task_request, 'create', task_values => jsonb_build_object('title', 'Estimated commitment', 'estimate', 3.5, 'cycle_id', first.id));
  task2 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'create', task_values => jsonb_build_object('title', 'Carryover', 'estimate', 2, 'cycle_id', first.id));
  task3 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'create', task_values => jsonb_build_object('title', 'Unestimated carryover', 'cycle_id', first.id));
  perform public.mutate_task(org, project, task_request, 'create', task_values => jsonb_build_object('title', 'Estimated commitment', 'estimate', 3.5, 'cycle_id', first.id));
  select * into first from public.cycles where id = first.id;
  perform pg_temp.assert_true(first.committed_points = 5.5 and first.task_count = 3, 'planned assignment totals or replay incorrect');
  begin
    perform public.manage_cycle(org, project, 'start', first.id, request_id => extensions.gen_random_uuid(), expected_updated_at => initial_version);
    raise exception 'stale sprint change succeeded';
  exception when serialization_failure then null; end;
  first := pg_temp.cycle_action(org, project, first.id, 'start');
  perform pg_temp.assert_true(first.initial_commitment = 5.5 and jsonb_array_length(first.initial_tasks) = 3, 'start must snapshot initial tasks and estimates');
  begin
    perform pg_temp.cycle_action(org, project, second.id, 'start');
    raise exception 'two active sprints succeeded';
  exception when unique_violation then null; end;
  -- Failure in the sprint ledger must also undo task history, totals and receipts.
  select count(*) into audit_count from public.cycle_events where cycle_id = first.id;
  select count(*) into history_count from public.task_events where task_id = task1.id;
  perform set_config('projectpulse.cycle_test_failure', 'yes', true);
  begin
    perform public.mutate_task(org, project, failed_task_request, 'update', task1.id, '{"estimate":5}', task1.updated_at);
    raise exception using errcode = 'XX000', message = 'Injected task audit failure was not reached';
  exception when raise_exception then null; end;
  perform set_config('projectpulse.cycle_test_failure', 'no', true);
  perform pg_temp.assert_true((select to_jsonb(t) = to_jsonb(task1) from public.tasks t where t.id = task1.id), 'audit failure did not roll back task');
  perform pg_temp.assert_true((select to_jsonb(c) = to_jsonb(first) from public.cycles c where c.id = first.id), 'audit failure did not roll back sprint totals');
  perform pg_temp.assert_true((select count(*) = audit_count from public.cycle_events where cycle_id = first.id), 'failed mutation left sprint audit');
  perform pg_temp.assert_true((select count(*) = history_count from public.task_events where task_id = task1.id), 'failed mutation left task history');
  reset role;
  perform pg_temp.assert_true(not exists (select 1 from public.task_mutation_receipts where organization_id = org and request_id = failed_task_request), 'failed mutation left receipt');
  set local role authenticated;
  task1 := public.mutate_task(org, project, failed_task_request, 'update', task1.id, '{"estimate":5}', task1.updated_at);
  first := pg_temp.cycle_action(org, project, first.id, 'pause');
  task2 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task2.id, '{"cycle_id":null}', task2.updated_at);
  task4 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'create', task_values => jsonb_build_object('title', 'Added while paused', 'estimate', 4, 'cycle_id', first.id));
  task2 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task2.id, jsonb_build_object('cycle_id', first.id), task2.updated_at);
  first := pg_temp.cycle_action(org, project, first.id, 'start');
  perform pg_temp.assert_true(first.initial_commitment = 5.5 and first.committed_points = 11, 'resume overwrote initial commitment or missed scope changes');
  perform pg_temp.assert_true(first.added_points = 7.5 and first.removed_points = 2 and first.added_task_count = 2 and first.removed_task_count = 1, 'scope counters must include paused edits and net estimate changes');
  -- Custom configured terminal states count as done; canceled work does not.
  reset role;
  insert into public.project_workflow_statuses (organization_id, project_id, status, label, position, is_terminal)
    values (org, project, 'shipped', 'Shipped', 10, true);
  set local role authenticated;
  task1 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task1.id, '{"status":"shipped"}', task1.updated_at);
  task4 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task4.id, '{"status":"canceled"}', task4.updated_at);
  -- A failed history write must roll back both lifecycle snapshot and receipt.
  select * into first from public.cycles where id = first.id;
  frozen := to_jsonb(first);
  select count(*) into audit_count from public.cycle_events where cycle_id = first.id;
  perform set_config('projectpulse.cycle_test_failure', 'yes', true);
  begin
    perform public.manage_cycle(org, project, 'complete', first.id, request_id => failed_cycle_request, expected_updated_at => first.updated_at);
    raise exception using errcode = 'XX000', message = 'Injected failure was not reached';
  exception when raise_exception then null; end;
  perform set_config('projectpulse.cycle_test_failure', 'no', true);
  select * into first from public.cycles where id = first.id;
  perform pg_temp.assert_true(to_jsonb(first) = frozen, 'audit failure did not roll back completion');
  perform pg_temp.assert_true((select count(*) = audit_count from public.cycle_events where cycle_id = first.id), 'failed completion left audit');
  reset role;
  perform pg_temp.assert_true(not exists (select 1 from public.cycle_mutation_receipts where organization_id = org and request_id = failed_cycle_request), 'failed completion left receipt');
  set local role authenticated;
  first := public.manage_cycle(org, project, 'complete', first.id, request_id => failed_cycle_request, expected_updated_at => first.updated_at);
  perform pg_temp.assert_true(first.completed_points = 5 and first.completed_task_count = 1 and first.carried_over_points = 2 and first.carried_over_task_count = 2, 'completion or unestimated carryover totals incorrect');
  frozen := to_jsonb(first);
  begin
    perform public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task2.id, '{"estimate":8}', task2.updated_at);
    raise exception 'closed membership was re-estimated';
  exception when sqlstate '55000' then null; end;
  begin
    perform public.mutate_task(org, project, extensions.gen_random_uuid(), 'create', task_values => jsonb_build_object('title', 'Invalid closed assignment', 'cycle_id', first.id));
    raise exception 'new task entered closed sprint';
  exception when sqlstate '55000' then null; end;
  task2 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task2.id, jsonb_build_object('cycle_id', second.id), task2.updated_at);
  task3 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task3.id, '{"cycle_id":null}', task3.updated_at);
  task2 := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task2.id, '{"estimate":8}', task2.updated_at);
  select * into first from public.cycles where id = first.id;
  perform pg_temp.assert_true(to_jsonb(first) = frozen, 'carryover changed closed history');
  select * into second from public.cycles where id = second.id;
  perform pg_temp.assert_true(second.committed_points = 8 and second.task_count = 1, 'carried work was not assigned to next sprint');
  perform pg_temp.assert_true((select count(*) = 2 from public.cycle_events where cycle_id = first.id and event_type = 'cycle.task_carried_over'), 'carryover audit missing');
  perform pg_temp.assert_true((select count(*) = 1 from public.cycle_events where cycle_id = first.id and event_type = 'cycle.started'), 'start event duplicated on resume');
  begin
    perform public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task3.id, jsonb_build_object('cycle_id', hidden.id), task3.updated_at);
    raise exception 'cross-project cycle assignment succeeded';
  exception when foreign_key_violation then null; end;
  begin
    update public.cycles set initial_commitment = 99 where id = first.id;
    raise exception 'client forged sprint history';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.cycles where id = first.id;
    raise exception 'client deleted sprint history';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.cycle_events (organization_id, project_id, cycle_id, event_type, payload) values (org, project, first.id, 'cycle.started', '{}');
    raise exception 'client forged sprint audit';
  exception when insufficient_privilege then null; end;
  begin
    perform public.manage_cycle(org, project, null, request_id => extensions.gen_random_uuid());
    raise exception 'null action succeeded';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.manage_cycle(org, project, 'create', cycle_name => 'Bad dates', cycle_starts_at => 'infinity', request_id => extensions.gen_random_uuid());
    raise exception 'nonfinite dates succeeded';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', viewer_id, 'role', 'authenticated')::text, true);
  perform pg_temp.assert_true((select count(*) = 0 from public.cycles where id = hidden.id), 'viewer read private sprint');
  perform pg_temp.assert_true((select count(*) = 0 from public.cycle_events where cycle_id = hidden.id), 'viewer read private sprint audit');
  perform pg_temp.assert_true((select count(*) > 0 from public.cycle_events where cycle_id = first.id), 'viewer cannot read assigned sprint audit');
  begin
    perform public.manage_cycle(org, project, 'create', cycle_name => 'Sprint A', request_id => request);
    raise exception 'viewer replayed owner receipt';
  exception when insufficient_privilege then null; end;
  begin
    perform public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', task3.id, jsonb_build_object('cycle_id', second.id), task3.updated_at);
    raise exception 'viewer planned a task';
  exception when insufficient_privilege then null; end;
  reset role;
  delete from public.organization_memberships where organization_id = org and user_id = viewer_id;
  set local role authenticated;
  perform pg_temp.assert_true((select count(*) = 0 from public.cycles where id = first.id), 'removed member read sprint');
  perform pg_temp.assert_true((select count(*) = 0 from public.cycle_events where cycle_id = first.id), 'removed member read sprint audit');
  reset role;
  update public.projects set archived_at = now() where id = project;
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  begin
    perform pg_temp.cycle_action(org, project, second.id, 'start');
    raise exception 'archived project sprint started';
  exception when sqlstate '55000' then null; end;
end $$;
rollback;
