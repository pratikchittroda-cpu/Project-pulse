# T070 — Notification Preferences

## Status

Planned

## Depends on

`T033`, `T045`.

## Unblocks

`T071`, `T072`.

## Goal

Give users control over which project events reach them and through which channels.

## Implementation steps

1. Define notification categories.
2. Add user-level defaults.
3. Add project-level overrides.
4. Add quiet hours and digest preference.
5. Respect preferences in notification creation and delivery.

## Acceptance criteria

- [ ] Users can disable non-critical notifications.
- [ ] Mentions and direct assignments remain visible.
- [ ] Preferences are scoped correctly.
- [ ] Quiet hours do not lose events.
- [ ] Notification behavior is documented.

## Verification

- Test each category, override, and quiet-hours behavior.
- Test notification permission boundaries.

## Handoff

Record category names, default values, precedence rules, and delivery integration hooks.

## Commit

`T070: add notification preferences`
