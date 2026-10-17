# T010 — Supabase Local Setup

## Status

Planned

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

- [ ] A clean developer can start local Supabase using documented commands.
- [ ] Resetting the database is deterministic.
- [ ] Seed data is safe and non-sensitive.
- [ ] Environment variables are documented in `.env.example`.

## Verification

- Start local Supabase.
- Reset and seed the database.
- Verify the web app can reach the local project.

## Handoff

Record CLI version assumptions, startup commands, ports, and seed entities.

## Commit

`T010: configure local Supabase`
