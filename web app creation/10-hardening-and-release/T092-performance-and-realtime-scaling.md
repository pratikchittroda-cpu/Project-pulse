# T092 — Performance and Realtime Scaling

## Status

Planned

## Depends on

`T031`, `T041`, `T064`.

## Unblocks

`T095`.

## Goal

Verify that the first release remains responsive as tasks, events, and presence increase.

## Implementation steps

1. Review database indexes and query plans.
2. Add pagination to large lists and timelines.
3. Measure board update latency.
4. Measure webhook acknowledgment and processing time.
5. Bound realtime subscriptions and presence payloads.
6. Add load fixtures without sensitive data.

## Acceptance criteria

- [ ] Board updates remain responsive under representative load.
- [ ] Large event histories are paginated.
- [ ] Webhooks acknowledge quickly and process asynchronously.
- [ ] Presence does not create unbounded database writes.
- [ ] Performance limits are documented.

## Verification

- Run query and realtime benchmarks.
- Test reconnect and high-event scenarios.

## Handoff

Record baselines, measured limits, indexes added, and known scaling bottlenecks.

## Commit

`T092: verify performance and realtime scaling`
