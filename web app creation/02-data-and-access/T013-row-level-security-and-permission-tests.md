# T013 — Row-Level Security and Permission Tests

## Status

Done

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

- [x] A member cannot read another organization.
- [x] Viewers cannot perform writes.
- [x] Project access is enforced in the database.
- [x] Service-role operations are not exposed to clients.
- [x] Permission tests cover positive and negative cases.

## Verification

Completed verification:

- `corepack pnpm run supabase:reset` applied the RLS policy migration to a
  clean local database.
- `docker exec --interactive supabase_db_projectpulse psql ... <
  supabase/rls-tests.sql` passed direct PostgreSQL permission assertions for
  owner, member, viewer, and cross-organization users.
- The permission script verified positive project reads, cross-organization
  denial, viewer write denial, and client webhook write denial in one
  transaction with rollback fixtures.
- Database inspection reported sixty-two public policies, four restricted
  helper functions, and RLS enabled for both service-role-only webhook/audit
  tables. `make test` passed twenty-five Vitest tests.

## Handoff

- Migration: `supabase/migrations/20261017010000_add_rls_policies.sql`; it is
  append-only and follows the T011 schema migration.
- Helpers are `is_org_member`, `has_org_role`, `can_access_project`, and
  `can_write_project`. They are `security definer`, use `search_path = public,
  auth`, and are executable only by `authenticated` and `service_role`.
- Roles are owner/admin, member, viewer, removed member, anon, and service
  role. Organization admins can administer projects and memberships; members
  can write assigned projects; viewers are read-only; cross-organization rows
  are invisible.
- `webhook_events` and `audit_records` intentionally have no client policies;
  only service-role/migration paths can access them. No tables are intentionally
  public.
- Direct permission coverage lives in `supabase/rls-tests.sql`; it simulates
  JWT subjects with `request.jwt.claim.sub` and rolls back all fixtures.
- T014 and T015 are now unblocked. T013 policy helpers should be reused by
  later feature migrations instead of duplicating membership queries.

## Commit

`T013: add RLS policies and tests`
