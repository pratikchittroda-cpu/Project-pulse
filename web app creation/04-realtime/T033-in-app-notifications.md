# T033 — In-App Notifications

## Status

Done

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

1. Define notification types, target users, and dedupe keys.
2. Create notifications from task assignment/status, mention, review, and CI
   event hooks.
3. Add read, unread, and mark-all-read actions.
4. Add deep links to the relevant task/event.
5. Deliver through Realtime with unread retrieval fallback and deduplication.

## Acceptance criteria

- [x] Notifications are scoped to the intended user.
- [x] Notifications link to the relevant task or event.
- [x] Duplicate source events do not spam the inbox.
- [x] Read state persists.
- [x] Realtime delivery is supplemented by unread retrieval.

## Verification

- Test notification creation, deduplication, read/unread/mark-all state, deep
  links, realtime fallback, and project permission boundaries.

## Handoff

- Notification types are `task_assigned`, `task_status_changed`,
  `task_comment_mention`, `task_review_requested`, `task_ci_failed`, and
  `task_event`. Rows are scoped to recipient, organization, project, task, and
  source event; `(organization_id, recipient_user_id, dedupe_key)` prevents
  duplicate inbox entries.
- T028 mention events fan out to project members through the notification
  trigger. Task assignment/status events and trusted generic event payloads use
  the same service-side enqueue boundary. Actor self-notifications are skipped.
- `/app/notifications` retrieves unread rows, subscribes to recipient-scoped
  Realtime changes, marks individual/all rows read, and falls back to retrieval
  after channel errors or when Realtime is unavailable. Deep links retain the
  task scope and source event ID.
- The workspace header uses the same recipient-scoped subscription, so the
  unread badge updates while the user is on another route. Task detail changes
  reload the notification and history surfaces through the shared detail stream.
- Email, chat, and push delivery are intentionally future event-consumer
  extensions; the durable inbox remains the source of truth.

## Commit

`T033: add in-app notifications`
