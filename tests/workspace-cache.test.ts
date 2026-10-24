// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  readDashboardSnapshot,
  readOrganizations,
  readProjects,
  readStoredWorkspaceSelection,
  storeSelectedOrganization,
  storeSelectedProject,
  writeDashboardSnapshot,
  writeOrganizations,
  writeProjects,
} from "../apps/web/src/app/workspace-cache.js";

describe("workspace cache", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });

  it("restores organization and project context without waiting for revalidation", () => {
    writeOrganizations("user-1", [
      { id: "org-1", name: "Pulse", role: "owner", slug: "pulse" },
    ]);
    writeProjects("user-1", "org-1", [
      { id: "project-1", key: "PULSE", name: "ProjectPulse" },
    ]);
    storeSelectedOrganization("org-1");
    storeSelectedProject("project-1");

    expect(readOrganizations("user-1")).toHaveLength(1);
    expect(readProjects("user-1", "org-1")[0]?.key).toBe("PULSE");
    expect(readStoredWorkspaceSelection()).toEqual({
      organizationId: "org-1",
      projectId: "project-1",
    });
  });

  it("normalizes the snake-case bootstrap dashboard payload", () => {
    writeDashboardSnapshot("user-1", "org-1", "project-1", {
      active_task_count: 3,
      completed_task_count: 2,
      events: [
        {
          event_type: "task.status_changed",
          occurred_at: "2026-10-24T00:00:00.000Z",
          task_id: "task-1",
        },
      ],
      in_review_task_count: 1,
      tasks: [
        {
          id: "task-1",
          status: "in_progress",
          task_number: 7,
          title: "Ship the dashboard",
        },
      ],
      total_task_count: 5,
    });

    expect(readDashboardSnapshot("user-1", "org-1", "project-1")).toEqual({
      activeTaskCount: 3,
      completedTaskCount: 2,
      events: [
        {
          eventType: "task.status_changed",
          occurredAt: "2026-10-24T00:00:00.000Z",
          taskId: "task-1",
        },
      ],
      inReviewTaskCount: 1,
      tasks: [
        {
          id: "task-1",
          status: "in_progress",
          taskNumber: 7,
          title: "Ship the dashboard",
        },
      ],
      totalTaskCount: 5,
    });
  });
});
