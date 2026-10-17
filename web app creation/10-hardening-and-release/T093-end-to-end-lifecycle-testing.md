# T093 — End-to-End Lifecycle Testing

## Status

Planned

## Depends on

`T045`, `T054`, `T061`.

## Unblocks

`T095`, `T096`.

## Goal

Prove the complete ProjectPulse task-to-merge-to-analytics lifecycle.

## Scenario

```text
Create project
  -> create PULSE-1
  -> create matching branch
  -> send IDE activity
  -> open pull request
  -> receive CI result
  -> review pull request
  -> merge to main
  -> complete task
  -> update activity timeline and metrics
```

## Acceptance criteria

- [ ] Every lifecycle step succeeds in a clean test environment.
- [ ] Duplicate webhook delivery is safe.
- [ ] Presence expires after disconnect.
- [ ] Analytics reflect the completed lifecycle.
- [ ] Unauthorized users cannot observe or mutate the scenario.

## Verification

- Run Playwright and integration tests.
- Capture failure diagnostics and fixture cleanup behavior.

## Handoff

Record test setup, fixtures, execution time, flaky scenarios, and known environmental requirements.

## Commit

`T093: verify end-to-end lifecycle`
