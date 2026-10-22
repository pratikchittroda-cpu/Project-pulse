# Start Here

## Purpose

This backlog is designed for multiple implementation sessions. Each task is a self-contained work unit, but tasks must respect the dependency graph.

## Before starting a task

1. Read this file.
2. Read `02-DEPENDENCY-GRAPH.md`.
3. Read `04-DEFINITION-OF-DONE.md`.
4. Read the selected task file completely.
5. Check the task's dependencies in `08-STATUS-INDEX.md`.
6. Confirm the task is not already claimed by another session.
7. Create a branch named `task/Txxx-short-description`.

## During a task

- Modify only the owned paths listed by the task.
- Do not edit another task's implementation or status.
- Do not edit an applied database migration. Add a new migration instead.
- Do not commit secrets, local tokens, or absolute machine paths.
- Keep APIs, events, and shared types aligned with `06-DATA-EVENT-CONTRACTS.md`.
- Add meaningful tests for behavior and security boundaries.

## After a task

1. Run `make test` from the repository root.
2. Run any task-specific verification commands.
3. Update the task's handoff section.
4. Set the task status to `Done` only after verification passes.
5. Commit with the task ID, for example `T023: build kanban board`.
6. Tell the next session which task is now unblocked.

## Status values

- `Planned` — defined but dependencies are not complete.
- `Ready` — dependencies are complete and the task can start.
- `In Progress` — one session currently owns the task.
- `Blocked` — work cannot continue because of a specific dependency or decision.
- `Review` — implementation is complete and awaiting review or merge.
- `Done` — implementation, tests, documentation, and handoff are complete.

## First task

Start with `01-foundation/T001-repository-bootstrap.md`.
