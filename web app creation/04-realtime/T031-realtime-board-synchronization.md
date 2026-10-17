# T031 — Realtime Board Synchronization

## Status

Planned

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

1. Subscribe to project-scoped task changes.
2. Apply inserts, updates, and deletes to local state.
3. Reconcile optimistic updates with server state.
4. Handle reconnect and stale snapshots.
5. Avoid duplicate event application.

## Acceptance criteria

- [ ] Two browser sessions see task changes without manual refresh.
- [ ] Reconnect restores current project state.
- [ ] Optimistic failure does not corrupt the board.
- [ ] Subscriptions stop when leaving a project.
- [ ] Unauthorized channels cannot expose data.

## Verification

- Test two-session updates.
- Test reconnect and duplicate delivery behavior.

## Handoff

Record channel names, subscription filters, local cache rules, and known scaling limits.

## Commit

`T031: synchronize board in realtime`
