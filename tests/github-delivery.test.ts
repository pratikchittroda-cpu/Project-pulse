import { describe, expect, it } from "vitest";

import {
  evaluateDeliveryRisks,
  normalizeGithubEvent,
  verifyGithubWebhookSignature,
} from "@releasearc/integrations";

const repository = {
  default_branch: "main",
  full_name: "acme/checkout",
  html_url: "https://github.com/acme/checkout",
};

describe("GitHub delivery integration", () => {
  it("normalizes pull requests and resolves task keys from the title and branch", () => {
    const events = normalizeGithubEvent(
      "pull_request",
      {
        action: "opened",
        pull_request: {
          body: "Closes RA-42",
          head: { ref: "feature/RA-42-checkout" },
          html_url: "https://github.com/acme/checkout/pull/18",
          number: 18,
          title: "Improve checkout handoff",
        },
        repository,
        sender: { login: "octocat" },
        updated_at: "2026-10-25T09:00:00.000Z",
      },
      "delivery-18",
    );

    expect(events).toEqual([
      expect.objectContaining({
        action: "opened",
        actorLogin: "octocat",
        externalId: "delivery-18:pull_request:18",
        kind: "pull_request",
        ref: "feature/RA-42-checkout",
        taskKeys: ["RA-42"],
      }),
    ]);
  });

  it("normalizes each pushed commit without leaking the payload", () => {
    const events = normalizeGithubEvent(
      "push",
      {
        commits: [
          { id: "abc123", message: "fix(RA-7): handle retry" },
          { id: "def456", message: "docs: update runbook" },
        ],
        ref: "refs/heads/feature/RA-7-retry",
        repository,
        sender: { login: "octocat" },
      },
      "delivery-push",
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(
      expect.objectContaining({
        externalId: "delivery-push:commit:abc123",
        kind: "commit",
        taskKeys: ["RA-7"],
      }),
    );
    expect(events[0]).not.toHaveProperty("payload");
  });

  it("verifies GitHub HMAC signatures and rejects malformed signatures", async () => {
    const payload = '{"action":"opened"}';
    const secret = "delivery-secret";
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"],
    );
    const digest = await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload),
    );
    const signature = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    await expect(
      verifyGithubWebhookSignature(payload, `sha256=${signature}`, secret),
    ).resolves.toBe(true);
    await expect(
      verifyGithubWebhookSignature(payload, "sha256=not-a-signature", secret),
    ).resolves.toBe(false);
  });

  it("prioritizes explainable task risks", () => {
    const risks = evaluateDeliveryRisks(
      [
        {
          assigneeId: null,
          id: "task-blocked",
          priority: "medium",
          status: "blocked",
          taskNumber: 3,
          title: "Resolve payment timeout",
          updatedAt: "2026-10-25T09:00:00.000Z",
        },
        {
          assigneeId: null,
          id: "task-unassigned",
          priority: "urgent",
          status: "in_progress",
          taskNumber: 4,
          title: "Rotate signing keys",
          updatedAt: "2026-10-25T09:00:00.000Z",
        },
        {
          assigneeId: "user-1",
          id: "task-review",
          priority: "high",
          status: "in_review",
          taskNumber: 5,
          title: "Ship checkout review",
          updatedAt: "2026-10-22T09:00:00.000Z",
        },
      ],
      new Date("2026-10-25T09:00:00.000Z"),
    );

    expect(risks.map(({ id }) => id)).toEqual([
      "blocked:task-blocked",
      "unassigned:task-unassigned",
      "stale-review:task-review",
    ]);
    expect(risks[0]?.nextMove).toContain("blocker");
    expect(risks[2]?.reason).toContain("48 hours");
  });
});
