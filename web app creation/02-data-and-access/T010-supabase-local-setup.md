# T010 — Supabase Local Setup

## Status

Done

## Depends on

`T001`, `T003`, `T007`.

## Unblocks

`T011`.

## Goal

Make Supabase locally reproducible for database, authentication, storage, and Edge Function development.

## Owned paths

- `supabase/config.toml`
- `supabase/seed.sql`
- Supabase environment documentation
- Local Supabase scripts

## Implementation steps

1. Configure local Supabase services.
2. Define local project URL and key variables.
3. Add a reset and seed workflow.
4. Document how to start and stop the local stack.
5. Keep service-role credentials out of client configuration.

## Acceptance criteria

- [x] A clean developer can start local Supabase using documented commands.
- [x] Resetting the database is deterministic.
- [x] Seed data is safe and non-sensitive.
- [x] Environment variables are documented in `.env.example`.

## Verification

Completed verification:

- `corepack pnpm exec supabase --version` reported the pinned CLI version
  `2.121.0` from the project dependency.
- `corepack pnpm run supabase:start` started the local API, Postgres, Auth,
  Realtime, Storage, Studio, Mailpit, and Edge Runtime services with Docker.
- `corepack pnpm run supabase:reset` completed twice and applied
  `supabase/seed.sql`; the metadata query returned the same single
  `environment=local-development` row after the second reset.
- `curl http://127.0.0.1:54321/rest/v1/` returned a successful local REST
  response, confirming the API endpoint is reachable from the development host.
- `corepack pnpm run supabase:status` reported the stack running and printed
  the documented local endpoints.
- `make test` passed the project quality pipeline with eighteen Vitest tests,
  including config, seed determinism, and browser/server environment checks.

## Handoff

- CLI: Supabase `2.121.0`, pinned in the root dev dependencies and invoked via
  `corepack pnpm exec supabase`; Docker is required for the local services.
- Commands are `corepack pnpm run supabase:start`, `supabase:status`,
  `supabase:reset`, `supabase:seed`, and `supabase:stop`. Reset and seed both
  run `supabase db reset --local --yes`, which applies migrations and the
  configured seed file in order.
- Local endpoints: API `54321`, Postgres `54322`, Studio `54323`, Mailpit
  `54324`, Edge Runtime inspector `8083`, and analytics `54327`.
- `supabase/config.toml` enables Auth, Realtime, Storage, Edge Functions,
  migrations, and seed loading. Auth redirects target the Vite web port `5173`.
- `supabase/seed.sql` creates only the deterministic
  `projectpulse_seed_metadata` marker with `environment=local-development`;
  T011 can add domain entities after its migrations exist.
- `.env.example` separates browser-safe `VITE_*` variables from the server-only
  service-role and integration placeholders. No generated local keys or tokens
  are committed.
- T011 is now unblocked. T012 and later access tasks remain blocked on the
  schema and migration work.

## Commit

`T010: configure local Supabase`
