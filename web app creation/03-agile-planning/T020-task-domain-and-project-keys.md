# T020 — Task Domain and Project Keys

## Status

Planned

## Depends on

`T015`, `T007`.

## Unblocks

`T021`, `T043`, `T052`.

## Goal

Define the canonical task identity and workflow model used by the board, GitHub integration, extension, and analytics.

## Owned paths

- Task domain types
- Task database migration if needed
- Task key generation utilities
- Workflow status configuration

## Implementation steps

1. Add sequential task numbers per project.
2. Generate display keys such as `PULSE-42`.
3. Add default statuses and priorities.
4. Add story points and estimate validation.
5. Add task archive/cancel behavior.
6. Document manual versus automated status transitions.

## Acceptance criteria

- [ ] Task keys are unique within a project.
- [ ] Keys are safe to use in branches, commits, and pull requests.
- [ ] Status and priority values are validated at the database boundary.
- [ ] Workflow configuration can be extended later.
- [ ] Task identity is stable after edits.

## Verification

- Test concurrent task-number creation.
- Test invalid keys, priorities, statuses, and estimates.
- Run migration and domain tests.

## Handoff

Record key-generation behavior, status values, transition rules, and any schema migration.

## Commit

`T020: define task domain and keys`
