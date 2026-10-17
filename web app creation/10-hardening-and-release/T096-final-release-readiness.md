# T096 — Final Release Readiness

## Status

Planned

## Depends on

`T095` and all required release tasks.

## Unblocks

First public or team release.

## Goal

Confirm the repository and product are ready for the selected release scope.

## Checklist

- [ ] `make test` passes offline.
- [ ] Production web build passes.
- [ ] Docker build passes.
- [ ] Database migrations apply from empty state.
- [ ] RLS tests pass.
- [ ] GitHub webhook signatures are verified.
- [ ] Duplicate webhook delivery is safe.
- [ ] IDE extension packages successfully.
- [ ] End-to-end lifecycle passes.
- [ ] Accessibility review is complete.
- [ ] README setup, run, test, and deploy instructions are accurate.
- [ ] `.env.example` has no real secrets.
- [ ] Git status is clean after the release commit.

## Verification

Run the full release checklist and record the exact commit, environment, and test results.

## Handoff

Record release scope, known limitations, rollback owner, next milestone, and post-release monitoring plan.

## Commit

`T096: complete release readiness`
