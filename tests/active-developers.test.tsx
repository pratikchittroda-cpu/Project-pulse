// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ActiveDevelopers } from "../apps/web/src/features/presence/active-developers.js";
import type { ActiveDeveloperPresence } from "../apps/web/src/features/presence/developer-presence.js";

const developer: ActiveDeveloperPresence = {
  activity: "editing",
  branch: "feature/presence",
  file: {
    fileExtension: "ts",
    fileName: "presence.ts",
  },
  lastSeenAt: 1_000,
  organizationId: "organization-1",
  projectId: "project-1",
  taskId: "task-1",
  userId: "user-1",
};

describe("active developer presence UI", () => {
  afterEach(cleanup);

  it("shows safe activity metadata without source content", () => {
    render(<ActiveDevelopers developers={[developer]} />);

    expect(
      screen.getByRole("region", { name: "Active developers" }),
    ).toBeTruthy();
    expect(screen.getByText("user-1")).toBeTruthy();
    expect(screen.getByText("editing · task task-1")).toBeTruthy();
    expect(screen.getByText("Branch: feature/presence")).toBeTruthy();
    expect(screen.getByText("File: presence.ts")).toBeTruthy();
    expect(screen.queryByText(/do-not-send|token =/i)).toBeNull();
  });

  it("hides the developer list when telemetry is paused", () => {
    render(<ActiveDevelopers developers={[developer]} status="paused" />);

    expect(
      screen.getByText("Presence is paused in your privacy settings."),
    ).toBeTruthy();
    expect(screen.queryByText("user-1")).toBeNull();
  });

  it("explains connection failures without hiding board availability", () => {
    render(<ActiveDevelopers developers={[]} status="error" />);

    expect(
      screen.getByText(
        "Project presence could not connect. Task synchronization is still available.",
      ),
    ).toBeTruthy();
  });
});
