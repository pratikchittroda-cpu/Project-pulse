# ProjectPulse RLS permissions

Migration `20261017010000_add_rls_policies.sql` adds the membership-aware RLS
boundary for the schema created by T011. Helper functions are `security
definer`, use a restricted search path, and are executable only by
`authenticated` and `service_role`.

## Role matrix

- **Owner/admin**: organization and project administration, membership/team
  management, and all project reads/writes.
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
