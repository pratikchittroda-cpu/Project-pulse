# T054 — Extension Presence Publishing

## Status

Planned

## Depends on

`T032`, `T053`.

## Unblocks

`T093` and live task presence.

## Goal

Publish the current developer activity to the project presence channel.

## Owned paths

- Realtime presence client
- Presence lifecycle in the extension
- Presence display integration on the dashboard

## Implementation steps

1. Join the authorized project channel after connection.
2. Publish task, branch, activity, and optional redacted file.
3. Update on activity changes and heartbeat.
4. Leave on disconnect, pause, or workspace close.
5. Add stale presence handling.

## Acceptance criteria

- [ ] Presence appears on the correct project and task.
- [ ] Presence disappears after disconnect or expiry.
- [ ] Paused users are not displayed as active.
- [ ] File display follows privacy settings.
- [ ] Presence cannot cross organization boundaries.

## Verification

- Test join, update, leave, expiry, and reconnect.
- Verify dashboard behavior with multiple developers.

## Handoff

Record presence payload, channel lifecycle, retry behavior, and dashboard integration points.

## Commit

`T054: publish extension presence`
