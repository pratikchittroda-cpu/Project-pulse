import type { CycleRecord } from "../apps/web/src/features/planning/cycle-repository.js";
import { taskDetailFixture } from "./task-fixtures.js";

export function cycleFixture(
  overrides: Partial<CycleRecord> = {},
): CycleRecord {
  const { scope } = taskDetailFixture();
  return {
    id: "cycle-1",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    name: "Sprint 14",
    status: "planned",
    startsAt: "2026-10-21T00:00:00.000Z",
    endsAt: "2026-10-28T00:00:00.000Z",
    startedAt: null,
    pausedAt: null,
    completedAt: null,
    initialCommitment: null,
    committedPoints: 0,
    completedPoints: 0,
    addedPoints: 0,
    removedPoints: 0,
    carriedOverPoints: 0,
    taskCount: 0,
    completedTaskCount: 0,
    addedTaskCount: 0,
    removedTaskCount: 0,
    carriedOverTaskCount: 0,
    initialTasks: [],
    completionTasks: [],
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    ...overrides,
  };
}
