# T021 — Task CRUD and Data Hooks

## Status

Planned

## Depends on

`T020`, `T013`.

## Unblocks

`T022`, `T023`, `T024`, `T026`, `T027`, `T028`.

## Goal

Implement secure task creation, reading, updating, archiving, and assignment.

## Owned paths

- Task repository/API functions
- Task query and mutation hooks
- Task create/edit forms
- Task list primitives

## Implementation steps

1. Add task queries scoped to the active project.
2. Add create and edit mutations.
3. Add assignment, labels, priority, estimate, due date, and status updates.
4. Add optimistic updates only where conflict behavior is defined.
5. Add server-side validation and permission handling.

## Acceptance criteria

- [ ] Authorized users can create and edit tasks.
- [ ] Viewers cannot mutate tasks.
- [ ] Task keys are displayed consistently.
- [ ] Validation errors are actionable.
- [ ] Archived tasks are not shown in active views by default.

## Verification

- Test CRUD success and failure paths.
- Test project isolation and viewer restrictions.
- Run `make test`.

## Handoff

Record query names, mutation behavior, cache invalidation, and form validation rules.

## Commit

`T021: implement task CRUD`
