# T051 — Extension Auth and Workspace Connection

## Status

Planned

## Depends on

`T050`, `T012`, `T015`.

## Unblocks

`T052`, `T053`.

## Goal

Connect an IDE workspace to an authenticated ReleaseArc project.

## Owned paths

- Extension authentication flow
- Secure token storage
- Workspace connection settings
- Project selection commands

## Implementation steps

1. Open the approved sign-in flow.
2. Store tokens using the IDE secret storage API.
3. Detect repository and workspace identity.
4. Let a user select an accessible project.
5. Show connection and authentication errors.

## Acceptance criteria

- [ ] Tokens are not stored in plain workspace settings.
- [ ] A user can connect and disconnect a workspace.
- [ ] Only accessible projects appear.
- [ ] Disconnect stops telemetry and presence.
- [ ] Expired authentication has a recovery path.

## Verification

- Test sign-in, expiry, logout, reconnect, and project switching.
- Inspect extension logs for secret leakage.

## Handoff

Record token flow, secret-storage key names, workspace identity rules, and connection settings.

## Commit

`T051: connect extension authentication`
