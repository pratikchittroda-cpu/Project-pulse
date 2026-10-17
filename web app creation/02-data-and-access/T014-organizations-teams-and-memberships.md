# T014 — Organizations, Teams, and Memberships

## Status

Planned

## Depends on

`T012`, `T013`.

## Unblocks

`T015`, planning features, and team analytics.

## Goal

Build organization onboarding and membership management.

## Owned paths

- Organization pages
- Team pages
- Member invitation flow
- Membership hooks and mutations

## Implementation steps

1. Create organization onboarding.
2. Add member invitations and role assignment.
3. Add team creation and team membership.
4. Add member removal and role changes.
5. Display organization and team context in navigation.

## Acceptance criteria

- [ ] A new user can create or join an organization.
- [ ] Admins can invite members.
- [ ] Roles are enforced by the database and UI.
- [ ] Teams can be assigned to projects and tasks.
- [ ] Removed members lose access immediately.

## Verification

- Test owner, admin, member, viewer, and removed-member flows.
- Run RLS tests after UI changes.

## Handoff

Record invitation behavior, role matrix, and pending membership edge cases.

## Commit

`T014: add organizations and teams`
