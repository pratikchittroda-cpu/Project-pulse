# T026 — Task Dependencies and Blockers

## Status

Done

## Depends on

`T021`.

## Unblocks

Scope health and risk indicators.

## Goal

Make dependencies and blockers explicit instead of hiding them in comments.

## Owned paths

- Task relation model
- Dependency editor
- Blocker UI
- Dependency validation

## Implementation steps

1. Support a canonical `blocks` relation and derive blocked-by views from it.
2. Enforce self-link, duplicate, cross-project, archived-task, and cycle checks
   in the database mutation RPC.
3. Show dependency state on Kanban cards and task detail.
4. Require a blocker explanation and allow an optional finite target date.
5. Add warnings and health summaries for blocked urgent/high-priority tasks.

## Acceptance criteria

- [x] Users can create and remove valid dependency links.
- [x] Self-dependencies are rejected.
- [x] Blocking tasks are visible from both sides.
- [x] Blocked tasks have an explanation.
- [x] Dependency data is available to health analytics.

## Verification

- Test graph validation, request replay, deletion, and rollback behavior.
- Test cross-project, cross-organization, viewer, and direct-write restrictions.
- Test task-detail and Kanban dependency state through the application repositories.
- Test PostgREST create/read/summary/delete readback with real Auth sessions.

## Handoff

- T026 stores only canonical `blocks` rows in `task_relations`: `task_id` is the
  blocker and `related_task_id` is the blocked task. The UI exposes the inverse
  `blocked by` view without storing reciprocal rows.
- Writes go through the authenticated `manage_task_relation` RPC. It uses a
  project advisory transaction lock, private request receipts, and recursive
  reachability checks. Self-links, duplicate links, cycles, archived tasks,
  cross-project tasks, and cross-organization access are rejected.
- Each relation requires a trimmed explanation of 1–2,000 characters and may
  include a finite `target_date`. Relation changes emit task-scoped history
  events for both affected tasks; relation metadata remains in the event payload.
- The repository exposes `blockerCount`, `blockingCount`, and
  `hasCriticalBlocker`. A critical blocker is an active urgent/high-priority
  task blocking an active task. These summaries are available to board cards and
  later scope-health analytics.
- Dependency reads are organization/project scoped and exclude archived tasks
  from active health summaries. Viewers can read dependencies; only project
  writers can mutate them, and archived projects remain read-only.

## Commit

`T026: add task dependencies and blockers`
