# T044 — Pull Request, CI, and Deployment Models

## Status

Planned

## Depends on

`T042`, `T011`.

## Unblocks

`T045`, `T062`, `T063`.

## Goal

Persist engineering delivery objects so tasks can show code and release state separately.

## Owned paths

- Pull request migration and types
- Review records
- CI run/check records
- Deployment records
- Provider link components

## Implementation steps

1. Add pull request identity and state.
2. Add review state and reviewers.
3. Add CI check and run status.
4. Add deployment environment and status.
5. Preserve provider links and commit SHAs.
6. Add project/task relation records.

## Acceptance criteria

- [ ] A task can link multiple commits and PRs.
- [ ] CI status is separate from task status.
- [ ] Deployment status is separate from merge status.
- [ ] Provider records are deduplicated.
- [ ] The model supports future GitLab or Bitbucket adapters.

## Verification

- Test upsert behavior for repeated provider events.
- Test status transitions and relation queries.

## Handoff

Record schema, status mappings, provider identifiers, and links used by the task detail page.

## Commit

`T044: add delivery object models`
