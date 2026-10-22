# T022 — Task Detail and Activity Timeline

## Status

Done

## Depends on

`T021`, `T030`.

## Unblocks

`T084`.

## Goal

Create the main task detail experience and make every important state change understandable.

## Owned paths

- Task detail page
- Task metadata panels
- Activity timeline components
- Task route data loading

## Implementation steps

1. Display title, description, status, priority, assignee, sprint, and estimate.
2. Add linked branch, commit, PR, CI, and deployment sections as data becomes available.
3. Render task events in chronological order.
4. Explain whether an event was manual, automated, or provider-originated.
5. Add loading, error, and missing-link states.

## Acceptance criteria

- [x] A user can understand the current task state from one page.
- [x] Timeline entries show actor, source, time, and change.
- [x] Automated transitions show their reason.
- [x] Related engineering objects can be added without redesigning the page.
- [x] Unauthorized users cannot open the task.

## Verification

- `make test` passed typecheck, lint, formatting, production builds, all 60
  offline Vitest tests, and workspace checks.
- UI interaction tests cover task-list links, metadata, manual/automated/provider
  event rendering, legacy payloads, empty/loading/error/missing states, viewers,
  archived projects, save/archive/restore readback, and late responses after a
  task or project switch. Demo-mode routes require a real session for details.
- `corepack pnpm run test:db` passed RLS/history/replay/rollback assertions and
  four concurrent identical requests returning one task and one history event.
- `corepack pnpm run test:api` passed against local Supabase Auth/PostgREST using
  the real application repositories. It verified lossless bigint task keys,
  create/edit/archive/restore, stale-write rejection, automation reasons, sprint
  lookup, 111 history entries across pages with timestamp ties, viewer mutation
  denial, private-project/cross-organization isolation, and membership removal.
- A clean-source Docker build succeeded with Node `22.14.0` and pnpm `10.12.1`.
  `pnpm run typecheck`, `pnpm run lint`, and `pnpm test` passed inside the build
  image with `--network none`. The nginx runtime returned HTTP 200 for `/healthz`
  and a nested task route. `docker compose config --quiet` passed.
- The Vite configuration was resolved directly to verify that it reads the root
  `.env` and finds the public browser settings without logging their values.

## Handoff

- Entry point: click a task title at `/app/tasks`. Detail route:
  `/app/organizations/:organizationId/projects/:projectId/tasks/:taskId`.
  Route IDs, rather than the current sidebar selection, scope every detail read.
- `task-detail-repository.ts` loads the project key/name, scoped task, permissions,
  workflow/assignee options, and sprint name. `task-detail-workspace.tsx` displays
  metadata and reuses the task form; successful writes reload task and history.
  `Reload task` handles stale-state recovery. `Refresh history` retries the
  timeline independently. Scope changes discard previous state and late results.
- `task-timeline.tsx` supports `task.created`, `task.updated`,
  `task.status_changed`, `task.archived`, `task.restored`, and provider event names.
  Repository reads are ordered by `occurred_at`, `created_at`, then `id`, loading
  100-row pages. Field changes render as before/after values alongside actor,
  source, occurrence time, automation reason, and optional correlation ID.
- Atomic capture was committed separately as `2af8998`; the page/timeline and
  behavioral/API tests are in `c6b83b7`. The applied append-only migration is
  `supabase/migrations/20261020000000_atomic_task_history.sql`. Task mutations,
  receipt persistence, and history share a transaction; no-op field changes do
  not produce events. Explicit event replay is actor/content/project checked.
- Retry IDs are held in memory by each task repository instance until a confirmed
  response. They survive an explicit identical retry after an uncertain failure,
  but not a full page reload. Read back the task list after an ambiguous create
  across reloads. No historical changes are fabricated/backfilled.
- Assignee/actor values use `You`, stored user IDs, or `System / service` until
  profile-name lookup is added. Sprint display is supported; sprint editing is
  part of T024. Branch, commit, PR, CI, and deployment slots currently say
  `Not linked yet`; provider data belongs to subsequent integration tasks.
- History is refresh-based; realtime subscriptions belong to T031. The automated
  UI checks use jsdom, and the integration test uses the real local API; a manual
  authenticated-browser walkthrough was not part of this verification.
- Setup repairs: Vite reads the documented root `.env`; Docker/Compose pass
  public browser values at build time. Docker ignores host-generated artifacts,
  and the web TypeScript project references shared UI for clean builds. README
  documents setup, run, offline tests, database/API tests, and deployment.
- The host Node 25 engine warning does not occur on the verified pinned Node 22
  image. Vite still reports the existing >500 kB bundle advisory; performance
  work is separate from this feature.
- Next planning task: T023 Kanban. T022 supplies one dependency for T084; T084
  still requires T044, T064, and T083.

## Commit

`T022: add task detail and timeline`
