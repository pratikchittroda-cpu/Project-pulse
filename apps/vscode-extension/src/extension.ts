import * as vscode from "vscode";

import {
  extensionCommands,
  extensionConfiguration,
  isTelemetryAllowed,
} from "./config.js";

const CONSENT_STATE_KEY = "projectpulse.telemetryConsent";
const AUTH_STATE_KEY = "projectpulse.authenticated";

function workspaceUrl() {
  return vscode.workspace
    .getConfiguration()
    .get<string>(extensionConfiguration.workspaceUrl, "http://localhost:5173");
}

function telemetryIsEnabled(context: vscode.ExtensionContext) {
  const configured = vscode.workspace
    .getConfiguration()
    .get<boolean>(extensionConfiguration.telemetryEnabled, false);
  const authenticated = context.globalState.get<boolean>(AUTH_STATE_KEY, false);
  const consentGiven = context.globalState.get<boolean>(
    CONSENT_STATE_KEY,
    false,
  );

  return configured && isTelemetryAllowed({ authenticated, consentGiven });
}

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBar.name = "ProjectPulse";
  statusBar.text = "$(pulse) ProjectPulse: not linked";
  statusBar.tooltip = "Open ProjectPulse workspace";
  statusBar.command = extensionCommands.openWorkspace;
  statusBar.show();

  const openWorkspace = vscode.commands.registerCommand(
    extensionCommands.openWorkspace,
    async () => {
      await vscode.env.openExternal(vscode.Uri.parse(workspaceUrl()));
    },
  );
  const linkWorkspace = vscode.commands.registerCommand(
    extensionCommands.linkWorkspace,
    async () => {
      const url = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        prompt: "Enter the ProjectPulse workspace URL",
        value: workspaceUrl(),
        validateInput: (value) => {
          try {
            const parsed = new URL(value);
            return parsed.protocol === "http:" || parsed.protocol === "https:"
              ? undefined
              : "Use an http or https URL";
          } catch {
            return "Enter a valid workspace URL";
          }
        },
      });

      if (url) {
        await vscode.workspace
          .getConfiguration()
          .update(
            extensionConfiguration.workspaceUrl,
            url,
            vscode.ConfigurationTarget.Global,
          );
        statusBar.text = "$(pulse) ProjectPulse: linked";
        void vscode.window.showInformationMessage(
          "ProjectPulse workspace linked.",
        );
      }
    },
  );
  const manageTelemetryConsent = vscode.commands.registerCommand(
    extensionCommands.manageTelemetryConsent,
    async () => {
      const choice = await vscode.window.showInformationMessage(
        "ProjectPulse activity telemetry is off by default. It never collects source code, keystrokes, screenshots, terminal contents, or secrets.",
        "Allow privacy-aware activity telemetry",
        "Keep telemetry off",
      );
      const consentGiven = choice === "Allow privacy-aware activity telemetry";
      await context.globalState.update(CONSENT_STATE_KEY, consentGiven);
      await vscode.workspace
        .getConfiguration()
        .update(
          extensionConfiguration.telemetryEnabled,
          consentGiven,
          vscode.ConfigurationTarget.Global,
        );
      const telemetryEnabled = telemetryIsEnabled(context);
      void vscode.window.showInformationMessage(
        telemetryEnabled
          ? "ProjectPulse telemetry consent saved. Authentication is still required before events are sent."
          : "ProjectPulse telemetry remains off.",
      );
    },
  );

  context.subscriptions.push(
    statusBar,
    openWorkspace,
    linkWorkspace,
    manageTelemetryConsent,
  );
}

export function deactivate() {
  // The scaffold has no background work or telemetry queue to flush.
}
