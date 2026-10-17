# T045 — Automation Engine and Task State Machine

## Status

Planned

## Depends on

`T030`, `T043`, `T044`.

## Unblocks

`T093`, notifications, analytics, and the first complete demo.

## Goal

Apply safe, explainable automation rules to engineering events.

## Default transitions

```text
Branch or commit references task -> In Progress
Pull request opened             -> In Review
Review requests changes         -> Changes Requested
Review approved and CI passes   -> Ready to Merge
Pull request merged to main     -> Completed
```

CI failures remain health indicators unless a project explicitly configures a different rule.

## Implementation steps

1. Define built-in rules.
2. Evaluate event conditions.
3. Apply idempotent actions.
4. Record automation runs and explanations.
5. Support manual override and automation suppression.
6. Avoid reopening tasks automatically without an explicit rule.

## Acceptance criteria

- [ ] Supported events produce the expected state changes.
- [ ] Duplicate events are safe.
- [ ] Every transition records source and reason.
- [ ] Manual corrections are preserved.
- [ ] A failed automation run is visible and retryable.

## Verification

- Test the full state machine with event fixtures.
- Test duplicate, out-of-order, and conflicting events.

## Handoff

Record built-in rules, conflict resolution, manual override behavior, and automation persistence.

## Commit

`T045: automate task state transitions`
