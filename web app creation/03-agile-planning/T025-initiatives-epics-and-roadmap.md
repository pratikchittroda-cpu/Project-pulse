# T025 — Initiatives, Epics, and Roadmap

## Status

Done

## Depends on

`T021`, `T024`.

## Unblocks

Roadmap reporting and milestone health.

## Goal

Provide planning hierarchy above individual tasks.

## Owned paths

- Initiative and epic models
- Roadmap page
- Parent-child progress calculations
- Milestone controls

## Implementation steps

1. Add initiatives, epics, and milestones.
2. Link tasks to epics and initiatives.
3. Calculate progress from task state and estimates.
4. Add target dates and milestone status.
5. Render a roadmap view with filters.

## Acceptance criteria

- [x] Tasks can belong to an epic.
- [x] Epics can belong to an initiative.
- [x] Progress is explainable from child tasks.
- [x] Overdue milestones are visible.
- [x] Roadmap respects project permissions.

## Verification

- Test rollups with completed, canceled, and unestimated tasks.
- Test date and permission behavior.

## Handoff

### Implementation

- `/app/roadmap` and workspace navigation provide initiative, epic, milestone,
  and task-link controls for a selected authenticated project.
- `apps/web/src/features/roadmap/` contains the paginated repository, guarded
  loading/mutation hook, explainable rollup model, responsive workspace, and
  filters. `apps/web/src/pages/roadmap-page.tsx` applies organization/project
  session gating and archived-project read-only behavior.
- The append-only migration
  `supabase/migrations/20261021020000_roadmap_hierarchy.sql` adds hierarchy
  indexes, finite milestone dates, and extends `mutate_task` with `epic_id` and
  `milestone_id` while preserving task receipts/history.

### Hierarchy rules and progress formula

- Initiatives belong to the organization. Epics belong to the selected project
  and may reference any initiative in the same organization. Milestones belong to
  the selected project. A task may independently link to one epic and one
  milestone; composite foreign keys reject cross-project or cross-organization
  links.
- All roadmap entities use `planned`, `active`, `completed`, or `canceled`.
  Milestones accept an optional finite calendar target date. A milestone is
  overdue when `target_date < today` and status is neither `completed` nor
  `canceled`.
- For each initiative, epic, milestone, and the project summary, progress is
  calculated from active unarchived child tasks. Canceled tasks are excluded from
  the denominator. Configured terminal non-canceled task statuses count as
  completed. `progressPercent = completedTaskCount / activeTaskCount * 100`,
  rounded to the nearest whole percent; empty scopes report 0%.
- Point progress sums `estimate` for active tasks and completed active tasks;
  null estimates count in task totals and contribute zero points. The UI shows
  both counts and points so the rollup remains explainable when work is canceled
  or unestimated.

### Permissions and performance

- Organization owners/admins manage initiatives. Project writers manage epics,
  milestones, and task links. Viewers and archived projects read roadmap data
  only. Server-side RLS remains authoritative; UI controls mirror the same
  boundaries.
- Initiative, epic, and milestone reads use 100-row pages. Task reads reuse the
  200-row task repository pagination. T025 adds project/epic and
  project/milestone indexes; the UI computes small explainable rollups from the
  bounded task set instead of issuing one query per roadmap item.
- Task hierarchy changes use the existing atomic `mutate_task` request receipt,
  expected version, and task-history event contract. Roadmap entity edits use
  scoped `updated_at` checks and tell the user to reload after a stale write.

### Verification recorded October 20, 2026

- `corepack pnpm test`: **89 tests across 20 files** passed, including roadmap
  repository validation/pagination, component rollups, overdue filtering,
  read-only states, task linking, and protected routing.
- `corepack pnpm run test:db`: roadmap hierarchy links, task-history capture,
  finite milestone dates, member/viewer boundaries, cross-project link denial,
  and cross-organization reads passed alongside the existing RLS/history/sprint
  suites.
- `corepack pnpm run test:api`: **4 passed** through local Supabase
  Auth/PostgREST, including roadmap create/readback, task hierarchy linking,
  viewer denial, sprint lifecycle/carryover, and pagination beyond 200 tasks / 100
  sprints.
- `corepack pnpm run typecheck`, `corepack pnpm run lint`, and formatting checks
  passed. The production web build passed with the existing non-failing Vite
  large-chunk warning.

### Limits and next task

- Roadmap progress is recomputed on reload from RLS-visible task rows; realtime
  updates and server-side aggregate materialization remain later work.
- There is no bulk hierarchy reassignment or initiative deletion control in this
  milestone. Existing foreign-key `set null` behavior preserves child rows if an
  initiative is removed by an authorized organization administrator.
- No authenticated browser/mobile visual walkthrough was performed; component
  tests and real API readback cover the implemented flow.
- Roadmap reporting and milestone health can now consume the hierarchy and
  explainable rollups. Task dependency health, shared task filtering, saved
  views, and task collaboration are now available from `T026`–`T028`.

## Commit

`T025: add initiatives epics and roadmap`
