# T027 — Search, Filters, and Saved Views

## Status

Done

## Depends on

`T023`, `T021`.

## Unblocks

Efficient project navigation and analytics drill-down.

## Goal

Make project work discoverable as task and event volume grows.

## Owned paths

- Search input and results
- Board and backlog filters
- Saved-view model
- URL filter serialization

## Implementation steps

1. Search task keys, titles, descriptions, labels, and optional branch/PR metadata.
2. Add status, priority, assignee, sprint, team, label, and archived filters.
3. Persist filter state in URLs.
4. Save named views per user and project.
5. Add accessible filter controls and clear-all behavior across task list, board,
   and backlog.

## Acceptance criteria

- [x] Search returns only authorized records.
- [x] Filters can be combined.
- [x] Saved views can be created, edited, and deleted.
- [x] A view can be shared through a URL without leaking data.
- [x] Search remains usable on mobile.

## Verification

- Test filter combinations, URL reload, accessible clear-all behavior, and
  permission boundaries.
- Test saved-view create/readback/update/delete and owner isolation.

## Handoff

- Filter state serializes as `q`, `status`, `priority`, `assignee`, `sprint`,
  `team`, `label`, and `archived` query parameters. Routes remain authenticated
  and project-scoped; URL state never supplies authorization.
- Task list reads are paginated in the repository before client-side filtering.
  Search covers task keys, titles, descriptions, labels, and optional branch or
  pull-request fields when provider-backed task records populate them. The base
  schema does not yet persist those provider fields.
- `task_saved_views` is user/project scoped with a unique name per owner and
  project. View filters are normalized before storage and RLS prevents cross-user
  or inaccessible-project access.
- The shared filter panel is responsive and reused by Tasks, Board, and Backlog.

## Commit

`T027: add search filters and saved views`
