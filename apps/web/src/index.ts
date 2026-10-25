import { PROJECT_NAME, type WorkspacePackage } from "@releasearc/domain";

export const webWorkspace: WorkspacePackage = {
  name: "@releasearc/web",
  responsibility: "ReleaseArc web application",
};

export const webWorkspaceLabel = `${PROJECT_NAME} web workspace`;
