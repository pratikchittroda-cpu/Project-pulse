-- T028 database coverage. Every fixture and assertion rolls back.
begin;

do $$
declare
  organization_id uuid := '10000000-0000-0000-0000-000000000028';
  project_id uuid := '20000000-0000-0000-0000-000000000028';
  hidden_project_id uuid := '20000000-0000-0000-0000-000000000029';
  t028_task_id uuid := '30000000-0000-0000-0000-000000000028';
  hidden_task_id uuid := '30000000-0000-0000-0000-000000000029';
  writer_id uuid := '00000000-0000-0000-0000-000000000028';
  member_id uuid := '00000000-0000-0000-0000-000000000029';
  viewer_id uuid := '00000000-0000-0000-0000-000000000030';
  outsider_id uuid := '00000000-0000-0000-0000-000000000031';
  comment_row public.comments;
  checklist_row public.task_checklist_items;
  attachment_row public.attachments;
  original_status text;
  operation_succeeded boolean;
  visible_count integer;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (writer_id, 'authenticated', 'authenticated', 't028-writer@example.test', now(), now(), now()),
    (member_id, 'authenticated', 'authenticated', 't028-member@example.test', now(), now(), now()),
    (viewer_id, 'authenticated', 'authenticated', 't028-viewer@example.test', now(), now(), now()),
    (outsider_id, 'authenticated', 'authenticated', 't028-outsider@example.test', now(), now(), now());
  insert into public.organizations (id, name, slug)
  values (organization_id, 'T028 collaboration', 't028-collaboration');
  insert into public.organization_memberships (organization_id, user_id, role)
  values
    (organization_id, writer_id, 'member'),
    (organization_id, member_id, 'member'),
    (organization_id, viewer_id, 'viewer');
  insert into public.projects (id, organization_id, name, project_key)
  values
    (project_id, organization_id, 'T028 project', 'T028'),
    (hidden_project_id, organization_id, 'T028 hidden project', 'T29X');
  insert into public.project_memberships (organization_id, project_id, user_id, role)
  values
    (organization_id, project_id, writer_id, 'member'),
    (organization_id, project_id, member_id, 'member'),
    (organization_id, project_id, viewer_id, 'viewer');
  insert into public.tasks (id, organization_id, project_id, title, status)
  values
    (t028_task_id, organization_id, project_id, 'T028 task', 'in_progress'),
    (hidden_task_id, organization_id, hidden_project_id, 'T028 hidden task', 'backlog');
  select task.status into original_status from public.tasks task where task.id = t028_task_id;

  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', writer_id, 'role', 'authenticated')::text, true);

  select * into comment_row
  from public.manage_task_comment(
    organization_id, project_id, t028_task_id, 'create', extensions.gen_random_uuid(),
    comment_body => 'A safe comment', mentioned_user_ids => array[member_id]
  );
  if not exists (
    select 1 from public.comment_mentions mention
    where mention.comment_id = comment_row.id and mention.mentioned_user_id = member_id
  ) then
    raise exception 'project member mention did not persist';
  end if;
  if not exists (
    select 1 from public.task_events event_row
    where event_row.task_id = t028_task_id
      and event_row.event_type = 'task.comment_mentioned'
      and event_row.payload #>> '{notification,kind}' = 'task_comment_mention'
      and event_row.payload -> 'mentionedUserIds' ? member_id::text
  ) then
    raise exception 'mention notification hook payload was not recorded';
  end if;

  select * into comment_row
  from public.manage_task_comment(
    organization_id, project_id, t028_task_id, 'edit', extensions.gen_random_uuid(), comment_row.id,
    'Edited safe comment', array[member_id]
  );
  if comment_row.edit_version <> 1 then
    raise exception 'comment edit did not increment history version';
  end if;

  operation_succeeded := false;
  begin
    perform public.manage_task_comment(
      organization_id, project_id, t028_task_id, 'create', extensions.gen_random_uuid(),
      comment_body => 'Bad mention', mentioned_user_ids => array[outsider_id]
    );
    operation_succeeded := true;
  exception when insufficient_privilege then null; end;
  if operation_succeeded then
    raise exception 'non-member mention unexpectedly succeeded';
  end if;

  select * into comment_row
  from public.manage_task_comment(
    organization_id, project_id, t028_task_id, 'delete', extensions.gen_random_uuid(), comment_row.id
  );
  if comment_row.deleted_at is null then
    raise exception 'comment delete did not retain a tombstone';
  end if;
  if comment_row.body <> '[deleted]' then
    raise exception 'deleted comment RPC returned original body';
  end if;
  if exists (
    select 1 from public.task_events event_row
    where event_row.task_id = t028_task_id
      and event_row.event_type = 'task.comment_deleted'
      and event_row.payload ? 'body'
  ) then
    raise exception 'deleted comment history exposed body';
  end if;

  select * into checklist_row
  from public.manage_task_checklist_item(
    organization_id, project_id, t028_task_id, 'create', extensions.gen_random_uuid(),
    item_title => 'Run the T028 checks'
  );
  select * into checklist_row
  from public.manage_task_checklist_item(
    organization_id, project_id, t028_task_id, 'toggle', extensions.gen_random_uuid(),
    checklist_row.id, item_completed => true
  );
  if checklist_row.completed_at is null then
    raise exception 'checklist toggle did not persist';
  end if;
  if (select task.status from public.tasks task where task.id = t028_task_id) <> original_status then
    raise exception 'checklist changed task status';
  end if;

  select * into attachment_row
  from public.register_task_attachment(
    organization_id, project_id, t028_task_id, extensions.gen_random_uuid(),
    organization_id::text || '/' || project_id::text || '/' || t028_task_id::text || '/report.txt',
    'report.txt', 'text/plain', 12
  );
  if attachment_row.byte_size <> 12 or attachment_row.content_type <> 'text/plain' then
    raise exception 'attachment metadata did not persist';
  end if;
  operation_succeeded := false;
  begin
    perform public.register_task_attachment(
      organization_id, project_id, t028_task_id, extensions.gen_random_uuid(),
      organization_id::text || '/' || project_id::text || '/' || t028_task_id::text || '/bad.exe',
      'bad.exe', 'application/x-msdownload', 12
    );
    operation_succeeded := true;
  exception when invalid_parameter_value then null; end;
  if operation_succeeded then
    raise exception 'invalid attachment type unexpectedly succeeded';
  end if;
  operation_succeeded := false;
  begin
    perform public.register_task_attachment(
      organization_id, project_id, t028_task_id, extensions.gen_random_uuid(),
      organization_id::text || '/' || project_id::text || '/' || t028_task_id::text || '/large.txt',
      'large.txt', 'text/plain', 10485761
    );
    operation_succeeded := true;
  exception when check_violation then null; when invalid_parameter_value then null; end;
  if operation_succeeded then
    raise exception 'oversized attachment unexpectedly succeeded';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', viewer_id, 'role', 'authenticated')::text, true);
  select count(*) into visible_count from public.comments comment_record where comment_record.task_id = t028_task_id;
  if visible_count <> 1 then
    raise exception 'viewer could not read project comment metadata';
  end if;
  select count(*) into visible_count from public.attachments attachment_record where attachment_record.task_id = t028_task_id;
  if visible_count <> 1 then
    raise exception 'viewer attachment read was denied';
  end if;
  operation_succeeded := false;
  begin
    perform public.manage_task_checklist_item(
      organization_id, project_id, t028_task_id, 'toggle', extensions.gen_random_uuid(),
      checklist_row.id, item_completed => false
    );
    operation_succeeded := true;
  exception when insufficient_privilege then null; end;
  if operation_succeeded then
    raise exception 'viewer checklist write unexpectedly succeeded';
  end if;

  set local role service_role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.projects set archived_at = clock_timestamp() where id = project_id;
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', writer_id, 'role', 'authenticated')::text, true);
  operation_succeeded := false;
  begin
    perform public.manage_task_comment(
      organization_id, project_id, t028_task_id, 'create', extensions.gen_random_uuid(),
      comment_body => 'Archived write'
    );
    operation_succeeded := true;
  exception when sqlstate '55000' then null; end;
  if operation_succeeded then
    raise exception 'archived comment write unexpectedly succeeded';
  end if;
end;
$$;

rollback;
