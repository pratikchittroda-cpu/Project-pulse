# T071 — Slack and Teams Integrations

## Status

Planned

## Depends on

`T070`, `T040`.

## Unblocks

External team notifications.

## Goal

Send selected ProjectPulse events to approved Slack or Microsoft Teams destinations.

## Implementation steps

1. Define provider-neutral outbound notification events.
2. Add connection and channel mapping.
3. Add safe message templates.
4. Respect user and project notification preferences.
5. Retry failures without duplicating messages.
6. Add disconnect and secret rotation behavior.

## Acceptance criteria

- [ ] Administrators control destination mapping.
- [ ] Messages link back to authorized ProjectPulse pages.
- [ ] Secrets are never exposed in UI or logs.
- [ ] Duplicate source events are deduplicated.
- [ ] Provider failure is visible to administrators.

## Verification

- Test connection, mapping, delivery, retry, and disconnect.
- Test notification redaction and permission behavior.

## Handoff

Record provider scopes, message templates, retry policy, and destination ownership.

## Commit

`T071: add Slack and Teams notifications`
