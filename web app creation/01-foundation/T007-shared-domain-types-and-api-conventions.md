# T007 — Shared Domain Types and API Conventions

## Status

Planned

## Depends on

`T002` and `00-project-control/06-DATA-EVENT-CONTRACTS.md`.

## Unblocks

`T010`, `T020`, `T030`, `T042`, `T053`.

## Goal

Define the shared TypeScript contracts used by the web app, Edge Functions, extension, and analytics.

## Owned paths

- `packages/domain/`
- Shared error and pagination types
- Shared event names and status values

## Implementation steps

1. Define organization, project, task, member, event, and integration types.
2. Define status and priority unions.
3. Define API success and error envelopes.
4. Define pagination and date serialization rules.
5. Add runtime validation at external boundaries where needed.

## Acceptance criteria

- [ ] Web and extension can import shared types.
- [ ] Provider-specific payloads are separate from domain events.
- [ ] Invalid external data has a typed failure path.
- [ ] Contracts are documented.

## Verification

- Add type-level and runtime validation tests.
- Run all workspace typechecks.

## Handoff

Record exported types, event names, and compatibility rules for future changes.

## Commit

`T007: define shared domain contracts`
