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

Task events use the same project boundary. Authenticated event writes require
the current actor and project write access; the `record_task_event` RPC accepts
only internal or extension sources from clients. Provider-originated sources
remain service-role ingestion paths, and organization/idempotency uniqueness
prevents duplicate history entries.

Migration `20261020000000_atomic_task_history.sql` adds transactional task
history. The `mutate_task` RPC checks current project write access before either
performing a change or returning a matching request receipt. Updates require
the last observed `updated_at`; stale changes fail with `40001`. Receipts are
private, keyed by organization/request ID, and bind the project, actor, and
request content. Changing any of those on replay fails rather than returning
another actor's or project's data.

An AFTER trigger records create/update/status/archive/restore events in the
same transaction as the task. Direct client writes to `task_events` are revoked;
explicit non-lifecycle events go through `record_task_event`, whose replay checks
also compare project, task, actor, source, type, payload, and correlation. The
`task-change:` idempotency prefix is reserved for trigger-owned history.
Clients use the authenticated actor and `internal` mutation source; trusted
service-role automation must supply a source and non-empty reason.

The scoped detail route queries project, task, sprint, and history using their
organization/project IDs with the authenticated browser client. Viewer roles
can read assigned tasks and history but cannot mutate them. Missing and
inaccessible tasks share a non-disclosing UI state. `test:db` checks these
boundaries in PostgreSQL; `test:api` additionally verifies them through local
Auth/PostgREST, including same-organization private projects and removed members.

Add policy changes as new append-only migrations. Do not weaken the organization
or project helper functions in feature-specific SQL.
