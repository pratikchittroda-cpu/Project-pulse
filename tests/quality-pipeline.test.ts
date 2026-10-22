import { describe, expect, it } from "vitest";

import {
  PROJECT_NAME,
  type WorkspacePackage,
} from "../packages/domain/src/index.js";
import { webWorkspace, webWorkspaceLabel } from "../apps/web/src/index.js";

describe("workspace quality smoke test", () => {
  it("resolves the web workspace through the shared domain package", () => {
    const expectedWorkspace: WorkspacePackage = {
      name: "@projectpulse/web",
      responsibility: "ProjectPulse web application",
    };

    expect(PROJECT_NAME).toBe("ProjectPulse");
    expect(webWorkspace).toEqual(expectedWorkspace);
    expect(webWorkspaceLabel).toBe("ProjectPulse web workspace");
  });
});
