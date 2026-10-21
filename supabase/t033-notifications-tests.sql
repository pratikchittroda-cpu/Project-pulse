-- T033 database coverage. Every fixture and assertion rolls back.
begin;

do $$
<<t033_notification_test>>
declare
  organization_id uuid := '10000000-0000-0000-0000-000000000033';
  project_id uuid := '20000000-0000-0000-0000-000000000033';
  hidden_project_id uuid := '20000000-0000-0000-0000-000000000034';
  task_id uuid := '30000000-0000-0000-0000-000000000033';
  hidden_task_id uuid := '30000000-0000-0000-0000-000000000034';
  writer_id uuid := '00000000-0000-0000-0000-000000000033';
  recipient_id uuid := '00000000-0000-0000-0000-000000000034';
  viewer_id uuid := '00000000-0000-0000-0000-000000000035';
  outsider_id uuid := '00000000-0000-0000-0000-000000000036';
  comment_id uuid;
  mention_event_id uuid;
  notification_id uuid;
  visible_count integer;
  unread_count integer;
  marked_count integer;
  operation_succeeded boolean;
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (writer_id, 'authenticated', 'authenticated', 't033-writer@example.test', now(), now(), now()),
    (recipient_id, 'authenticated', 'authenticated', 't033-recipient@example.test', now(), now(), now()),
    (viewer_id, 'authenticated', 'authenticated', 't033-viewer@example.test', now(), now(), now()),
    (outsider_id, 'authenticated', 'authenticated', 't033-outsider@example.test', now(), now(), now());

  insert into public.organizations (id, name, slug)
  values (organization_id, 'T033 notifications', 't033-notifications');
  insert into public.organization_memberships (organization_id, user_id, role)
  values
    (organization_id, writer_id, 'member'),
    (organization_id, recipient_id, 'member'),
    (organization_id, viewer_id, 'viewer');
  insert into public.projects (id, organization_id, name, project_key)
  values
    (project_id, organization_id, 'T033 project', 'T033'),
    (hidden_project_id, organization_id, 'T033 hidden project', 'T34X');
  insert into public.project_memberships (organization_id, project_id, user_id, role)
  values
    (organization_id, project_id, writer_id, 'member'),
    (organization_id, project_id, recipient_id, 'member'),
    (organization_id, project_id, viewer_id, 'viewer');
  insert into public.tasks (id, organization_id, project_id, title, assignee_id)
  values
    (task_id, organization_id, project_id, 'T033 task', recipient_id),
    (hidden_task_id, organization_id, hidden_project_id, 'T033 hidden task', null);

  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', writer_id, 'role', 'authenticated')::text,
    true
  );

  select comment_record.id into comment_id
  from public.manage_task_comment(
    organization_id,
    project_id,
    task_id,
    'create',
    '00000000-0000-0000-0000-000000000033'::uuid,
    comment_body => 'T033 mention',
    mentioned_user_ids => array[recipient_id]
  ) comment_record;
  select event_row.id into mention_event_id
  from public.task_events event_row
   where event_row.task_id = t033_notification_test.task_id
    and event_row.event_type = 'task.comment_mentioned'
  order by event_row.created_at desc
  limit 1;
  if mention_event_id is null then
    raise exception 'mention event was not recorded';
  end if;

  set local role service_role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select notification.id into notification_id
  from public.notifications notification
  where notification.recipient_user_id = recipient_id
    and notification.source_event_id = mention_event_id;
  if notification_id is null then
    raise exception 'mention notification was not created';
  end if;
  if not exists (
    select 1 from public.notifications notification
    where notification.id = notification_id
      and notification.notification_type = 'task_comment_mention'
      and notification.dedupe_key = 'event:' || mention_event_id::text || ':task_comment_mention'
       and notification.deep_link = '/app/organizations/' || t033_notification_test.organization_id
        || '/projects/' || t033_notification_test.project_id || '/tasks/' || t033_notification_test.task_id
        || '?event=' || mention_event_id
      and notification.read_at is null
  ) then
    raise exception 'mention notification fields were not persisted';
  end if;

  perform public.enqueue_notification_for_event(
    mention_event_id,
    recipient_id,
    'task_comment_mention'
  );
  select count(*) into visible_count
  from public.notifications notification
  where notification.recipient_user_id = recipient_id
    and notification.source_event_id = mention_event_id;
  if visible_count <> 1 then
    raise exception 'duplicate source event created another notification';
  end if;

  perform public.enqueue_notification_for_event(
    mention_event_id,
    recipient_id,
    'task_event',
    'Second notification',
    'A second dedupe key is allowed',
    't033-second-key'
  );
  perform public.enqueue_notification_for_event(
    mention_event_id,
    viewer_id,
    'task_event',
    'Viewer notification',
    'A viewer may read project notifications',
    't033-viewer-key'
  );
  operation_succeeded := false;
  begin
    perform public.enqueue_notification_for_event(
      mention_event_id,
      outsider_id,
      'task_event',
      'Outsider notification',
      'This must be rejected',
      't033-outsider-key'
    );
    operation_succeeded := true;
  exception when insufficient_privilege then null; end;
  if operation_succeeded then
    raise exception 'cross-project recipient unexpectedly succeeded';
  end if;

  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', recipient_id, 'role', 'authenticated')::text,
    true
  );
  select count(*) into unread_count
  from public.list_unread_notifications(organization_id, project_id, 50);
  if unread_count <> 2 then
    raise exception 'recipient unread retrieval returned %, expected 2', unread_count;
  end if;

  select saved.id into notification_id
  from public.mark_notification_read(notification_id, true) saved;
  if not exists (
    select 1 from public.notifications notification
    where notification.id = notification_id and notification.read_at is not null
  ) then
    raise exception 'mark read did not persist';
  end if;
  marked_count := public.mark_all_notifications_read(organization_id, project_id);
  if marked_count <> 1 then
    raise exception 'mark all read changed %, expected 1', marked_count;
  end if;
  select count(*) into unread_count
  from public.list_unread_notifications(organization_id, project_id, 50);
  if unread_count <> 0 then
    raise exception 'mark all read left unread notifications';
  end if;

  perform public.mark_notification_read(notification_id, false);
  select count(*) into unread_count
  from public.list_unread_notifications(organization_id, project_id, 50);
  if unread_count <> 1 then
    raise exception 'mark unread did not restore one unread notification';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', viewer_id, 'role', 'authenticated')::text,
    true
  );
  select count(*) into visible_count
  from public.notifications notification;
  if visible_count <> 1 then
    raise exception 'viewer notification scoping returned % rows, expected 1', visible_count;
  end if;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', outsider_id, 'role', 'authenticated')::text,
    true
  );
  select count(*) into visible_count
  from public.notifications notification;
  if visible_count <> 0 then
    raise exception 'outsider read project notifications';
  end if;

  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', writer_id, 'role', 'authenticated')::text,
    true
  );
  operation_succeeded := false;
  begin
    insert into public.notifications (
      organization_id,
      project_id,
      task_id,
      source_event_id,
      recipient_user_id,
      notification_type,
      dedupe_key,
      title,
      body,
      deep_link
    ) values (
      organization_id,
      project_id,
      task_id,
      mention_event_id,
      recipient_id,
      'task_event',
      't033-direct-write',
      'Direct write',
      'Must fail',
      public.notification_deep_link(organization_id, project_id, task_id, mention_event_id)
    );
    operation_succeeded := true;
  exception when insufficient_privilege then null; end;
  if operation_succeeded then
    raise exception 'authenticated notification insert unexpectedly succeeded';
  end if;
end;
$$;

rollback;
