# T082 — Build, Test, and Flakiness Health

## Status

Planned

## Depends on

`T044`.

## Unblocks

`T083`.

## Goal

Expose build duration, repeated failures, and unstable tests as project health signals.

## Implementation steps

1. Normalize test and build check results.
2. Track duration and outcome history.
3. Group repeated failures using stable check identity.
4. Detect likely flaky checks from alternating outcomes.
5. Link failures to PRs, commits, and tasks.

## Acceptance criteria

- [ ] Failed checks can be traced to provider logs.
- [ ] Duration trends are visible.
- [ ] Flakiness is presented as a signal, not a definitive label.
- [ ] Retries are distinguished from new runs.
- [ ] Project access is enforced.

## Verification

- Test pass, fail, cancel, retry, and intermittent fixtures.
- Test links and permission rules.

## Handoff

Record flakiness heuristic, minimum sample size, and data-quality limitations.

## Commit

`T082: add build and test health`
