# ReleaseArc VS Code/Cursor extension

The extension scaffold targets VS Code `^1.96.0` and Cursor-compatible hosts
that implement the VS Code extension API.

## Commands

- `ReleaseArc: Open Workspace` opens the configured `releasearc.workspaceUrl`.
- `ReleaseArc: Link Workspace` stores a validated web workspace URL in the
  global editor configuration.
- `ReleaseArc: Manage Activity Consent` records explicit telemetry consent.

The status-bar item is a placeholder until workspace authentication and branch
linking are implemented by T051 and T052. No telemetry is sent by this
scaffold. Future activity telemetry must require both authenticated identity
and the explicit consent state; it must remain within the privacy contract in
`00-project-control/05-ARCHITECTURE-DECISIONS.md`.

## Development

```sh
corepack pnpm --filter releasearc-vscode-extension build
corepack pnpm --filter releasearc-vscode-extension package
```

Use the checked-in launch configuration in `.vscode/launch.json` to launch an
Extension Development Host from VS Code. Cursor should use the same compiled
CommonJS entry point and command contributions; host-specific authentication
behavior is intentionally deferred to T051.
