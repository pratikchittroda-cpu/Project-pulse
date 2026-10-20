import { describe, expect, it, vi } from "vitest";

import {
  TaskValidationError,
  emptyTaskDraft,
  taskPayload,
  createTaskRepository,
} from "../apps/web/src/features/tasks/task-repository.js";

describe("task repository validation", () => {
  it("normalizes labels and nullable task fields for persistence", () => {
    const payload = taskPayload({
      ...emptyTaskDraft,
      description: "  Ship the task flow  ",
      dueDate: "2026-12-31",
      estimate: "3.50",
      labels: "planning, security, planning",
      title: "  Build tasks  ",
    });

    expect(payload).toEqual({
      assignee_id: null,
      description: "Ship the task flow",
      due_date: "2026-12-31",
      estimate: 3.5,
      labels: ["planning", "security"],
      priority: "medium",
      status: "backlog",
      title: "Build tasks",
    });
  });

  it("returns field-level errors for unsafe task input", () => {
    expect(() =>
      taskPayload({
        ...emptyTaskDraft,
        dueDate: "2026-02-30",
        estimate: "-1",
        labels: Array.from({ length: 21 }, (_, index) => `label-${index}`).join(
          ",",
        ),
        status: "not configured",
        title: "",
      }),
    ).toThrow(TaskValidationError);

    try {
      taskPayload({
        ...emptyTaskDraft,
        dueDate: "2026-02-30",
        estimate: "-1",
        labels: Array.from({ length: 21 }, (_, index) => `label-${index}`).join(
          ",",
        ),
        status: "not configured",
        title: "",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(TaskValidationError);
      expect(Object.keys((error as TaskValidationError).fields)).toEqual(
        expect.arrayContaining([
          "title",
          "status",
          "labels",
          "estimate",
          "dueDate",
        ]),
      );
    }
  });
});

describe("atomic task mutations", () => {
  it("retains the request ID after an uncertain failure and reads the confirmed task", async () => {
    const row = {
      id: "task-1",
      number: "9007199254740993",
      title: "Ship",
      description: null,
      status: "backlog",
      priority: "medium",
      assignee_id: null,
      labels: [],
      estimate: null,
      due_date: null,
      cycle_id: null,
      epic_id: null,
      milestone_id: null,
      archived_at: null,
      updated_at: "2026-10-20T00:00:00.000Z",
    };
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Network disconnected" },
      })
      .mockResolvedValueOnce({ data: row, error: null });
    const rpc = vi.fn(() => ({ select: () => ({ single }) }));
    const client = { rpc } as unknown as Parameters<
      typeof createTaskRepository
    >[0];
    const repository = createTaskRepository(client);
    const scope = {
      organizationId: "org",
      projectId: "project",
      projectKey: "SHIP",
      userId: "user",
    };
    await expect(
      repository.save(scope, { ...emptyTaskDraft, title: "Ship" }),
    ).rejects.toThrow("Network disconnected");
    const task = await repository.save(scope, {
      ...emptyTaskDraft,
      title: "Ship",
    });
    expect(task.key).toBe("SHIP-9007199254740993");
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0]?.[0]).toBe("mutate_task");
  });
});
