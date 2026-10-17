// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthProvider, useAuth } from "../apps/web/src/app/auth-context.js";
import { supabaseAuthConfig } from "../apps/web/src/app/auth-client.js";

function AuthProbe() {
  const { session, signOut, status } = useAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="session">{session ? "session" : "no-session"}</span>
      <button onClick={() => void signOut()} type="button">
        Sign out
      </button>
    </div>
  );
}

describe("authentication flow boundaries", () => {
  afterEach(() => cleanup());

  it("clears the local session state on sign-out", async () => {
    render(
      <AuthProvider initialStatus="authenticated">
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByTestId("status").textContent).toBe("signed_out");
    expect(screen.getByTestId("session").textContent).toBe("no-session");
  });

  it("uses loading state before a persisted session is resolved", () => {
    render(
      <AuthProvider initialStatus="loading">
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status").textContent).toBe("loading");
  });

  it("does not treat placeholder browser credentials as configured auth", () => {
    expect(supabaseAuthConfig.isConfigured).toBe(false);
    expect(supabaseAuthConfig.anonKey).not.toContain("sb_secret_");
  });
});
