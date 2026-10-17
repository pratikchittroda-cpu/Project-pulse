# Architecture Decisions

## Runtime and package management

- Node.js 22 LTS is the pinned runtime.
- pnpm is the package manager because the project contains a web app, an extension, and shared packages.
- A lockfile is mandatory.
- Dependencies are installed from the project manifest and lockfile.

## Frontend

- React 19 and Vite.
- TypeScript with strict checking.
- Tailwind CSS and Lucide icons.
- Zustand for local UI state where needed.
- Supabase client and query hooks for server state.

## Backend

- Supabase Auth for identity.
- PostgreSQL for durable data.
- Supabase Realtime for task synchronization and presence.
- Supabase Edge Functions for webhook ingestion and background-facing APIs.
- Supabase Storage for attachments.

## Integrations

- GitHub is the first source-control provider.
- The internal event model must not be GitHub-specific.
- VS Code Extension API is the first IDE target; Cursor compatibility is a design goal.

## Privacy

- No source code, keystrokes, screenshots, terminal contents, or secrets are collected.
- File-level telemetry is optional and redaction-aware.
- Presence is ephemeral; only summarized sessions are persisted.
- Analytics should focus on team flow instead of individual surveillance.

## Automation

- Every automatic transition creates an auditable event.
- Manual overrides are supported.
- CI status is a health signal and does not automatically equal task status.
- Webhook processing is asynchronous and idempotent.

## Reproducibility

- The project must contain a Dockerfile.
- The project must contain `.env.example`.
- The project must contain an offline-capable `make test` command.
- The README must document setup, run, test, and deployment.
