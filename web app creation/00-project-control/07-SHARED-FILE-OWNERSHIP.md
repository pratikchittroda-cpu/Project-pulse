# Shared File Ownership

This file prevents parallel sessions from overwriting one another.

## Root files

Owned by `T001` through `T004` and later `T095`:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.nvmrc`
- `Dockerfile`
- `Makefile`
- `.env.example`
- Root README

## Web application

- `T005` owns the initial app shell and routing.
- `T006` owns shared UI primitives.
- Planning tasks own their feature directories.
- A feature task must not make unrelated changes to the app shell.

## Database

- Each schema task creates a new migration.
- Existing migrations are never edited after they are applied.
- RLS policies are owned by the task that introduces the protected entity, with security review in `T090`.

## GitHub functions

- `T040` owns connection setup.
- `T041` owns webhook verification and delivery storage.
- `T042` owns provider-to-domain normalization.
- `T045` owns automation behavior.

## Extension

- `T050` owns the extension package.
- `T051` through `T056` own extension capabilities.

## Status

The coordinator owns `08-STATUS-INDEX.md`.
