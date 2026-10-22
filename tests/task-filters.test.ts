import { describe, expect, it } from "vitest";

import {
  buildTaskFilterOptions,
  emptyTaskFilters,
  filterTaskRecords,
  parseTaskFilters,
  serializeTaskFilters,
  taskSearchText,
} from "../apps/web/src/features/tasks/task-filters.js";
import type {
  TaskOptions,
  TaskRecord,
} from "../apps/web/src/features/tasks/task-repository.js";

const options: TaskOptions = {
  assignees: [{ id: "user-1" }, { id: "user-2" }],
  canWrite: true,
  sprints: [{ id: "sprint-1", label: "Sprint 1", status: "active" }],
  statuses: [
    { label: "Backlog", status: "backlog" },
    { label: "In progress", status: "in_progress" },
  ],
  teams: [{ id: "team-1", label: "PLAT · Platform" }],
};

const tasks: TaskRecord[] = [
  {
    archivedAt: null,
    branchName: "feature/release-signal",
    cycleId: "sprint-1",
    epicId: null,
    milestoneId: null,
    assigneeId: "user-1",
    description: "Prepare the release signal",
    dueDate: null,
    estimate: 3,
    id: "task-1",
    key: "PULSE-1",
    labels: ["release", "planning"],
    number: "1",
    priority: "high",
    pullRequestNumber: 42,
    pullRequestTitle: "Release signal",
    pullRequestUrl: "https://github.com/example/pull/42",
    status: "in_progress",
    teamId: "team-1",
    title: "Ship release signal",
    updatedAt: "2026-10-20T00:00:00.000Z",
  },
  {
    archivedAt: null,
    cycleId: null,
    epicId: null,
    milestoneId: null,
    assigneeId: null,
    description: "Document the API",
    dueDate: null,
    estimate: null,
    id: "task-2",
    key: "PULSE-2",
    labels: ["docs"],
    number: "2",
    priority: "low",
    status: "backlog",
    title: "Document API",
    updatedAt: "2026-10-20T00:00:00.000Z",
  },
];

describe("task filter state", () => {
  it("serializes combined filters and restores them from a URL", () => {
    const filters = {
      ...emptyTaskFilters,
      assigneeId: "user-1",
      includeArchived: true,
      label: "release",
      priority: "high" as const,
      query: "signal",
      sprintId: "sprint-1",
      status: "in_progress",
      teamId: "team-1",
    };

    expect(parseTaskFilters(serializeTaskFilters(filters))).toEqual(filters);
    expect(serializeTaskFilters(filters)).toContain("status=in_progress");
    expect(serializeTaskFilters(filters)).toContain("archived=1");
  });

  it("combines status, priority, assignee, sprint, team, label, and search", () => {
    expect(
      filterTaskRecords(tasks, {
        assigneeId: "user-1",
        label: "release",
        priority: "high",
        query: "pull/42",
        sprintId: "sprint-1",
        status: "in_progress",
        teamId: "team-1",
      }),
    ).toEqual([tasks[0]]);
    expect(filterTaskRecords(tasks, { sprintId: "backlog" })).toEqual([
      tasks[1],
    ]);
    expect(filterTaskRecords(tasks, { assigneeId: "unassigned" })).toEqual([
      tasks[1],
    ]);
  });

  it("builds filter options from configured metadata and authorized task data", () => {
    const filterOptions = buildTaskFilterOptions(tasks, options);

    expect(filterOptions.labels).toEqual(["docs", "planning", "release"]);
    expect(filterOptions.teams).toEqual([
      { id: "team-1", label: "PLAT · Platform" },
    ]);
    expect(filterOptions.sprints).toEqual([
      { id: "sprint-1", label: "Sprint 1", status: "active" },
    ]);
  });

  it("includes optional branch and pull-request metadata in search text", () => {
    expect(taskSearchText(tasks[0]!)).toContain("feature/release-signal");
    expect(taskSearchText(tasks[0]!)).toContain("release signal");
    expect(taskSearchText(tasks[0]!)).toContain("pull/42");
  });
});
