# Definition of Done

A task is complete only when all applicable conditions are true.

## Implementation

- The requested behavior is implemented.
- The implementation follows the architecture decisions.
- Errors and loading states are handled.
- Empty states are useful and actionable.
- Permission checks exist at the server boundary.
- The UI is responsive and keyboard accessible.

## Data and security

- Database changes use a new migration.
- RLS policies are tested.
- External events are idempotent.
- Secrets are read from environment variables.
- No source code, tokens, or credentials are committed.
- No machine-specific absolute paths are used.

## Verification

- `make test` passes.
- Relevant unit tests pass.
- Relevant integration or browser tests pass.
- The production build succeeds when applicable.
- Documentation reflects the final behavior.

## Handoff

- The task file has a completed handoff section.
- Known limitations are recorded.
- The next task is identified.
- The work is committed using the task ID.
