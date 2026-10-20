// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildKanbanColumns,
  filterKanbanTasks,
  KanbanBoard,
} from "../apps/web/src/features/board/kanban-board.js";
import type {
  TaskOptions,
  TaskRecord,
  TaskRepository,
} from "../apps/web/src/features/tasks/task-repository.js";
import { deferred, taskDetailFixture } from "./task-fixtures.js";

afterEach(cleanup);

const detail = taskDetailFixture();
const scope = detail.scope;
const statuses: TaskOptions["statuses"] = [
  { isTerminal: false, label: "Backlog", status: "backlog" },
  { isTerminal: false, label: "In progress", status: "in_progress" },
  { isTerminal: true, label: "Completed", status: "completed" },
];

function boardTasks(): TaskRecord[] {
  return [
    detail.task,
    {
      ...detail.task,
      id: "task-2",
      key: "SHIP-43",
      number: "43",
      title: "Review delivery signal",
      status: "in_progress",
      priority: "urgent",
      assigneeId: "user-2",
      labels: ["signals"],
    },
    {
      ...detail.task,
      id: "task-3",
      key: "SHIP-44",
      number: "44",
      title: "Completed work",
      status: "completed",
      archivedAt: "2026-10-20T12:00:00.000Z",
    },
  ];
}

function createRepository(
  tasks = boardTasks(),
  overrides: Partial<TaskRepository> = {},
): TaskRepository {
  return {
    get: vi.fn(async () => null),
    cycleName: vi.fn(async () => null),
    list: vi.fn(async () => tasks),
    options: vi.fn(async () => ({
      assignees: [{ id: "user-1" }, { id: "user-2" }],
      canWrite: true,
      statuses,
    })),
    save: vi.fn(async (_scope, draft, previous) => ({
      ...(previous ?? tasks[0]),
      status: draft.status,
      updatedAt: "2026-10-20T13:00:00.000Z",
    })),
    setArchived: vi.fn(async (_scope, task) => task),
    updatePlanning: vi.fn(async (_scope, task, patch) => ({
      ...task,
      ...patch,
    })),
    ...overrides,
  };
}

function renderBoard(repository: TaskRepository = createRepository()) {
  return render(
    <MemoryRouter>
      <KanbanBoard repository={repository} scope={scope} />
    </MemoryRouter>,
  );
}

describe("kanban board models", () => {
  it("keeps configured workflow order and preserves unknown statuses", () => {
    const tasks = boardTasks();
    const columns = buildKanbanColumns(
      [...tasks, { ...tasks[0], id: "task-unknown", status: "custom_status" }],
      statuses,
    );

    expect(columns.map(({ status }) => status)).toEqual([
      "backlog",
      "in_progress",
      "completed",
      "custom_status",
    ]);
    expect(
      columns.find(({ status }) => status === "backlog")?.tasks,
    ).toHaveLength(1);
    expect(
      columns.find(({ status }) => status === "custom_status")?.label,
    ).toBe("Custom Status");
  });

  it("filters by query, priority, assignee, and task metadata", () => {
    const tasks = boardTasks();

    expect(
      filterKanbanTasks(tasks, {
        query: "signal",
        priority: "all",
        assigneeId: "all",
      }),
    ).toHaveLength(1);
    expect(
      filterKanbanTasks(tasks, {
        query: "",
        priority: "urgent",
        assigneeId: "all",
      }),
    ).toHaveLength(1);
    expect(
      filterKanbanTasks(tasks, {
        query: "",
        priority: "all",
        assigneeId: "user-1",
      }),
    ).toHaveLength(2);
  });
});

describe("kanban board interaction", () => {
  it("renders cards in status columns with compact and expanded content", async () => {
    renderBoard();

    const backlog = await screen.findByRole("list", { name: "Backlog tasks" });
    expect(within(backlog).getByText("SHIP-42")).toBeTruthy();
    expect(within(backlog).getByText("Ship task history")).toBeTruthy();
    expect(within(backlog).getByText("More details")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "In progress tasks" }),
    ).toBeTruthy();
    expect(screen.getByRole("list", { name: "Completed tasks" })).toBeTruthy();
    expect(screen.getAllByText(/WIP/).length).toBe(3);
  });

  it("moves a task optimistically through the keyboard control and commits the server response", async () => {
    const pending = deferred<TaskRecord>();
    const repository = createRepository([], {
      list: vi.fn(async () => [boardTasks()[0]]),
      save: vi.fn(() => pending.promise),
    });
    renderBoard(repository);

    const move = await screen.findByRole("combobox", { name: "Move SHIP-42" });
    const inProgress = screen.getByRole("list", { name: "In progress tasks" });
    fireEvent.change(move, { target: { value: "in_progress" } });
    await waitFor(() =>
      expect(within(inProgress).getByText("SHIP-42")).toBeTruthy(),
    );
    expect(repository.save).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ status: "in_progress" }),
      expect.objectContaining({ id: "task-1", status: "backlog" }),
    );
    pending.resolve({
      ...boardTasks()[0],
      status: "in_progress",
      updatedAt: "2026-10-20T13:00:00.000Z",
    });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("combobox", {
            name: "Move SHIP-42",
          }) as HTMLSelectElement
        ).value,
      ).toBe("in_progress"),
    );
  });

  it("rolls a failed move back to the original column and explains the failure", async () => {
    const repository = createRepository([], {
      list: vi.fn(async () => [boardTasks()[0]]),
      save: vi.fn(async () => {
        throw new Error("Task changed. Reload before saving again.");
      }),
    });
    renderBoard(repository);

    const move = await screen.findByRole("combobox", { name: "Move SHIP-42" });
    const backlog = screen.getByRole("list", { name: "Backlog tasks" });
    const inProgress = screen.getByRole("list", { name: "In progress tasks" });
    fireEvent.change(move, { target: { value: "in_progress" } });
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(within(backlog).getByText("SHIP-42")).toBeTruthy(),
    );
    expect(within(inProgress).queryByText("SHIP-42")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Task changed");
  });

  it("supports native drag/drop and keeps a viewer board read-only", async () => {
    const repository = createRepository([], {
      list: vi.fn(async () => [boardTasks()[0]]),
      options: vi.fn(async () => ({ assignees: [], canWrite: true, statuses })),
    });
    renderBoard(repository);
    const card = await screen.findByRole("listitem");
    const target = screen.getByRole("list", {
      name: "In progress tasks",
    }).parentElement;
    const dataTransfer = {
      effectAllowed: "none",
      getData: vi.fn(() => "task-1"),
      setData: vi.fn(),
    };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "task-1");
    expect(repository.save).toHaveBeenCalled();

    cleanup();
    const viewerRepository = createRepository([], {
      list: vi.fn(async () => [boardTasks()[0]]),
      options: vi.fn(async () => ({
        assignees: [],
        canWrite: false,
        statuses,
      })),
    });
    renderBoard(viewerRepository);
    const viewerMove = await screen.findByRole("combobox", {
      name: "Move SHIP-42",
    });
    expect((viewerMove as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole("listitem").getAttribute("draggable")).toBe(
      "false",
    );
    expect(
      screen.getByText("You have read-only access to this board."),
    ).toBeTruthy();
  });

  it("filters the board without changing task data", async () => {
    const repository = createRepository();
    renderBoard(repository);
    await screen.findByRole("list", { name: "Backlog tasks" });
    fireEvent.change(screen.getByLabelText("Find tasks"), {
      target: { value: "signal" },
    });
    expect(screen.getByText("Review delivery signal")).toBeTruthy();
    expect(screen.queryByText("Ship task history")).toBeNull();
    expect(repository.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Ship task history")).toBeTruthy();
  });
});
