# T091 — Observability and Error Reporting

## Status

Planned

## Depends on

`T041`, `T053`, `T060`.

## Unblocks

`T095`.

## Goal

Make failures in the dashboard, extension, webhooks, and aggregation pipeline diagnosable.

## Implementation steps

1. Define structured log fields.
2. Add correlation IDs across provider events and task transitions.
3. Add integration health checks.
4. Add safe error reporting with redaction.
5. Add operational metrics for webhook and telemetry processing.

## Acceptance criteria

- [ ] Operators can trace a webhook to its task event.
- [ ] Secrets and source contents are redacted.
- [ ] Failed automation is visible.
- [ ] Extension failures have actionable diagnostics.
- [ ] Health checks distinguish dependency failure from application failure.

## Verification

- Simulate webhook, database, provider, and telemetry failures.
- Confirm logs contain correlation data but no secrets.

## Handoff

Record log schema, dashboards, alert conditions, redaction rules, and incident links.

## Commit

`T091: add observability and error reporting`
