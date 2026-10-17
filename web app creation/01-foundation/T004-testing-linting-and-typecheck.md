# T004 — Testing, Linting, and Typecheck

## Status

Done

## Depends on

`T002`.

## Unblocks

`T005` and all implementation tasks.

## Goal

Create the single repeatable quality command required by the project.

## Owned paths

- `Makefile`
- Test configuration
- TypeScript configuration
- Lint and formatting configuration
- Root quality scripts

## Implementation steps

1. Configure Vitest for unit and domain tests.
2. Configure TypeScript strict checking.
3. Add linting and formatting rules.
4. Create an offline-capable `make test` target.
5. Make failures return a non-zero exit code.
6. Add one smoke test proving the command is wired correctly.

## Acceptance criteria

- [x] `make test` works from a clean checkout.
- [x] Tests do not require a network connection.
- [x] Type errors fail the command.
- [x] Lint errors fail the command.
- [x] Test output identifies the failing workspace.

## Verification

Completed verification:

- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts`
  completed successfully from the committed lockfile.
- `corepack pnpm run format:check`, `corepack pnpm run lint`,
  `corepack pnpm run typecheck`, and `corepack pnpm run test:unit` passed.
- `make test` passed the complete quality pipeline: workspace validation,
  strict TypeScript checks, ESLint, Prettier, builds, Vitest, and workspace
  smoke checks.
- An intentional ESLint violation passed through stdin and returned a failure,
  confirming lint errors produce a non-zero exit status.

## Handoff

- `make test` and `corepack pnpm run test` run the complete quality pipeline.
  The pipeline is `workspace:check`, `typecheck`, `lint`, `format:check`,
  `build`, `test:unit`, and `test:workspaces`, chained with fail-fast
  non-zero exits.
- Vitest is configured in `vitest.config.ts` for Node-based unit tests under
  `tests/**/*.test.ts`, with the shared domain package aliased to source for
  offline tests. `tests/quality-pipeline.test.ts` verifies the web-to-domain
  workspace boundary.
- ESLint uses the flat config in `eslint.config.mjs`; Prettier uses
  `.prettierrc.json` and `.prettierignore`. Both are pinned in the root
  package manifest and lockfile.
- Recursive pnpm checks retain workspace names in their output so failures
  identify the affected package.
- T005 is now unblocked. T003, T007, and T050 remain ready for parallel work.

## Commit

`T004: add quality gates`
