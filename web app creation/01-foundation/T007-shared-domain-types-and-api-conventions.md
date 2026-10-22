# T007 — Shared Domain Types and API Conventions

## Status

Done

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

- [x] Web and extension can import shared types.
- [x] Provider-specific payloads are separate from domain events.
- [x] Invalid external data has a typed failure path.
- [x] Contracts are documented.

## Verification

Completed verification:

- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts`
  completed successfully from the committed lockfile.
- `corepack pnpm run typecheck` passed all workspace TypeScript projects,
  including the web and VS Code extension imports from `@projectpulse/domain`.
- `tests/domain-contracts.test.ts` covers valid event parsing, typed field
  validation failures, strict ISO date serialization, event naming, provider
  payload separation, and API response typing.
- `make test` passed the complete quality pipeline with fourteen Vitest tests.

## Handoff

- `@projectpulse/domain` exports entity contracts for `Organization`, `Team`,
  `Member`, `Project`, `Repository`, `Task`, and `Integration`, plus
  `TaskStatus`, `TaskPriority`, `MemberRole`, and provider/status unions.
- Event contracts are `EventEnvelope`, `ProviderEvent`, `EventName`,
  `isEventName`, and `parseEventEnvelope`. Normalized event names use lower-case
  dot-separated syntax; provider-specific delivery payloads remain in
  `ProviderEvent` until normalized.
- API contracts are `ApiResponse`, `ApiSuccess`, `ApiFailure`, `ApiError`,
  `Paginated`, and `PageInfo`. Dates use branded `IsoDateTime` strings created
  by `toIsoDateTime` and checked by `isIsoDateTime`.
- `parseEventEnvelope` returns a typed `ValidationResult` with field-level
  `ValidationIssue` entries and does not throw for malformed external input.
- The web workspace already consumes `WorkspacePackage`; the extension now
  imports `TaskStatus`, proving the package boundary in both consumers.
- Compatibility rule: add new event names and optional envelope fields without
  changing existing serialized names; breaking changes require a versioned
  contract or migration.
- T010, T020, T030, T042, and T053 are now unblocked by the shared contracts.

## Commit

`T007: define shared domain contracts`
