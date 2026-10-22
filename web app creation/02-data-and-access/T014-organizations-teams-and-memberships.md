# T014 — Organizations, Teams, and Memberships

## Status

Done

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

- [x] A new user can create or join an organization.
- [x] Admins can invite members.
- [x] Roles are enforced by the database and UI.
- [x] Teams can be assigned to projects and tasks.
- [x] Removed members lose access immediately.

## Verification

- `corepack pnpm run supabase:reset` applied the append-only organization
  management migration to a clean local database.
- `docker exec --interactive supabase_db_projectpulse psql -U postgres -d
  postgres -v ON_ERROR_STOP=1 < supabase/rls-tests.sql` passed direct
  PostgreSQL assertions for owner invitations, blocked member invitations,
  invitation acceptance, team assignment, owner protection, and removed-member
  access/cascade behavior.
- `make test` passed all workspace checks, typechecking, lint, formatting, build,
  27 Vitest tests, and workspace smoke checks.

## Handoff

- Migration: `supabase/migrations/20261017020000_organization_management.sql`;
  it adds the organization invitation table, transactional RPCs, team links on
  projects/tasks, and membership cleanup constraints without editing earlier
  migrations.
- `create_organization` creates the organization and authenticated caller's
  owner membership in one security-definer transaction. Slugs are normalized
  to lowercase and organization constraints remain database-enforced.
- `invite_organization_member` is owner/admin-only, stores only a SHA-256 token
  hash, returns the one-time token to the caller, supports admin/member/viewer
  roles, and defaults invitations to seven days. Client inserts/updates are not
  exposed; `revoke_organization_invitation` handles administrative revocation.
- `accept_organization_invitation` requires an authenticated user whose JWT
  email matches the invitation, rejects expired/revoked/accepted tokens, and
  creates or updates the membership atomically. The page accepts links at
  `/app/organization?invite=<token>`.
- Owner memberships cannot be role-edited or removed. Admins can change
  non-owner roles, remove non-owner members, create teams, and manage team
  membership. Removing an organization membership cascades team/project
  membership cleanup and immediately removes RLS visibility.
- Projects and tasks carry an optional same-organization `team_id`, enforced by
  composite foreign keys and RLS checks. The shared organization context drives
  the sidebar selector and persists the selected organization locally.
- Pending edge cases: invitations are one-time and email-bound; duplicate
  pending invitations are permitted by design, while token hashes remain unique.
  The UI displays the generated invitation URL once for delivery through an
  approved channel.

## Commit

`T014: add organizations and teams`
