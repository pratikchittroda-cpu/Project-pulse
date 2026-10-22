// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BacklogWorkspace } from "../apps/web/src/features/planning/backlog-workspace.js";
import type {
  CycleRecord,
  CycleRepository,
} from "../apps/web/src/features/planning/cycle-repository.js";
import type {
  TaskRecord,
  TaskRepository,
  TaskScope,
} from "../apps/web/src/features/tasks/task-repository.js";
import { deferred, taskDetailFixture } from "./task-fixtures.js";
import { cycleFixture } from "./planning-fixtures.js";

afterEach(cleanup);
const detail = taskDetailFixture();
const task: TaskRecord = { ...detail.task, cycleId: null, estimate: null };

function setup(
  cycles: CycleRecord[] = [cycleFixture()],
  tasks: TaskRecord[] = [task],
  canWrite = true,
) {
  const cycleStore = {
    list: vi.fn(async () => cycles),
    create: vi.fn<CycleRepository["create"]>(async (_scope, draft) => {
      const created = cycleFixture({ id: "cycle-2", name: draft.name });
      cycles = [...cycles, created];
      return created;
    }),
    edit: vi.fn<CycleRepository["edit"]>(async (_scope, current, draft) => {
      const saved = { ...current, name: draft.name };
      cycles = cycles.map((item) => (item.id === saved.id ? saved : item));
      return saved;
    }),
    manage: vi.fn<CycleRepository["manage"]>(
      async (_scope, action, current) => {
        const saved = {
          ...current,
          status: (
            {
              start: "active",
              pause: "paused",
              complete: "completed",
              cancel: "canceled",
            } as const
          )[action],
          startedAt: "2026-10-20T12:00:00.000Z",
        };
        cycles = cycles.map((item) => (item.id === saved.id ? saved : item));
        return saved;
      },
    ),
  };
  const taskStore = {
    get: vi.fn(async () => null),
    cycleName: vi.fn(async () => null),
    list: vi.fn(async () => tasks),
    options: vi.fn(async () => ({ ...detail.options, canWrite })),
    save: vi.fn(async () => task),
    setArchived: vi.fn(async () => task),
    updatePlanning: vi.fn<TaskRepository["updatePlanning"]>(
      async (_scope, current, patch) => {
        const saved = {
          ...current,
          ...patch,
          updatedAt: "2026-10-20T13:00:00.000Z",
        };
        tasks = tasks.map((item) => (item.id === saved.id ? saved : item));
        return saved;
      },
    ),
  };
  const view = (scope: TaskScope = detail.scope, archivedProject = false) => (
    <MemoryRouter>
      <BacklogWorkspace
        scope={scope}
        cycleStore={cycleStore}
        taskStore={taskStore}
        archivedProject={archivedProject}
      />
    </MemoryRouter>
  );
  return { cycleStore, taskStore, view };
}

describe("backlog and sprint planning", () => {
  it("loads, creates and edits sprints, and reads the saved values back", async () => {
    const { view, cycleStore } = setup();
    render(view());
    expect(screen.getByText("Loading backlog and sprints…")).toBeTruthy();
    await screen.findByRole("region", { name: "Sprint 14" });
    fireEvent.change(screen.getByLabelText("Sprint name"), {
      target: { value: "Sprint 15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create sprint" }));
    await screen.findByText("Sprint created.");
    expect(cycleStore.create).toHaveBeenCalledWith(detail.scope, {
      name: "Sprint 15",
      startsAt: "",
      endsAt: "",
    });
    const created = screen.getByRole("region", { name: "Sprint 15" });
    fireEvent.click(
      within(created).getByRole("button", { name: "Edit sprint" }),
    );
    fireEvent.change(screen.getByLabelText("Sprint name"), {
      target: { value: "Renamed sprint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save sprint" }));
    await screen.findByRole("region", { name: "Renamed sprint" });
    expect(cycleStore.list).toHaveBeenCalledTimes(3);
  });

  it("supports start, pause, resume, and completion and disables conflicting starts", async () => {
    const { view, cycleStore } = setup([
      cycleFixture(),
      cycleFixture({ id: "cycle-2", name: "Sprint 15" }),
    ]);
    render(view());
    const region = () =>
      within(screen.getByRole("region", { name: "Sprint 14" }));
    await screen.findByRole("region", { name: "Sprint 14" });
    fireEvent.click(region().getByRole("button", { name: "Start" }));
    await screen.findByText("Sprint 14 started.");
    expect(
      (
        within(screen.getByRole("region", { name: "Sprint 15" })).getByRole(
          "button",
          { name: "Start" },
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(region().getByRole("button", { name: "Pause" }));
    await screen.findByText("Sprint 14 paused.");
    fireEvent.click(region().getByRole("button", { name: "Resume" }));
    await screen.findByText("Sprint 14 resumed.");
    fireEvent.click(region().getByRole("button", { name: "Complete" }));
    await screen.findByText("Sprint 14 completed.");
    expect(cycleStore.manage.mock.calls.map((call) => call[1])).toEqual([
      "start",
      "pause",
      "start",
      "complete",
    ]);
    expect(region().queryByRole("button", { name: "Edit sprint" })).toBeNull();
  });

  it("assigns and removes backlog work with estimates and filters planned work", async () => {
    const { view, taskStore } = setup();
    render(view());
    await screen.findByRole("form", { name: `Plan ${task.key}` });
    expect(
      screen.getByRole("link", { name: task.title }).getAttribute("href"),
    ).toBe(
      `/app/organizations/${detail.scope.organizationId}/projects/${detail.scope.projectId}/tasks/${task.id}`,
    );
    fireEvent.change(screen.getByLabelText(`Sprint for ${task.key}`), {
      target: { value: "cycle-1" },
    });
    fireEvent.change(screen.getByLabelText(`Estimate for ${task.key}`), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await screen.findByText(`${task.key} planning updated.`);
    expect(taskStore.updatePlanning).toHaveBeenCalledWith(detail.scope, task, {
      cycleId: "cycle-1",
      estimate: 5,
    });
    expect(
      within(screen.getByRole("region", { name: "Backlog tasks" })).queryByText(
        task.title,
      ),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Filter by sprint"), {
      target: { value: "cycle-1" },
    });
    expect(
      within(screen.getByRole("region", { name: "Planned work" })).getByText(
        task.title,
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(`Sprint for ${task.key}`), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("region", { name: "Backlog tasks" })).getByText(
          task.title,
        ),
      ).toBeTruthy(),
    );
  });

  it("preserves a failed draft, reports the error, and reloads after a stale write", async () => {
    const { view, taskStore } = setup();
    taskStore.updatePlanning.mockRejectedValueOnce(
      new Error("Task changed. Reload before saving again."),
    );
    render(view());
    await screen.findByRole("button", { name: "Save plan" });
    fireEvent.change(screen.getByLabelText(`Estimate for ${task.key}`), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await screen.findByRole("alert");
    expect(
      (screen.getByLabelText(`Estimate for ${task.key}`) as HTMLInputElement)
        .value,
    ).toBe("8");
    expect(taskStore.list).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reload planning" }));
    await waitFor(() =>
      expect(
        (screen.getByLabelText(`Estimate for ${task.key}`) as HTMLInputElement)
          .value,
      ).toBe(""),
    );
  });

  it("keeps historical snapshots fixed while carrying unfinished work to another sprint", async () => {
    const snapshot = {
      id: task.id,
      key: task.key,
      number: task.number,
      title: "Historical title",
      estimate: 5,
      status: "backlog",
      completed: false,
      terminal: false,
    };
    const closed = cycleFixture({
      status: "completed",
      startedAt: "2026-10-20T00:00:00Z",
      initialCommitment: 5,
      committedPoints: 5,
      taskCount: 1,
      carriedOverTaskCount: 1,
      carriedOverPoints: 5,
      initialTasks: [snapshot],
      completionTasks: [snapshot],
    });
    const { view, taskStore } = setup(
      [closed, cycleFixture({ id: "cycle-2", name: "Next sprint" })],
      [{ ...task, cycleId: closed.id, estimate: 5 }],
    );
    render(view());
    await screen.findByRole("region", { name: closed.name });
    const history = within(screen.getByRole("region", { name: closed.name }));
    expect(history.queryByRole("button", { name: "Edit sprint" })).toBeNull();
    fireEvent.click(history.getByText("Closed sprint history · 1 tasks"));
    fireEvent.change(
      screen.getByLabelText(`Carryover destination for ${task.key}`),
      { target: { value: "cycle-2" } },
    );
    fireEvent.click(history.getByRole("button", { name: "Carry over" }));
    await screen.findByText(`${task.key} carried over.`);
    expect(taskStore.updatePlanning).toHaveBeenCalledWith(
      detail.scope,
      expect.objectContaining({ cycleId: closed.id }),
      { cycleId: "cycle-2", estimate: 5 },
    );
    expect(screen.getAllByText(`${task.key} · Historical title`)).toHaveLength(
      2,
    );
    expect(
      screen.getByText(`${task.key} · Already moved or unavailable`),
    ).toBeTruthy();
  });

  it.each(["viewer", "archived"])(
    "makes %s planning read-only",
    async (mode) => {
      const { view, cycleStore, taskStore } = setup(
        undefined,
        undefined,
        mode !== "viewer",
      );
      render(view(detail.scope, mode === "archived"));
      await screen.findByText(
        /Planning is read-only|read-only access to planning/,
      );
      expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Create sprint" }),
      ).toBeNull();
      expect(
        (screen.getByRole("button", { name: "Save plan" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(cycleStore.manage).not.toHaveBeenCalled();
      expect(taskStore.updatePlanning).not.toHaveBeenCalled();
    },
  );

  it("handles empty, failed reads, retry, and loss of access without stale data", async () => {
    const { view, cycleStore, taskStore } = setup([], []);
    cycleStore.list.mockRejectedValueOnce(new Error("Planning unavailable"));
    render(view());
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Reload planning" }));
    await screen.findByText("No sprints yet. Create one to start planning.");
    cycleStore.list.mockResolvedValue([cycleFixture()]);
    taskStore.list.mockResolvedValue([task]);
    fireEvent.click(screen.getByRole("button", { name: "Reload planning" }));
    await screen.findByText(task.title);
    cycleStore.list.mockResolvedValue([]);
    taskStore.list.mockResolvedValue([]);
    taskStore.options.mockResolvedValue({
      ...detail.options,
      canWrite: false,
      statuses: [],
      assignees: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Reload planning" }));
    await screen.findByText("You have read-only access to planning.");
    expect(screen.queryByText(task.title)).toBeNull();
  });

  it("ignores reads and mutations that finish after switching projects", async () => {
    const { view, cycleStore, taskStore } = setup();
    const slow = deferred<CycleRecord[]>();
    cycleStore.list.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([]);
    const rendered = render(view());
    rendered.rerender(view({ ...detail.scope, projectId: "project-2" }));
    await screen.findByText("No sprints yet. Create one to start planning.");
    await act(async () => slow.resolve([cycleFixture()]));
    expect(screen.queryByRole("region", { name: "Sprint 14" })).toBeNull();
    const saving = deferred<TaskRecord>();
    taskStore.updatePlanning.mockReturnValueOnce(saving.promise);
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    rendered.rerender(view({ ...detail.scope, projectId: "project-3" }));
    await screen.findByRole("button", { name: "Save plan" });
    await act(async () => saving.resolve(task));
    expect(taskStore.list).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(`${task.key} planning updated.`)).toBeNull();
  });
});
