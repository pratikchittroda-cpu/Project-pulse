import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  extensionCommands,
  extensionConfiguration,
  extensionWorkspace,
  isTelemetryAllowed,
} from "../apps/vscode-extension/src/index.js";

const manifest = JSON.parse(
  readFileSync("apps/vscode-extension/package.json", "utf8"),
) as {
  activationEvents: string[];
  contributes: { commands: Array<{ command: string }> };
  main: string;
};

describe("VS Code extension scaffold", () => {
  it("declares the compiled entry point and command palette contributions", () => {
    expect(extensionWorkspace.hostCompatibility).toEqual(["vscode", "cursor"]);
    expect(manifest.main).toBe("./dist/extension.js");
    expect(manifest.activationEvents).toContain(
      "onCommand:projectpulse.openWorkspace",
    );
    expect(manifest.contributes.commands.map(({ command }) => command)).toEqual(
      expect.arrayContaining(Object.values(extensionCommands)),
    );
    expect(extensionConfiguration.workspaceUrl).toBe(
      "projectpulse.workspaceUrl",
    );
  });

  it("requires authentication and consent before telemetry is allowed", () => {
    expect(
      isTelemetryAllowed({ authenticated: false, consentGiven: false }),
    ).toBe(false);
    expect(
      isTelemetryAllowed({ authenticated: false, consentGiven: true }),
    ).toBe(false);
    expect(
      isTelemetryAllowed({ authenticated: true, consentGiven: false }),
    ).toBe(false);
    expect(
      isTelemetryAllowed({ authenticated: true, consentGiven: true }),
    ).toBe(true);
  });
});
