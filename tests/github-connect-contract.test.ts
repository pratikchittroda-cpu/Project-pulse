import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(
  "supabase/functions/github-connect/index.ts",
  "utf8",
);

describe("GitHub automatic connection contract", () => {
  it("authenticates the ReleaseArc caller and enforces project write access", () => {
    expect(functionSource).toContain("admin.auth.getUser(accessToken)");
    expect(functionSource).toContain('"can_write_project"');
    expect(functionSource).toContain('from("projects")');
    expect(functionSource.indexOf("admin.auth.getUser")).toBeLessThan(
      functionSource.indexOf('from("projects")'),
    );
  });

  it("creates or repairs the webhook through GitHub without exposing the secret", () => {
    expect(functionSource).toContain("api.github.com");
    expect(functionSource).toContain("/hooks?per_page=100");
    expect(functionSource).toContain('method: "PATCH"');
    expect(functionSource).toContain('method: "POST"');
    expect(functionSource).toContain("GITHUB_WEBHOOK_SECRET");
    expect(functionSource).not.toContain("console.log");
    expect(functionSource).not.toContain("console.error");
    expect(functionSource).not.toContain(
      "github_access_token: githubAccessToken",
    );
  });

  it("keeps the supported event set and rejects non-GitHub repository URLs", () => {
    for (const eventName of [
      "pull_request",
      "pull_request_review",
      "push",
      "check_run",
      "deployment_status",
      "release",
    ]) {
      expect(functionSource).toContain(`"${eventName}"`);
    }
    expect(functionSource).toContain('parsed.protocol !== "https:"');
    expect(functionSource).toContain(
      'parsed.hostname.toLowerCase() !== "github.com"',
    );
  });
});
