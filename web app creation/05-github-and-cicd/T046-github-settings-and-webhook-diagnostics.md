# T046 — GitHub Settings and Webhook Diagnostics

## Status

In progress

## Depends on

`T040`, `T041`, `T042`.

## Unblocks

Production integration support and `T091`.

## Goal

Give administrators visibility into integration configuration and failures.

## Owned paths

- Integration settings page
- Webhook delivery history
- Replay controls
- Connection health indicators

## Implementation steps

1. Display connected account and repository.
2. Display webhook registration and last delivery state.
3. Show safe delivery details without secrets.
4. Add replay for failed normalized events.
5. Add reconnect, disconnect, and scope remediation.

## Acceptance criteria

- [ ] Admins can diagnose missing events.
- [ ] Non-admins cannot access secrets or replay controls.
- [ ] Replay is idempotent.
- [ ] Failure messages suggest a next action.
- [x] Disconnect preserves historical engineering data.

## Verification

- Test all permission roles.
- Test failed delivery, replay, and disconnected integration states.

## Handoff

Record diagnostic fields, redaction rules, replay permissions, and operational limitations.

## Commit

`T046: add GitHub integration diagnostics`
