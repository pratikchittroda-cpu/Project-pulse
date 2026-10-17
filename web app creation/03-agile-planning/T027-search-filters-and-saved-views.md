# T027 — Search, Filters, and Saved Views

## Status

Planned

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

1. Search task keys, titles, descriptions, labels, branches, and PRs.
2. Add status, priority, assignee, sprint, team, and label filters.
3. Persist filter state in URLs.
4. Save named views per user and project.
5. Add accessible filter controls and clear-all behavior.

## Acceptance criteria

- [ ] Search returns only authorized records.
- [ ] Filters can be combined.
- [ ] Saved views can be created, edited, and deleted.
- [ ] A view can be shared through a URL without leaking data.
- [ ] Search remains usable on mobile.

## Verification

- Test filter combinations and permission boundaries.
- Test URL reload and saved-view behavior.

## Handoff

Record query indexes, filter serialization, and search limitations.

## Commit

`T027: add search filters and saved views`
