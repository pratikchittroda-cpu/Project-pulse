# T030 — Event Envelope and Task Events

## Status

Done

## Depends on

`T007`, `T011`, `T020`.

## Unblocks

`T022`, `T031`, `T032`, `T033`, `T045`, `T060`.

## Goal

Create a durable, provider-neutral event history for task and engineering activity.

## Owned paths

- Event domain types
- Task event persistence
- Event insertion helpers
- Event query hooks

## Implementation steps

1. Implement the common event envelope.
2. Store task-facing events with source and actor.
3. Add idempotency and correlation IDs.
4. Add chronological query support.
5. Distinguish durable events from ephemeral presence.

## Acceptance criteria

- [x] Every automated transition can be explained by an event.
- [x] Duplicate events do not create duplicate history entries.
- [x] Events store source, actor, timestamps, and entity IDs.
- [x] Payloads are validated before persistence.
- [x] Queries are project-scoped and indexed.

## Verification

- `corepack pnpm run supabase:reset` applied the append-only event migration.
- `docker exec --interactive supabase_db_projectpulse psql -U postgres -d
postgres -v ON_ERROR_STOP=1 < supabase/rls-tests.sql` passed duplicate-event
  idempotency, chronological event fixtures, malformed event rejection,
  provider-source spoof rejection, viewer denial, and cross-organization read
  isolation.
- `VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=replace-with-local-anon-key make test` passed all
  workspace checks, typechecking, lint, formatting, build, 42 Vitest tests,
  and workspace smoke checks.

## Handoff

- Migration: `supabase/migrations/20261018010000_event_envelope_and_task_events.sql`.
  It extends `task_events` with source, entity, idempotency, and correlation
  fields; adds project/task ordering indexes; and enforces one event per
  organization/idempotency key.
- `record_task_event` is the trusted insertion boundary. It validates task
  ownership, event names, source, idempotency keys, payload defaults, and
  project write access. Repeating the same organization/idempotency key returns
  the original row without creating duplicate history.
- Authenticated callers may record only `internal` or `extension` events, and
  actor identity is bound to `auth.uid()`. Provider-originated sources such as
  GitHub are reserved for service-role ingestion paths.
- The shared event envelope remains provider-neutral and is validated by the
  existing `parseEventEnvelope` contract. The web repository is
  `apps/web/src/features/events/task-events-repository.ts`; it provides
  `list(scope)` ordered by occurred/created time and `record(scope, draft)`.
  `useTaskEvents` reloads after writes and exposes loading, recording, and error
  state for T022's task detail timeline.
- Durable task events are distinct from ephemeral presence. Retention is left
  to a later hardening task; this migration does not delete history.

## Commit

`T030: add event envelope and task events`
