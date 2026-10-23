import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouterProvider } from "react-router-dom";

import { type AuthStatus } from "../apps/web/src/app/auth-context.js";
import { createTestRouter } from "../apps/web/src/app/router.js";

function renderRoute(path: string, initialAuthStatus?: AuthStatus) {
  const router = createTestRouter([path], { initialAuthStatus });
  const markup = renderToStaticMarkup(
    createElement(RouterProvider, { router }),
  );

  return { markup, router };
}

describe("web route groups", () => {
  it("renders the public landing route", () => {
    const { markup } = renderRoute("/", "signed_out");

    expect(markup).toContain("Make delivery feel visible.");
    expect(markup).toContain("Open the workspace");
    expect(markup).toContain("From planning signals to shipping decisions.");
    expect(markup).toContain(
      "See how work moves without turning work into surveillance.",
    );
    expect(markup).toContain("Signal lens");
    expect(markup).toContain("PERMISSIONS / VISIBLE");
    expect(markup).toContain("Make delivery feel calmer.");
  });

  it("renders the authentication route separately from the app shell", () => {
    const { markup } = renderRoute("/auth/login", "signed_out");

    expect(markup).toContain("Sign in to ProjectPulse");
    expect(markup).toContain("Send magic link");
    expect(markup).toContain("There is no separate signup screen");
    expect(markup).not.toContain("Create an account");
    expect(markup).toContain("Continue with GitHub");
    expect(markup).not.toContain("Engineering control plane");
  });

  it("renders the protected project workspace with navigation", () => {
    const { markup } = renderRoute("/app");

    expect(markup).toContain("Welcome to ProjectPulse");
    expect(markup).toContain("Create your first organization.");
    expect(markup).not.toContain("Delivery health is trending up.");
    expect(markup).not.toContain("pulse-api");
    expect(markup).not.toContain("92%");
    expect(markup).not.toContain("PULSE");
    expect(markup).not.toContain("ProjectPulse user");
    expect(markup).toContain("Primary navigation");
    expect(markup).toContain("Activity");
  });

  it("renders the protected organization administration route", () => {
    const { markup } = renderRoute("/app/organization");

    expect(markup).toContain("Organizations and teams");
    expect(markup).toContain("Create your first organization");
    expect(markup).toContain("Organization context");
  });

  it("renders the protected project administration route", () => {
    const { markup } = renderRoute("/app/projects");

    expect(markup).toContain("Projects and repositories");
    expect(markup).toContain("Set up an organization");
    expect(markup).toContain("Select an organization first");
  });

  it("renders the protected tasks route", () => {
    const { markup } = renderRoute("/app/tasks");

    expect(markup).toContain("Tasks");
    expect(markup).toContain("Select an organization and project");
  });

  it("renders the protected board route", () => {
    const { markup } = renderRoute("/app/board");

    expect(markup).toContain("Kanban board");
    expect(markup).toContain("Select an organization and project");
  });

  it("renders the protected backlog route", () => {
    const { markup } = renderRoute("/app/backlog");

    expect(markup).toContain("Backlog and sprints");
    expect(markup).toContain("Select an organization and project");
  });

  it("renders the protected roadmap route", () => {
    const { markup } = renderRoute("/app/roadmap");

    expect(markup).toContain("Roadmap");
    expect(markup).toContain("Select an organization and project");
  });

  it("requires a real session for scoped task details even in demo mode", () => {
    const { markup } = renderRoute(
      "/app/organizations/00000000-0000-4000-8000-000000000001/projects/00000000-0000-4000-8000-000000000002/tasks/00000000-0000-4000-8000-000000000003",
    );
    expect(markup).toContain("Sign in to view task history");
    expect(markup).not.toContain("View not found");
    expect(markup).not.toContain("Edit task");
  });

  it("renders the loading state while authentication is unresolved", () => {
    const { markup } = renderRoute("/app", "loading");

    expect(markup).toContain("Loading workspace");
    expect(markup).toContain('role="status"');
  });

  it("renders a useful response for an unknown route", () => {
    const { markup, router } = renderRoute("/not-a-real-route");

    expect(router.state.location.pathname).toBe("/not-a-real-route");
    expect(markup).toContain("View not found");
    expect(markup).toContain("Return home");
  });
});
