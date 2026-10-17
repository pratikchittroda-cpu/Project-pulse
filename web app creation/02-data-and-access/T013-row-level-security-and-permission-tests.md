# T013 — Row-Level Security and Permission Tests

## Status

Planned

## Depends on

`T011`, `T012`.

## Unblocks

`T014`, `T015`, and all protected feature work.

## Goal

Ensure organization and project data is isolated and every access rule is tested.

## Owned paths

- RLS policies and helper functions
- Database permission tests
- Permission documentation

## Implementation steps

1. Define organization membership helpers.
2. Protect organization-owned rows.
3. Protect project-owned rows.
4. Add role-based write rules.
5. Add service-role-only webhook paths.
6. Test cross-organization and cross-project access.

## Acceptance criteria

- [ ] A member cannot read another organization.
- [ ] Viewers cannot perform writes.
- [ ] Project access is enforced in the database.
- [ ] Service-role operations are not exposed to clients.
- [ ] Permission tests cover positive and negative cases.

## Verification

- Run database permission tests as multiple users and roles.
- Test direct client queries, not only UI guards.

## Handoff

Record role names, policy helper functions, and any intentionally public tables.

## Commit

`T013: add RLS policies and tests`
