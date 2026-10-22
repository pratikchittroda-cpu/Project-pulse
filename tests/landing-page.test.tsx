// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LandingPage } from "../apps/web/src/pages/landing-page.js";

describe("public landing page", () => {
  it("switches the signal lens readout when a different lens is selected", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    const panel = screen.getByRole("tabpanel");

    expect(panel.textContent).toContain("Work in motion");
    expect(panel.textContent).toContain("STEADY / IN MOTION");

    fireEvent.click(screen.getByRole("tab", { name: "Release" }));

    expect(panel.textContent).toContain("Delivery health");
    expect(panel.textContent).toContain("READY / LOW RISK");
  });
});
