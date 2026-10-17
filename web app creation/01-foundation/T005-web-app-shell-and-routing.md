# T005 — Web App Shell and Routing

## Status

Planned

## Depends on

`T002`, `T004`.

## Unblocks

`T006`, all web UI features.

## Goal

Create the navigable React application shell with authenticated and unauthenticated layouts.

## Owned paths

- `apps/web/src/app/`
- `apps/web/src/routes/`
- `apps/web/src/pages/`
- Initial navigation and error boundaries

## Implementation steps

1. Create the Vite React entry point.
2. Add public, authentication, and application route groups.
3. Add the sidebar/header layout shell.
4. Add loading, not-found, and error boundaries.
5. Add a project context placeholder that later tasks can connect to real data.

## Acceptance criteria

- [ ] The app starts and builds.
- [ ] Public and protected routes are distinguishable.
- [ ] Navigation works without full-page reloads.
- [ ] Unknown routes have a useful response.
- [ ] Layout works at mobile and desktop widths.

## Verification

- Add route rendering tests.
- Run the web build and `make test`.

## Handoff

Record route names, layout ownership, and the extension points for authentication and project context.

## Commit

`T005: create web app shell`
