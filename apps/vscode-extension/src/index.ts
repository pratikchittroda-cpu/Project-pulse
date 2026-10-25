import { type TaskStatus } from "@releasearc/domain";

export * from "./config.js";

export const extensionWorkspace = {
  name: "releasearc-vscode-extension",
  hostCompatibility: ["vscode", "cursor"] as const,
};

export const extensionDefaultTaskStatus: TaskStatus = "in_progress";
