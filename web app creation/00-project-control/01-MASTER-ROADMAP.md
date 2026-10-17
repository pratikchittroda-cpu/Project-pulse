# Master Roadmap

## Product outcome

ProjectPulse is a live engineering control plane. It connects planned work with developer activity, source-control events, CI/CD results, and delivery analytics.

## Release sequence

### Release 0 — Reproducible foundation

Tasks `T001` through `T007` create the repository, runtime pin, lockfile, Docker setup, test command, web shell, design system, and shared contracts.

### Release 1 — Secure project workspace

Tasks `T010` through `T015` create the local Supabase environment, schema, authentication, RLS, organizations, teams, projects, and repositories.

### Release 2 — Agile planning

Tasks `T020` through `T028` create the task lifecycle, Kanban board, sprints, roadmap, dependencies, search, comments, and attachments.

### Release 3 — Realtime workspace

Tasks `T030` through `T033` create the event model, realtime synchronization, presence, and in-app notifications.

### Release 4 — GitHub-backed automation

Tasks `T040` through `T046` connect GitHub, verify webhooks, normalize events, resolve task keys, display CI/PR/deployment data, and automate task transitions.

### Release 5 — Developer experience

Tasks `T050` through `T056` create the VS Code/Cursor extension, workspace linking, branch matching, telemetry, presence, privacy controls, and command-palette actions.

### Release 6 — Delivery intelligence

Tasks `T060` through `T064` create session aggregation, scope health, flow metrics, CI/review health, and reports.

### Release 7 — Collaboration

Tasks `T070` through `T072` create notification preferences, Slack/Teams integration, sprint digests, and release notes.

### Release 8 — Architecture intelligence

Tasks `T080` through `T083` create code hotspots, dependency health, build/test health, and architecture views.

### Release 9 — AI assistance

Tasks `T084` and `T085` add permission-aware AI summaries and risk assistance only after the event and access models are reliable.

### Release 10 — Production readiness

Tasks `T090` through `T096` complete security, observability, performance, accessibility, end-to-end verification, deployment, and release readiness.

## Critical demo path

```text
T001 -> T002 -> T003/T004 -> T005 -> T010 -> T011 -> T012 -> T013
  -> T014 -> T015 -> T020 -> T021 -> T023 -> T030 -> T040 -> T041
  -> T042 -> T043 -> T044 -> T045 -> T050 -> T051 -> T052 -> T053
  -> T054 -> T093 -> T095
```
