# T090 — Security Hardening and Audit

## Status

Planned

## Depends on

`T013`, `T040`, `T055`.

## Unblocks

`T095`.

## Goal

Perform a focused security pass over identity, integrations, telemetry, storage, and auditability.

## Implementation steps

1. Review all RLS policies.
2. Review service-role boundaries.
3. Review OAuth scopes and token storage.
4. Review webhook signature handling.
5. Review extension local storage and telemetry redaction.
6. Add audit events for administrative and automated changes.

## Acceptance criteria

- [ ] Cross-organization access tests pass.
- [ ] Secrets are absent from logs and repository files.
- [ ] Integration disconnect and rotation are supported.
- [ ] Sensitive actions are auditable.
- [ ] Retention and deletion behavior is documented.

## Verification

- Run permission, secret-scanning, and integration security checks.
- Review dependency vulnerabilities.

## Handoff

Record findings, remediations, residual risks, and required production settings.

## Commit

`T090: harden security and auditability`
