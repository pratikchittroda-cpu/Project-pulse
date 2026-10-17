# T003 — Docker and Local Development

## Status

Planned

## Depends on

`T001`, `T002`.

## Unblocks

`T010`, `T095`.

## Goal

Make the project buildable and runnable on a clean Linux machine without global installs or machine-specific paths.

## Owned paths

- `Dockerfile`
- Local development documentation
- Container-related configuration
- `.env.example`

## Implementation steps

1. Select a Node base image matching the runtime pin.
2. Install dependencies from the lockfile.
3. Build the web workspace inside the image.
4. Document local Supabase prerequisites.
5. Document environment variables without real secrets.
6. Add a run command suitable for local development.

## Acceptance criteria

- [ ] Docker can install dependencies from a clean context.
- [ ] The application build completes inside Docker.
- [ ] The container has no hard-coded local paths.
- [ ] `.env.example` documents every required variable.
- [ ] No secret is present in image layers or committed files.

## Verification

- Build the Docker image.
- Run the image with example configuration.
- Confirm the documented port and health behavior.

## Handoff

Record the image target, build command, run command, required variables, and any local-only limitations.

## Commit

`T003: add Docker local development`
