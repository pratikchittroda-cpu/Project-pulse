begin;

create table public.delivery_objects (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  repository_id uuid not null,
  provider text not null check (provider = 'github'),
  kind text not null check (kind in ('branch', 'check_run', 'commit', 'deployment', 'pull_request', 'release', 'review')),
  external_id text not null check (char_length(trim(external_id)) between 1 and 240),
  action text not null check (char_length(trim(action)) between 1 and 80),
  actor_login text,
  ref text,
  status text,
  url text,
  task_keys text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id),
  unique (provider, repository_id, kind, external_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (repository_id, organization_id)
    references public.repositories(id, organization_id) on delete cascade
);

create table public.delivery_task_links (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  delivery_object_id uuid not null,
  task_id uuid not null,
  link_source text not null default 'task_key' check (link_source in ('task_key', 'manual')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (delivery_object_id, task_id),
  foreign key (delivery_object_id, organization_id)
    references public.delivery_objects(id, organization_id) on delete cascade,
  foreign key (task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade
);

create index delivery_objects_project_occurred_idx
  on public.delivery_objects (project_id, occurred_at desc);
create index delivery_objects_repository_occurred_idx
  on public.delivery_objects (repository_id, occurred_at desc);
create index delivery_objects_kind_status_idx
  on public.delivery_objects (project_id, kind, status, occurred_at desc);
create index delivery_task_links_task_idx
  on public.delivery_task_links (task_id, created_at desc);

alter table public.delivery_objects enable row level security;
alter table public.delivery_task_links enable row level security;

create policy delivery_objects_select on public.delivery_objects
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));

create policy delivery_task_links_select on public.delivery_task_links
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));

create or replace function public.get_project_delivery_summary(
  target_organization_id uuid,
  target_project_id uuid
)
returns table (
  github_delivery_count bigint,
  last_github_delivery_at timestamptz,
  open_pull_request_count bigint,
  failed_check_count bigint,
  failed_deployment_count bigint,
  recent_deliveries jsonb
)
language plpgsql
stable
security invoker
set search_path = public, auth, extensions
as $$
begin
  if not public.can_access_project(target_project_id, target_organization_id) then
    raise exception 'Project access is required';
  end if;

  return query
  with scoped_deliveries as (
    select delivery.*
    from public.delivery_objects delivery
    where delivery.organization_id = target_organization_id
      and delivery.project_id = target_project_id
      and delivery.provider = 'github'
  ),
  recent as (
    select delivery.*
    from scoped_deliveries delivery
    order by delivery.occurred_at desc, delivery.created_at desc
    limit 8
  )
  select
    count(*)::bigint,
    max(delivery.occurred_at),
    count(*) filter (
      where delivery.kind = 'pull_request'
        and delivery.status in ('open', 'reopened')
    )::bigint,
    count(*) filter (
      where delivery.kind = 'check_run'
        and delivery.status in ('failure', 'failed', 'cancelled', 'timed_out', 'action_required')
    )::bigint,
    count(*) filter (
      where delivery.kind = 'deployment'
        and delivery.status in ('failure', 'error', 'inactive')
    )::bigint,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'action', recent_delivery.action,
            'actor_login', recent_delivery.actor_login,
            'id', recent_delivery.id,
            'kind', recent_delivery.kind,
            'occurred_at', recent_delivery.occurred_at,
            'ref', recent_delivery.ref,
            'status', recent_delivery.status,
            'task_keys', recent_delivery.task_keys,
            'url', recent_delivery.url
          )
          order by recent_delivery.occurred_at desc, recent_delivery.created_at desc
        )
        from recent recent_delivery
      ),
      '[]'::jsonb
    )
  from scoped_deliveries delivery;
end;
$$;

revoke execute on function public.get_project_delivery_summary(uuid, uuid) from public;
grant execute on function public.get_project_delivery_summary(uuid, uuid)
  to authenticated, service_role;

create or replace function public.ingest_github_delivery(
  target_repository_id uuid,
  target_delivery_id text,
  target_event_type text,
  target_payload jsonb,
  target_normalized_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  repository_row record;
  webhook_row_id uuid;
  normalized_event jsonb;
  delivery_row_id uuid;
  task_key text;
  linked_task_id uuid;
  event_kind text;
  event_action text;
  event_external_id text;
  event_occurred_at timestamptz;
  event_status text;
  event_source_key text;
  event_type text;
  inserted_links bigint := 0;
  inserted_objects bigint := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role is required';
  end if;
  if target_delivery_id is null or char_length(trim(target_delivery_id)) not between 1 and 240 then
    raise exception using errcode = '22023', message = 'GitHub delivery ID is required';
  end if;
  if target_payload is null or jsonb_typeof(target_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'GitHub payload must be an object';
  end if;
  if target_normalized_events is null or jsonb_typeof(target_normalized_events) <> 'array' then
    raise exception using errcode = '22023', message = 'Normalized events must be an array';
  end if;

  select
    repository.id,
    repository.organization_id,
    repository.project_id,
    project.project_key
  into repository_row
  from public.repositories repository
  join public.projects project
    on project.id = repository.project_id
   and project.organization_id = repository.organization_id
  where repository.id = target_repository_id
    and repository.provider = 'github';

  if not found then
    raise exception using errcode = '23503', message = 'GitHub repository is not registered';
  end if;

  insert into public.webhook_events (
    organization_id,
    repository_id,
    provider,
    provider_event_id,
    event_type,
    payload,
    processing_status
  )
  values (
    repository_row.organization_id,
    repository_row.id,
    'github',
    trim(target_delivery_id),
    lower(trim(target_event_type)),
    target_payload,
    'processing'
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into webhook_row_id;

  if webhook_row_id is null then
    return jsonb_build_object(
      'duplicate', true,
      'delivery_id', trim(target_delivery_id),
      'inserted_links', 0,
      'inserted_objects', 0
    );
  end if;

  begin
    for normalized_event in
      select value from jsonb_array_elements(target_normalized_events) value
    loop
      event_kind := lower(trim(normalized_event->>'kind'));
      event_action := lower(trim(normalized_event->>'action'));
      event_external_id := trim(normalized_event->>'external_id');
      event_occurred_at := coalesce(
        nullif(normalized_event->>'occurred_at', '')::timestamptz,
        timezone('utc', now())
      );
      event_status := nullif(lower(trim(normalized_event->>'status')), '');

      if event_kind not in ('branch', 'check_run', 'commit', 'deployment', 'pull_request', 'release', 'review')
        or event_action = ''
        or event_external_id = '' then
        continue;
      end if;

      delivery_row_id := null;
      insert into public.delivery_objects (
        organization_id,
        project_id,
        repository_id,
        provider,
        kind,
        external_id,
        action,
        actor_login,
        ref,
        status,
        url,
        task_keys,
        metadata,
        occurred_at
      )
      values (
        repository_row.organization_id,
        repository_row.project_id,
        repository_row.id,
        'github',
        event_kind,
        event_external_id,
        event_action,
        nullif(trim(normalized_event->>'actor_login'), ''),
        nullif(trim(normalized_event->>'ref'), ''),
        event_status,
        nullif(trim(normalized_event->>'url'), ''),
        coalesce(
          array(
            select distinct upper(trim(value))
            from jsonb_array_elements_text(coalesce(normalized_event->'task_keys', '[]'::jsonb)) value
            where char_length(trim(value)) between 3 and 40
          ),
          '{}'::text[]
        ),
        case
          when jsonb_typeof(normalized_event->'metadata') = 'object'
            then normalized_event->'metadata'
          else '{}'::jsonb
        end,
        event_occurred_at
      )
      on conflict (provider, repository_id, kind, external_id)
      do update set
        action = excluded.action,
        actor_login = excluded.actor_login,
        ref = excluded.ref,
        status = excluded.status,
        url = excluded.url,
        task_keys = excluded.task_keys,
        metadata = excluded.metadata,
        occurred_at = excluded.occurred_at,
        updated_at = timezone('utc', now())
      returning id into delivery_row_id;

      if delivery_row_id is null then
        select delivery.id
        into delivery_row_id
        from public.delivery_objects delivery
        where delivery.provider = 'github'
          and delivery.repository_id = repository_row.id
          and delivery.kind = event_kind
          and delivery.external_id = event_external_id;
      else
        inserted_objects := inserted_objects + 1;
      end if;

      for task_key in
        select distinct upper(trim(value))
        from jsonb_array_elements_text(coalesce(normalized_event->'task_keys', '[]'::jsonb)) value
      loop
        linked_task_id := null;
        select task.id
        into linked_task_id
        from public.tasks task
        where task.organization_id = repository_row.organization_id
          and task.project_id = repository_row.project_id
          and upper(repository_row.project_key || '-' || task.task_number::text) = task_key;

        if linked_task_id is null then
          continue;
        end if;

        insert into public.delivery_task_links (
          organization_id,
          project_id,
          delivery_object_id,
          task_id,
          link_source
        )
        values (
          repository_row.organization_id,
          repository_row.project_id,
          delivery_row_id,
          linked_task_id,
          'task_key'
        )
        on conflict (delivery_object_id, task_id) do nothing;

        if found then
          inserted_links := inserted_links + 1;
        end if;

        event_source_key := left(
          'github:' || trim(target_delivery_id) || ':' || event_external_id || ':' || linked_task_id::text,
          200
        );
        event_type := 'github.' || regexp_replace(event_kind, '[^a-z0-9_.]+', '_', 'g')
          || '.' || regexp_replace(event_action, '[^a-z0-9_.]+', '_', 'g');

        perform public.record_task_event(
          repository_row.organization_id,
          repository_row.project_id,
          linked_task_id,
          event_type,
          'github',
          event_source_key,
          jsonb_build_object(
            'action', event_action,
            'delivery_id', trim(target_delivery_id),
            'external_id', event_external_id,
            'kind', event_kind,
            'status', event_status,
            'url', nullif(trim(normalized_event->>'url'), '')
          ),
          event_occurred_at,
          trim(target_delivery_id),
          null
        );
      end loop;
    end loop;

    update public.webhook_events
    set processed_at = timezone('utc', now()),
        processing_status = 'processed',
        processing_error = null
    where id = webhook_row_id;
  exception when others then
    update public.webhook_events
    set processed_at = timezone('utc', now()),
        processing_status = 'failed',
        processing_error = left(sqlerrm, 1000)
    where id = webhook_row_id;
    raise;
  end;

  return jsonb_build_object(
    'duplicate', false,
    'delivery_id', trim(target_delivery_id),
    'inserted_links', inserted_links,
    'inserted_objects', inserted_objects
  );
end;
$$;

revoke execute on function public.ingest_github_delivery(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_github_delivery(uuid, text, text, jsonb, jsonb)
  to service_role;

commit;
