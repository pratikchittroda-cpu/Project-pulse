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
  web/                  Web application workspace (@projectpulse/web)
  vscode-extension/     VS Code/Cursor extension workspace (@projectpulse/vscode-extension)
packages/
  domain/               Shared domain types and contracts (@projectpulse/domain)
  integrations/         External provider adapters (@projectpulse/integrations)
  ui/                   Shared UI primitives (@projectpulse/ui)
scripts/                Repository validation scripts
web app creation/       Dependency-aware implementation backlog
```

Each workspace has a private package manifest, a strict TypeScript configuration,
and build, test, lint, and typecheck scripts. The web workspace imports the
shared `@projectpulse/domain` package through the pnpm workspace reference.

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

`make test` runs the complete offline quality pipeline: workspace validation,
strict typechecking, ESLint, Prettier validation, all workspace builds, the
Vitest smoke suite, and workspace checks. A failure exits non-zero and the
workspace name is included in recursive pnpm output.

The workspace readiness check is also available:

```sh
corepack pnpm run workspace:check
```

The check validates all five package names and their shared quality scripts.

## Workspace commands

Run the complete workspace commands from the repository root:

```sh
corepack pnpm run dev
corepack pnpm run build
corepack pnpm run test
corepack pnpm run lint
corepack pnpm run typecheck
corepack pnpm run format:check
```

To target one workspace, use its package name with pnpm's filter syntax:

```sh
corepack pnpm --filter @projectpulse/web build
corepack pnpm --filter @projectpulse/domain typecheck
```

The web development entry point is the React/Vite shell on the Vite default
port (`5173`). Use `corepack pnpm --filter @projectpulse/web preview` to serve
the production build locally.

Shared interface primitives live in `@projectpulse/ui`. Import components such
as `Button`, `Input`, `Card`, `Dialog`, `Tabs`, `StatusBadge`, `PriorityBadge`,
`Menu`, `DataTable`, `Toast`, and `PageLayout` from that package. Its design
tokens and responsive styles are available through `@projectpulse/ui/styles.css`.

Shared domain contracts live in `@projectpulse/domain`. Use its entity types,
workflow unions, API envelopes, pagination types, ISO date helpers, and
`parseEventEnvelope` validator at external event boundaries.

## Development and deployment

### Local web development

Copy the documented placeholders before starting local services:

```sh
cp .env.example .env
corepack pnpm --filter @projectpulse/web dev
```

The Vite server listens on `http://localhost:5173`. The browser configuration
uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the local Supabase
defaults point to `http://127.0.0.1:54321`.

### Docker

Build and run the production web container with no global project dependency:

```sh
docker build --tag projectpulse:local .
docker run --rm --publish 8080:8080 projectpulse:local
```

Open `http://localhost:8080`. The container serves the Vite build through
nginx, supports client-side route fallback, and exposes `GET /healthz` with an
`ok` response. Docker Compose provides the same flow and allows the host port
to be changed with `PROJECTPULSE_PORT`:

```sh
PROJECTPULSE_PORT=8080 docker compose up --build
```

### Local Supabase prerequisites

Install the Supabase CLI using its official package for your operating system,
then run the local stack from the repository root:

```sh
supabase start
supabase status
```

T010 adds the committed local Supabase configuration, database services, and
migrations. Until then, the web shell runs with the placeholder project and
does not make Supabase requests. Never commit `.env`; use `.env.example` as
the variable inventory.

The runnable web workspace, development server, production build, container,
and deployment commands are introduced by the foundation tasks:

- T002 — workspace package manifests and root workspace commands
- T003 — Docker and local development
- T004 — linting, typechecking, and the full quality pipeline
- T005 — React/Vite web application shell and routing
- T095 — production deployment runbook

## Runtime and package manager

- Node.js 22 LTS is pinned by `.nvmrc` and constrained by the `engines` field.
- pnpm is pinned by the `packageManager` field.
- `pnpm-workspace.yaml` defines the `apps/*` and `packages/*` workspace globs.

## Security and local configuration

Local secrets must stay in untracked environment files. Never commit tokens,
credentials, or machine-specific absolute paths. Environment variables and
container configuration are added by T003.
