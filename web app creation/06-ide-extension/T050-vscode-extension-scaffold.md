# T050 — VS Code Extension Scaffold

## Status

Planned

## Depends on

`T002`.

## Unblocks

`T051`.

## Goal

Create a TypeScript extension package that can run in VS Code and Cursor-compatible environments.

## Owned paths

- `apps/vscode-extension/`
- Extension manifest
- Activation and command registration
- Extension development configuration

## Implementation steps

1. Create extension manifest and activation events.
2. Add a development launch configuration.
3. Add a status-bar placeholder.
4. Add command registration placeholders.
5. Add a package script for build and packaging.

## Acceptance criteria

- [ ] Extension builds from the pinned workspace.
- [ ] Extension activates without uncaught errors.
- [ ] Commands are discoverable in the command palette.
- [ ] No telemetry is sent before authentication and consent.
- [ ] Cursor compatibility assumptions are documented.

## Verification

- Launch the extension host locally.
- Run extension unit tests and packaging checks.

## Handoff

Record activation events, command IDs, extension settings, and host compatibility notes.

## Commit

`T050: scaffold IDE extension`
