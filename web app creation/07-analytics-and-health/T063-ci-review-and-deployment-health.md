# T063 — CI, Review, and Deployment Health

## Status

Planned

## Depends on

`T044`, `T060`.

## Unblocks

`T064` and release reporting.

## Goal

Show how CI, review, and deployment systems affect delivery.

## Metrics

- Pull-request review time
- Time to first review
- CI pass/fail rate
- Repeated failures
- Check duration
- Deployment frequency
- Deployment failures
- Change failure rate

## Implementation steps

1. Normalize provider statuses.
2. Calculate review and CI timelines.
3. Group repeated failures safely.
4. Link every metric to provider records.
5. Add project-level date filters.

## Acceptance criteria

- [ ] Failed CI checks are distinguishable from missing checks.
- [ ] Review delays identify the relevant PR.
- [ ] Deployment metrics are separate from merge metrics.
- [ ] Repeated failures can be drilled into.
- [ ] Metrics remain meaningful when provider data is incomplete.

## Verification

- Test passed, failed, canceled, retried, and missing checks.
- Test review and deployment status changes.

## Handoff

Record status mapping, metric formulas, provider limitations, and data-quality behavior.

## Commit

`T063: add CI review and deployment health`
