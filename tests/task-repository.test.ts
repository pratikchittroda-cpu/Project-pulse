import { describe, expect, it } from "vitest";

import {
  TaskValidationError,
  emptyTaskDraft,
  taskPayload,
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
