"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const config_js_1 = require("./config.js");
const CONSENT_STATE_KEY = "projectpulse.telemetryConsent";
const AUTH_STATE_KEY = "projectpulse.authenticated";
function workspaceUrl() {
    return vscode.workspace
        .getConfiguration()
        .get(config_js_1.extensionConfiguration.workspaceUrl, "http://localhost:5173");
}
function telemetryIsEnabled(context) {
    const configured = vscode.workspace
        .getConfiguration()
        .get(config_js_1.extensionConfiguration.telemetryEnabled, false);
    const authenticated = context.globalState.get(AUTH_STATE_KEY, false);
    const consentGiven = context.globalState.get(CONSENT_STATE_KEY, false);
    return configured && (0, config_js_1.isTelemetryAllowed)({ authenticated, consentGiven });
}
function activate(context) {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.name = "ProjectPulse";
    statusBar.text = "$(pulse) ProjectPulse: not linked";
    statusBar.tooltip = "Open ProjectPulse workspace";
    statusBar.command = config_js_1.extensionCommands.openWorkspace;
    statusBar.show();
    const openWorkspace = vscode.commands.registerCommand(config_js_1.extensionCommands.openWorkspace, async () => {
        await vscode.env.openExternal(vscode.Uri.parse(workspaceUrl()));
    });
    const linkWorkspace = vscode.commands.registerCommand(config_js_1.extensionCommands.linkWorkspace, async () => {
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
                }
                catch {
                    return "Enter a valid workspace URL";
                }
            },
        });
        if (url) {
            await vscode.workspace
                .getConfiguration()
                .update(config_js_1.extensionConfiguration.workspaceUrl, url, vscode.ConfigurationTarget.Global);
            statusBar.text = "$(pulse) ProjectPulse: linked";
            void vscode.window.showInformationMessage("ProjectPulse workspace linked.");
        }
    });
    const manageTelemetryConsent = vscode.commands.registerCommand(config_js_1.extensionCommands.manageTelemetryConsent, async () => {
        const choice = await vscode.window.showInformationMessage("ProjectPulse activity telemetry is off by default. It never collects source code, keystrokes, screenshots, terminal contents, or secrets.", "Allow privacy-aware activity telemetry", "Keep telemetry off");
        const consentGiven = choice === "Allow privacy-aware activity telemetry";
        await context.globalState.update(CONSENT_STATE_KEY, consentGiven);
        await vscode.workspace
            .getConfiguration()
            .update(config_js_1.extensionConfiguration.telemetryEnabled, consentGiven, vscode.ConfigurationTarget.Global);
        const telemetryEnabled = telemetryIsEnabled(context);
        void vscode.window.showInformationMessage(telemetryEnabled
            ? "ProjectPulse telemetry consent saved. Authentication is still required before events are sent."
            : "ProjectPulse telemetry remains off.");
    });
    context.subscriptions.push(statusBar, openWorkspace, linkWorkspace, manageTelemetryConsent);
}
function deactivate() {
    // The scaffold has no background work or telemetry queue to flush.
}
//# sourceMappingURL=extension.js.map