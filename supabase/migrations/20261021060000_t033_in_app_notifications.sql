begin;

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  task_id uuid not null,
  source_event_id uuid not null references public.task_events(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (notification_type in (
    'task_assigned',
    'task_status_changed',
    'task_comment_mention',
    'task_review_requested',
    'task_ci_failed',
    'task_event'
  )),
  dedupe_key text not null check (char_length(btrim(dedupe_key)) between 1 and 200),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  deep_link text not null check (deep_link like '/app/organizations/%/projects/%/tasks/%'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, recipient_user_id, dedupe_key),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade
);

create index notifications_recipient_created_idx
  on public.notifications (organization_id, recipient_user_id, created_at desc, id desc);
create index notifications_recipient_unread_idx
  on public.notifications (organization_id, recipient_user_id, created_at desc, id desc)
  where read_at is null;
create index notifications_source_event_idx
  on public.notifications (source_event_id);

alter table public.notifications enable row level security;
alter table public.notifications replica identity full;

create policy notifications_select on public.notifications
  for select to authenticated
  using (
    recipient_user_id = auth.uid()
    and public.can_access_project(project_id, organization_id)
  );

-- Notification writes and read state changes go through the RPCs below. The
-- service role keeps an insert path for trusted event consumers and fixtures.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated, service_role;
grant insert on public.notifications to service_role;

create or replace function public.is_notification_type(target_type text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select target_type = any (array[
    'task_assigned',
    'task_status_changed',
    'task_comment_mention',
    'task_review_requested',
    'task_ci_failed',
    'task_event'
  ]);
$$;

revoke execute on function public.is_notification_type(text) from public, anon, authenticated, service_role;

create or replace function public.notification_deep_link(
  target_organization_id uuid,
  target_project_id uuid,
  target_task_id uuid,
  target_event_id uuid
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select format(
    '/app/organizations/%s/projects/%s/tasks/%s?event=%s',
    target_organization_id,
    target_project_id,
    target_task_id,
    target_event_id
  );
$$;

revoke execute on function public.notification_deep_link(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.enqueue_notification_for_event(
  target_event_id uuid,
  target_recipient_user_id uuid,
  target_notification_type text,
  target_title text default null,
  target_body text default null,
  target_dedupe_key text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns public.notifications
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  actor uuid := auth.uid();
  source_event public.task_events;
  source_task public.tasks;
  saved public.notifications;
  resolved_dedupe_key text;
  resolved_title text;
  resolved_body text;
  resolved_metadata jsonb;
begin
  select * into source_event
  from public.task_events event_row
  where event_row.id = target_event_id;
  if not found then
    raise exception using errcode = '23503', message = 'Notification source event is unavailable';
  end if;

  if not service_call and (
    actor is null
    or source_event.actor_id is distinct from actor
    or not public.can_write_project(source_event.project_id, source_event.organization_id)
  ) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;

  if target_recipient_user_id is null
    or not exists (
      select 1
      from public.organization_memberships organization_member
      where organization_member.organization_id = source_event.organization_id
        and organization_member.user_id = target_recipient_user_id
        and (
          organization_member.role in ('owner', 'admin')
          or exists (
            select 1
            from public.project_memberships project_member
            where project_member.organization_id = source_event.organization_id
              and project_member.project_id = source_event.project_id
              and project_member.user_id = target_recipient_user_id
          )
        )
    ) then
    raise exception using errcode = '42501', message = 'Notification recipient cannot access this project';
  end if;

  if not public.is_notification_type(target_notification_type) then
    raise exception using errcode = '22023', message = 'Notification type is invalid';
  end if;
  if target_dedupe_key is not null
    and char_length(btrim(target_dedupe_key)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Notification dedupe key is invalid';
  end if;
  if target_title is not null and char_length(btrim(target_title)) > 160 then
    raise exception using errcode = '22023', message = 'Notification title is too long';
  end if;
  if target_body is not null and char_length(btrim(target_body)) > 2000 then
    raise exception using errcode = '22023', message = 'Notification body is too long';
  end if;
  if target_metadata is not null and jsonb_typeof(target_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'Notification metadata must be an object';
  end if;

  select * into source_task
  from public.tasks task_row
  where task_row.id = source_event.task_id
    and task_row.project_id = source_event.project_id
    and task_row.organization_id = source_event.organization_id;
  if not found then
    raise exception using errcode = '23503', message = 'Notification task is unavailable';
  end if;

  resolved_title := coalesce(
    nullif(btrim(target_title), ''),
    case target_notification_type
      when 'task_assigned' then 'Task assigned to you'
      when 'task_status_changed' then 'Task status changed'
      when 'task_comment_mention' then 'You were mentioned'
      when 'task_review_requested' then 'Review requested'
      when 'task_ci_failed' then 'CI check failed'
      else 'Task activity'
    end
  );
  resolved_body := coalesce(
    nullif(btrim(target_body), ''),
    case target_notification_type
      when 'task_assigned' then format('"%s" was assigned to you.', source_task.title)
      when 'task_status_changed' then format('"%s" changed status.', source_task.title)
      when 'task_comment_mention' then format('You were mentioned on "%s".', source_task.title)
      when 'task_review_requested' then format('A review was requested for "%s".', source_task.title)
      when 'task_ci_failed' then format('A CI check failed for "%s".', source_task.title)
      else format('New activity was recorded on "%s".', source_task.title)
    end
  );
  resolved_dedupe_key := coalesce(
    nullif(btrim(target_dedupe_key), ''),
    format('event:%s:%s', source_event.id, target_notification_type)
  );
  resolved_metadata := coalesce(target_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'eventId', source_event.id,
      'eventType', source_event.event_type,
      'source', source_event.source,
      'taskId', source_event.task_id
    );

  insert into public.notifications (
    organization_id,
    project_id,
    task_id,
    source_event_id,
    recipient_user_id,
    actor_id,
    notification_type,
    dedupe_key,
    title,
    body,
    deep_link,
    metadata
  ) values (
    source_event.organization_id,
    source_event.project_id,
    source_event.task_id,
    source_event.id,
    target_recipient_user_id,
    source_event.actor_id,
    target_notification_type,
    resolved_dedupe_key,
    resolved_title,
    resolved_body,
    public.notification_deep_link(
      source_event.organization_id,
      source_event.project_id,
      source_event.task_id,
      source_event.id
    ),
    resolved_metadata
  )
  on conflict (organization_id, recipient_user_id, dedupe_key) do nothing
  returning * into saved;

  if not found then
    select * into saved
    from public.notifications notification
    where notification.organization_id = source_event.organization_id
      and notification.recipient_user_id = target_recipient_user_id
      and notification.dedupe_key = resolved_dedupe_key;
  end if;
  return saved;
end;
$$;

revoke execute on function public.enqueue_notification_for_event(uuid, uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enqueue_notification_for_event(uuid, uuid, text, text, text, text, jsonb)
  to service_role;

create or replace function public.dispatch_task_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  notification_payload jsonb := case
    when jsonb_typeof(new.payload -> 'notification') = 'object'
      then new.payload -> 'notification'
    else '{}'::jsonb
  end;
  recipient_ids jsonb := '[]'::jsonb;
  notification_type text;
  notification_title text;
  notification_body text;
  notification_dedupe_key text;
  notification_metadata jsonb := '{}'::jsonb;
  recipient_text text;
  recipient_id uuid;
  assigned_user_text text;
  assigned_user_id uuid;
  trusted_generic_source boolean := new.source in ('system', 'github', 'gitlab', 'other');
begin
  -- T028's mention hook is intentionally recognized by its event and request
  -- key shape, so an arbitrary authenticated event cannot impersonate it.
  if new.event_type = 'task.comment_mentioned'
    and new.idempotency_key like 'task-comment:%:mentioned'
    and new.payload #>> '{notification,kind}' = 'task_comment_mention'
    and jsonb_typeof(new.payload #> '{notification,recipientUserIds}') = 'array' then
    notification_type := 'task_comment_mention';
    recipient_ids := new.payload #> '{notification,recipientUserIds}';
    notification_title := new.payload #>> '{notification,title}';
    notification_body := new.payload #>> '{notification,body}';
    notification_dedupe_key := new.payload #>> '{notification,dedupeKey}';
    notification_metadata := coalesce(new.payload #> '{notification,metadata}', '{}'::jsonb);
  elsif new.event_type = 'task.status_changed'
    and new.idempotency_key like 'task-change:%' then
    select task.assignee_id into assigned_user_id
    from public.tasks task
    where task.id = new.task_id
      and task.project_id = new.project_id
      and task.organization_id = new.organization_id;
    if assigned_user_id is not null then
      notification_type := 'task_status_changed';
      recipient_ids := to_jsonb(array[assigned_user_id]);
    end if;
  elsif new.event_type = 'task.updated'
    and new.idempotency_key like 'task-change:%'
    and (new.payload #>> '{changes,assignee_id,to}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    assigned_user_text := new.payload #>> '{changes,assignee_id,to}';
    assigned_user_id := assigned_user_text::uuid;
    notification_type := 'task_assigned';
    recipient_ids := to_jsonb(array[assigned_user_id]);
  elsif trusted_generic_source
    and public.is_notification_type(notification_payload ->> 'kind')
    and jsonb_typeof(notification_payload -> 'recipientUserIds') = 'array' then
    notification_type := notification_payload ->> 'kind';
    recipient_ids := notification_payload -> 'recipientUserIds';
    notification_title := notification_payload ->> 'title';
    notification_body := notification_payload ->> 'body';
    notification_dedupe_key := notification_payload ->> 'dedupeKey';
    notification_metadata := coalesce(notification_payload -> 'metadata', '{}'::jsonb);
  end if;

  if notification_type is null or jsonb_typeof(recipient_ids) <> 'array' then
    return new;
  end if;
  if jsonb_typeof(notification_metadata) <> 'object' then
    notification_metadata := '{}'::jsonb;
  end if;

  for recipient_text in
    select value from jsonb_array_elements_text(recipient_ids)
  loop
    if recipient_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      continue;
    end if;
    recipient_id := recipient_text::uuid;
    if recipient_id = new.actor_id then
      continue;
    end if;
    if not exists (
      select 1
      from public.organization_memberships organization_member
      where organization_member.organization_id = new.organization_id
        and organization_member.user_id = recipient_id
        and (
          organization_member.role in ('owner', 'admin')
          or exists (
            select 1
            from public.project_memberships project_member
            where project_member.organization_id = new.organization_id
              and project_member.project_id = new.project_id
              and project_member.user_id = recipient_id
          )
        )
    ) then
      continue;
    end if;
    perform public.enqueue_notification_for_event(
      new.id,
      recipient_id,
      notification_type,
      left(nullif(btrim(notification_title), ''), 160),
      left(nullif(btrim(notification_body), ''), 2000),
      left(nullif(btrim(notification_dedupe_key), ''), 200),
      notification_metadata
    );
  end loop;
  return new;
end;
$$;

revoke execute on function public.dispatch_task_event_notifications() from public, anon, authenticated, service_role;

drop trigger if exists task_events_dispatch_notifications on public.task_events;
create trigger task_events_dispatch_notifications
  after insert on public.task_events
  for each row execute function public.dispatch_task_event_notifications();

create or replace function public.list_unread_notifications(
  target_organization_id uuid default null,
  target_project_id uuid default null,
  limit_count integer default 50
)
returns setof public.notifications
language sql
stable
security definer
set search_path = public, auth, pg_catalog
as $$
  select notification.*
  from public.notifications notification
  where auth.uid() is not null
    and notification.recipient_user_id = auth.uid()
    and (target_organization_id is null or notification.organization_id = target_organization_id)
    and (target_project_id is null or notification.project_id = target_project_id)
    and notification.read_at is null
    and public.can_access_project(notification.project_id, notification.organization_id)
  order by notification.created_at desc, notification.id desc
  limit least(greatest(coalesce(limit_count, 50), 1), 200);
$$;

revoke execute on function public.list_unread_notifications(uuid, uuid, integer)
  from public, anon;
grant execute on function public.list_unread_notifications(uuid, uuid, integer)
  to authenticated, service_role;

create or replace function public.mark_notification_read(
  target_notification_id uuid,
  target_read boolean default true
)
returns public.notifications
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  saved public.notifications;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  update public.notifications notification
  set read_at = case
    when coalesce(target_read, true) then coalesce(notification.read_at, timezone('utc', now()))
    else null
  end
  where notification.id = target_notification_id
    and notification.recipient_user_id = auth.uid()
    and public.can_access_project(notification.project_id, notification.organization_id)
  returning notification.* into saved;
  if not found then
    raise exception using errcode = '42501', message = 'Notification is unavailable';
  end if;
  return saved;
end;
$$;

revoke execute on function public.mark_notification_read(uuid, boolean)
  from public, anon;
grant execute on function public.mark_notification_read(uuid, boolean)
  to authenticated, service_role;

create or replace function public.mark_all_notifications_read(
  target_organization_id uuid default null,
  target_project_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  update public.notifications notification
  set read_at = coalesce(notification.read_at, timezone('utc', now()))
  where notification.recipient_user_id = auth.uid()
    and (target_organization_id is null or notification.organization_id = target_organization_id)
    and (target_project_id is null or notification.project_id = target_project_id)
    and notification.read_at is null
    and public.can_access_project(notification.project_id, notification.organization_id);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.mark_all_notifications_read(uuid, uuid)
  from public, anon;
grant execute on function public.mark_all_notifications_read(uuid, uuid)
  to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.notifications';
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;

commit;
