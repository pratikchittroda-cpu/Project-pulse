// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../apps/web/src/app/auth-context.js";
import { PublicLayout } from "../apps/web/src/app/layouts.js";

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("authenticated public-root redirects", () => {
  it("redirects authenticated users from the public landing route", async () => {
    render(
      createElement(
        AuthProvider,
        { initialStatus: "authenticated" },
        createElement(
          MemoryRouter,
          { initialEntries: ["/"] },
          createElement(
            Routes,
            null,
            createElement(
              Route,
              { element: createElement(PublicLayout), path: "/" },
              createElement(Route, {
                element: createElement("div", null, "landing"),
                index: true,
              }),
            ),
            createElement(Route, {
              element: createElement("div", null, "dashboard"),
              path: "/app",
            }),
          ),
        ),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("dashboard")).toBeTruthy();
    });
  });
});
