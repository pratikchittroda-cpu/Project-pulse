# T011 — Initial Database Schema and Migrations

## Status

Planned

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

- [ ] Schema supports the first task-to-merge lifecycle.
- [ ] `TIMESTAMPTZ` is used consistently.
- [ ] Webhook provider event IDs can be unique.
- [ ] No table relies on an unprotected organization boundary.
- [ ] Migration reset succeeds locally.

## Verification

- Apply migrations to a clean local database.
- Reset and reapply migrations.
- Run schema and foreign-key checks.

## Handoff

Record migration names, table ownership, indexes, and any deferred schema.

## Commit

`T011: add initial database schema`
