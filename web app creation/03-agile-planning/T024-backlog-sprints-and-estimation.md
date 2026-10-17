# T024 — Backlog, Sprints, and Estimation

## Status

Planned

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

- [ ] A project can have one active sprint.
- [ ] Tasks can be added and removed with an audit event.
- [ ] Initial commitment is preserved.
- [ ] Sprint totals update when estimates or membership change.
- [ ] Completed sprint history remains readable.

## Verification

- Test sprint lifecycle and carryover behavior.
- Test estimate changes and scope calculations.

## Handoff

Record cycle rules, capacity fields, and the event names used by analytics.

## Commit

`T024: add backlog and sprints`
