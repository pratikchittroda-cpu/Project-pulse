# T015 — Projects and Repository Records

## Status

Planned

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

- [ ] Project keys are unique within an organization.
- [ ] Project access follows membership rules.
- [ ] The selected project is persisted in navigation.
- [ ] Repository records can later be connected to GitHub.
- [ ] Invalid keys and duplicate keys have useful errors.

## Verification

- Test create, edit, archive, and access scenarios.
- Verify project keys are safe for task identifiers.

## Handoff

Record project key validation, route shape, repository fields, and the GitHub integration extension points.

## Commit

`T015: add projects and repository records`
