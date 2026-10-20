import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  TaskEventValidationError,
  validateTaskEventDraft,
} from "../apps/web/src/features/events/task-events-repository.js";

const migration = readFileSync(
  "supabase/migrations/20261018010000_event_envelope_and_task_events.sql",
  "utf8",
);

const scope = {
  organizationId: "10000000-0000-0000-0000-000000000001",
  projectId: "20000000-0000-0000-0000-000000000001",
  taskId: "30000000-0000-0000-0000-000000000001",
};

describe("task event contract", () => {
  it("validates and normalizes a durable task event envelope", () => {
    const envelope = validateTaskEventDraft(scope, {
      correlationId: "run-42",
      eventType: "task.status_changed",
      idempotencyKey: "task-1-status-2",
      occurredAt: "2026-10-20T12:00:00.000Z",
      payload: { from: "backlog", to: "in_progress" },
      source: "internal",
    });

    expect(envelope.entityId).toBe(scope.taskId);
    expect(envelope.entityType).toBe("task");
    expect(envelope.projectId).toBe(scope.projectId);
    expect(envelope.correlationId).toBe("run-42");
  });

  it("rejects malformed event input before persistence", () => {
    expect(() =>
      validateTaskEventDraft(scope, {
        eventType: "TASK STATUS",
        idempotencyKey: "",
        payload: {},
        source: "github",
      }),
    ).toThrow(TaskEventValidationError);
  });

  it("declares idempotency, source, actor, and project-scoped ordering at the database boundary", () => {
    expect(migration).toContain(
      "task_events_organization_idempotency_key_unique",
    );
    expect(migration).toContain("task_events_task_occurred_idx");
    expect(migration).toContain(
      "create or replace function public.record_task_event",
    );
    expect(migration).toContain("task_events_validate_actor");
    expect(migration).toContain(
      "Authenticated clients cannot impersonate provider event sources",
    );
  });
});
