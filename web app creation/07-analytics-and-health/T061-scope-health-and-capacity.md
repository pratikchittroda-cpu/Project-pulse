# T061 — Scope Health and Capacity

## Status

Planned

## Depends on

`T024`, `T060`.

## Unblocks

`T064`, sprint digests, and risk reporting.

## Goal

Detect scope growth, unassigned work, priority imbalance, and sprint capacity pressure.

## Metrics

- Initial committed points
- Current committed points
- Added points
- Removed points
- Completed points
- Carryover points
- Unassigned work
- Blocked work
- P0/P1/P2 distribution

## Implementation steps

1. Preserve sprint commitment at start.
2. Calculate scope growth percentage.
3. Add configurable warning thresholds.
4. Explain every warning with contributing tasks.
5. Add project and sprint health summaries.

## Acceptance criteria

- [ ] Scope growth compares current work to the original commitment.
- [ ] Unassigned P0/P1 tasks are visible.
- [ ] Warnings link to the tasks causing them.
- [ ] Thresholds are configurable by project.
- [ ] Canceled work is not treated as completed work.

## Verification

- Test task additions, removals, estimates, carryover, and cancellations.
- Test threshold configuration and permissions.

## Handoff

Record formulas, threshold defaults, warning severity, and required indexes.

## Commit

`T061: add scope health metrics`
