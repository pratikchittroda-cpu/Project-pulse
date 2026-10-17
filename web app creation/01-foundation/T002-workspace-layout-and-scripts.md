# T002 — Workspace Layout and Scripts

## Status

Planned

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

- [ ] Each workspace has a clear responsibility.
- [ ] Root commands can target one workspace.
- [ ] Shared packages resolve without copied source.
- [ ] Build output is excluded from version control.
- [ ] The setup is documented.

## Verification

- Install dependencies from the lockfile.
- Run the root typecheck and build scripts.
- Verify a shared package import from the web workspace.

## Handoff

Record workspace names, scripts, package boundaries, and any shared configuration assumptions.

## Commit

`T002: create workspace layout`
