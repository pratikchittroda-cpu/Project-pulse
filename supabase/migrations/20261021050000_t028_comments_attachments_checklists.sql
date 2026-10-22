begin;

-- T028 keeps comment history durable without exposing deleted text through the
-- collaboration APIs. The original body remains available to the database for
-- retention/audit work, while clients receive deleted_at and redact it.
alter table public.comments
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete set null,
  add column edit_version integer not null default 0,
  add constraint comments_edit_version_check check (edit_version >= 0),
  add constraint comments_deleted_by_check check (deleted_at is not null or deleted_by is null);

create index comments_task_visible_created_idx
  on public.comments (organization_id, project_id, task_id, created_at)
  where deleted_at is null;

create table public.comment_mentions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  task_id uuid not null,
  comment_id uuid not null,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (comment_id, mentioned_user_id),
  foreign key (comment_id, project_id, organization_id)
    references public.comments(id, project_id, organization_id) on delete cascade,
  foreign key (task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade
);

create index comment_mentions_task_idx
  on public.comment_mentions (organization_id, project_id, task_id, comment_id);

create table public.task_checklist_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  task_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  position integer not null default 0 check (position >= 0),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, project_id, organization_id),
  foreign key (task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade,
  check (completed_at is not null or completed_by is null)
);

create index task_checklist_items_task_idx
  on public.task_checklist_items (organization_id, project_id, task_id, position, created_at);

alter table public.attachments
  add constraint attachments_file_name_check
    check (char_length(btrim(file_name)) between 1 and 160),
  add constraint attachments_content_type_check
    check (lower(content_type) in (
      'application/pdf',
      'application/zip',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/markdown',
      'text/plain'
    )),
  add constraint attachments_byte_size_limit_check
    check (byte_size between 1 and 10485760),
  add constraint attachments_storage_path_check
    check (storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[A-Za-z0-9._ -]{1,200}$');

create unique index attachments_organization_storage_path_idx
  on public.attachments (organization_id, storage_path);

alter table public.comment_mentions enable row level security;
alter table public.task_checklist_items enable row level security;

create policy comment_mentions_select on public.comment_mentions
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));

create policy task_checklist_items_select on public.task_checklist_items
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy task_checklist_items_insert on public.task_checklist_items
  for insert to authenticated
  with check (public.can_write_project(project_id, organization_id));
create policy task_checklist_items_update on public.task_checklist_items
  for update to authenticated
  using (public.can_write_project(project_id, organization_id))
  with check (public.can_write_project(project_id, organization_id));
create policy task_checklist_items_delete on public.task_checklist_items
  for delete to authenticated
  using (public.can_write_project(project_id, organization_id));

-- Mutations go through the RPCs below so author ownership, mention scope,
-- archived-project state, and history writes are checked together.
revoke insert, update, delete on public.comments from anon, authenticated;
revoke insert, update, delete on public.comment_mentions from anon, authenticated;
revoke insert, update, delete on public.task_checklist_items from anon, authenticated;
revoke insert, update, delete on public.attachments from anon, authenticated;
grant select on public.comments, public.comment_mentions, public.task_checklist_items,
  public.attachments to authenticated, service_role;

create or replace function public.manage_task_comment(
  target_organization_id uuid,
  target_project_id uuid,
  target_task_id uuid,
  action text,
  request_id uuid,
  target_comment_id uuid default null,
  comment_body text default null,
  mentioned_user_ids uuid[] default '{}'::uuid[]
)
returns public.comments
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  actor uuid := auth.uid();
  saved public.comments;
  event_source text := case when service_call then 'system' else 'internal' end;
  mention_payload jsonb := to_jsonb(coalesce(mentioned_user_ids, '{}'::uuid[]));
begin
  if not service_call and (actor is null or not public.can_write_project(target_project_id, target_organization_id)) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  if not exists (
    select 1 from public.projects project
    where project.id = target_project_id
      and project.organization_id = target_organization_id
      and project.archived_at is null
  ) then
    raise exception using errcode = '55000', message = 'Project is unavailable or archived';
  end if;
  if request_id is null or action not in ('create', 'edit', 'delete') then
    raise exception using errcode = '22023', message = 'Invalid comment request';
  end if;
  if not exists (
    select 1 from public.tasks task
    where task.id = target_task_id
      and task.project_id = target_project_id
      and task.organization_id = target_organization_id
  ) then
    raise exception using errcode = '23503', message = 'Task is unavailable in this project';
  end if;
  if coalesce(array_length(mentioned_user_ids, 1), 0) > 20 then
    raise exception using errcode = '22023', message = 'A comment may mention at most 20 project members';
  end if;
  if exists (
    select 1
    from unnest(coalesce(mentioned_user_ids, '{}'::uuid[])) mentioned(user_id)
    where not exists (
      select 1
      from public.project_memberships membership
      where membership.organization_id = target_organization_id
        and membership.project_id = target_project_id
        and membership.user_id = mentioned.user_id
    )
  ) then
    raise exception using errcode = '42501', message = 'Mentions must target project members';
  end if;

  if action = 'create' then
    if target_comment_id is not null or nullif(btrim(comment_body), '') is null
      or char_length(btrim(comment_body)) > 20000 then
      raise exception using errcode = '22023', message = 'A comment needs 1 to 20,000 characters';
    end if;
    insert into public.comments (
      organization_id, project_id, task_id, author_id, body
    ) values (
      target_organization_id, target_project_id, target_task_id, actor, btrim(comment_body)
    ) returning * into saved;
    insert into public.comment_mentions (
      organization_id, project_id, task_id, comment_id, mentioned_user_id
    )
    select target_organization_id, target_project_id, target_task_id, saved.id, mentioned.user_id
    from unnest(coalesce(mentioned_user_ids, '{}'::uuid[])) mentioned(user_id)
    on conflict (comment_id, mentioned_user_id) do nothing;
    insert into public.task_events (
      organization_id, project_id, task_id, event_type, source, entity_type, entity_id,
      idempotency_key, actor_id, payload, occurred_at
    ) values (
      target_organization_id, target_project_id, target_task_id, 'task.comment_created',
      event_source, 'task', target_task_id, 'task-comment:' || request_id::text || ':created',
      actor, jsonb_build_object('version', 1, 'commentId', saved.id,
        'mentionCount', coalesce(array_length(mentioned_user_ids, 1), 0)), clock_timestamp()
    );
  else
    select * into saved
    from public.comments comment_row
      where comment_row.id = target_comment_id
      and comment_row.organization_id = target_organization_id
      and comment_row.project_id = target_project_id
      and comment_row.task_id = target_task_id
    for update;
    if not found or (not service_call and saved.author_id is distinct from actor) then
      raise exception using errcode = '42501', message = 'Only the comment author may change this comment';
    end if;
    if action = 'edit' then
      if saved.deleted_at is not null or nullif(btrim(comment_body), '') is null
        or char_length(btrim(comment_body)) > 20000 then
        raise exception using errcode = '22023', message = 'Deleted comments cannot be edited';
      end if;
      update public.comments
      set body = btrim(comment_body),
          edit_version = edit_version + 1,
          updated_at = clock_timestamp()
      where id = saved.id
      returning * into saved;
      delete from public.comment_mentions mention
      where mention.comment_id = saved.id;
      insert into public.comment_mentions (
        organization_id, project_id, task_id, comment_id, mentioned_user_id
      )
      select target_organization_id, target_project_id, target_task_id, saved.id, mentioned.user_id
      from unnest(coalesce(mentioned_user_ids, '{}'::uuid[])) mentioned(user_id)
      on conflict (comment_id, mentioned_user_id) do nothing;
      insert into public.task_events (
        organization_id, project_id, task_id, event_type, source, entity_type, entity_id,
        idempotency_key, actor_id, payload, occurred_at
      ) values (
        target_organization_id, target_project_id, target_task_id, 'task.comment_edited',
        event_source, 'task', target_task_id, 'task-comment:' || request_id::text || ':edited',
        actor, jsonb_build_object('version', 1, 'commentId', saved.id,
          'editVersion', saved.edit_version,
          'mentionCount', coalesce(array_length(mentioned_user_ids, 1), 0)), clock_timestamp()
      );
    else
      if saved.deleted_at is null then
        update public.comments
        set deleted_at = clock_timestamp(), deleted_by = actor, updated_at = clock_timestamp()
        where id = saved.id
        returning * into saved;
        delete from public.comment_mentions mention
        where mention.comment_id = saved.id;
        insert into public.task_events (
          organization_id, project_id, task_id, event_type, source, entity_type, entity_id,
          idempotency_key, actor_id, payload, occurred_at
        ) values (
          target_organization_id, target_project_id, target_task_id, 'task.comment_deleted',
          event_source, 'task', target_task_id, 'task-comment:' || request_id::text || ':deleted',
          actor, jsonb_build_object('version', 1, 'commentId', saved.id,
            'contentState', 'redacted'), clock_timestamp()
        );
      end if;
      if action = 'delete' then
        saved.body := '[deleted]';
      end if;
    end if;
  end if;

  if action in ('create', 'edit') and coalesce(array_length(mentioned_user_ids, 1), 0) > 0 then
    insert into public.task_events (
      organization_id, project_id, task_id, event_type, source, entity_type, entity_id,
      idempotency_key, actor_id, payload, occurred_at
    ) values (
      target_organization_id, target_project_id, target_task_id, 'task.comment_mentioned',
      event_source, 'task', target_task_id,
      'task-comment:' || request_id::text || ':mentioned', actor,
      jsonb_build_object(
        'version', 1,
        'commentId', saved.id,
        'mentionedUserIds', mention_payload,
        'notification', jsonb_build_object(
          'kind', 'task_comment_mention',
          'recipientUserIds', mention_payload
        )
      ), clock_timestamp()
    );
  end if;
  return saved;
end;
$$;

revoke execute on function public.manage_task_comment(uuid, uuid, uuid, text, uuid, uuid, text, uuid[])
  from public, anon, service_role;
grant execute on function public.manage_task_comment(uuid, uuid, uuid, text, uuid, uuid, text, uuid[])
  to authenticated;

create or replace function public.manage_task_checklist_item(
  target_organization_id uuid,
  target_project_id uuid,
  target_task_id uuid,
  action text,
  request_id uuid,
  item_id uuid default null,
  item_title text default null,
  item_completed boolean default null,
  item_position integer default 0
)
returns public.task_checklist_items
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  actor uuid := auth.uid();
  saved public.task_checklist_items;
  event_source text := case when service_call then 'system' else 'internal' end;
  event_name text;
begin
  if not service_call and (actor is null or not public.can_write_project(target_project_id, target_organization_id)) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  if not exists (
    select 1 from public.projects project
    where project.id = target_project_id
      and project.organization_id = target_organization_id
      and project.archived_at is null
  ) then
    raise exception using errcode = '55000', message = 'Project is unavailable or archived';
  end if;
  if request_id is null or action not in ('create', 'toggle', 'delete') then
    raise exception using errcode = '22023', message = 'Invalid checklist request';
  end if;
  if not exists (
    select 1 from public.tasks task
    where task.id = target_task_id
      and task.project_id = target_project_id
      and task.organization_id = target_organization_id
  ) then
    raise exception using errcode = '23503', message = 'Task is unavailable in this project';
  end if;

  if action = 'create' then
    if item_id is not null or nullif(btrim(item_title), '') is null
      or char_length(btrim(item_title)) > 500 or item_position < 0 then
      raise exception using errcode = '22023', message = 'A checklist item needs 1 to 500 characters';
    end if;
    insert into public.task_checklist_items (
      organization_id, project_id, task_id, title, position, created_by
    ) values (
      target_organization_id, target_project_id, target_task_id, btrim(item_title), item_position, actor
    ) returning * into saved;
    event_name := 'task.checklist_item_created';
  else
    select * into saved
    from public.task_checklist_items item
    where item.id = item_id
      and item.organization_id = target_organization_id
      and item.project_id = target_project_id
      and item.task_id = target_task_id
    for update;
    if not found then
      raise exception using errcode = '42501', message = 'Checklist item is unavailable';
    end if;
    if action = 'toggle' then
      if item_completed is null then
        raise exception using errcode = '22023', message = 'Checklist completion state is required';
      end if;
      update public.task_checklist_items
      set completed_at = case when item_completed then clock_timestamp() else null end,
          completed_by = case when item_completed then actor else null end,
          updated_at = clock_timestamp()
      where id = saved.id
      returning * into saved;
      event_name := 'task.checklist_item_toggled';
    else
      delete from public.task_checklist_items where id = saved.id;
      event_name := 'task.checklist_item_deleted';
    end if;
  end if;

  insert into public.task_events (
    organization_id, project_id, task_id, event_type, source, entity_type, entity_id,
    idempotency_key, actor_id, payload, occurred_at
  ) values (
    target_organization_id, target_project_id, target_task_id, event_name, event_source,
    'task', target_task_id, 'task-checklist:' || request_id::text, actor,
    case when event_name = 'task.checklist_item_deleted' then
      jsonb_build_object('version', 1, 'itemId', saved.id, 'contentState', 'redacted')
    else
      jsonb_build_object('version', 1, 'itemId', saved.id, 'completed', saved.completed_at is not null)
    end,
    clock_timestamp()
  );
  return saved;
end;
$$;

revoke execute on function public.manage_task_checklist_item(uuid, uuid, uuid, text, uuid, uuid, text, boolean, integer)
  from public, anon, service_role;
grant execute on function public.manage_task_checklist_item(uuid, uuid, uuid, text, uuid, uuid, text, boolean, integer)
  to authenticated;

create or replace function public.register_task_attachment(
  target_organization_id uuid,
  target_project_id uuid,
  target_task_id uuid,
  request_id uuid,
  target_storage_path text,
  target_file_name text,
  target_content_type text,
  target_byte_size bigint,
  target_comment_id uuid default null
)
returns public.attachments
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  actor uuid := auth.uid();
  saved public.attachments;
  event_source text := case when service_call then 'system' else 'internal' end;
begin
  if not service_call and (actor is null or not public.can_write_project(target_project_id, target_organization_id)) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  if not exists (
    select 1 from public.projects project
    where project.id = target_project_id
      and project.organization_id = target_organization_id
      and project.archived_at is null
  ) then
    raise exception using errcode = '55000', message = 'Project is unavailable or archived';
  end if;
  if request_id is null
    or target_storage_path !~ ('^' || target_organization_id::text || '/' || target_project_id::text || '/' || target_task_id::text || '/[A-Za-z0-9._ -]{1,200}$')
    or char_length(btrim(target_file_name)) not between 1 and 160
    or lower(target_content_type) not in (
      'application/pdf', 'application/zip', 'image/gif', 'image/jpeg',
      'image/png', 'image/webp', 'text/markdown', 'text/plain'
    )
    or target_byte_size not between 1 and 10485760 then
    raise exception using errcode = '22023', message = 'Attachment type, name, path, or size is not allowed';
  end if;
  if not exists (
    select 1 from public.tasks task
    where task.id = target_task_id
      and task.project_id = target_project_id
      and task.organization_id = target_organization_id
  ) then
    raise exception using errcode = '23503', message = 'Task is unavailable in this project';
  end if;
  if target_comment_id is not null and not exists (
    select 1 from public.comments comment_row
    where comment_row.id = target_comment_id
      and comment_row.organization_id = target_organization_id
      and comment_row.project_id = target_project_id
      and comment_row.task_id = target_task_id
      and comment_row.deleted_at is null
  ) then
    raise exception using errcode = '23503', message = 'Comment is unavailable for this attachment';
  end if;

  insert into public.attachments (
    organization_id, project_id, task_id, comment_id, uploaded_by,
    storage_path, file_name, content_type, byte_size
  ) values (
    target_organization_id, target_project_id, target_task_id, target_comment_id, actor,
    target_storage_path, btrim(target_file_name), lower(target_content_type), target_byte_size
  )
  on conflict (organization_id, storage_path) do nothing
  returning * into saved;
  if not found then
    select * into saved
    from public.attachments attachment
    where attachment.organization_id = target_organization_id
      and attachment.storage_path = target_storage_path;
  end if;

  insert into public.task_events (
    organization_id, project_id, task_id, event_type, source, entity_type, entity_id,
    idempotency_key, actor_id, payload, occurred_at
  ) values (
    target_organization_id, target_project_id, target_task_id, 'task.attachment_added',
    event_source, 'task', target_task_id, 'task-attachment:' || request_id::text, actor,
    jsonb_build_object('version', 1, 'attachmentId', saved.id,
      'fileName', saved.file_name, 'contentType', saved.content_type,
      'byteSize', saved.byte_size), clock_timestamp()
  ) on conflict (organization_id, idempotency_key) do nothing;
  return saved;
end;
$$;

revoke execute on function public.register_task_attachment(uuid, uuid, uuid, uuid, text, text, text, bigint, uuid)
  from public, anon, service_role;
grant execute on function public.register_task_attachment(uuid, uuid, uuid, uuid, text, text, text, bigint, uuid)
  to authenticated;

create or replace function public.parse_projectpulse_attachment_path(target_name text)
returns table(organization_id uuid, project_id uuid, task_id uuid)
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if target_name is null or target_name !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[A-Za-z0-9._ -]{1,200}$' then
    return;
  end if;
  organization_id := split_part(target_name, '/', 1)::uuid;
  project_id := split_part(target_name, '/', 2)::uuid;
  task_id := split_part(target_name, '/', 3)::uuid;
  return next;
exception when invalid_text_representation then
  return;
end;
$$;
revoke execute on function public.parse_projectpulse_attachment_path(text) from public, anon;
grant execute on function public.parse_projectpulse_attachment_path(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'projectpulse-attachments',
  'projectpulse-attachments',
  false,
  10485760,
  array[
    'application/pdf', 'application/zip', 'image/gif', 'image/jpeg',
    'image/png', 'image/webp', 'text/markdown', 'text/plain'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists projectpulse_attachment_objects_select on storage.objects;
create policy projectpulse_attachment_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'projectpulse-attachments'
    and exists (
      select 1
      from public.parse_projectpulse_attachment_path(name) path
      join public.attachments attachment
        on attachment.organization_id = path.organization_id
       and attachment.project_id = path.project_id
       and attachment.task_id = path.task_id
       and attachment.storage_path = storage.objects.name
      where public.can_access_project(path.project_id, path.organization_id)
    )
  );

drop policy if exists projectpulse_attachment_objects_insert on storage.objects;
create policy projectpulse_attachment_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'projectpulse-attachments'
    and exists (
      select 1
      from public.parse_projectpulse_attachment_path(name) path
      join public.projects project
        on project.id = path.project_id
       and project.organization_id = path.organization_id
      join public.tasks task
        on task.id = path.task_id
       and task.project_id = path.project_id
       and task.organization_id = path.organization_id
      where project.archived_at is null
        and public.can_write_project(path.project_id, path.organization_id)
    )
  );

drop policy if exists projectpulse_attachment_objects_delete on storage.objects;
create policy projectpulse_attachment_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'projectpulse-attachments'
    and exists (
      select 1
      from public.attachments attachment
      where attachment.storage_path = storage.objects.name
        and attachment.uploaded_by = auth.uid()
    )
  );

commit;
