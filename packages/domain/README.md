# `@projectpulse/domain`

The domain package is the dependency-free contract layer shared by the web
application, Edge Functions, IDE extension, integrations, and analytics.

## Contract groups

- Entity types: `Organization`, `Team`, `Member`, `Project`, `Repository`,
  `Task`, and `Integration`.
- Workflow unions: `TaskStatus` and `TaskPriority`.
- Event contracts: `EventEnvelope`, `ProviderEvent`, `EventName`, and
  `parseEventEnvelope`.
- API contracts: `ApiResponse`, `ApiSuccess`, `ApiFailure`, `ApiError`,
  `Paginated`, and `PageInfo`.
- Serialization: `IsoDateTime`, `isIsoDateTime`, and `toIsoDateTime`.

Event names are lower-case and dot-separated, with underscore-separated words
allowed inside a segment, for example `task.created` and
`telemetry.session_started`. Provider payloads remain in `ProviderEvent` and
are normalized into the provider-neutral `EventEnvelope` before application
code consumes them.

External event input must pass through `parseEventEnvelope`. It returns a
typed `ValidationResult`, preserving field-level issues without throwing for
malformed input. Date fields are serialized as UTC ISO strings with millisecond
precision, such as `2026-10-17T12:00:00.000Z`.
