# T023 — Kanban Board and Drag-and-Drop

## Status

Done

## Depends on

`T006`, `T021`.

## Unblocks

`T027`, `T031`, `T064`.

## Goal

Build the interactive board that combines manual planning state with live task signals.

## Owned paths

- Board page
- Board columns and cards
- Board filters shell
- Drag-and-drop behavior

## Implementation steps

1. Group tasks by workflow status.
2. Render task cards with priority, estimate, assignee, CI, PR, and presence slots.
3. Add drag-and-drop status changes.
4. Add optimistic updates with rollback on failure.
5. Add WIP-limit indicators.
6. Add keyboard-accessible movement.

## Acceptance criteria

- [x] Tasks appear in the correct status column.
- [x] Authorized users can move tasks.
- [x] Failed updates restore the previous state.
- [x] Board cards have useful compact and expanded content.
- [x] Board is usable without a mouse.
- [x] Board works on small screens.

## Verification

- `make test` passed workspace validation, typechecking, lint, formatting, build,
  all 68 offline Vitest tests, and workspace checks.
- `tests/kanban-board.test.tsx` covers configured/unknown workflow columns,
  query/priority/assignee filters, compact/expanded cards, keyboard movement,
  optimistic status changes, rollback on failed writes, native drag/drop, WIP
  indicators, and viewer read-only behavior.
- `tests/web-routing.test.tsx` covers the protected `/app/board` route.
- Existing `corepack pnpm run test:db` and `corepack pnpm run test:api` passed;
  the same `mutate_task` RPC and RLS boundary back board status changes with
  atomic task history, stale-write rejection, and viewer denial.
- The production build completed with the board route and CSS included. No new
  migration was required; the board uses the existing task repository/RPC.

## Handoff

- Route: `/app/board`, linked from the protected workspace navigation. The list
  remains at `/app/tasks`; task cards link to the existing scoped detail route.
- `use-kanban-board.ts` loads active or archived tasks and project workflow
  statuses, preserves request ordering, and serializes one move at a time. A
  move replaces the card status immediately, calls `repository.save` with the
  previous task for optimistic-concurrency protection, then replaces it with
  the server response. Rejected writes restore the prior task object and show
  the repository error without hiding the board.
- `buildKanbanColumns` preserves configured workflow order and appends a readable
  column for an unexpected status so data is not silently dropped. Cards expose
  key/title/detail link, priority, assignee, estimate, labels, description/due
  date disclosure, and status badge. Board filters are local and do not mutate
  saved task state.
- Native HTML drag/drop is intentionally dependency-free: cards set a plain-text
  task ID in `dataTransfer`, columns accept drops, and the same move handler is
  used by the keyboard `select`. No third-party drag-and-drop library is needed.
- Columns show active-card WIP counts and say `no limit` because workflow rows
  currently have no persisted WIP-limit field. A later workflow configuration
  task can supply limits without redesigning the board header/card model.
- Mobile layout switches to horizontally scrollable, snap-aligned columns below
  700px. Cards remain keyboard-usable through native links, disclosures, and
  status selects; viewers/archived projects cannot drag or change status.
- No realtime subscription is added here. T031 owns live board synchronization;
  this board reloads explicitly and rolls back failed local moves.
- No new database migration files were added. The task movement path inherits
  `mutate_task` actor/project permission checks and automatic task history.

## Commit

`T023: build kanban board`
