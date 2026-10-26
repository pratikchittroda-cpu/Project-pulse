begin;

create or replace function public.get_project_github_diagnostics(
  target_organization_id uuid,
  target_project_id uuid
)
returns table (
  github_repository_count bigint,
  failed_webhook_count bigint,
  last_webhook_received_at timestamptz,
  failed_webhooks jsonb
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
  with scoped_repositories as (
    select repository.id
    from public.repositories repository
    where repository.organization_id = target_organization_id
      and repository.project_id = target_project_id
      and repository.provider = 'github'
  ),
  scoped_webhooks as (
    select webhook.*
    from public.webhook_events webhook
    join scoped_repositories repository on repository.id = webhook.repository_id
    where webhook.organization_id = target_organization_id
      and webhook.provider = 'github'
  ),
  recent_failures as (
    select webhook.*
    from scoped_webhooks webhook
    where webhook.processing_status = 'failed'
    order by webhook.received_at desc
    limit 5
  )
  select
    (select count(*)::bigint from scoped_repositories),
    count(*) filter (where webhook.processing_status = 'failed')::bigint,
    max(webhook.received_at),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'event_type', failure.event_type,
            'processing_error', left(failure.processing_error, 240),
            'received_at', failure.received_at
          )
          order by failure.received_at desc
        )
        from recent_failures failure
      ),
      '[]'::jsonb
    )
  from scoped_webhooks webhook;
end;
$$;

revoke execute on function public.get_project_github_diagnostics(uuid, uuid)
  from public;
grant execute on function public.get_project_github_diagnostics(uuid, uuid)
  to authenticated, service_role;

commit;
