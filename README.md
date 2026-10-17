# ProjectPulse

ProjectPulse is a real-time engineering operations platform that connects agile
planning, developer activity, source-control events, CI/CD signals, analytics,
and delivery health.

The implementation backlog lives in [`web app creation/`](web%20app%20creation/).
Read [`web app creation/00-project-control/00-START-HERE.md`](web%20app%20creation/00-project-control/00-START-HERE.md)
before starting a task.

## Repository layout

```text
apps/
  web/                  React web application (T002)
  vscode-extension/     VS Code/Cursor extension (T002, T050)
packages/
  domain/               Shared domain types and contracts (T002, T007)
  integrations/         External provider adapters (T002)
  ui/                   Shared UI primitives (T002, T006)
scripts/                Repository validation scripts
web app creation/       Dependency-aware implementation backlog
```

T001 creates the workspace directory skeleton. Each workspace's package
manifest and workspace-specific commands are added by T002.

## Prerequisites

- Node.js `22.14.0`, the version pinned in [`.nvmrc`](.nvmrc)
- Corepack, distributed with Node.js, to provide the pnpm version pinned in
  [`package.json`](package.json)

No globally installed project dependency is required.

## First local setup

From the repository root, install exactly from the committed lockfile:

```sh
corepack pnpm install --frozen-lockfile
```

## Bootstrap validation

Run the offline repository check with:

```sh
make test
```

The workspace readiness check is also available:

```sh
corepack pnpm run workspace:check
```

Until T002 adds the workspace package manifests, `workspace:check` exits with
an actionable list of the manifests that are still missing. That failure is
intentional; `make test` validates the T001 bootstrap itself without requiring
network access or a globally installed package.

## Development and deployment

The runnable web workspace, development server, production build, container,
and deployment commands are introduced by the subsequent foundation tasks:

- T002 — workspace package manifests and root workspace commands
- T003 — Docker and local development
- T004 — linting, typechecking, and the full quality pipeline
- T095 — production deployment runbook

## Runtime and package manager

- Node.js 22 LTS is pinned by `.nvmrc` and constrained by the `engines` field.
- pnpm is pinned by the `packageManager` field.
- `pnpm-workspace.yaml` defines the `apps/*` and `packages/*` workspace globs.

## Security and local configuration

Local secrets must stay in untracked environment files. Never commit tokens,
credentials, or machine-specific absolute paths. Environment variables and
container configuration are added by T003.
