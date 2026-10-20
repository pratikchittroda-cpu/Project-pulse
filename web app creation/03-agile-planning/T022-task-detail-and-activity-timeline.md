# T022 — Task Detail and Activity Timeline

## Status

In Progress

## Depends on

`T021`, `T030`.

## Unblocks

`T084`.

## Goal

Create the main task detail experience and make every important state change understandable.

## Owned paths

- Task detail page
- Task metadata panels
- Activity timeline components
- Task route data loading

## Implementation steps

1. Display title, description, status, priority, assignee, sprint, and estimate.
2. Add linked branch, commit, PR, CI, and deployment sections as data becomes available.
3. Render task events in chronological order.
4. Explain whether an event was manual, automated, or provider-originated.
5. Add loading, error, and missing-link states.

## Acceptance criteria

- [ ] A user can understand the current task state from one page.
- [ ] Timeline entries show actor, source, time, and change.
- [ ] Automated transitions show their reason.
- [ ] Related engineering objects can be added without redesigning the page.
- [ ] Unauthorized users cannot open the task.

## Verification

- Test timeline ordering and event rendering.
- Test empty, loading, and permission states.

## Handoff

Record page route, timeline event types, and reserved areas for GitHub and telemetry data.

## Commit

`T022: add task detail and timeline`
