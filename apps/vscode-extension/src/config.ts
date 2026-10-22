export const extensionCommands = {
  linkWorkspace: "projectpulse.linkWorkspace",
  manageTelemetryConsent: "projectpulse.setTelemetryConsent",
  openWorkspace: "projectpulse.openWorkspace",
} as const;

export const extensionConfiguration = {
  telemetryEnabled: "projectpulse.telemetry.enabled",
  workspaceUrl: "projectpulse.workspaceUrl",
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
