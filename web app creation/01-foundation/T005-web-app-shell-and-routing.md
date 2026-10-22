# T005 — Web App Shell and Routing

## Status

Done

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

- [x] The app starts and builds.
- [x] Public and protected routes are distinguishable.
- [x] Navigation works without full-page reloads.
- [x] Unknown routes have a useful response.
- [x] Layout works at mobile and desktop widths.

## Verification

Completed verification:

- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts`
  completed successfully from the committed lockfile.
- `corepack pnpm --filter @projectpulse/web build` completed the TypeScript and
  Vite production build.
- `make test` passed workspace validation, typechecking, linting, formatting,
  all workspace builds, and six Vitest assertions across public, auth,
  protected, loading, and not-found routes.

## Handoff

- Vite starts the web workspace with `corepack pnpm --filter
  @projectpulse/web dev`; the production command runs strict TypeScript before
  `vite build`.
- Public routes are `/` and `/auth/login`; application routes are `/app` and
  `/app/activity`. Unknown paths render the `NotFoundPage` response.
- `PublicLayout`, `AuthLayout`, and `AppLayout` own their route-group chrome.
  `ProtectedRoute` separates authenticated application routes and renders a
  loading state while auth is unresolved.
- `AuthProvider` is a local placeholder with sign-in/sign-out actions; T012 can
  replace its status source with Supabase Auth without changing route layout
  ownership. `ProjectProvider` exposes the placeholder `PULSE` project and is
  the extension point for T015 project data.
- `AppErrorBoundary` handles render failures, while `RouteErrorPage` handles
  router errors. Responsive CSS collapses the sidebar navigation below 760px
  and includes visible keyboard focus states.
- T006 is now unblocked. T003, T007, and T050 remain ready for parallel work.

## Commit

`T005: create web app shell`
