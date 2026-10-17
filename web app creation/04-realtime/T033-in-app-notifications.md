# T033 — In-App Notifications

## Status

Planned

## Depends on

`T030`, `T032`.

## Unblocks

`T070`, notification-driven workflows.

## Goal

Create a reliable in-app notification inbox for important project events.

## Owned paths

- Notification schema and helpers
- Notification inbox UI
- Read/unread mutations
- Realtime notification delivery

## Implementation steps

1. Define notification types and target users.
2. Create notifications from task, mention, review, and CI events.
3. Add read, unread, and mark-all-read actions.
4. Add deep links to the relevant project object.
5. Avoid duplicate notifications for duplicate events.

## Acceptance criteria

- [ ] Notifications are scoped to the intended user.
- [ ] Notifications link to the relevant task or event.
- [ ] Duplicate source events do not spam the inbox.
- [ ] Read state persists.
- [ ] Realtime delivery is supplemented by unread retrieval.

## Verification

- Test notification creation, deduplication, and read state.
- Test project permission boundaries.

## Handoff

Record notification types, dedupe keys, delivery hooks, and future email/chat extension points.

## Commit

`T033: add in-app notifications`
