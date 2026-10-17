# T053 — Activity Telemetry and Heartbeats

## Status

Planned

## Depends on

`T051`, `T030`.

## Unblocks

`T054`, `T055`, `T060`.

## Goal

Capture lightweight activity categories without collecting source content or keystrokes.

## Owned paths

- Activity detector
- Heartbeat scheduler
- Telemetry batching and API client
- Idle detection

## Activity categories

```text
editing, debugging, testing, reviewing, building, planning, idle, offline
```

## Implementation steps

1. Listen to safe workspace/editor events.
2. Map events to activity categories.
3. Add configurable idle timeout.
4. Batch and send heartbeats.
5. Stop transmission when paused, disconnected, or unauthenticated.

## Acceptance criteria

- [ ] No source content or keystrokes are collected.
- [ ] Activity state changes are deterministic.
- [ ] Heartbeats are bounded and rate-limited.
- [ ] Idle state is visible and does not count as active time.
- [ ] Server rejection does not crash the extension.

## Verification

- Test event-to-category mapping.
- Test idle timeout, pause, rate limiting, and network failure.

## Handoff

Record event sources, heartbeat interval, idle policy, payload fields, and retention assumptions.

## Commit

`T053: add privacy-minimized telemetry`
