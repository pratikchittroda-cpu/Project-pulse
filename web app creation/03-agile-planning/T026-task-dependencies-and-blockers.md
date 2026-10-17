# T026 — Task Dependencies and Blockers

## Status

Planned

## Depends on

`T021`.

## Unblocks

Scope health and risk indicators.

## Goal

Make dependencies and blockers explicit instead of hiding them in comments.

## Owned paths

- Task relation model
- Dependency editor
- Blocker UI
- Dependency validation

## Implementation steps

1. Support blocked-by and blocking relationships.
2. Prevent self-links and invalid duplicate links.
3. Show dependency state on cards and task detail.
4. Allow a blocker explanation and optional target date.
5. Add warnings for blocked critical-priority tasks.

## Acceptance criteria

- [ ] Users can create and remove valid dependency links.
- [ ] Self-dependencies are rejected.
- [ ] Blocking tasks are visible from both sides.
- [ ] Blocked tasks have an explanation.
- [ ] Dependency data is available to health analytics.

## Verification

- Test graph validation and deletion behavior.
- Test cross-project restrictions if enabled.

## Handoff

Record relation types, graph limits, and health signals exposed to later tasks.

## Commit

`T026: add task dependencies and blockers`
