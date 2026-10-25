# T020 — Task Domain and Project Keys

## Status

Done

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

- [x] Task keys are unique within a project.
- [x] Keys are safe to use in branches, commits, and pull requests.
- [x] Status and priority values are validated at the database boundary.
- [x] Workflow configuration can be extended later.
- [x] Task identity is stable after edits.

## Verification

- `corepack pnpm run supabase:reset` applied the append-only task-domain
  migration successfully.
- `docker exec --interactive supabase_db_projectpulse psql -U postgres -d
postgres -v ON_ERROR_STOP=1 < supabase/rls-tests.sql` passed generated task
  numbering, explicit-number advancement, custom workflow status, invalid
  status/priority/estimate, immutable task identity, project-key stability,
  project access, viewer restrictions, and repository assertions.
- Two concurrent PostgreSQL sessions inserted tasks into one project and
  received task numbers `1` and `2` without collision.
- `make test` passed all workspace checks, typechecking, lint, formatting, build,
  33 Vitest tests, and workspace smoke checks.

## Handoff

- Migration: `supabase/migrations/20261017030000_task_domain_and_workflow.sql`.
  It adds `project_task_sequences`, configurable
  `project_workflow_statuses`, project metadata seeding, task-number triggers,
  and immutable task/project identity guards.
- New tasks reserve numbers from a per-project sequence row locked with
  `SELECT ... FOR UPDATE`. The trigger accepts an explicit positive number for
  imports and advances the sequence when needed; normal inserts receive the
  next number. Task keys are rendered by `formatTaskKey(projectKey, number)` as
  `PROJECT-42`.
- Default statuses are `backlog`, `planned`, `in_progress`, `blocked`,
  `in_review`, `changes_requested`, `ready_to_merge`, `completed`, and
  `canceled`. Projects may add statuses matching the database-safe lowercase
  identifier pattern. Terminal defaults are `completed` and `canceled`.
- Priorities remain `urgent`, `high`, `medium`, and `low`; the existing task
  estimate check rejects negative values. The workflow foreign key rejects
  undefined statuses before persistence.
- Task identity (`organization_id`, `project_id`, `task_number`) cannot change
  after creation. Project keys remain editable until the project has tasks;
  after the first task, changing the project key is rejected so branch/commit/PR
  references remain stable.
- Status transitions are intentionally not automated in T020. Manual UI writes
  and later event/provider automation must use the configured status rows and
  record their reasons in the T030 event history.

## Commit

`T020: define task domain and keys`
