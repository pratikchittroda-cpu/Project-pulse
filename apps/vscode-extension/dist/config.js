"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extensionConfiguration = exports.extensionCommands = void 0;
exports.isTelemetryAllowed = isTelemetryAllowed;
exports.extensionCommands = {
    linkWorkspace: "projectpulse.linkWorkspace",
    manageTelemetryConsent: "projectpulse.setTelemetryConsent",
    openWorkspace: "projectpulse.openWorkspace",
};
exports.extensionConfiguration = {
    telemetryEnabled: "projectpulse.telemetry.enabled",
    workspaceUrl: "projectpulse.workspaceUrl",
};
/** Telemetry requires both identity and a separate explicit consent action. */
function isTelemetryAllowed({ authenticated, consentGiven, }) {
    return authenticated && consentGiven;
}
//# sourceMappingURL=config.js.map