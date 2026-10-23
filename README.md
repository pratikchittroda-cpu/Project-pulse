# ProjectPulse

ProjectPulse is a real-time engineering operations platform that connects agile
planning, developer activity, source-control events, CI/CD signals, analytics,
and delivery health.

The implementation backlog lives in [`web app creation/`](web%20app%20creation/).
Read [`web app creation/00-project-control/00-START-HERE.md`](web%20app%20creation/00-project-control/00-START-HERE.md)
before starting a task.

## Repository layout

```text
apps/
  web/                  Web application workspace (@projectpulse/web)
  vscode-extension/     VS Code/Cursor extension workspace (projectpulse-vscode-extension)
packages/
  domain/               Shared domain types and contracts (@projectpulse/domain)
  integrations/         External provider adapters (@projectpulse/integrations)
  ui/                   Shared UI primitives (@projectpulse/ui)
scripts/                Repository validation scripts
web app creation/       Dependency-aware implementation backlog
```

Each workspace has a private package manifest, a strict TypeScript configuration,
and build, test, lint, and typecheck scripts. The web workspace imports the
shared `@projectpulse/domain` package through the pnpm workspace reference.

## Prerequisites

- Node.js `22.14.0`, the version pinned in [`.nvmrc`](.nvmrc)
- Corepack, distributed with Node.js, to provide the pnpm version pinned in
  [`package.json`](package.json)

No globally installed project dependency is required.

## First local setup

From the repository root, install exactly from the committed lockfile:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build
```

The first build compiles the shared packages used by the web development server.
Use `corepack pnpm` for every command; a separate global `pnpm` or `nvm` install
is not required when the pinned Node runtime and Corepack are available.

## Bootstrap validation

Run the offline repository check with:

```sh
make test
```

`make test` runs the complete offline quality pipeline: workspace validation,
strict typechecking, ESLint, Prettier validation, all workspace builds, the
Vitest smoke suite, and workspace checks. A failure exits non-zero and the
workspace name is included in recursive pnpm output.

The workspace readiness check is also available:

```sh
corepack pnpm run workspace:check
```

The check validates all five package names and their shared quality scripts.

## Workspace commands

Run the complete workspace commands from the repository root:

```sh
corepack pnpm run dev
corepack pnpm run build
corepack pnpm run test
corepack pnpm run lint
corepack pnpm run typecheck
corepack pnpm run format:check
```

To target one workspace, use its package name with pnpm's filter syntax:

```sh
corepack pnpm --filter @projectpulse/web build
corepack pnpm --filter @projectpulse/domain typecheck
```

The web development entry point is the React/Vite shell on the Vite default
port (`5173`). Use `corepack pnpm --filter @projectpulse/web preview` to serve
the production build locally.

Shared interface primitives live in `@projectpulse/ui`. Import components such
as `Button`, `Input`, `Card`, `Dialog`, `Tabs`, `StatusBadge`, `PriorityBadge`,
`Menu`, `DataTable`, `Toast`, and `PageLayout` from that package. Its design
tokens and responsive styles are available through `@projectpulse/ui/styles.css`.

Shared domain contracts live in `@projectpulse/domain`. Use its entity types,
workflow unions, API envelopes, pagination types, ISO date helpers, and
`parseEventEnvelope` validator at external event boundaries.

## Task planning

After selecting an organization and project in the web app, open `/app/tasks` to
create and manage project tasks. Task numbers are assigned by PostgreSQL and are
displayed with the stable project key, such as `PULSE-42`. The page supports
status, priority, assignee, labels, estimate, due date, edit, archive, and
restore flows. Active views hide archived tasks by default; viewer roles and
archived projects remain read-only at both the UI and database boundaries.

Click a task title to open
`/app/organizations/:organizationId/projects/:projectId/tasks/:taskId`.
The detail page shows the task state, sprint, metadata, edit/archive controls,
and chronological activity. Timeline entries include actor, source, time,
changed values, and an automation reason when provided. Branch, commit, pull
request, CI, and deployment areas are reserved for later integrations.

The task detail page also shows **Dependencies**. Add a `blocked by` or `blocks`
link with a required explanation and optional target date, then remove it after
the work is unblocked. The database rejects self-links, duplicate links, cycles,
archived-task links, and cross-project links. Urgent and high-priority tasks with
active blockers show a critical warning; viewers and archived projects retain
read-only dependency visibility.

Task list, Board, and Backlog share URL-backed **Search and filters** for task
keys, titles, descriptions, labels, statuses, priorities, assignees, sprints,
teams, and archived visibility. A filter URL is safe to share because it carries
only filter state; the destination still requires authenticated project access.
Save named views per project and account, then apply, rename, or delete them
without changing another user's views. Provider-backed branch and pull-request
metadata is included automatically when those fields are available.

Task details also include **Comments**, project-member mentions, protected
attachments, and checklists. Comment edits and deletes are author-controlled and
leave safe activity history. Attachments use a private storage bucket with an
allowlist and 10 MiB limit. Checklist completion is independent from task status,
and viewers or archived projects remain read-only.

Use **Board** in the workspace navigation or open `/app/board` for the
configured Kanban workflow. Cards are grouped by project status and include
priority, estimate, assignee, labels, a compact detail disclosure, and a link
back to the task detail page. Authorized users can drag cards between columns or
choose a destination in the keyboard-friendly **Move** control. Moves update
optimistically and restore the original column if the server rejects the write.
Board filters cover task text/keys/descriptions/labels, priority, assignee, and
archived visibility. Cards show blocker and blocking counts when dependencies
exist. Each column reports its current WIP count; the current
schema has no persisted WIP limit, so the board labels that state honestly as
`no limit`. Viewer roles and archived projects remain read-only.

Use **Backlog** or `/app/backlog` to create sprints, set optional calendar dates,
and assign unarchived tasks with story-point estimates. Estimates may be blank
(unestimated) or non-negative numbers with up to two decimal places. A project
has at most one active sprint. **Pause** releases the active slot; **Resume**
preserves the original commitment. Active or paused sprints can be completed;
pause an active sprint before canceling it.

The first start captures task details and initial commitment. Current scope,
completed work, and added/removed points and task counts update transactionally,
including scope changes while paused. Unestimated tasks count as work but add
zero points. Estimate adjustments count their net point difference. Configured
terminal statuses count as completed except `canceled`.

Completion or cancellation freezes historical task details and totals. Expand
**Closed sprint history**, choose a destination, and **Carry over** unfinished
work to the backlog or another open sprint. Carryover preserves the old snapshot;
change the task's estimate or status afterward. **Unfinished at close** stays
fixed even after tasks move. There is no automatic bulk carryover. Viewers and
archived projects are read-only. Use **Reload planning** after a stale-version
error or to see other users' changes; the Kanban board also receives scoped task
inserts, updates, and deletes through Supabase Realtime and reloads after a
reconnect.
Legacy closed sprints without recorded snapshots display that absence explicitly.

Use **Roadmap** or `/app/roadmap` for the planning hierarchy above tasks. Create
organization-level initiatives, project epics, and project milestones with
planned/active/completed/canceled status. Epics may belong to an initiative;
tasks can link independently to an epic and a milestone. Owners/admins manage
initiatives, project writers manage epics, milestones, and task links, and
viewers can read assigned project roadmap data without mutation controls.

Roadmap progress is explainable from the visible child tasks. Canceled tasks are
excluded from the active denominator; terminal non-canceled workflow statuses
count as completed. The view reports completed/active task counts and estimated
points, with unestimated tasks counted as tasks and contributing zero points.
Milestones show an **Overdue** badge when their finite target date is before the
current date and their status is not completed or canceled. Status and initiative
filters are local to the loaded project scope. Reads are paginated in 100-row
pages and task hierarchy writes use the atomic task mutation/history contract.

Task writes use `mutate_task`: PostgreSQL commits the task, its history, and a
request receipt atomically. Identical retries within the same repository instance
reuse the request ID; stale versions are rejected. Reload the task after a
conflict. No-op changes add no event. Existing tasks may have no history before
automatic recording was installed. Use **Reload task** or **Refresh history**
to retrieve new changes; the board synchronizes confirmed task changes live,
while durable task history and ephemeral presence remain separate concerns.

The workspace includes a **Notifications** inbox at `/app/notifications` for
task assignment/status changes, project-member mentions, review/CI hooks, and
important task activity. Notifications are recipient-scoped, deduplicated by
source event, linked to the relevant task, and support individual or mark-all
read state. Realtime delivery is supplemented by unread retrieval after a
reconnect or channel failure.

Developer presence is available through the project-scoped Presence controller
and `ActiveDevelopers` UI primitive. It expires after 45 seconds without an
update, redacts file metadata, shares no source content, and remains hidden when
telemetry is paused.

### Local realtime test workspace

Start Docker and local Supabase, apply migrations, and create a repeatable
two-user workspace with real tasks, memberships, and local password accounts:

```sh
corepack pnpm run supabase:start
corepack pnpm exec supabase migration up --local
corepack pnpm run realtime:setup
corepack pnpm run dev
```

`realtime:setup` writes the local-only `.env.local` and
`.realtime-test-credentials.json` files, then prints the two test accounts. The
login page shows **Realtime owner** and **Realtime reviewer** buttons when those
local credentials are present. Use separate browser profiles or one normal and
one private window because Supabase stores one session per browser origin.

Use the `LIVE` project to test:

- Move `LIVE-1` on the board in one window and watch the other update.
- Open the board in both windows and watch the **Active developers** card.
- Open `LIVE-3`, add a comment, and mention the other tester. Their notification
  inbox and header badge update through Realtime.
- Toggle checklist items, add dependencies, upload an allowed attachment, and
  watch task history and collaboration details refresh in the other window.
- Disconnect/reconnect a window or stop/start Realtime to verify the documented
  reload fallback.

Run the authenticated real-database Realtime verification directly with:

```sh
corepack pnpm run test:realtime
```

That test uses two real local Supabase Auth sessions, Postgres RPCs/triggers,
the `task_events` and `notifications` tables, authenticated Realtime channels,
and Presence. It does not use the React test repositories or in-memory event
fakes.

### Task and permission verification

`make test` is the offline command after dependencies are installed. It uses
test-only configuration, so an existing local `.env` does not change its results.
For real database/API checks, start local Supabase and apply pending migrations:

```sh
corepack pnpm run supabase:start
corepack pnpm exec supabase migration up --local
corepack pnpm run test:db
corepack pnpm run test:api
```

`test:db` checks RLS, history atomicity, rollback, dependency graph validation,
saved-view ownership, collaboration permissions, realtime publication and
presence-channel authorization, notification deduplication/read state,
dependency replay, stale writes, and concurrent request deduplication. Roadmap assertions cover hierarchy links, task-history
capture, finite dates, member/viewer permissions, and cross-project/organization
denial. Sprint assertions cover lifecycle replay, immutable
snapshots, paused scope changes, carryover, audit-failure rollback, concurrent
starts/assignments, and completion isolation. `test:api` exercises the actual
application repositories through local Supabase Auth/PostgREST, including bigint
task keys, multi-page task/sprint/timeline reads, sprint lifecycle and carryover,
roadmap create/readback and task linking, dependency create/readback/summary/
deletion, saved-view readback, comments, member-scoped mentions, protected
attachments, checklist behavior, notification delivery/read state, viewer denial,
and project/organization isolation.
Both use
isolated fixtures and clean up after themselves; neither resets existing data.
The API suite keeps temporary credentials in memory and is excluded from the
offline command. `SUPABASE_DB_CONTAINER` can override the default database
container name, `supabase_db_projectpulse`.

## Development and deployment

### Local web development

Keep an existing `.env`; on a fresh checkout, copy the documented placeholders:

```sh
test -f .env || cp .env.example .env
```

Start local Supabase using the commands below, then fill the two public
`VITE_SUPABASE_*` values in the root `.env` from `supabase:status`. Vite reads
that root file for both development and production builds. Start the app with:

```sh
corepack pnpm run dev
```

The Vite server listens on `http://localhost:5173`. The browser configuration
uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the local Supabase
defaults point to `http://127.0.0.1:54321`.

### Docker

Build and run the production web container with no global project dependency.
For a connected app, export `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
in the shell before this direct Docker build:

```sh
docker build --tag projectpulse:local \
  --build-arg VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_ANON_KEY .
docker run --rm --publish 8080:8080 projectpulse:local
```

Open `http://localhost:8080`. The container serves the Vite build through
nginx, supports client-side route fallback, and exposes `GET /healthz` with an
`ok` response. Docker Compose reads the public values from the root `.env` as
build arguments and allows the host port to be changed with `PROJECTPULSE_PORT`:

```sh
PROJECTPULSE_PORT=8080 docker compose up --build
```

Vite embeds these public settings at build time; rebuild when they change. Use
the backend URL reachable from the user's browser. Server/service-role secrets
are never build arguments. Configure Supabase Auth to allow the deployed
`/auth/callback` URL. The image excludes local environment files, dependencies,
compiled workspace output, and TypeScript caches, then rebuilds its own artifacts.

To verify the pinned Node 22/Linux toolchain with networking disabled after the
image has installed its dependencies:

```sh
docker build --target build --tag projectpulse:check .
docker run --rm --network none projectpulse:check pnpm test
```

### Local Supabase prerequisites

The Supabase CLI is pinned in the root dev dependencies, so Corepack can run it
without a global install. Docker Desktop (or a Docker-compatible daemon) is
the only system prerequisite. From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run supabase:start
corepack pnpm run supabase:status
```

For an existing local database, apply only pending migrations with
`corepack pnpm exec supabase migration up --local`. To deliberately erase local
data and apply the deterministic seed, use:

```sh
corepack pnpm run supabase:reset
```

Stop the local stack with `corepack pnpm run supabase:stop`. The local API is
available at `http://127.0.0.1:54321`, Studio at `http://127.0.0.1:54323`,
Postgres at `127.0.0.1:54322`, and the local email inbox at
`http://127.0.0.1:54324`.

The browser uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The
service-role key and integration secrets stay server-side and are never placed
in browser configuration. T011 adds the application migrations; the seed
creates only a deterministic local-environment marker until later tasks add
domain fixtures. Never commit `.env`; use `.env.example` as the variable
inventory.

### Authentication

The web app uses Supabase Auth for magic links and optional GitHub OAuth. Set
the two `VITE_SUPABASE_*` variables in an untracked `.env` file, using the
publishable key printed by `corepack pnpm run supabase:status` for local work.
The callback route is `/auth/callback`; sessions persist in browser storage,
refresh automatically, and are cleared by sign-out. Service-role credentials
are never exposed to the browser. The web app has no separate signup screen:
users return to the same browser and are sent directly to the workspace while
their persisted session remains valid.

When running the Vite development server, the sign-in screen also exposes
`Continue in demo mode`. It opens the workspace with local preview data without
creating a Supabase session, and the choice is remembered in that browser. The
demo entry point is development-only; production builds keep the real auth flow.

The runnable web workspace, development server, production build, container,
and deployment commands are introduced by the foundation tasks:

- T002 — workspace package manifests and root workspace commands
- T003 — Docker and local development
- T004 — linting, typechecking, and the full quality pipeline
- T005 — React/Vite web application shell and routing
- T095 — production deployment runbook

## Runtime and package manager

- Node.js 22 LTS is pinned by `.nvmrc` and constrained by the `engines` field.
- pnpm is pinned by the `packageManager` field.
- `pnpm-workspace.yaml` defines the `apps/*` and `packages/*` workspace globs.

## Security and local configuration

Local secrets must stay in untracked environment files. Never commit tokens,
credentials, or machine-specific absolute paths. Environment variables and
container configuration are added by T003.
