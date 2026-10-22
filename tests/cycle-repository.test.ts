import { describe, expect, it, vi } from "vitest";
import {
  createCycleRepository,
  validateCycleDraft,
} from "../apps/web/src/features/planning/cycle-repository.js";
import { createTaskRepository } from "../apps/web/src/features/tasks/task-repository.js";
import { taskDetailFixture } from "./task-fixtures.js";

describe("planning validation and retries", () => {
  it("validates dates and names before sending a sprint request", () => {
    expect(
      validateCycleDraft({
        name: " Sprint ",
        startsAt: "2026-10-20",
        endsAt: "2026-11-03",
      }),
    ).toEqual({
      name: "Sprint",
      startsAt: "2026-10-20T00:00:00.000Z",
      endsAt: "2026-11-03T00:00:00.000Z",
    });
    for (const draft of [
      { name: "", startsAt: "", endsAt: "" },
      { name: "Sprint", startsAt: "2026-02-30", endsAt: "" },
      { name: "Sprint", startsAt: "2026-10-20", endsAt: "2026-10-19" },
      { name: "Sprint", startsAt: "infinity", endsAt: "" },
    ])
      expect(() => validateCycleDraft(draft)).toThrow();
  });

  it("reuses the same request ID for an explicit retry after an uncertain result", async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "Connection interrupted" } })
      .mockResolvedValueOnce({
        data: { id: "saved-sprint", name: "Sprint" },
        error: null,
      });
    const rpc = vi.fn(() => ({ select: () => ({ single }) }));
    const store = createCycleRepository({ rpc } as unknown as Parameters<
      typeof createCycleRepository
    >[0]);
    const draft = { name: "Sprint", startsAt: "", endsAt: "" };
    await expect(
      store.create(taskDetailFixture().scope, draft),
    ).rejects.toThrow("Connection interrupted");
    expect((await store.create(taskDetailFixture().scope, draft)).id).toBe(
      "saved-sprint",
    );
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });

  it("rejects invalid story points before any planning mutation", async () => {
    const rpc = vi.fn();
    const store = createTaskRepository({ rpc } as unknown as Parameters<
      typeof createTaskRepository
    >[0]);
    const { scope, task } = taskDetailFixture();
    for (const estimate of [NaN, Infinity, -1, 100000000, 1.234]) {
      await expect(
        store.updatePlanning(scope, task, { estimate, cycleId: null }),
      ).rejects.toThrow();
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
