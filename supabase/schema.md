# ProjectPulse database schema

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

## Delivery and audit model

- `repositories` stores provider-neutral repository metadata.
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
