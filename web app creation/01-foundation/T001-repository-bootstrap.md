# T001 — Repository Bootstrap

## Status

Done

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

- [x] A clean checkout identifies the pinned runtime.
- [x] The workspace installs from the lockfile.
- [x] No global dependency is required.
- [x] The repository layout is documented.
- [x] No secrets or machine-specific paths are committed.

## Verification

- Run the package-manager install in a clean environment.
- Run `git status --short` and confirm only intended files exist.

Completed verification:

- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts`
  completed without changing `pnpm-lock.yaml`.
- `make test` passed using the offline bootstrap checks.
- `corepack pnpm run workspace:check` exits with status 1 and clearly lists
  the five workspace manifests that T002 must add.
- Ignored worker attachments and OS metadata do not appear in the repository
  status; no secrets or machine-specific paths were added.

## Handoff

- Runtime: Node.js `22.14.0`, pinned in `.nvmrc` and constrained by the root
  `package.json` engines field.
- Package manager: pnpm `10.12.1`, pinned by the root `packageManager` field
  and captured in `pnpm-lock.yaml`.
- Created paths: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`,
  `.gitignore`, `Makefile`, `pnpm-lock.yaml`, `README.md`,
  `scripts/check-bootstrap.mjs`, `scripts/check-workspaces.mjs`, and the
  `apps/` and `packages/` workspace directory skeleton.
- Exact next command for `T002`: `corepack pnpm run workspace:check` after
  its workspace manifests are created.

## Commit

`T001: bootstrap repository`
