# T032 — Realtime Developer Presence

## Status

Planned

## Depends on

`T030`, `T014`.

## Unblocks

`T054`, presence badges, and live activity views.

## Goal

Display current developer activity without persisting every heartbeat.

## Owned paths

- Presence channel helpers
- Presence state types
- Presence expiry logic
- Presence UI primitives

## Implementation steps

1. Define project-scoped presence state.
2. Add activity, task, branch, and optional redacted file fields.
3. Add expiry and offline behavior.
4. Enforce project membership before joining channels.
5. Keep presence ephemeral and separate from durable sessions.

## Acceptance criteria

- [ ] Active users appear on the correct project/task.
- [ ] Stale presence expires automatically.
- [ ] No source content is exposed.
- [ ] Presence is hidden when telemetry is paused.
- [ ] A user cannot join another organization's channel.

## Verification

- Test join, update, leave, expiry, and authorization behavior.
- Test a paused telemetry state.

## Handoff

Record channel naming, state shape, expiry interval, and UI usage guidance.

## Commit

`T032: add realtime developer presence`
