import { describe, expect, it, vi } from "vitest";

import {
  createTaskRelationRepository,
  validateTaskDependencyDraft,
} from "../apps/web/src/features/tasks/task-relations-repository.js";
import { taskDetailFixture } from "./task-fixtures.js";

describe("task dependency validation", () => {
  it("requires two distinct tasks, an explanation, and valid dates", () => {
    expect(
      validateTaskDependencyDraft({
        blockerTaskId: "task-a",
        blockedTaskId: "task-b",
        explanation: "  Waiting for review  ",
        targetDate: "2026-11-01",
      }),
    ).toEqual({
      blocker_task_id: "task-a",
      blocked_task_id: "task-b",
      blocker_explanation: "Waiting for review",
      blocker_target_date: "2026-11-01",
    });
    expect(() =>
      validateTaskDependencyDraft({
        blockerTaskId: "task-a",
        blockedTaskId: "task-a",
        explanation: "Self",
        targetDate: "",
      }),
    ).toThrow(/itself/);
    expect(() =>
      validateTaskDependencyDraft({
        blockerTaskId: "task-a",
        blockedTaskId: "task-b",
        explanation: "",
        targetDate: "",
      }),
    ).toThrow(/explanation/);
    expect(() =>
      validateTaskDependencyDraft({
        blockerTaskId: "task-a",
        blockedTaskId: "task-b",
        explanation: "Waiting",
        targetDate: "2026-02-30",
      }),
    ).toThrow(/target date/);
  });
});

describe("task dependency repository", () => {
  it("reuses a request ID after an uncertain create response", async () => {
    const row = {
      id: "relation-1",
      organization_id: "organization-1",
      project_id: "project-1",
      task_id: "task-a",
      related_task_id: "task-b",
      relation_type: "blocks" as const,
      blocker_explanation: "Waiting",
      blocker_target_date: null,
      created_at: "2026-10-20T00:00:00.000Z",
    };
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Connection interrupted" },
      })
      .mockResolvedValueOnce({ data: row, error: null });
    const rpc = vi.fn(() => ({ select: () => ({ single }) }));
    const fixture = taskDetailFixture();
    const taskStore = {
      list: vi.fn(async () => [
        { ...fixture.task, id: "task-a", key: "SHIP-1" },
        { ...fixture.task, id: "task-b", key: "SHIP-2" },
      ]),
    } as never;
    const repository = createTaskRelationRepository(
      { rpc } as never,
      taskStore,
    );
    const draft = {
      blockerTaskId: "task-a",
      blockedTaskId: "task-b",
      explanation: "Waiting",
      targetDate: "",
    };
    await expect(repository.create(fixture.scope, draft)).rejects.toThrow(
      "Connection interrupted",
    );
    expect((await repository.create(fixture.scope, draft)).id).toBe(
      "relation-1",
    );
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
});
