import type { TaskRecord } from "../tasks/task-repository.js";

export interface ProgressSummary {
  completedPoints: number;
  completedTaskCount: number;
  progressPercent: number;
  taskCount: number;
  totalPoints: number;
}

export function isTaskCompleted(
  task: TaskRecord,
  terminalStatuses: Set<string>,
) {
  return (
    task.status !== "canceled" &&
    (terminalStatuses.has(task.status) || task.status === "completed")
  );
}

export function progressForTasks(
  tasks: TaskRecord[],
  terminalStatuses: Set<string>,
): ProgressSummary {
  const activeTasks = tasks.filter((task) => task.status !== "canceled");
  const completedTasks = activeTasks.filter((task) =>
    isTaskCompleted(task, terminalStatuses),
  );
  const totalPoints = activeTasks.reduce(
    (total, task) => total + (task.estimate ?? 0),
    0,
  );
  const completedPoints = completedTasks.reduce(
    (total, task) => total + (task.estimate ?? 0),
    0,
  );
  return {
    taskCount: activeTasks.length,
    completedTaskCount: completedTasks.length,
    totalPoints,
    completedPoints,
    progressPercent: activeTasks.length
      ? Math.round((completedTasks.length / activeTasks.length) * 100)
      : 0,
  };
}

export function isMilestoneOverdue(
  targetDate: string | null,
  status: string,
  today = new Date().toISOString().slice(0, 10),
) {
  return Boolean(
    targetDate &&
      targetDate < today &&
      status !== "completed" &&
      status !== "canceled",
  );
}

export function pointsLabel(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} pts`;
}
