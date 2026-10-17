import { type TaskStatus } from "@projectpulse/domain";

export const extensionWorkspace = {
  name: "@projectpulse/vscode-extension",
  hostCompatibility: ["vscode", "cursor"] as const,
};

export const extensionDefaultTaskStatus: TaskStatus = "in_progress";
