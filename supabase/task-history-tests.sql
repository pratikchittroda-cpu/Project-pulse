-- Run against the local migrated database. All fixtures and fault injection roll back.
begin;

do $$
declare
  org uuid := '11000000-0000-0000-0000-000000000022';
  project uuid := '22000000-0000-0000-0000-000000000022';
  hidden_project uuid := '22000000-0000-0000-0000-000000000023';
  owner_user uuid := '00000000-0000-0000-0000-000000000022';
  writer_user uuid := '00000000-0000-0000-0000-000000000023';
  viewer_user uuid := '00000000-0000-0000-0000-000000000024';
  created public.tasks;
  edited public.tasks;
  replay public.tasks;
  hidden public.tasks;
  request uuid := extensions.gen_random_uuid();
  edit_request uuid := extensions.gen_random_uuid();
  archive_request uuid := extensions.gen_random_uuid();
  event_row public.task_events;
  count_events integer;
begin
  insert into auth.users (id, email) values
    (owner_user, 'history-owner@example.test'), (writer_user, 'history-writer@example.test'),
    (viewer_user, 'history-viewer@example.test');
  insert into public.organizations (id, name, slug) values (org, 'History Test', 'history-test-22');
  insert into public.organization_memberships (organization_id, user_id, role) values
    (org, owner_user, 'owner'), (org, writer_user, 'member'), (org, viewer_user, 'viewer');
  insert into public.projects (id, organization_id, name, project_key) values
    (project, org, 'History', 'HIST'), (hidden_project, org, 'Hidden history', 'HIDE');
  insert into public.project_memberships (organization_id, project_id, user_id, role) values
    (org, project, writer_user, 'member'), (org, project, viewer_user, 'viewer');
  insert into public.tasks (organization_id, project_id, title) values (org, hidden_project, 'Private task') returning * into hidden;

  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', writer_user, 'role', 'authenticated')::text, true);
  created := public.mutate_task(org, project, request, 'create', task_values => '{"title":"First task","estimate":3.5}');
  replay := public.mutate_task(org, project, request, 'create', task_values => '{"title":"First task","estimate":3.5}');
  if replay.id <> created.id then raise exception 'create replay made another task'; end if;
  select count(*) into count_events from public.task_events where task_id = created.id;
  if count_events <> 1 then raise exception 'creation should have exactly one event, got %', count_events; end if;
  select * into event_row from public.task_events where task_id = created.id;
  if event_row.actor_id <> writer_user or event_row.event_type <> 'task.created'
    or event_row.payload #>> '{changes,title,to}' <> 'First task' then
    raise exception 'creation event lost actor or values';
  end if;

  edited := public.mutate_task(org, project, edit_request, 'update', created.id,
    '{"title":"Edited task","status":"in_progress","priority":"high"}', created.updated_at);
  replay := public.mutate_task(org, project, edit_request, 'update', created.id,
    '{"title":"Edited task","status":"in_progress","priority":"high"}', created.updated_at);
  if replay.updated_at <> edited.updated_at then raise exception 'edit replay changed version'; end if;
  select count(*) into count_events from public.task_events where task_id = created.id;
  if count_events <> 2 then raise exception 'edit or replay produced extra events'; end if;
  select * into event_row from public.task_events where idempotency_key = 'task-change:' || edit_request;
  if event_row.event_type <> 'task.status_changed'
    or event_row.payload #>> '{changes,status,from}' <> 'backlog'
    or event_row.payload #>> '{changes,status,to}' <> 'in_progress'
    or event_row.payload #>> '{changes,title,to}' <> 'Edited task' then
    raise exception 'status change lost changed fields';
  end if;

  begin
    perform public.mutate_task(org, project, edit_request, 'update', created.id, '{"title":"Different"}', created.updated_at);
    raise exception 'request ID collision was accepted';
  exception when unique_violation then null; end;
  begin
    perform public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', created.id, '{"title":"Stale"}', created.updated_at);
    raise exception 'stale edit was accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', created.id, '{"priority":"invalid"}', edited.updated_at);
    raise exception 'invalid update accepted';
  exception when check_violation then null; end;

  edited := public.mutate_task(org, project, archive_request, 'archive', created.id, '{}', edited.updated_at);
  replay := public.mutate_task(org, project, archive_request, 'archive', created.id, '{}', replay.updated_at);
  if replay.archived_at is distinct from edited.archived_at then raise exception 'archive replay differed'; end if;
  edited := public.mutate_task(org, project, extensions.gen_random_uuid(), 'restore', created.id, '{}', edited.updated_at);
  select count(*) into count_events from public.task_events where task_id = created.id;
  if count_events <> 4 then raise exception 'archive/restore not recorded once'; end if;
  -- A timestamp-only/no-op update must not create an invented field change.
  edited := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', created.id, '{"title":"Edited task"}', edited.updated_at);
  select count(*) into count_events from public.task_events where task_id = created.id;
  if count_events <> 4 then raise exception 'no-op generated history'; end if;

  select count(*) into count_events from public.task_events where task_id = hidden.id;
  if count_events <> 0 then raise exception 'same-org private project history leaked'; end if;
  begin
    perform public.mutate_task(org, hidden_project, extensions.gen_random_uuid(), 'update', hidden.id, '{"title":"Denied"}', hidden.updated_at);
    raise exception 'private project mutation accepted';
  exception when insufficient_privilege then null; end;
  -- A caller who knows another project's event key must not get that event back.
  begin
    perform public.record_task_event(org, project, created.id, 'task.updated', 'internal',
      'task-change:' || request, '{}');
    raise exception 'reserved lifecycle event key accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.record_task_event(org, project, created.id, 'task.updated', 'internal',
      'spoof-actor', '{}', target_actor_id => owner_user);
    raise exception 'actor spoof accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.record_task_event(org, project, created.id, 'task.updated', 'internal', 'bad-payload', '[]');
    raise exception 'non-object event payload accepted';
  exception when invalid_parameter_value then null; end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', viewer_user, 'role', 'authenticated')::text, true);
  select count(*) into count_events from public.task_events where task_id = created.id;
  if count_events <> 4 then raise exception 'viewer cannot read history'; end if;
  begin
    perform public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', created.id, '{"title":"Denied"}', edited.updated_at);
    raise exception 'viewer mutation accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.mutate_task(org, project, request, 'create', task_values => '{"title":"First task","estimate":3.5}');
    raise exception 'viewer replay returned a receipt';
  exception when insufficient_privilege then null; end;

  set local role service_role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  edited := public.mutate_task(org, project, extensions.gen_random_uuid(), 'update', created.id,
    '{"status":"in_review"}', edited.updated_at, 'github', 'Pull request opened', 'delivery-22');
  select * into event_row from public.task_events where task_id = created.id order by occurred_at desc, created_at desc, id desc limit 1;
  if event_row.source <> 'github' or event_row.payload ->> 'reason' <> 'Pull request opened'
    or event_row.payload ->> 'mode' <> 'automated' or event_row.correlation_id <> 'delivery-22' then
    raise exception 'automation reason/source missing';
  end if;
  reset role;
end;
$$;

-- Prove failure to persist history also rolls back the task and its receipt.
create function pg_temp.reject_test_event() returns trigger language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = 'Injected history failure';
end;
$$;
create trigger test_reject_event before insert on public.task_events
  for each row execute function pg_temp.reject_test_event();
do $$
declare
  before_task public.tasks;
  test_request uuid := extensions.gen_random_uuid();
begin
  select * into before_task from public.tasks where title = 'Edited task';
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000023","role":"authenticated"}', true);
  begin
    perform public.mutate_task(before_task.organization_id, before_task.project_id, test_request, 'update', before_task.id,
      '{"title":"Must roll back"}', before_task.updated_at);
    raise exception using errcode = 'XX000', message = 'history failure did not abort write';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Injected history failure' then raise; end if;
  end;
  if exists (select 1 from public.tasks where id = before_task.id and title <> before_task.title) then
    raise exception 'task survived failed history write';
  end if;
  reset role;
  if exists (select 1 from public.task_mutation_receipts r where r.request_id = test_request) then
    raise exception 'receipt survived failed history write';
  end if;
end;
$$;
rollback;
