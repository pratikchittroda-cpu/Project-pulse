import { toIsoDateTime } from "@projectpulse/domain";
import type { TaskDetail } from "../apps/web/src/features/tasks/task-detail-repository.js";
import type { TaskEventRecord } from "../apps/web/src/features/events/task-events-repository.js";

export function taskDetailFixture(): TaskDetail {
  return {
    scope: {
      organizationId: "organization-1",
      projectId: "project-1",
      projectKey: "SHIP",
      userId: "user-1",
    },
    projectName: "Delivery",
    projectArchived: false,
    cycleName: "Sprint 12",
    options: {
      canWrite: true,
      assignees: [{ id: "user-1" }],
      statuses: [
        { status: "backlog", label: "Backlog" },
        { status: "in_progress", label: "In progress" },
      ],
    },
    task: {
      id: "task-1",
      key: "SHIP-42",
      number: "42",
      title: "Ship task history",
      description: "Keep the complete change history.",
      status: "backlog",
      priority: "high",
      assigneeId: "user-1",
      cycleId: "cycle-1",
      estimate: 3.5,
      labels: ["planning"],
      dueDate: "2026-10-31",
      archivedAt: null,
      updatedAt: "2026-10-20T10:00:00.000Z",
    },
  };
}

export function taskEventFixture(
  overrides: Partial<TaskEventRecord> = {},
): TaskEventRecord {
  return {
    eventId: "event-1",
    entityId: "task-1",
    entityType: "task",
    organizationId: "organization-1",
    projectId: "project-1",
    eventType: "task.created",
    source: "internal",
    actorId: "user-1",
    idempotencyKey: "task-change:request-1",
    occurredAt: toIsoDateTime("2026-10-20T10:00:00.000Z"),
    receivedAt: toIsoDateTime("2026-10-20T10:00:00.000Z"),
    createdAt: "2026-10-20T10:00:00.000Z",
    payload: {
      version: 1,
      mode: "manual",
      changes: { title: { from: null, to: "Ship task history" } },
    },
    ...overrides,
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}
