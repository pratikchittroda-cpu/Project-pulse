// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog, Input, StatusBadge, Tabs } from "@releasearc/ui";

describe("shared UI primitives", () => {
  it("exposes input errors to assistive technology", () => {
    render(
      <Input
        error="A project name is required"
        label="Project name"
        value=""
        readOnly
      />,
    );

    const input = screen.getByLabelText("Project name");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("-error");
    expect(screen.getByRole("alert").textContent).toContain(
      "A project name is required",
    );
  });

  it("communicates status with an icon and visible label", () => {
    render(<StatusBadge status="completed" />);

    const badge = screen.getByLabelText("Status: Completed");

    expect(badge.textContent).toContain("Completed");
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("moves tabs with the keyboard and returns focus to the next tab", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        onChange={onChange}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "activity", label: "Activity" },
          { disabled: true, id: "settings", label: "Settings" },
        ]}
        value="overview"
      />,
    );

    const overviewTab = screen.getByRole("tab", { name: "Overview" });
    const activityTab = screen.getByRole("tab", { name: "Activity" });

    overviewTab.focus();
    fireEvent.keyDown(overviewTab, { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("activity");
    expect(document.activeElement).toBe(activityTab);
  });

  it("closes dialogs from the Escape key", () => {
    const onClose = vi.fn();
    render(
      <Dialog
        description="This is a keyboard-accessible dialog."
        onClose={onClose}
        open
        title="Confirm action"
      >
        <p>Dialog content</p>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
