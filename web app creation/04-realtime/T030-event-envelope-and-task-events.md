# T030 — Event Envelope and Task Events

## Status

Planned

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

- [ ] Every automated transition can be explained by an event.
- [ ] Duplicate events do not create duplicate history entries.
- [ ] Events store source, actor, timestamps, and entity IDs.
- [ ] Payloads are validated before persistence.
- [ ] Queries are project-scoped and indexed.

## Verification

- Test duplicate insertion and event ordering.
- Test malformed external payload rejection.

## Handoff

Record event names, persistence rules, idempotency behavior, and retention assumptions.

## Commit

`T030: add event envelope and task events`
