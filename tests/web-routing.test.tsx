import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouterProvider } from "react-router-dom";

import { createTestRouter } from "../apps/web/src/app/router.js";

function renderRoute(path: string, initialAuthStatus?: "loading") {
  const router = createTestRouter([path], { initialAuthStatus });
  const markup = renderToStaticMarkup(
    createElement(RouterProvider, { router }),
  );

  return { markup, router };
}

describe("web route groups", () => {
  it("renders the public landing route", () => {
    const { markup } = renderRoute("/");

    expect(markup).toContain("Make delivery feel visible.");
    expect(markup).toContain("Open the workspace");
  });

  it("renders the authentication route separately from the app shell", () => {
    const { markup } = renderRoute("/auth/login");

    expect(markup).toContain("Sign in to ProjectPulse");
    expect(markup).toContain("Send magic link");
    expect(markup).toContain("Continue with GitHub");
    expect(markup).not.toContain("Engineering control plane");
  });

  it("renders the protected project workspace with navigation", () => {
    const { markup } = renderRoute("/app");

    expect(markup).toContain("Good morning, team.");
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
    expect(markup).toContain("Create a project");
    expect(markup).toContain("Select an organization first");
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
