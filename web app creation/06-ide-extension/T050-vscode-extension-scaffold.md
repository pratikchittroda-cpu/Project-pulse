# T050 — VS Code Extension Scaffold

## Status

Done

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

- [x] Extension builds from the pinned workspace.
- [x] Extension activates without uncaught errors.
- [x] Commands are discoverable in the command palette.
- [x] No telemetry is sent before authentication and consent.
- [x] Cursor compatibility assumptions are documented.

## Verification

Completed verification:

- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts`
  completed successfully from the committed lockfile.
- `corepack pnpm --filter releasearc-vscode-extension build` completed the
  CommonJS TypeScript extension build.
- `corepack pnpm --filter releasearc-vscode-extension package` produced
  `releasearc.vsix` with the manifest, compiled activation entry point, and
  README.
- `make test` passed all workspace checks and sixteen Vitest tests, including
  manifest command contributions and the authentication-plus-consent telemetry
  gate.
- The checked-in launch/tasks configuration provides the local Extension
  Development Host flow; activation only registers commands/status-bar UI and
  has no background network or telemetry work to fail.

## Handoff

- Marketplace manifest name is `releasearc-vscode-extension` because VSCE
  rejects scoped npm names; the workspace remains under `apps/vscode-extension`.
  It targets VS Code `^1.96.0` and Cursor hosts implementing the VS Code API.
- Activation entry point: `dist/extension.js`. Activation events are
  `onStartupFinished` plus the three command IDs:
  `releasearc.openWorkspace`, `releasearc.linkWorkspace`, and
  `releasearc.setTelemetryConsent`.
- Settings are `releasearc.workspaceUrl` (defaulting to local Vite) and
  `releasearc.telemetry.enabled` (default `false`). Telemetry is allowed only
  when both authenticated identity and explicit consent are true; the scaffold
  sends no events.
- `ReleaseArc: Link Workspace` validates and stores an HTTP(S) URL, while
  `ReleaseArc: Open Workspace` opens it through the host. The status bar
  displays linked/not-linked placeholder state.
- `.vscode/launch.json` and `.vscode/tasks.json` launch the extension host and
  build with Corepack. T051 owns real extension authentication; T052 owns
  branch/task linking.
- T010 is now ready; T051 remains blocked on this scaffold.

## Commit

`T050: scaffold IDE extension`
