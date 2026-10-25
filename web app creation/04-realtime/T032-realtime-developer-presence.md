# T032 — Realtime Developer Presence

## Status

Done

## Depends on

`T030`, `T014`.

## Unblocks

`T054`, presence badges, and live activity views.

## Goal

Display current developer activity without persisting every heartbeat.

## Owned paths

- Presence channel helpers
- Presence state types
- Presence expiry logic
- Presence UI primitives

## Implementation steps

1. Define project-scoped presence state and private channel naming.
2. Add activity, task, branch, and optional redacted file fields.
3. Add expiry and offline behavior.
4. Enforce project access before joining or publishing to channels.
5. Keep presence ephemeral and separate from durable sessions/events.

## Acceptance criteria

- [x] Active users appear on the correct project/task through the reusable
      presence controller and UI primitive.
- [x] Stale presence expires automatically.
- [x] No source content is exposed.
- [x] Presence is hidden when telemetry is paused.
- [x] A user cannot join another organization's channel.

## Verification

- Test join, update, leave, expiry, offline, authorization, and redaction behavior.
- Test paused telemetry behavior and realtime channel RLS policies.

## Handoff

- Channel name: `projectpulse:presence:<organizationId>:<projectId>`, joined as
  a private Supabase Presence channel. `realtime.messages` policies authorize
  only authenticated users who can access the encoded project scope.
- Presence state contains user ID, activity, optional task ID, branch, and a
  redacted file basename/extension/hash. Full paths, source text, buffers, and
  secrets are discarded before tracking. Local records expire after 45 seconds
  without a fresh presence event.
- `createDeveloperPresence` requires an injected project authorizer and keeps
  telemetry-paused/offline states off the channel. The board page now mounts a
  project-scoped presence controller and joins with a lightweight `testing`
  activity so the feature can be exercised in two authenticated browser tabs.
  `ActiveDevelopers` and `DeveloperPresencePanel` remain reusable UI
  primitives; extension/activity producers and product-specific telemetry
  preferences remain caller-owned.
- Presence is not written to `task_events` or durable session tables. A later
  producer can update activity without changing task history.

## Commit

`T032: add realtime developer presence`
