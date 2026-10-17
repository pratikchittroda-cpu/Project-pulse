-- T010 keeps the seed deterministic and non-sensitive. Domain entities are
-- added by T011 migrations and can extend this seed without changing the
-- local reset command.
create table if not exists public.projectpulse_seed_metadata (
  seed_key text primary key,
  seed_value text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.projectpulse_seed_metadata (seed_key, seed_value)
values ('environment', 'local-development')
on conflict (seed_key) do update
set
  seed_value = excluded.seed_value,
  updated_at = timezone('utc', now());
