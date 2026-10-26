begin;

alter table public.webhook_events
  add column if not exists updated_at timestamptz not null
  default timezone('utc', now());

update public.webhook_events
set updated_at = coalesce(processed_at, received_at, timezone('utc', now()))
where updated_at is null;

comment on column public.webhook_events.updated_at is
  'Last processing-state update; maintained by the shared updated-at trigger.';

commit;
