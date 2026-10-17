# T012 — Authentication Flows

## Status

Planned

## Depends on

`T010`, `T011`.

## Unblocks

`T013`, `T014`, `T040`, `T051`.

## Goal

Provide secure sign-in and session handling for the dashboard and extension.

## Owned paths

- Auth pages and hooks
- Auth callback handling
- Session provider
- Auth-related Edge Function helpers

## Implementation steps

1. Add email or magic-link sign-in.
2. Add GitHub OAuth configuration for identity where available.
3. Persist and refresh sessions securely.
4. Protect authenticated routes.
5. Add sign-out and session-expiry behavior.
6. Document provider setup without committing secrets.

## Acceptance criteria

- [ ] Unauthenticated users cannot access protected project data.
- [ ] Sessions survive a page reload.
- [ ] Expired sessions recover or redirect safely.
- [ ] Sign-out clears client state.
- [ ] Extension authentication can reuse the approved flow.

## Verification

- Test unauthenticated, authenticated, expired, and signed-out states.
- Verify no access token is logged.

## Handoff

Record provider settings, redirect URLs, token storage strategy, and test accounts required locally.

## Commit

`T012: implement authentication flows`
