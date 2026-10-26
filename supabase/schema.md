# ReleaseArc database schema

Migration `20261017000000_initial_schema.sql` establishes the durable model
used by the dashboard, extension, integrations, and event pipeline.

## Ownership and identity

- `organizations` is the tenant boundary. Every organization-owned table has a
  required `organization_id` column and foreign key.
- `organization_memberships`, `teams`, `team_memberships`, and
  `project_memberships` connect Supabase Auth users to organization and project
  access. Role policy helpers are added by T013.
- `projects.project_key` is uppercase and limited to ten characters. Task
  identity is stored as `(project_id, task_number)`; the display key is derived
  by application code, for example `PULSE-42`.

## Planning model

`cycles`, `initiatives`, `epics`, `milestones`, `tasks`, and `task_relations`
support the first planning-to-delivery lifecycle. Project and organization
columns are repeated on child records so composite foreign keys prevent rows
from crossing tenant boundaries accidentally.

`initiatives` are organization-level goals. `epics` belong to a project and may
reference an initiative in the same organization. `milestones` belong to a
project and carry a finite optional `target_date`; both epics and milestones use
the shared planned/active/completed/canceled status vocabulary. Tasks may link to
one epic and one milestone independently, with composite foreign keys enforcing
the same project and organization. T025 adds indexed hierarchy reads and extends
the atomic task mutation RPC so hierarchy changes are included in task history.

Roadmap progress is calculated from active, unarchived child tasks: canceled
tasks are excluded from the denominator; configured terminal non-canceled
statuses count as completed; null estimates count as tasks and contribute zero
points. The UI loads the hierarchy and tasks in bounded pages, then explains each
initiative, epic, and milestone rollup from its child task links.

T026 uses `task_relations` for a canonical dependency graph. A `blocks` row
stores the blocker in `task_id` and the blocked task in `related_task_id`; the
application derives the inverse blocked-by view without storing reciprocal rows.
Each dependency may carry a trimmed explanation and finite target date. The
authenticated `manage_task_relation` RPC validates active same-project tasks,
rejects self-links, duplicates, and cycles, serializes graph changes per project,
and records private request receipts. Dependency changes emit task-scoped
`task.dependency_changed` history events for both affected tasks. Repository
summaries expose blocker counts, blocking counts, and active urgent/high-priority
blocker signals for boards and later health analytics.

T027 adds `task_saved_views`, scoped by organization, project, and authenticated
user. A saved view stores only normalized filter state as JSON; its RLS policy
lets a user manage their own views only inside a project they can access.

T028 extends `comments` with edit/delete metadata and adds project-scoped
`comment_mentions` and `task_checklist_items`. Comment and checklist mutations
use authenticated RPCs so author ownership, project-member mentions, archived
projects, and task history are checked atomically. `attachments` keeps protected
metadata for task files and enforces the PDF/ZIP/image/Markdown/text allowlist,
10 MiB size limit, and organization/project/task storage path. The private
`projectpulse-attachments` bucket uses signed URLs and storage policies derived
from the metadata row's project access.

T031 adds `tasks` to the `supabase_realtime` publication with full replica
identity for tenant-safe delete payloads. The board subscribes to one
organization/project channel and merges versioned changes into its local cache;
the durable task/event tables remain the source of truth.

T032 keeps developer presence ephemeral in Supabase Presence channels. Presence
state is not stored in the application schema; `realtime.messages` policies use
the encoded organization/project topic and `can_access_project` to authorize
authenticated readers and publishers. The application redacts file metadata and
expires stale records locally.

T033 adds durable recipient-scoped `notifications` rows with source event IDs,
dedupe keys, read timestamps, metadata, and task/event deep links. A task-event
trigger fans out approved mention/assignment/status/generic notification hooks;
the table is included in the Realtime publication, while unread RPC retrieval
remains the recovery path after reconnects.

## Delivery and audit model

- `repositories` stores provider-neutral repository metadata.
- `delivery_objects` stores normalized GitHub delivery history; disconnecting a
  repository nulls its repository reference without deleting delivery records or
  task links.
- `integrations` stores provider connection state and non-secret configuration.
- `task_events` stores normalized task activity with lower-case dot-separated
  event names.
- `webhook_events` stores provider delivery IDs with a unique
  `(provider, provider_event_id)` constraint for idempotency.
- `comments` and `attachments` store collaboration content and storage
  metadata; file bytes belong in Supabase Storage.
- `audit_records` stores durable actor/action/entity audit information.

## Security and migration rules

All organization-owned tables enable RLS in this migration. They intentionally
have no client policies yet: T013 adds membership-aware policies after T012
establishes session handling. Service-role and migration operations can still
bootstrap local data. Add future changes as append-only migrations; never edit
this applied migration in place.

All persisted timestamps use `timestamptz` with UTC defaults. Mutable tables
use `public.set_updated_at()` triggers. Indexes cover tenant, project, status,
assignee, cycle, task number, event time, webhook receipt time, and audit time.
