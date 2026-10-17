# T004 — Testing, Linting, and Typecheck

## Status

Planned

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

- [ ] `make test` works from a clean checkout.
- [ ] Tests do not require a network connection.
- [ ] Type errors fail the command.
- [ ] Lint errors fail the command.
- [ ] Test output identifies the failing workspace.

## Verification

- Run `make test` with network access disabled if possible.
- Run each underlying check individually.

## Handoff

Record the exact quality pipeline and the commands feature sessions must run.

## Commit

`T004: add quality gates`
