# T021 — Task CRUD and Data Hooks

## Status

Done

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

- [x] Authorized users can create and edit tasks.
- [x] Viewers cannot mutate tasks.
- [x] Task keys are displayed consistently.
- [x] Validation errors are actionable.
- [x] Archived tasks are not shown in active views by default.

## Verification

- `corepack pnpm run supabase:reset` applied the append-only task CRUD
  validation migration successfully.
- `docker exec --interactive supabase_db_projectpulse psql -U postgres -d
  postgres -v ON_ERROR_STOP=1 < supabase/rls-tests.sql` passed direct
  PostgreSQL assertions for member task edits, assignment boundaries, labels,
  archive behavior, invalid status/priority/estimate input, viewer mutation
  denial, cross-organization isolation, archived-task active filtering, and
  archived-project read-only rules.
- `make test` passed all workspace checks, typechecking, lint, formatting, build,
  37 Vitest tests, and workspace smoke checks.

## Handoff

- Migration: `supabase/migrations/20261018000000_task_crud_validation.sql`.
  It adds labels, finite estimate/date constraints, project-member assignee
  validation, `created_by` defaulting to the authenticated user, and a database
  guard that keeps archived projects read-only.
- The repository layer lives in
  `apps/web/src/features/tasks/task-repository.ts`. Its scoped operations are
  `list(scope, includeArchived)`, `options(scope)`, `save(scope, draft,
  previous?)`, and `setArchived(scope, task, archived)`. Every query carries
  both organization and project IDs; updates use `updated_at` as a lightweight
  conflict guard and then reload from the server rather than applying an
  optimistic mutation.
- `useTasks` owns loading/error/saving state, reloads after successful writes,
  and prevents overlapping mutations. Active queries filter `archived_at is
  null`; the archive toggle explicitly includes archived rows.
- The route is `/app/tasks`. Task forms support title, description, configured
  status, priority, assignee, comma-separated labels, estimate, and due date.
  Task keys use the T020 `formatTaskKey` contract and are displayed on every
  task card.
- Client validation returns field-level errors for title length, unknown status,
  priority, labels, estimate, and calendar dates. PostgreSQL repeats the
  important checks and translates permission/constraint failures into useful
  repository errors.
- The task page is read-only for viewers and archived projects. Project-level
  access is still enforced by the existing RLS helpers; no task row is read
  outside the selected organization/project scope.

## Commit

`T021: implement task CRUD`
