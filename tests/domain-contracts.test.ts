import { describe, expect, it } from "vitest";

import {
  isEventName,
  isIsoDateTime,
  parseEventEnvelope,
  toIsoDateTime,
  type ApiResponse,
  type ProviderEvent,
} from "@releasearc/domain";

const validEnvelope = {
  entityId: "task-42",
  entityType: "task",
  eventId: "event-1",
  eventType: "task.created",
  idempotencyKey: "task-42-created",
  occurredAt: "2026-10-17T12:00:00.000Z",
  organizationId: "org-1",
  payload: { taskNumber: 42 },
  projectId: "project-1",
  receivedAt: "2026-10-17T12:00:01.000Z",
  source: "internal",
};

describe("shared domain contracts", () => {
  it("accepts a normalized event envelope and preserves its payload", () => {
    const result = parseEventEnvelope<{ taskNumber: number }>(validEnvelope);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.payload.taskNumber).toBe(42);
      expect(result.value.eventType).toBe("task.created");
    }
  });

  it("returns typed field errors for malformed external input", () => {
    const result = parseEventEnvelope({
      ...validEnvelope,
      eventType: "TASK CREATED",
      occurredAt: "tomorrow",
      payload: undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_event_envelope");
      expect(result.error.issues.map((issue) => issue.field)).toEqual([
        "eventType",
        "occurredAt",
        "payload",
      ]);
    }
  });

  it("uses strict UTC ISO serialization for dates", () => {
    const serialized = toIsoDateTime("2026-10-17T12:00:00Z");

    expect(serialized).toBe("2026-10-17T12:00:00.000Z");
    expect(isIsoDateTime(serialized)).toBe(true);
    expect(isIsoDateTime("2026-10-17")).toBe(false);
    expect(() => toIsoDateTime("not-a-date")).toThrow(RangeError);
  });

  it("keeps provider payloads separate from domain events", () => {
    const providerEvent: ProviderEvent<{ action: string }> = {
      deliveryId: "delivery-1",
      payload: { action: "opened" },
      provider: "github",
      providerEventType: "pull_request",
    };
    const response: ApiResponse<ProviderEvent> = {
      data: providerEvent,
      ok: true,
    };

    expect(response.ok).toBe(true);
    expect(isEventName("github.pull_request.opened")).toBe(true);
    expect(isEventName("GitHub.PullRequest.Opened")).toBe(false);
  });
});
