# T095 — Deployment and Production Runbook

## Status

Planned

## Depends on

`T003`, `T004`, `T090`, `T091`, `T092`, `T093`, `T094`.

## Unblocks

`T096`.

## Goal

Document and verify a reproducible deployment process for the web app, database, Edge Functions, and extension.

## Implementation steps

1. Document environment provisioning.
2. Document database migration deployment.
3. Document Edge Function deployment.
4. Document web application build and hosting.
5. Document webhook registration and secret configuration.
6. Document rollback and recovery.
7. Document extension packaging and release.

## Acceptance criteria

- [ ] A clean machine can follow the README successfully.
- [ ] Production secrets are described but not committed.
- [ ] Migrations are applied in order.
- [ ] Rollback and recovery steps exist.
- [ ] Health checks and smoke tests are documented.

## Verification

- Perform a staging deployment.
- Run production-like smoke tests.
- Build the Docker image.

## Handoff

Record deployment providers, required variables, migration commands, rollback steps, and owner responsibilities.

## Commit

`T095: document production deployment`
