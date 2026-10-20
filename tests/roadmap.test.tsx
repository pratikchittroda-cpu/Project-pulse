// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoadmapWorkspace } from "../apps/web/src/features/roadmap/roadmap-workspace.js";
import type { RoadmapRepository } from "../apps/web/src/features/roadmap/roadmap-repository.js";
import type {
  TaskRecord,
  TaskRepository,
} from "../apps/web/src/features/tasks/task-repository.js";
import { roadmapFixture } from "./roadmap-fixtures.js";
import { taskDetailFixture } from "./task-fixtures.js";

afterEach(cleanup);

function setup(canWrite = true, archivedProject = false) {
  const detail = taskDetailFixture();
  const data = roadmapFixture();
  const completed: TaskRecord = {
    ...detail.task,
    id: "task-completed",
    key: "SHIP-1",
    number: "1",
    title: "Completed task",
    status: "completed",
    estimate: 3,
    epicId: "epic-1",
    milestoneId: "milestone-1",
  };
  const canceled: TaskRecord = {
    ...detail.task,
    id: "task-canceled",
    key: "SHIP-2",
    number: "2",
    title: "Canceled task",
    status: "canceled",
    estimate: 8,
    epicId: "epic-1",
    milestoneId: "milestone-1",
  };
  const unestimated: TaskRecord = {
    ...detail.task,
    id: "task-unestimated",
    key: "SHIP-3",
    number: "3",
    title: "Unestimated task",
    status: "in_progress",
    estimate: null,
    epicId: null,
    milestoneId: null,
  };
  let tasks = [completed, canceled, unestimated];
  const roadmapStore: RoadmapRepository = {
    list: vi.fn(async () => data),
    createInitiative: vi.fn(async (_scope, draft) => ({
      ...data.initiatives[0],
      ...draft,
      id: "initiative-2",
    })),
    editInitiative: vi.fn(async (_scope, item, draft) => ({
      ...item,
      ...draft,
    })),
    createEpic: vi.fn(async (_scope, draft) => ({
      ...data.epics[0],
      ...draft,
      id: "epic-2",
    })),
    editEpic: vi.fn(async (_scope, item, draft) => ({ ...item, ...draft })),
    createMilestone: vi.fn(async (_scope, draft) => ({
      ...data.milestones[0],
      ...draft,
      id: "milestone-2",
    })),
    editMilestone: vi.fn(async (_scope, item, draft) => ({
      ...item,
      ...draft,
    })),
  };
  const taskStore: TaskRepository = {
    get: vi.fn(async () => null),
    cycleName: vi.fn(async () => null),
    list: vi.fn(async () => tasks),
    options: vi.fn(async () => ({
      ...detail.options,
      canWrite,
      statuses: [
        { status: "backlog", label: "Backlog", isTerminal: false },
        { status: "in_progress", label: "In progress", isTerminal: false },
        { status: "completed", label: "Completed", isTerminal: true },
        { status: "canceled", label: "Canceled", isTerminal: true },
      ],
    })),
    save: vi.fn(async () => completed),
    setArchived: vi.fn(async () => completed),
    updatePlanning: vi.fn(async (_scope, task, patch) => {
      const saved = {
        ...task,
        ...patch,
        updatedAt: "2026-10-20T13:00:00.000Z",
      };
      tasks = tasks.map((item) => (item.id === task.id ? saved : item));
      return saved;
    }),
  };
  const view = () => (
    <MemoryRouter>
      <RoadmapWorkspace
        archivedProject={archivedProject}
        canAdministerOrganization={canWrite}
        roadmapStore={roadmapStore}
        scope={detail.scope}
        taskStore={taskStore}
      />
    </MemoryRouter>
  );
  return { roadmapStore, taskStore, view, task: unestimated };
}

describe("roadmap workspace", () => {
  it("explains progress from completed, canceled, and unestimated tasks", async () => {
    const { view } = setup();
    render(view());
    await screen.findByRole("region", { name: "Initiatives and epics" });
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("1/2 active tasks")).toBeTruthy();
    expect(
      screen.getAllByText("1/1 active tasks · 3 pts of 3 pts").length,
    ).toBe(3);
    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "SHIP-1" })).toHaveLength(2);
    expect(screen.queryByText("8 pts")).toBeNull();
  });

  it("links an active task to an epic and milestone", async () => {
    const { view, taskStore, task } = setup();
    render(view());
    const taskForm = await screen.findByRole("form", {
      name: `Link ${task.key}`,
    });
    fireEvent.change(within(taskForm).getByLabelText(`Epic for ${task.key}`), {
      target: { value: "epic-1" },
    });
    fireEvent.change(
      within(taskForm).getByLabelText(`Milestone for ${task.key}`),
      {
        target: { value: "milestone-1" },
      },
    );
    fireEvent.click(
      within(taskForm).getByRole("button", { name: "Save links" }),
    );
    await screen.findByText(`${task.key} hierarchy updated.`);
    expect(taskStore.updatePlanning).toHaveBeenCalledWith(
      taskStore.updatePlanning.mock.calls[0]?.[0],
      task,
      {
        cycleId: task.cycleId,
        estimate: task.estimate,
        epicId: "epic-1",
        milestoneId: "milestone-1",
      },
    );
  });

  it.each([
    ["viewer", false, false],
    ["archived", true, false],
  ])("keeps %s roadmaps read-only", async (_label, archived, canWrite) => {
    const { view, taskStore, roadmapStore } = setup(canWrite, archived);
    render(view());
    await screen.findByText(/roadmap is read-only|read-only access/);
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
    expect(
      (
        screen.getAllByRole("button", {
          name: "Save links",
        })[0] as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(taskStore.updatePlanning).not.toHaveBeenCalled();
    expect(roadmapStore.createEpic).not.toHaveBeenCalled();
  });

  it("filters milestones by overdue status", async () => {
    const { view } = setup();
    render(view());
    await screen.findByRole("region", { name: "Milestones" });
    fireEvent.change(screen.getByLabelText("Roadmap status filter"), {
      target: { value: "overdue" },
    });
    expect(screen.getByRole("heading", { name: "Beta release" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Roadmap status filter"), {
      target: { value: "completed" },
    });
    expect(
      screen.getByText("No milestones match the current filters."),
    ).toBeTruthy();
  });
});
