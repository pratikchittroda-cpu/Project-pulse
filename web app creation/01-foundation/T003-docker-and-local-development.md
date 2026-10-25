# T003 — Docker and Local Development

## Status

Done

## Depends on

`T001`, `T002`.

## Unblocks

`T010`, `T095`.

## Goal

Make the project buildable and runnable on a clean Linux machine without global installs or machine-specific paths.

## Owned paths

- `Dockerfile`
- Local development documentation
- Container-related configuration
- `.env.example`

## Implementation steps

1. Select a Node base image matching the runtime pin.
2. Install dependencies from the lockfile.
3. Build the web workspace inside the image.
4. Document local Supabase prerequisites.
5. Document environment variables without real secrets.
6. Add a run command suitable for local development.

## Acceptance criteria

- [x] Docker can install dependencies from a clean context.
- [x] The application build completes inside Docker.
- [x] The container has no hard-coded local paths.
- [x] `.env.example` documents every required variable.
- [x] No secret is present in image layers or committed files.

## Verification

Completed verification:

- `docker compose config` rendered the Compose file successfully with example
  defaults, port mapping, environment placeholders, and healthcheck settings.
- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts` passed
  from the committed lockfile.
- `make test` passed all project quality gates and fourteen Vitest tests.
- `docker build --tag releasearc:local .` completed successfully after
  starting Docker Desktop. The first container smoke run exposed nginx's
  default root-only cache paths; the runtime config now uses writable `/tmp`
  paths for the non-root process.
- `docker run --rm --detach --name releasearc-t003 --publish 18080:8080
releasearc:local` started successfully; `curl /healthz` returned `ok`, the
  `/app` client-route fallback served `index.html`, and Docker reported the
  container healthcheck as `healthy`. The test container was stopped after
  verification.

## Handoff

- `Dockerfile` uses `node:22.14.0-bookworm-slim`, activates pnpm `10.12.1`
  through Corepack, installs from `pnpm-lock.yaml`, builds `@releasearc/web`,
  and copies the Vite output into `nginx:1.27.4-alpine`.
- Runtime listens on port `8080` as the non-root `nginx` user. Nginx serves
  `/healthz` with `ok` and falls back to `index.html` for client-side routes.
- Build command: `docker build --tag releasearc:local .`; run command:
  `docker run --rm --publish 8080:8080 releasearc:local`. Compose equivalent:
  `RELEASEARC_PORT=8080 docker compose up --build`.
- `.env.example` documents `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and
  `GITHUB_WEBHOOK_SECRET`; all values are non-secret placeholders.
- Local Supabase CLI setup is documented in the root README. T010 owns the
  committed Supabase project configuration and migrations.
- T010 and T095 are now unblocked. T050 remains ready for parallel work.

## Commit

`T003: add Docker local development`
