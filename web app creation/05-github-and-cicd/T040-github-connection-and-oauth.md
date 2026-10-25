# T040 — GitHub Connection and OAuth

## Status

Implemented

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

- [x] Users can connect an authorized GitHub account.
- [x] Tokens are passed to the trusted connection function and are not stored or returned.
- [x] Repository connection respects GitHub and project permissions.
- [x] A project can disconnect the repository without deleting delivery history.
- [x] Missing scopes produce a useful remediation message.

## Verification

- Test callback success, denial, expired state, and disconnect.
- Verify no token appears in browser logs or application logs.

## Handoff

Record OAuth scopes, callback URLs, token storage, and provider error handling.

## Implementation note

The Projects page uses Supabase Auth's GitHub identity and the `github-connect`
Edge Function to verify repository access, create or repair the ReleaseArc
webhook, and upsert repository metadata. Manual webhook setup remains available
as a fallback for installations whose GitHub OAuth configuration does not grant
repository-hook permissions.
