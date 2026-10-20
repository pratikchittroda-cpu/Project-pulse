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

## Sprint planning and historical snapshots

Migrations `20261021000000_backlog_sprints.sql` and
`20261021010000_cycle_snapshots_and_carryover.sql` add sprint lifecycle,
membership accounting, snapshots, and a scoped `cycle_events` ledger. Apply both
with `corepack pnpm exec supabase migration up --local`; neither migration
requires resetting existing data.

Authenticated project writers use `manage_cycle` for create/edit/start/pause/
complete/cancel. Every call requires a request ID; updates also require the last
observed cycle `updated_at`. Permission and archived-project checks precede
receipt replay. Private `cycle_mutation_receipts` bind the actor, project, and
request content. Stale versions fail with `40001`; invalid closed-history edits
fail with `55000`. A unique index enforces one active cycle per project.

Direct cycle insert/update/delete privileges are revoked from `anon`,
`authenticated`, and `service_role`. The lifecycle RPC is authenticated-only;
service-role RLS bypass does not bypass these SQL privileges. Clients cannot
write the cycle ledger or access cycle receipts. Authorized project readers can
read cycles and `cycle_events`; viewer roles retain read access but cannot plan.
Removing organization membership also removes access to its sprint history.

Task membership and estimates use the existing `mutate_task` RPC and task
version checks. Triggers lock affected cycles, update open totals, and record
membership/estimate/status events in the same transaction. Failure to record
either task or sprint history rolls the mutation and receipt back. Lifecycle
changes likewise commit their snapshot, audit record, and receipt together.

## Roadmap hierarchy

Initiatives are organization-scoped: authenticated organization members can read
them, while only organization owners/admins can create, update, or delete them.
Epics and milestones are project-scoped: assigned project readers can read them,
and project owners/admins/members can write them. Viewers retain read access but
cannot mutate roadmap items. Composite organization/project foreign keys prevent
an epic or milestone from crossing a tenant or project boundary.

Tasks link to `epic_id` and `milestone_id` through the existing atomic
`mutate_task` RPC. The T025 append-only migration keeps request receipts,
expected-version checks, and task history while allowing those two hierarchy
fields. A link to an epic or milestone from another project fails at the database
foreign-key boundary. Roadmap list queries remain scoped by the authenticated
organization/project and are paginated for bounded reads.

Milestone target dates are finite optional `date` values. The roadmap marks a
milestone overdue only when its target date is before the current date and its
status is neither completed nor canceled. Progress is a client-readable rollup
of RLS-visible tasks: canceled tasks are excluded, terminal non-canceled statuses
count as complete, and unestimated tasks contribute zero points.

## Task dependencies and blockers

T026 keeps dependency reads behind the existing organization/project RLS
boundary. Viewers and assigned project readers can read visible `task_relations`
rows; removed members, other organizations, and anonymous clients cannot see
them. Direct `task_relations` insert/update/delete privileges are revoked from
clients and service role. Authenticated project writers use the
`manage_task_relation` security-definer RPC, which is the only mutation path and
is not executable by `anon` or `service_role`.

The RPC checks the active project, actor write access, same-project active tasks,
explanation/date validity, duplicate edges, and recursive cycles before changing
the graph. A private receipt binds the organization, project, actor, request
fingerprint, and response for safe retries. Each create/delete records a
task-scoped dependency event for both endpoints in the same transaction. Viewer
and archived-project UI flows remain read-only, while project writers can create
and remove dependencies through the task detail editor.

Initial and closing snapshots preserve string task numbers, keys, titles,
estimates, and workflow status. Completed/canceled cycle rows stay immutable.
Tasks cannot enter a closed cycle or change estimate/status/archive state while
remaining in it. Moving membership out is allowed without changing those fields
in the same operation; the UI offers this for unfinished work. The historical
snapshot and unfinished-at-close metrics remain fixed after carryover. Direct
task deletion cannot erase closed history; normal organization/project cascade
cleanup remains available to authorized administrators.

Add policy changes as new append-only migrations. Do not weaken the organization
or project helper functions in feature-specific SQL.
