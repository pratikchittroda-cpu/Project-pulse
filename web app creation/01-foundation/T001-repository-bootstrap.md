# T001 — Repository Bootstrap

## Status

Ready

## Depends on

None.

## Unblocks

`T002`, `T003`, `T004`, `T050`.

## Goal

Create the reproducible Node.js/TypeScript workspace foundation for ProjectPulse.

## Owned paths

- Root package manifest and workspace configuration
- `.nvmrc` or equivalent runtime pin
- `pnpm-workspace.yaml`
- Initial `.gitignore`
- Initial root README sections

## Implementation steps

1. Pin Node.js 22 LTS.
2. Configure pnpm workspace support.
3. Create the `apps/` and `packages/` layout described in the backlog.
4. Add a lockfile.
5. Add scripts that fail clearly when a workspace is missing.
6. Document the first local setup command.

## Acceptance criteria

- [ ] A clean checkout identifies the pinned runtime.
- [ ] The workspace installs from the lockfile.
- [ ] No global dependency is required.
- [ ] The repository layout is documented.
- [ ] No secrets or machine-specific paths are committed.

## Verification

- Run the package-manager install in a clean environment.
- Run `git status --short` and confirm only intended files exist.

## Handoff

Record the runtime version, package-manager version, created paths, and the exact next command for `T002`.

## Commit

`T001: bootstrap repository`
