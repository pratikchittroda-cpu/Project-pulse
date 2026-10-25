export const extensionCommands = {
  linkWorkspace: "releasearc.linkWorkspace",
  manageTelemetryConsent: "releasearc.setTelemetryConsent",
  openWorkspace: "releasearc.openWorkspace",
} as const;

export const extensionConfiguration = {
  telemetryEnabled: "releasearc.telemetry.enabled",
  workspaceUrl: "releasearc.workspaceUrl",
} as const;

export interface ExtensionSettings {
  authenticated: boolean;
  consentGiven: boolean;
}

/** Telemetry requires both identity and a separate explicit consent action. */
export function isTelemetryAllowed({
  authenticated,
  consentGiven,
}: ExtensionSettings) {
  return authenticated && consentGiven;
}
