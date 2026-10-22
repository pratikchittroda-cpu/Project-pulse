import { PROJECT_NAME, type WorkspacePackage } from "@projectpulse/domain";

export const webWorkspace: WorkspacePackage = {
  name: "@projectpulse/web",
  responsibility: "ProjectPulse web application",
};

export const webWorkspaceLabel = `${PROJECT_NAME} web workspace`;
