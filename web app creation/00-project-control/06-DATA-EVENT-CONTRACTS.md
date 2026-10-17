# Data and Event Contracts

## Task identity

```text
project_key: PULSE
task_number: 42
display_key: PULSE-42
```

The project key and task number are stored separately. The display key is derived and used by branches, commits, and pull requests.

## Common event envelope

```text
event_id
source
event_type
organization_id
project_id
actor_id
entity_type
entity_id
occurred_at
received_at
idempotency_key
correlation_id
payload
```

## Event naming

Use lower-case dot-separated names:

```text
task.created
github.pull_request.opened
telemetry.session_started
presence.updated
```

## Telemetry contract

Allowed fields:

- User ID
- Organization and project ID
- Repository ID
- Branch name
- Task ID
- Activity category
- Optional redacted file name
- Timestamp
- Extension version

Prohibited fields:

- Source contents
- Keystrokes
- Screenshots
- Terminal contents
- Tokens or secrets
- Full machine paths

## Status categories

The default workflow is:

```text
backlog
planned
in_progress
blocked
in_review
changes_requested
ready_to_merge
completed
canceled
```
