# T081 — Dependency and Security Health

## Status

Planned

## Depends on

`T042`.

## Unblocks

`T083`.

## Goal

Connect dependency and security scan signals to project and repository health.

## Implementation steps

1. Define normalized dependency finding records.
2. Ingest supported security scan results.
3. Track severity, package, version, and remediation link.
4. Add deduplication and resolution state.
5. Link critical findings to project alerts.

## Acceptance criteria

- [ ] Findings are normalized independently of provider.
- [ ] Severity and source are visible.
- [ ] Resolved findings do not remain active.
- [ ] Critical findings can alert authorized users.
- [ ] Secrets and private scan payloads are protected.

## Verification

- Test new, repeated, resolved, and reopened findings.
- Test provider permission and redaction behavior.

## Handoff

Record supported scan formats, finding identity, severity mapping, and retention policy.

## Commit

`T081: add dependency and security health`
