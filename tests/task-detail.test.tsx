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
import { TaskDetailWorkspace } from "../apps/web/src/features/tasks/task-detail-workspace.js";
import {
  taskDetailPath,
  type TaskDetail,
  type TaskDetailAddress,
} from "../apps/web/src/features/tasks/task-detail-repository.js";
import { TasksWorkspace } from "../apps/web/src/features/tasks/tasks-workspace.js";
import {
  deferred,
  taskDetailFixture,
  taskEventFixture,
} from "./task-fixtures.js";

afterEach(cleanup);

function setup(detail = taskDetailFixture()) {
  const address = { ...detail.scope, taskId: detail.task.id };
  const repository = {
    load: vi.fn(async (): Promise<TaskDetail | null> => detail),
    save: vi.fn(async () => detail.task),
    setArchived: vi.fn(async () => detail.task),
  };
  const eventsRepository = {
    list: vi.fn(async () => [taskEventFixture()]),
    record: vi.fn(async () => taskEventFixture()),
  };
  const view = (nextAddress: TaskDetailAddress = address) => (
    <MemoryRouter>
      <TaskDetailWorkspace
        address={nextAddress}
        repository={repository}
        eventsRepository={eventsRepository}
      />
    </MemoryRouter>
  );
  return { detail, address, repository, eventsRepository, view };
}

describe("task detail flow", () => {
  it("links the task list to the tenant-scoped detail route", async () => {
    const detail = taskDetailFixture();
    const repository = {
      get: vi.fn(async () => detail.task),
      cycleName: vi.fn(async () => detail.cycleName),
      list: vi.fn(async () => [detail.task]),
      options: vi.fn(async () => detail.options),
      save: vi.fn(async () => detail.task),
      setArchived: vi.fn(async () => detail.task),
    };
    render(
      <MemoryRouter>
        <TasksWorkspace scope={detail.scope} repository={repository} />
      </MemoryRouter>,
    );
    const link = await screen.findByRole("link", { name: detail.task.title });
    expect(link.getAttribute("href")).toBe(
      taskDetailPath(detail.scope, detail.task.id),
    );
  });

  it("shows loading then the current metadata and history on one page", async () => {
    const { view, detail, eventsRepository } = setup();
    render(view());
    expect(screen.getByText("Loading task…")).toBeTruthy();
    expect(
      await screen.findByRole("heading", { name: detail.task.title }),
    ).toBeTruthy();
    const metadata = within(screen.getByLabelText("Task details"));
    for (const text of [
      "SHIP-42",
      "Backlog",
      "You",
      "Sprint 12",
      "3.5 points",
      "2026-10-31",
      "planning",
      detail.task.description!,
    ]) {
      expect(metadata.getByText(text)).toBeTruthy();
    }
    expect(
      within(screen.getByLabelText("Engineering links")).getAllByText(
        "Not linked yet",
      ),
    ).toHaveLength(5);
    expect(await screen.findByText("Task created")).toBeTruthy();
    expect(eventsRepository.list).toHaveBeenCalledWith({
      organizationId: detail.scope.organizationId,
      projectId: detail.scope.projectId,
      taskId: detail.task.id,
    });
  });

  it.each(["viewer", "archived project"])(
    "keeps %s details readable without mutation controls",
    async (mode) => {
      const detail = taskDetailFixture();
      if (mode === "viewer") detail.options.canWrite = false;
      else detail.projectArchived = true;
      const { view } = setup(detail);
      render(view());
      await screen.findByRole("heading", { name: detail.task.title });
      expect(screen.getByText(/read-only/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Edit task" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Archive task" })).toBeNull();
      expect(await screen.findByText("Task created")).toBeTruthy();
    },
  );

  it("shows missing/access-denied state without fetching protected history", async () => {
    const { view, repository, eventsRepository } = setup();
    repository.load.mockResolvedValue(null);
    render(view());
    await screen.findByRole("heading", {
      name: "Task not found or access denied",
    });
    expect(eventsRepository.list).not.toHaveBeenCalled();
    expect(screen.queryByText("SHIP-42")).toBeNull();
  });

  it("can retry failed reads and removes details when access is lost", async () => {
    const { view, repository, detail } = setup();
    repository.load.mockRejectedValueOnce(new Error("Connection unavailable"));
    render(view());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Connection unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry loading task" }));
    await screen.findByRole("heading", { name: detail.task.title });
    repository.load.mockResolvedValue(null);
    fireEvent.click(screen.getByRole("button", { name: "Reload task" }));
    await screen.findByRole("heading", {
      name: "Task not found or access denied",
    });
    expect(screen.queryByText("Task created")).toBeNull();
    expect(screen.queryByText(detail.task.description!)).toBeNull();
  });

  it("reads back confirmed edits and refreshes history", async () => {
    const { view, repository, detail, eventsRepository } = setup();
    render(view());
    await screen.findByText("Task created");
    fireEvent.click(screen.getByRole("button", { name: "Edit task" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "History shipped" },
    });
    const updated = {
      ...detail,
      task: {
        ...detail.task,
        title: "History shipped",
        updatedAt: "2026-10-20T11:00:00.000Z",
      },
    };
    repository.load.mockResolvedValue(updated);
    repository.save.mockResolvedValue(updated.task);
    eventsRepository.list.mockResolvedValue([
      taskEventFixture({ eventType: "task.updated" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(
      await screen.findByRole("heading", { name: "History shipped" }),
    ).toBeTruthy();
    expect(await screen.findByText("Task updated")).toBeTruthy();
    expect(repository.save).toHaveBeenCalledWith(
      detail.scope,
      expect.objectContaining({ title: "History shipped" }),
      detail.task,
    );
    expect(repository.load).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("preserves the draft on failed saves and lets the user reload stale data", async () => {
    const { view, repository } = setup();
    repository.save.mockRejectedValue(
      new Error("Task changed. Reload before saving again."),
    );
    render(view());
    fireEvent.click(await screen.findByRole("button", { name: "Edit task" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "My pending title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Task changed",
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "My pending title",
    );
    expect(repository.load).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reload task" }));
    await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("reads back archive/restore and reports mutation failures as errors", async () => {
    const { view, repository, detail } = setup();
    render(view());
    await screen.findByRole("button", { name: "Archive task" });
    repository.setArchived.mockRejectedValueOnce(new Error("Archive denied"));
    fireEvent.click(screen.getByRole("button", { name: "Archive task" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Archive denied",
    );
    repository.load.mockResolvedValue({
      ...detail,
      task: { ...detail.task, archivedAt: "2026-10-20T11:00:00.000Z" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Archive task" }));
    const restore = await screen.findByRole("button", { name: "Restore task" });
    expect(repository.setArchived).toHaveBeenLastCalledWith(
      detail.scope,
      detail.task,
      true,
    );
    repository.load.mockResolvedValue(detail);
    fireEvent.click(restore);
    await screen.findByRole("button", { name: "Archive task" });
    expect(repository.setArchived).toHaveBeenLastCalledWith(
      detail.scope,
      expect.objectContaining({ archivedAt: expect.any(String) }),
      false,
    );
  });

  it("ignores late reads after navigating to another project/task", async () => {
    const { view, repository, address, detail } = setup();
    const previous = deferred<TaskDetail | null>();
    repository.load
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(null);
    const rendered = render(view());
    rendered.rerender(
      view({
        ...address,
        projectId: "private-project",
        taskId: "private-task",
      }),
    );
    await screen.findByRole("heading", {
      name: "Task not found or access denied",
    });
    await act(async () => previous.resolve(detail));
    expect(screen.queryByText(detail.task.title)).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Task not found or access denied" }),
    ).toBeTruthy();
  });

  it("does not reload an old task when its mutation finishes after navigation", async () => {
    const { view, repository, address, detail } = setup();
    const mutation = deferred<typeof detail.task>();
    repository.setArchived.mockReturnValueOnce(mutation.promise);
    const rendered = render(view());
    fireEvent.click(
      await screen.findByRole("button", { name: "Archive task" }),
    );
    repository.load.mockResolvedValueOnce(null);
    rendered.rerender(
      view({ ...address, projectId: "other-project", taskId: "other-task" }),
    );
    await screen.findByRole("heading", {
      name: "Task not found or access denied",
    });
    await act(async () => mutation.resolve(detail.task));
    expect(repository.load).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Task archived.")).toBeNull();
  });
});
