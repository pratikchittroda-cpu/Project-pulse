# Parallel Session Guide

## Recommended model

Use one implementation session per task and one branch per session.

Example:

```text
Session A -> task/T023-kanban-board
Session B -> task/T041-webhook-verification
Session C -> task/T053-telemetry-heartbeats
```

## Safe parallel lanes

After the foundation is ready, these lanes can run in parallel:

- Database and access: `T010` through `T015`.
- Web design system: `T005` and `T006`.
- Extension scaffold: `T050` after `T002`.
- Core planning features after `T021`.
- GitHub connection after `T015`.

## Shared-file rules

- Root configuration is owned by foundation tasks.
- A feature session must not rewrite the lockfile unless dependencies are part of its task.
- Applied migrations are immutable. Add a new migration for every schema change.
- Shared UI primitives belong to `T006`; feature sessions add feature components instead of changing primitives unnecessarily.
- `08-STATUS-INDEX.md` is updated by the coordinating session only.

## Handoff format

Every completed task must report:

```text
Task:
Branch:
Status:
Files changed:
Tests run:
Migration files:
Known limitations:
Newly unblocked tasks:
Suggested next task:
```

## Conflict resolution

If two tasks need the same file:

1. Stop the lower-priority task.
2. Record the conflict in its task file.
3. Let the earlier dependency own the shared change.
4. Rebase or merge only after the owner task is complete.
