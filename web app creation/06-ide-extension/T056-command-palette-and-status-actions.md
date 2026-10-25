# T056 — Command Palette and Status Actions

## Status

Planned

## Depends on

`T052`, `T055`.

## Unblocks

Fast developer workflows and extension polish.

## Goal

Let developers perform common ReleaseArc actions without leaving the IDE.

## Commands

- Start current task
- Stop current task
- Mark ready for review
- Mark blocked
- Pause telemetry
- Resume telemetry
- Open task in browser
- Refresh PR and CI state

## Acceptance criteria

- [ ] Commands appear only when relevant.
- [ ] Actions confirm success or explain failure.
- [ ] Permission errors are clear.
- [ ] Status changes create the same task events as dashboard actions.
- [ ] Commands respect telemetry pause state.

## Verification

- Test every command with connected, disconnected, paused, and unauthorized states.
- Verify event history after each mutation.

## Handoff

Record command IDs, enablement rules, API mutations, and user-visible messages.

## Commit

`T056: add IDE status commands`
