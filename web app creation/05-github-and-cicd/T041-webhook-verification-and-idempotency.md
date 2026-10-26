# T041 — Webhook Verification and Idempotency

## Status

Implemented with asynchronous processing still pending

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

- [x] Invalid signatures are rejected.
- [x] Duplicate delivery IDs are ignored safely.
- [ ] Webhook responses do not wait on long processing.
- [x] Failed events remain diagnosable.
- [x] Secrets are never logged.

## Verification

- Test valid, invalid, missing, and replayed signatures.
- Test duplicate delivery IDs.
- Test provider timeout and retry behavior.

## Handoff

The hosted endpoint is `/functions/v1/github-webhook`. It verifies GitHub
`x-hub-signature-256` HMAC signatures, stores unique delivery IDs, records
processing failures, and keeps secrets server-side. Processing is currently
synchronous within the Edge Function; queue-backed acknowledgment remains a
future scaling improvement.

## Commit

`T041: secure GitHub webhooks`
