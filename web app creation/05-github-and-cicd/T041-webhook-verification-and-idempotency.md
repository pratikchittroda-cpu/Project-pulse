# T041 — Webhook Verification and Idempotency

## Status

Planned

## Depends on

`T040`, `T030`.

## Unblocks

`T042`, `T046`, `T091`.

## Goal

Receive GitHub events safely and guarantee that retries do not duplicate state changes.

## Owned paths

- Webhook Edge Function
- Signature verification
- Provider delivery storage
- Retry and acknowledgment handling

## Implementation steps

1. Create the webhook endpoint.
2. Verify the GitHub HMAC signature before parsing.
3. Store provider delivery IDs with a unique constraint.
4. Acknowledge valid events quickly.
5. Queue or schedule normalized processing.
6. Record failures and safe retry state.

## Acceptance criteria

- [ ] Invalid signatures are rejected.
- [ ] Duplicate delivery IDs are ignored safely.
- [ ] Webhook responses do not wait on long processing.
- [ ] Failed events remain diagnosable.
- [ ] Secrets are never logged.

## Verification

- Test valid, invalid, missing, and replayed signatures.
- Test duplicate delivery IDs.
- Test provider timeout and retry behavior.

## Handoff

Record endpoint route, signature algorithm, delivery schema, retry policy, and secret configuration.

## Commit

`T041: secure GitHub webhooks`
