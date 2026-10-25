// @vitest-environment jsdom

import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../apps/web/src/app/auth-client.js", () => ({
  supabase: { rpc },
  supabaseAuthConfig: {
    anonKey: "test-anon-key",
    isConfigured: true,
    url: "https://example.supabase.co",
  },
}));

import { AuthProvider } from "../apps/web/src/app/auth-context.js";
import {
  OrganizationProvider,
  useOrganization,
} from "../apps/web/src/app/organization-context.js";
import { deferred } from "./task-fixtures.js";

const session = {
  user: { id: "user-1" },
} as unknown as Session;

function OrganizationProbe() {
  const { organizations, refreshOrganizations, selectedOrganizationId } =
    useOrganization();

  return (
    <div>
      <span data-testid="organizations">
        {organizations.map(({ name }) => name).join(",")}
      </span>
      <span data-testid="selected-organization">{selectedOrganizationId}</span>
      <button onClick={() => void refreshOrganizations()} type="button">
        Refresh organizations
      </button>
    </div>
  );
}

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  cleanup();
  rpc.mockReset();
  window.localStorage.clear();
});

describe("workspace context refreshes", () => {
  it("does not let a stale organization response erase a newer organization", async () => {
    const initialRequest = deferred<{ data: unknown; error: null }>();
    const latestRequest = deferred<{ data: unknown; error: null }>();
    rpc
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(latestRequest.promise);

    render(
      <AuthProvider initialSession={session} initialStatus="authenticated">
        <OrganizationProvider>
          <OrganizationProbe />
        </OrganizationProvider>
      </AuthProvider>,
    );

    await waitFor(() => expect(rpc).toHaveBeenCalledOnce());
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh organizations" }),
    );
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));

    await act(async () =>
      latestRequest.resolve({
        data: {
          organizations: [
            {
              id: "org-1",
              name: "New organization",
              role: "owner",
              slug: "new-organization",
            },
          ],
          projects: [],
          selected_organization_id: "org-1",
          selected_project_id: null,
        },
        error: null,
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("organizations").textContent).toBe(
        "New organization",
      ),
    );

    await act(async () => {
      initialRequest.resolve({
        data: {
          organizations: [],
          projects: [],
          selected_organization_id: null,
          selected_project_id: null,
        },
        error: null,
      });
    });

    expect(screen.getByTestId("organizations").textContent).toBe(
      "New organization",
    );
    expect(screen.getByTestId("selected-organization").textContent).toBe(
      "org-1",
    );
  });
});
