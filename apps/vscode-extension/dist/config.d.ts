export declare const extensionCommands: {
    readonly linkWorkspace: "projectpulse.linkWorkspace";
    readonly manageTelemetryConsent: "projectpulse.setTelemetryConsent";
    readonly openWorkspace: "projectpulse.openWorkspace";
};
export declare const extensionConfiguration: {
    readonly telemetryEnabled: "projectpulse.telemetry.enabled";
    readonly workspaceUrl: "projectpulse.workspaceUrl";
};
export interface ExtensionSettings {
    authenticated: boolean;
    consentGiven: boolean;
}
/** Telemetry requires both identity and a separate explicit consent action. */
export declare function isTelemetryAllowed({ authenticated, consentGiven, }: ExtensionSettings): boolean;
//# sourceMappingURL=config.d.ts.map