# ProjectPulse RLS permissions

Migration `20261017010000_add_rls_policies.sql` adds the membership-aware RLS
boundary for the schema created by T011. Helper functions are `security
definer`, use a restricted search path, and are executable only by
`authenticated` and `service_role`.

Migration `20261017020000_organization_management.sql` adds the organization
invitation and team-assignment boundaries. Invitation creation, acceptance, and
revocation use security-definer RPCs; clients cannot insert or mutate invitation
rows directly. Project and task team assignments must reference a team in the
same organization, and removing an organization membership cascades its team
and project memberships.

## Role matrix

- **Owner/admin**: organization and project administration, membership/team
  management, and all project reads/writes. Owner memberships cannot be removed
  or demoted.
- **Member**: reads projects they belong to and can create/update planning,
  task, relation, comment, attachment, and task-event records within those
  projects.
- **Viewer**: reads assigned project data but cannot write project-owned rows.
- **Removed member / other organization**: no rows are visible through
  authenticated client queries.
- **Anon**: no organization or project rows are visible.
- **Service role**: server-side webhook, audit, ingestion, and migration
  operations bypass RLS. These credentials never belong in browser code.

`webhook_events` and `audit_records` intentionally have no client policies;
they are service-role-only paths. RLS policy tests in `supabase/rls-tests.sql`
use direct PostgreSQL role and JWT-claim simulation to prove positive member
reads, cross-organization denial, viewer write denial, and client webhook write
denial.

Add policy changes as new append-only migrations. Do not weaken the organization
or project helper functions in feature-specific SQL.
