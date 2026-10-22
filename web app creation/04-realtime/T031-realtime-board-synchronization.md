# T031 — Realtime Board Synchronization

## Status

Done

## Depends on

`T023`, `T030`.

## Unblocks

Realtime dashboard verification and performance work.

## Goal

Keep open project views synchronized when tasks change in another session or integration.

## Owned paths

- Realtime subscription hooks
- Board synchronization logic
- Conflict and reconnect handling

## Implementation steps

1. Subscribe to organization/project-scoped task changes.
2. Apply inserts, updates, and deletes to local board state.
3. Reconcile optimistic moves with server state.
4. Reload after reconnect, timeout, channel errors, or stale snapshots.
5. Avoid duplicate and out-of-order event application.

## Acceptance criteria

- [x] Two browser sessions can receive task changes without manual refresh.
- [x] Reconnect restores current project state.
- [x] Optimistic failure does not corrupt the board.
- [x] Subscriptions stop when leaving a project.
- [x] Unauthorized channels cannot expose data through task RLS and scoped filters.

## Verification

- Test insert/update/delete, optimistic reconciliation, reconnect, duplicate
  delivery, stale ordering, cleanup, and project replacement.
- Verify the tasks table publication, full replica identity, and database/API
  permission boundaries.

## Handoff

- Channel name: `projectpulse:tasks:<organizationId>:<projectId>`. The
  subscription listens to `public.tasks` with the single-column
  `project_id=eq.<projectId>` filter supported by Supabase Realtime. Existing
  task RLS remains the server boundary; the client also rejects rows whose
  tenant/project identifiers do not match the active scope.
- `supabase/migrations/20261021062000_t031_task_realtime.sql` adds `tasks` to
  the `supabase_realtime` publication and uses full replica identity so delete
  payloads retain tenant/project scope.
- Board state keeps a per-task realtime version map. Equal fingerprints are
  ignored, older updates cannot overwrite newer state, and reloads merge only
  confirmed snapshots that are newer than the local realtime record. Reconnects
  trigger a repository reload; unmount and project changes remove the channel.
- The current board still loads the full project task snapshot before applying
  live updates. High-volume projects may later need a server cursor or bounded
  realtime cache instead of the current in-memory map.

## Commit

`T031: synchronize board in realtime`
