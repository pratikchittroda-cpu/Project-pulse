# T080 — Code Hotspots and Churn Analysis

## Status

Planned

## Depends on

`T042`, `T044`.

## Unblocks

`T083`.

## Goal

Identify frequently changing and delivery-risky areas of connected repositories.

## Implementation steps

1. Aggregate commits by file and module where safe.
2. Calculate change frequency and pull-request involvement.
3. Link hotspots to task and CI history.
4. Redact or omit sensitive file paths.
5. Add date-range filters.

## Acceptance criteria

- [ ] Hotspots are explained by underlying commits and PRs.
- [ ] No source contents are collected.
- [ ] Sensitive path redaction is supported.
- [ ] Results are scoped to authorized repositories.
- [ ] Hotspot data is presented as risk context, not developer ranking.

## Verification

- Test churn aggregation with representative repository fixtures.
- Test redaction and permission behavior.

## Handoff

Record formulas, repository limitations, redaction rules, and expected refresh timing.

## Commit

`T080: add code hotspot analysis`
