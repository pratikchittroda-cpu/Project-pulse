# T060 — Session Aggregation and Time Estimation

## Status

Planned

## Depends on

`T030`, `T053`.

## Unblocks

`T061`, `T062`, `T063`.

## Goal

Convert privacy-minimized telemetry into bounded, team-oriented session summaries.

## Implementation steps

1. Group heartbeats into sessions.
2. Apply idle timeout and maximum-gap rules.
3. Exclude paused and idle intervals from active-time estimates.
4. Aggregate by project, team, task, and activity category.
5. Apply retention and deletion rules.
6. Clearly label estimates as estimates.

## Acceptance criteria

- [ ] Sessions cannot bridge an excessive inactivity gap.
- [ ] Active time does not count idle or paused intervals.
- [ ] Individual raw heartbeat data is not required for normal reports.
- [ ] Users can delete or expire their telemetry according to policy.
- [ ] Analytics do not rank developers by activity time.

## Verification

- Test gaps, idle intervals, pause, reconnect, and deletion.
- Test aggregation across tasks and teams.

## Handoff

Record session algorithm, timeout values, aggregation grain, retention policy, and privacy wording.

## Commit

`T060: aggregate developer sessions`
