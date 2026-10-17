# T025 — Initiatives, Epics, and Roadmap

## Status

Planned

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

- [ ] Tasks can belong to an epic.
- [ ] Epics can belong to an initiative.
- [ ] Progress is explainable from child tasks.
- [ ] Overdue milestones are visible.
- [ ] Roadmap respects project permissions.

## Verification

- Test rollups with completed, canceled, and unestimated tasks.
- Test date and permission behavior.

## Handoff

Record hierarchy rules, progress formula, and roadmap performance considerations.

## Commit

`T025: add initiatives epics and roadmap`
