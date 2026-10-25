# ReleaseArc Web App Creation Plan

This folder is the implementation backlog for ReleaseArc, an engineering delivery intelligence platform that connects agile planning, developer activity, GitHub events, CI/CD signals, analytics, and delivery health.

The backlog is deliberately split into small, dependency-aware task files so separate sessions can work safely in parallel.

## Start here

1. Read `00-project-control/00-START-HERE.md`.
2. Read `00-project-control/02-DEPENDENCY-GRAPH.md`.
3. Read the task file for the next available task.
4. Confirm all dependencies are complete before starting.
5. Use a task-specific branch.
6. Work only inside the task's owned paths.
7. Run `make test` after implementation.
8. Record the handoff in the task file and commit the work.

## Folder map

- `00-project-control/` — operating rules, architecture decisions, contracts, and status.
- `01-foundation/` — repository, runtime, web shell, design system, and quality gates.
- `02-data-and-access/` — Supabase, schema, authentication, RLS, organizations, and projects.
- `03-agile-planning/` — tasks, board, backlog, roadmap, dependencies, and collaboration.
- `04-realtime/` — events, realtime synchronization, presence, and notifications.
- `05-github-and-cicd/` — GitHub, webhooks, pull requests, CI, deployments, and automation.
- `06-ide-extension/` — VS Code/Cursor extension and privacy-minimized telemetry.
- `07-analytics-and-health/` — scope, flow, CI, review, deployment, and project health metrics.
- `08-collaboration/` — notification preferences, chat integrations, digests, and release notes.
- `09-architecture-and-ai/` — code health, dependency health, architecture views, and AI assistance.
- `10-hardening-and-release/` — security, observability, performance, end-to-end verification, and deployment.

## Recommended first slice

The first complete product slice is:

```text
Create PULSE-1
  -> create feature/PULSE-1-login
  -> detect the branch
  -> show developer activity
  -> open a pull request
  -> show CI status
  -> merge to main
  -> complete the task
  -> display the full activity timeline
```

## Technology defaults

- Node.js 22 LTS
- pnpm workspace
- React 19 and Vite
- TypeScript
- Tailwind CSS and Lucide icons
- Supabase Auth, PostgreSQL, Realtime, Storage, and Edge Functions
- GitHub as the first source-control provider
- VS Code Extension API with Cursor compatibility
- Vitest, React Testing Library, and Playwright

These defaults can be changed only through `00-project-control/05-ARCHITECTURE-DECISIONS.md`.
