# T040 — GitHub Connection and OAuth

## Status

Planned

## Depends on

`T015`, `T012`.

## Unblocks

`T041`, `T046`.

## Goal

Connect an organization or project to GitHub with least-privilege access.

## Owned paths

- GitHub OAuth connection flow
- Provider account and repository selection UI
- Integration connection records
- Provider configuration helpers

## Implementation steps

1. Add OAuth start and callback handling.
2. Store provider account metadata without exposing tokens.
3. List repositories available to the authorized user.
4. Connect a repository to a ReleaseArc project.
5. Detect and store the default branch.
6. Show connection health and disconnect behavior.

## Acceptance criteria

- [ ] Users can connect an authorized GitHub account.
- [ ] Tokens are handled only on trusted server boundaries.
- [ ] Repository selection respects provider permissions.
- [ ] A project can be disconnected without deleting history.
- [ ] Missing scopes produce a useful remediation message.

## Verification

- Test callback success, denial, expired state, and disconnect.
- Verify no token appears in browser logs or application logs.

## Handoff

Record OAuth scopes, callback URLs, token storage, and provider error handling.

## Commit

`T040: connect GitHub repositories`
