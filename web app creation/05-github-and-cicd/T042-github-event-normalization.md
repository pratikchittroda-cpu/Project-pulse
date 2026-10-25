# T042 — GitHub Event Normalization

## Status

Planned

## Depends on

`T041`.

## Unblocks

`T043`, `T044`, `T046`, `T080`, `T081`.

## Goal

Convert provider-specific GitHub payloads into stable ReleaseArc domain events.

## Owned paths

- GitHub event parsers
- Provider adapter types
- Normalized event builders
- Parser tests and fixtures

## Supported events

- Push and commit
- Branch creation or deletion
- Pull request opened, closed, reopened, and synchronized
- Review submitted
- Check run completed
- Deployment status
- Release published

## Acceptance criteria

- [ ] Each supported provider event maps to a typed domain event.
- [ ] Unsupported events are acknowledged and recorded safely.
- [ ] Provider payloads are validated before normalization.
- [ ] Fixtures cover important payload variations.
- [ ] Normalized events do not expose provider secrets.

## Verification

- Run parser tests against stored safe fixtures.
- Test malformed and partial payloads.

## Handoff

Record supported event versions, normalized event types, fixture locations, and unsupported cases.

## Commit

`T042: normalize GitHub events`
