import type { TaskPriority } from "@projectpulse/domain";

import type { TaskOptions, TaskRecord } from "./task-repository.js";

export interface TaskFilters {
  assigneeId: string;
  includeArchived: boolean;
  label: string;
  priority: TaskPriority | "all";
  query: string;
  sprintId: string;
  status: string;
  teamId: string;
}

export const emptyTaskFilters: TaskFilters = {
  assigneeId: "all",
  includeArchived: false,
  label: "all",
  priority: "all",
  query: "",
  sprintId: "all",
  status: "all",
  teamId: "all",
};

const priorities: readonly TaskPriority[] = ["urgent", "high", "medium", "low"];

function isTaskPriority(value: unknown): value is TaskPriority {
  return (
    typeof value === "string" && priorities.includes(value as TaskPriority)
  );
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

export function normalizeTaskFilters(
  input: Partial<TaskFilters> = {},
): TaskFilters {
  const priority = input.priority;
  return {
    assigneeId: stringValue(input.assigneeId, emptyTaskFilters.assigneeId),
    includeArchived: input.includeArchived === true,
    label: stringValue(input.label, emptyTaskFilters.label),
    priority:
      priority === "all" || isTaskPriority(priority)
        ? priority
        : emptyTaskFilters.priority,
    query: stringValue(input.query, emptyTaskFilters.query),
    sprintId: stringValue(input.sprintId, emptyTaskFilters.sprintId),
    status: stringValue(input.status, emptyTaskFilters.status),
    teamId: stringValue(input.teamId, emptyTaskFilters.teamId),
  };
}

export function parseTaskFilters(input: string | URLSearchParams) {
  const params =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : input;

  return normalizeTaskFilters({
    assigneeId: params.get("assignee") ?? undefined,
    includeArchived: params.get("archived") === "1",
    label: params.get("label") ?? undefined,
    priority: (params.get("priority") ?? undefined) as
      | TaskFilters["priority"]
      | undefined,
    query: params.get("q") ?? undefined,
    sprintId: params.get("sprint") ?? undefined,
    status: params.get("status") ?? undefined,
    teamId: params.get("team") ?? undefined,
  });
}

export function serializeTaskFilters(filters: Partial<TaskFilters>) {
  const normalized = normalizeTaskFilters(filters);
  const params = new URLSearchParams();

  if (normalized.query.trim()) params.set("q", normalized.query);
  if (normalized.status !== emptyTaskFilters.status)
    params.set("status", normalized.status);
  if (normalized.priority !== emptyTaskFilters.priority)
    params.set("priority", normalized.priority);
  if (normalized.assigneeId !== emptyTaskFilters.assigneeId)
    params.set("assignee", normalized.assigneeId);
  if (normalized.sprintId !== emptyTaskFilters.sprintId)
    params.set("sprint", normalized.sprintId);
  if (normalized.teamId !== emptyTaskFilters.teamId)
    params.set("team", normalized.teamId);
  if (normalized.label !== emptyTaskFilters.label)
    params.set("label", normalized.label);
  if (normalized.includeArchived) params.set("archived", "1");

  return params.toString();
}

export function hasActiveTaskFilters(filters: TaskFilters) {
  return serializeTaskFilters(filters).length > 0;
}

function normalizedText(value: string | null | undefined) {
  return value?.toLocaleLowerCase() ?? "";
}

export function taskSearchText(task: TaskRecord) {
  return [
    task.key,
    task.title,
    task.description,
    ...task.labels,
    task.branchName,
    task.pullRequestNumber,
    task.pullRequestTitle,
    task.pullRequestUrl,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join(" ")
    .toLocaleLowerCase();
}

export function filterTaskRecords(
  tasks: TaskRecord[],
  filters: Partial<TaskFilters>,
) {
  const normalized = normalizeTaskFilters(filters);
  const query = normalizedText(normalized.query.trim());

  return tasks.filter((task) => {
    if (normalized.status !== "all" && task.status !== normalized.status)
      return false;
    if (normalized.priority !== "all" && task.priority !== normalized.priority)
      return false;
    if (
      normalized.assigneeId !== "all" &&
      (normalized.assigneeId === "unassigned"
        ? task.assigneeId !== null
        : task.assigneeId !== normalized.assigneeId)
    )
      return false;
    if (
      normalized.sprintId !== "all" &&
      (normalized.sprintId === "backlog"
        ? task.cycleId !== null
        : task.cycleId !== normalized.sprintId)
    )
      return false;
    if (
      normalized.teamId !== "all" &&
      (normalized.teamId === "unassigned"
        ? (task.teamId ?? null) !== null
        : task.teamId !== normalized.teamId)
    )
      return false;
    if (
      normalized.label !== "all" &&
      !task.labels.some(
        (label) => normalizedText(label) === normalizedText(normalized.label),
      )
    )
      return false;
    if (query && !taskSearchText(task).includes(query)) return false;
    return true;
  });
}

export interface TaskFilterOptions {
  assignees: { id: string; label?: string }[];
  labels: string[];
  sprints: { id: string; label: string; status?: string }[];
  statuses: { isTerminal?: boolean; label: string; status: string }[];
  teams: { id: string; label: string }[];
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildTaskFilterOptions(
  tasks: TaskRecord[],
  options: TaskOptions,
  extras: {
    sprints?: { id: string; label: string; status?: string }[];
  } = {},
): TaskFilterOptions {
  const statuses = [...options.statuses];
  for (const task of tasks) {
    if (!statuses.some(({ status }) => status === task.status)) {
      statuses.push({ label: statusLabel(task.status), status: task.status });
    }
  }

  const assignees = uniqueById([
    ...(options.assignees ?? []),
    ...tasks.flatMap((task) =>
      task.assigneeId ? [{ id: task.assigneeId }] : [],
    ),
  ]);
  const teams = uniqueById([
    ...(options.teams ?? []),
    ...tasks.flatMap((task) =>
      task.teamId ? [{ id: task.teamId, label: task.teamId }] : [],
    ),
  ]);
  const sprints = uniqueById([
    ...(options.sprints ?? []),
    ...(extras.sprints ?? []),
    ...tasks.flatMap((task) =>
      task.cycleId ? [{ id: task.cycleId, label: task.cycleId }] : [],
    ),
  ]);
  const labels = [
    ...new Set(tasks.flatMap(({ labels: taskLabels }) => taskLabels)),
  ].sort((left, right) => left.localeCompare(right));

  return {
    assignees,
    labels,
    sprints,
    statuses,
    teams,
  };
}
