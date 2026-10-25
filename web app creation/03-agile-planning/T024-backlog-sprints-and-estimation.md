# T024 — Backlog, Sprints, and Estimation

## Status

Done

## Depends on

`T021`.

## Unblocks

`T025`, `T061`.

## Goal

Allow teams to plan work into cycles and compare commitment with completion.

## Owned paths

- Backlog page
- Sprint/cycle data model and UI
- Estimation controls
- Sprint planning actions

## Implementation steps

1. Create, start, pause, and complete sprints.
2. Move tasks between backlog and sprint.
3. Add story point estimates.
4. Record initial sprint commitment.
5. Track added, removed, completed, and carried-over work.
6. Prevent accidental edits to completed sprint history.

## Acceptance criteria

- [x] A project can have one active sprint.
- [x] Tasks can be added and removed with an audit event.
- [x] Initial commitment is preserved.
- [x] Sprint totals update when estimates or membership change.
- [x] Completed sprint history remains readable.

## Verification

- Test sprint lifecycle and carryover behavior.
- Test estimate changes and scope calculations.

## Handoff

### Implementation

- `/app/backlog` and workspace navigation connect the authenticated project to
  sprint creation/editing, lifecycle controls, backlog assignments, estimates,
  current-sprint metrics, and readable initial/closing snapshots.
- Implementation lives in `apps/web/src/features/planning/` and
  `apps/web/src/pages/backlog-page.tsx`. Shared task persistence adds
  `TaskRepository.updatePlanning` and paginated task reads; task detail/board
  mutations retain their existing atomic history contract.
- Both T024 migrations are applied locally and committed. Do not edit them:
  append a new migration for later schema changes. The second migration extends
  the first with snapshots, carryover, lifecycle receipts, and hardened grants.
- Server reads/writes stay organization/project scoped. Viewers and archived
  projects are read-only. Failed mutations retain input; reload discards stale
  state. Project changes ignore late reads/mutations from the previous scope.

### Cycle rules and metrics

- Statuses: `planned`, `active`, `paused`, `completed`, `canceled`. Only one
  active cycle per project; pause releases that slot. Start/resume accepts
  planned/paused, complete accepts active/paused, cancel accepts planned/paused.
- First start records `initial_commitment` and `initial_tasks`; resuming preserves
  both, even for an initially empty sprint. Dates are optional ordered calendar
  dates; UI values become UTC midnight timestamps.
- `committed_points` / `task_count` describe current unarchived scope while open
  and scope at close afterward. `completed_points` / `completed_task_count`
  follow configured terminal statuses except literal `canceled`.
- `added_points`, `removed_points`, `added_task_count`, and `removed_task_count`
  accumulate after first start, including while paused. Estimate changes count
  the net point delta; membership changes count tasks even if unestimated.
- Completion/cancellation freezes `completion_tasks`. `carried_over_points` and
  `carried_over_task_count` mean unfinished nonterminal work **at close**, not a
  remaining-to-move counter. Archived tasks are excluded; null estimates add
  zero points. There is no separate team capacity setting in this milestone.
- Explicit per-task carryover moves closed membership to backlog/an open sprint
  while preserving estimate/status/archive state. Replanning is a separate
  operation afterward. The UI offers unfinished work; the database also permits
  other closed membership to leave under the same preservation rule. No automatic
  bulk move or historical snapshot reconstruction is performed.

### Audit and concurrency contract

- `manage_cycle` requires `request_id`, and `expected_updated_at` for non-create
  actions. Matching actor/project/content replays use private
  `cycle_mutation_receipts`; stale writes fail. The repository retains request
  IDs for explicit identical retries within the same instance, not across reloads.
- Lifecycle ledger events: `cycle.created`, `cycle.updated`, `cycle.started`,
  `cycle.resumed`, `cycle.paused`, `cycle.completed`, `cycle.canceled`.
- Task-scope ledger events: `cycle.task_added`, `cycle.task_removed`,
  `cycle.estimate_changed`, `cycle.task_status_changed`,
  `cycle.task_carried_over`. `cycle_events` includes actor, organization/project/
  cycle IDs, occurrence time, and before/after membership/estimate/status payloads.
  Lifecycle payloads include request ID, statuses, commitment, and point totals.
- Ordinary task history already captures `cycle_id` and estimate changes; the
  duplicate task-cycle trigger from the first migration is removed by the second.
- Lifecycle project/cycle locks and ordered task-cycle locks serialize scope
  changes against snapshots. Audit failures roll back task/cycle changes and
  receipts; direct client lifecycle/ledger writes are revoked.

### Verification recorded October 20, 2026

- `make test`: complete offline quality pipeline, **81 tests across 18 files**,
  typecheck, lint, formatting, all builds, and five workspace checks.
- `corepack pnpm run test:db`: RLS, stale/replayed requests, scope changes,
  custom terminal completion, carryover, closed-history protection, viewer/
  removed-member access, archived-project denial, and injected audit failures.
  Multi-connection assertions prove one concurrent start, four assignments with
  correct totals, late-assignment rejection on completion, and frozen carryover.
- `corepack pnpm run test:api`: **3 passed** through real local Supabase
  Auth/PostgREST. Covers lifecycle/edit/cancel, commitment/readback, scope totals,
  carryover, permissions, bigint task identity/history, and pagination beyond
  200 tasks / 100 sprints. Fixtures are isolated and cleaned up without a reset.
- Clean-source Linux build: `docker build --target build --tag releasearc:t024-check .`.
  Each requested check passed with networking disabled and a five-minute timeout:
  `docker run --rm --network none releasearc:t024-check pnpm run typecheck`,
  `docker run --rm --network none releasearc:t024-check pnpm run lint`, and
  `docker run --rm --network none releasearc:t024-check pnpm test`.
  Runtime pins remain Node `22.14.0` / pnpm `10.12.1`.
- Production image built as `releasearc:t024` using a dummy public smoke key.
  An isolated non-root nginx container returned `ok` from `/healthz`, served the
  same app entry at `/app/backlog` and `/`, and passed `nginx -t`. The temporary
  smoke container was stopped. `docker compose config --quiet` also passed.

### Limits and next task

- UI flows are verified with component tests plus actual repository/API readback;
  no authenticated browser or mobile visual walkthrough was performed.
- Realtime is not connected; use explicit reload. Legacy closed cycles without
  stored snapshots show no fabricated history. Capacity forecasting and an audit
  ledger UI remain outside this task.
- The host shell lacks a bare `pnpm` executable and uses unsupported Node 25;
  host checks use Corepack. The exact bare-pnpm commands above ran successfully
  in the pinned Linux image. Existing Vite large-chunk and non-root nginx `user`
  directive warnings are non-failing.
- `T025` is now unblocked. `T061` has its planning prerequisite but still requires
  `T060`; consume the snapshots/ledger rather than recomputing closed history
  from live task membership.

## Commit

`T024: add backlog and sprints`
