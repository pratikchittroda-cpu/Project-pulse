// @vitest-environment jsdom

import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toIsoDateTime } from "@releasearc/domain";
import { TaskTimeline } from "../apps/web/src/features/events/task-timeline.js";
import { useTaskEvents } from "../apps/web/src/features/events/use-task-events.js";
import type { TaskEventRecord } from "../apps/web/src/features/events/task-events-repository.js";
import { deferred, taskEventFixture } from "./task-fixtures.js";

const scope = {
  organizationId: "organization-1",
  projectId: "project-1",
  taskId: "task-1",
};
afterEach(cleanup);
function repository(events: TaskEventRecord[] = []) {
  return {
    list: vi.fn(async () => events),
    record: vi.fn(async () => taskEventFixture()),
  };
}

describe("task timeline", () => {
  it("renders chronological changes, actors, sources, time and automated reasons", async () => {
    const records = [
      taskEventFixture(),
      taskEventFixture({
        eventId: "event-2",
        eventType: "task.status_changed",
        source: "github",
        actorId: undefined,
        occurredAt: toIsoDateTime("2026-10-20T11:00:00.000Z"),
        correlationId: "delivery-42",
        payload: {
          mode: "automated",
          reason: "Pull request merged",
          changes: { status: { from: "in_review", to: "completed" } },
        },
      }),
      taskEventFixture({
        eventId: "event-3",
        eventType: "github.check.completed",
        source: "github",
        actorId: "reviewer-2",
        payload: { from: "pending", to: "success" },
      }),
    ];
    render(
      <TaskTimeline
        scope={scope}
        currentUserId="user-1"
        repository={repository(records)}
      />,
    );
    expect(screen.getByText("Loading activity…")).toBeTruthy();
    const list = await screen.findByRole("list", { name: "Task history" });
    const entries = within(list).getAllByRole("listitem");
    expect(entries).toHaveLength(3);
    expect(entries[0].textContent).toContain("Task created");
    expect(within(entries[0]).getByText("Manual")).toBeTruthy();
    expect(within(entries[0]).getByText("You")).toBeTruthy();
    expect(entries[1].textContent).toContain("Status changed");
    for (const text of [
      "Automated",
      "Source: github",
      "System / service",
      "Reason: Pull request merged",
      "in_review",
      "completed",
      "Correlation: delivery-42",
    ])
      expect(within(entries[1]).getByText(text)).toBeTruthy();
    expect(entries[1].querySelector("time")?.getAttribute("datetime")).toBe(
      records[1].occurredAt,
    );
    expect(within(entries[2]).getByText("Provider")).toBeTruthy();
    expect(within(entries[2]).getByText("reviewer-2")).toBeTruthy();
    expect(within(entries[2]).getByText("pending → success")).toBeTruthy();
  });

  it("supports empty history and retry after errors without retaining stale events", async () => {
    const store = repository();
    render(
      <TaskTimeline scope={scope} currentUserId="user-1" repository={store} />,
    );
    expect(await screen.findByText(/No activity recorded yet/)).toBeTruthy();
    store.list.mockRejectedValueOnce(new Error("History unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "History unavailable",
    );
    store.list.mockResolvedValue([taskEventFixture()]);
    fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    await screen.findByText("Task created");
    store.list.mockRejectedValueOnce(new Error("Access lost"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Task created")).toBeNull();
  });

  it("handles older or malformed change payloads without interpreting markup", async () => {
    render(
      <TaskTimeline
        scope={scope}
        currentUserId="user-1"
        repository={repository([
          taskEventFixture({
            payload: {
              changes: { status: null },
              reason: "<script>bad()</script>",
            },
          }),
        ])}
      />,
    );
    expect(
      await screen.findByText("No field-change details were recorded."),
    ).toBeTruthy();
    expect(screen.getByText("Reason: <script>bad()</script>")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });

  it("ignores out-of-order history responses and clears history on a scope change", async () => {
    const slow = deferred<TaskEventRecord[]>();
    const store = repository();
    store.list.mockReturnValueOnce(slow.promise);
    const { result, rerender } = renderHook(
      (value) => useTaskEvents(value, store),
      { initialProps: scope },
    );
    rerender({ ...scope, projectId: "other-project", taskId: "other-task" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => slow.resolve([taskEventFixture()]));
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("does not reload a previous scope when an event write completes after switching tasks", async () => {
    const writing = deferred<TaskEventRecord>();
    const store = repository();
    store.record.mockReturnValueOnce(writing.promise);
    const { result, rerender } = renderHook(
      (value) => useTaskEvents(value, store),
      { initialProps: scope },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let write!: Promise<TaskEventRecord>;
    act(() => {
      write = result.current.record({
        eventType: "task.updated",
        source: "internal",
        idempotencyKey: "explicit-1",
        payload: {},
      });
    });
    rerender({ ...scope, taskId: "other-task" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      writing.resolve(taskEventFixture());
      await write;
    });
    expect(store.list).toHaveBeenCalledTimes(2);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.events).toEqual([]);
  });
});
