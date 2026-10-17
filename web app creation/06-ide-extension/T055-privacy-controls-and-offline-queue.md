# T055 — Privacy Controls and Offline Queue

## Status

Planned

## Depends on

`T053`.

## Unblocks

`T056`, security review, and telemetry release.

## Goal

Give developers direct control over telemetry and prevent data loss or unsafe transmission.

## Owned paths

- Telemetry settings
- Pause and consent commands
- Redaction and exclusion rules
- Bounded offline queue

## Implementation steps

1. Add pause/resume telemetry.
2. Add file-name suppression or hashing.
3. Add excluded path patterns.
4. Queue only bounded, non-sensitive events while offline.
5. Expire queued events after a configured period.
6. Show what data is currently enabled.

## Acceptance criteria

- [ ] Pause stops new telemetry and presence.
- [ ] Queue never stores source contents or secrets.
- [ ] Queue has size and age limits.
- [ ] Exclusion rules are tested.
- [ ] Users can inspect and clear local telemetry state.

## Verification

- Test offline, reconnect, clear, pause, and exclusion behavior.
- Inspect local storage for sensitive data.

## Handoff

Record privacy defaults, configuration keys, queue limits, and user-facing explanations.

## Commit

`T055: add telemetry privacy controls`
