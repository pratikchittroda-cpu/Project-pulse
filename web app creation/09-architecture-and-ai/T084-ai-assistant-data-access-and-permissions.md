# T084 — AI Assistant Data Access and Permissions

## Status

Planned

## Depends on

`T022`, `T044`, `T064`, `T083`.

## Unblocks

`T085`.

## Goal

Create permission-aware context retrieval before adding AI features.

## Implementation steps

1. Define allowed ReleaseArc data sources.
2. Apply organization and project permissions before retrieval.
3. Create context builders for tasks, PRs, events, metrics, and health.
4. Define provider configuration and opt-out behavior.
5. Define logging and retention rules for prompts and responses.
6. Add citations back to source records.

## Acceptance criteria

- [ ] AI cannot retrieve unauthorized project data.
- [ ] Source records are cited in responses.
- [ ] Organizations can disable AI features.
- [ ] External provider routing is explicit.
- [ ] Sensitive fields are excluded by default.

## Verification

- Test cross-project and cross-organization retrieval.
- Test disabled provider and missing-context behavior.

## Handoff

Record context sources, permission checks, provider settings, redaction policy, and prompt retention.

## Commit

`T084: secure AI data access`
