# T002 — Workspace Layout and Scripts

## Status

Done

## Depends on

`T001`.

## Unblocks

`T003`, `T004`, `T005`, `T007`, `T050`.

## Goal

Create the web app, extension app, and shared package workspaces with predictable root commands.

## Owned paths

- `apps/web/`
- `apps/vscode-extension/`
- `packages/domain/`
- `packages/integrations/`
- `packages/ui/`
- Workspace scripts

## Implementation steps

1. Add minimal package manifests for each workspace.
2. Add TypeScript project references or a consistent shared configuration.
3. Add root scripts for development, build, test, lint, and typecheck.
4. Add package naming conventions.
5. Verify a package can import a shared package through a workspace reference.

## Acceptance criteria

- [x] Each workspace has a clear responsibility.
- [x] Root commands can target one workspace.
- [x] Shared packages resolve without copied source.
- [x] Build output is excluded from version control.
- [x] The setup is documented.

## Verification

Completed verification:

- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts`
  completed without changing `pnpm-lock.yaml`.
- `corepack pnpm run workspace:check` validated all five manifests and their
  shared quality scripts.
- `corepack pnpm run typecheck` passed for all workspaces using strict
  TypeScript project references.
- `corepack pnpm run build` passed for all workspaces.
- `corepack pnpm run test`, `corepack pnpm run lint`, and `make test` passed.
- The compiled web entry point imported `@projectpulse/domain` and produced
  `ProjectPulse web workspace` without copied domain source.

## Handoff

- Workspace names are `@projectpulse/web`, `@projectpulse/vscode-extension`,
  `@projectpulse/domain`, `@projectpulse/integrations`, and `@projectpulse/ui`.
- Every workspace exposes `build`, `test`, `lint`, and `typecheck`; the root
  exposes the same commands plus `dev`, all through `corepack pnpm`.
- `@projectpulse/web` depends on `@projectpulse/domain` with a `workspace:*`
  reference. TypeScript project references and `tsconfig.base.json` provide the
  shared strict compiler configuration; build output is written to ignored
  `dist/` directories.
- The web workspace's dependency-free development server listens on port `4173`
  until T005 replaces it with the React/Vite application shell.
- T003, T004, T007, and T050 are now unblocked; T005 still waits for T004.

## Commit

`T002: create workspace layout`
