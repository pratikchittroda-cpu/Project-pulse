# T011 — Initial Database Schema and Migrations

## Status

Done

## Depends on

`T010`, `T007`.

## Unblocks

`T012`, `T013`, `T014`, `T015`, `T020`, `T030`, `T044`.

## Goal

Create the durable PostgreSQL model for identity, projects, planning, events, integrations, and auditability.

## Owned paths

- `supabase/migrations/`
- Database schema documentation

## Required entities

- Organizations and memberships
- Teams and team memberships
- Projects
- Repositories and integrations
- Cycles, initiatives, epics, milestones
- Tasks and task relations
- Task events
- Comments and attachments metadata
- Webhook events
- Audit records

## Implementation steps

1. Add UUID primary keys and timestamps.
2. Add project keys and task numbers.
3. Add foreign keys and delete behavior.
4. Add indexes for project, status, assignee, sprint, task key, and event time.
5. Add update timestamp triggers.
6. Keep migrations append-only.

## Acceptance criteria

- [x] Schema supports the first task-to-merge lifecycle.
- [x] `TIMESTAMPTZ` is used consistently.
- [x] Webhook provider event IDs can be unique.
- [x] No table relies on an unprotected organization boundary.
- [x] Migration reset succeeds locally.

## Verification

Completed verification:

- `corepack pnpm run supabase:reset` applied
  `20261017000000_initial_schema.sql` to a clean local database after a failed
  first attempt was corrected before the migration was committed.
- PostgreSQL checks found all nineteen required public tables, all nineteen
  organization-owned tables with RLS enabled, forty-seven foreign keys, and
  the unique webhook provider/event-id constraint.
- A transaction-level schema smoke test inserted an organization, project,
  task in `ready_to_merge`, task event, and GitHub webhook event, then rolled
  back the fixture successfully.
- `make test` passed the full quality pipeline with twenty Vitest tests.

## Handoff

- Migration: `supabase/migrations/20261017000000_initial_schema.sql`. It is
  append-only and must not be edited after application; future changes require
  a new timestamped migration.
- Tables cover organizations/memberships, teams/team memberships, projects and
  project memberships, repositories, integrations, cycles, initiatives,
  epics, milestones, tasks, task relations, task events, comments, attachment
  metadata, webhook events, and audit records.
- Task identity is `(project_id, task_number)` with a positive task number and
  project-scoped uniqueness. Project keys are uppercase `[A-Z][A-Z0-9]{1,9}`.
- Every tenant-owned row carries `organization_id`, composite foreign keys
  prevent cross-tenant child references, and RLS is enabled on all nineteen
  tenant-owned tables. T013 adds membership/role policies; the intentional
  no-policy state currently denies client access by default.
- `public.set_updated_at()` triggers maintain UTC `updated_at` values. Indexes
  cover tenant, project, status, assignee, cycle, task number, event time,
  webhook receipt time, comments, attachments, and audit time.
- `webhook_events` enforces unique `(provider, provider_event_id)` for
  idempotency. Provider payloads remain JSONB until normalization into task
  events.
- T012 is now ready. RLS policy work in T013 remains blocked on authentication.

## Commit

`T011: add initial database schema`
