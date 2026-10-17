# T062 — Delivery Flow Metrics

## Status

Planned

## Depends on

`T044`, `T060`.

## Unblocks

`T064`.

## Goal

Measure how work moves from creation to completion without treating activity as productivity.

## Metrics

- Lead time
- Cycle time
- Throughput
- Work in progress
- Task age
- Time in each status
- Blocked time
- Carryover rate

## Implementation steps

1. Define timestamps for each lifecycle transition.
2. Calculate metrics from durable task events.
3. Exclude invalid or superseded transitions.
4. Add date-range and project filters.
5. Add trend snapshots for historical comparison.

## Acceptance criteria

- [ ] Definitions are documented and consistent.
- [ ] Metrics use event history rather than current state only.
- [ ] Date ranges and time zones are explicit.
- [ ] Incomplete tasks are separated from completed-task metrics.
- [ ] Drill-down reaches the underlying tasks.

## Verification

- Test known event timelines against expected calculations.
- Test missing and out-of-order events.

## Handoff

Record formulas, timestamp policy, timezone display rules, and data-quality warnings.

## Commit

`T062: add delivery flow metrics`
