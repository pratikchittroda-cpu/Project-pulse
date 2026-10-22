# T015 — Projects and Repository Records

## Status

Done

## Depends on

`T014`.

## Unblocks

`T020`, `T040`, `T050`, and project-level features.

## Goal

Allow teams to create project spaces and register repository metadata.

## Owned paths

- Project creation and settings pages
- Project context provider
- Repository record hooks
- Project permission checks

## Implementation steps

1. Create projects with a unique key.
2. Add title, description, repository URL, and default branch fields.
3. Add project members and team assignment.
4. Add project settings navigation.
5. Add repository records without provider-specific OAuth logic.

## Acceptance criteria

- [x] Project keys are unique within an organization.
- [x] Project access follows membership rules.
- [x] The selected project is persisted in navigation.
- [x] Repository records can later be connected to GitHub.
- [x] Invalid keys and duplicate keys have useful errors.

## Verification

- `docker exec --interactive supabase_db_projectpulse psql -U postgres -d
  postgres -v ON_ERROR_STOP=1 < supabase/rls-tests.sql` passed direct
  PostgreSQL assertions for project visibility, invalid and duplicate keys,
  archive/edit operations, member/viewer writes, and repository access.
- `make test` passed workspace checks, typechecking, lint, formatting, build, 30
  Vitest tests, and workspace smoke checks.

## Handoff

- The project administration route is `/app/projects`. The sidebar now exposes
  a project selector and a Projects navigation item. The selected project is
  persisted in `localStorage` under `projectpulse.selected-project`; the
  context falls back to the existing `PULSE` placeholder until an authenticated
  organization has accessible projects.
- Project keys are normalized to uppercase in the UI and must match
  `^[A-Z][A-Z0-9]{1,9}$`. The database also enforces that shape and
  `unique (organization_id, project_key)`. Duplicate-key and check-constraint
  errors are translated into actionable UI messages.
- Project settings support name, key, description, optional same-organization
  team assignment, and archive. Project membership management is available to
  organization owners/admins and uses the existing project RLS policies.
- Repository records store `name`, `provider` (`github`, `gitlab`, or `other`),
  `url`, and `default_branch`. URLs are validated as HTTP(S) in both the UI and
  schema. Records can be added and removed without provider OAuth or sync logic.
- The repository fields and provider enum are the extension point for T040
  GitHub integration; no access tokens or provider credentials are stored by
  this task.

## Commit

`T015: add projects and repository records`
