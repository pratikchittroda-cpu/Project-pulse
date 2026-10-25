import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(
  "supabase/functions/github-webhook/index.ts",
  "utf8",
);

describe("GitHub webhook function contract", () => {
  it("verifies signatures before resolving repositories or persisting events", () => {
    expect(functionSource).toContain("x-hub-signature-256");
    expect(functionSource).toContain("crypto.subtle.importKey");
    expect(functionSource).toContain("ingest_github_delivery");
    expect(functionSource.indexOf("verifySignature")).toBeLessThan(
      functionSource.indexOf('from("repositories")'),
    );
  });

  it("keeps the endpoint public for GitHub and never returns raw payloads", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).not.toContain("console.log(rawPayload");
    expect(functionSource).not.toContain("console.error(rawPayload");
    expect(functionSource).toContain("repository_not_registered");
  });

  it("normalizes the delivery events required by the first release", () => {
    for (const eventName of [
      "pull_request",
      "pull_request_review",
      "push",
      "check_run",
      "deployment_status",
      "release",
    ]) {
      expect(functionSource).toContain(`eventName === "${eventName}"`);
    }
  });
});
