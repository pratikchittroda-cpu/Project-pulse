import { useCallback, useEffect, useRef, useState } from "react";

import {
  taskRepository,
  taskToDraft,
  type TaskOptions,
  type TaskRecord,
  type TaskRepository,
  type TaskScope,
} from "../tasks/task-repository.js";
import {
  taskDependencyRepository,
  type TaskRelationRepository,
  type TaskDependencySummary,
} from "../tasks/task-relations-repository.js";
import type {
  TaskRealtimeChange,
  TaskRealtimeSubscription,
} from "./task-realtime.js";

const emptyOptions: TaskOptions = {
  assignees: [],
  canWrite: false,
  statuses: [],
};

function errorMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "Could not update the board. Try again.";
}

interface RealtimeTaskState {
  task: TaskRecord | null;
  version: string;
}

function compareVersions(left: string, right: string) {
  if (left === right) return 0;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime < rightTime ? -1 : 1;
  }
  return left < right ? -1 : 1;
}

function mergeTaskSnapshot(
  nextTasks: TaskRecord[],
  realtimeTasks: Map<string, RealtimeTaskState>,
  includeArchived: boolean,
) {
  const merged = new Map(nextTasks.map((task) => [task.id, task]));
  for (const [taskId, state] of realtimeTasks) {
    const snapshotTask = merged.get(taskId);
    if (state.task === null) {
      if (
        !snapshotTask ||
        compareVersions(state.version, snapshotTask.updatedAt) >= 0
      ) {
        merged.delete(taskId);
      }
      continue;
    }
    if (
      (!snapshotTask ||
        compareVersions(state.version, snapshotTask.updatedAt) >= 0) &&
      (includeArchived || !state.task.archivedAt)
    ) {
      merged.set(taskId, state.task);
    }
  }
  return [...merged.values()];
}

export function useKanbanBoard(
  scope: TaskScope,
  includeArchived: boolean,
  repository: TaskRepository = taskRepository,
  dependencyRepository: TaskRelationRepository | null = taskDependencyRepository,
  realtimeSubscription: TaskRealtimeSubscription | null = null,
) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [options, setOptions] = useState<TaskOptions>(emptyOptions);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [dependencySummary, setDependencySummary] = useState<
    Record<string, TaskDependencySummary>
  >({});
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const mounted = useRef(false);
  const moving = useRef(false);
  const generation = useRef(0);
  const moveToken = useRef(0);
  const realtimeTasks = useRef(new Map<string, RealtimeTaskState>());

  const reload = useCallback(async () => {
    const current = ++request.current;
    setIsLoading(true);
    setError(null);
    try {
      const [nextTasks, nextOptions, nextDependencySummary] = await Promise.all(
        [
          repository.list(scope, includeArchived),
          repository.options(scope),
          dependencyRepository?.summary(scope) ?? Promise.resolve({}),
        ],
      );
      if (mounted.current && request.current === current) {
        for (const task of nextTasks) {
          const previous = realtimeTasks.current.get(task.id);
          if (
            !previous ||
            compareVersions(task.updatedAt, previous.version) > 0
          ) {
            realtimeTasks.current.set(task.id, {
              task,
              version: task.updatedAt,
            });
          }
        }
        setTasks(
          mergeTaskSnapshot(nextTasks, realtimeTasks.current, includeArchived),
        );
        setOptions(nextOptions);
        setDependencySummary(nextDependencySummary);
      }
    } catch (cause) {
      if (mounted.current && request.current === current) {
        setTasks([]);
        setOptions(emptyOptions);
        setDependencySummary({});
        setError(errorMessage(cause));
      }
    } finally {
      if (mounted.current && request.current === current) setIsLoading(false);
    }
  }, [dependencyRepository, includeArchived, repository, scope]);

  const applyRealtimeChange = useCallback(
    (change: TaskRealtimeChange) => {
      const previous = realtimeTasks.current.get(change.taskId);
      if (previous && compareVersions(change.version, previous.version) < 0) {
        return;
      }

      realtimeTasks.current.set(change.taskId, {
        task: change.task,
        version: change.version,
      });
      if (change.task && (includeArchived || !change.task.archivedAt)) {
        setTasks((current) => {
          const found = current.some(({ id }) => id === change.taskId);
          return found
            ? current.map((task) =>
                task.id === change.taskId ? change.task! : task,
              )
            : [...current, change.task!];
        });
      } else {
        setTasks((current) => current.filter(({ id }) => id !== change.taskId));
      }
    },
    [includeArchived],
  );

  useEffect(() => {
    mounted.current = true;
    const currentGeneration = ++generation.current;
    realtimeTasks.current.clear();
    void reload();

    const unsubscribe = realtimeSubscription
      ? realtimeSubscription.subscribe(scope, {
          onChange: (change) => {
            if (mounted.current && generation.current === currentGeneration) {
              applyRealtimeChange(change);
            }
          },
          onResync: () => {
            if (mounted.current && generation.current === currentGeneration) {
              return reload();
            }
          },
        })
      : () => undefined;

    return () => {
      mounted.current = false;
      generation.current += 1;
      request.current += 1;
      moving.current = false;
      realtimeTasks.current.clear();
      unsubscribe();
    };
  }, [applyRealtimeChange, realtimeSubscription, reload, scope]);

  const moveTask = useCallback(
    async (task: TaskRecord, nextStatus: string) => {
      if (task.status === nextStatus) return task;
      if (!options.canWrite) {
        throw new Error("You have read-only access to tasks in this project.");
      }
      if (!options.statuses.some(({ status }) => status === nextStatus)) {
        throw new Error("Choose a configured project status.");
      }
      if (moving.current) {
        throw new Error("A task change is already being saved.");
      }

      const currentGeneration = generation.current;
      const currentMoveToken = ++moveToken.current;
      moving.current = true;
      setIsMoving(true);
      setMovingTaskId(task.id);
      setError(null);
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: nextStatus } : item,
        ),
      );

      try {
        const saved = await repository.save(
          scope,
          { ...taskToDraft(task), status: nextStatus },
          task,
        );
        const realtime = realtimeTasks.current.get(saved.id);
        const newerRealtime =
          realtime &&
          (realtime.task === null ||
            compareVersions(realtime.version, saved.updatedAt) >= 0);
        if (
          mounted.current &&
          generation.current === currentGeneration &&
          !newerRealtime
        ) {
          realtimeTasks.current.set(saved.id, {
            task: saved,
            version: saved.updatedAt,
          });
          setTasks((current) =>
            current.map((item) => (item.id === saved.id ? saved : item)),
          );
        }
        return saved;
      } catch (cause) {
        if (mounted.current && generation.current === currentGeneration) {
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id &&
              item.status === nextStatus &&
              item.updatedAt === task.updatedAt
                ? task
                : item,
            ),
          );
        }
        throw cause;
      } finally {
        if (moveToken.current === currentMoveToken) moving.current = false;
        if (
          mounted.current &&
          generation.current === currentGeneration &&
          moveToken.current === currentMoveToken
        ) {
          setIsMoving(false);
          setMovingTaskId(null);
        }
      }
    },
    [options.canWrite, options.statuses, repository, scope],
  );

  return {
    error,
    dependencySummary,
    isLoading,
    isMoving,
    moveTask,
    movingTaskId,
    options,
    reload,
    tasks,
  };
}
