import { useCallback, useEffect, useRef, useState } from "react";

import {
  taskRepository,
  taskToDraft,
  type TaskOptions,
  type TaskRecord,
  type TaskRepository,
  type TaskScope,
} from "../tasks/task-repository.js";

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

export function useKanbanBoard(
  scope: TaskScope,
  includeArchived: boolean,
  repository: TaskRepository = taskRepository,
) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [options, setOptions] = useState<TaskOptions>(emptyOptions);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const mounted = useRef(false);
  const moving = useRef(false);

  const reload = useCallback(async () => {
    const current = ++request.current;
    setIsLoading(true);
    setError(null);
    try {
      const [nextTasks, nextOptions] = await Promise.all([
        repository.list(scope, includeArchived),
        repository.options(scope),
      ]);
      if (mounted.current && request.current === current) {
        setTasks(nextTasks);
        setOptions(nextOptions);
      }
    } catch (cause) {
      if (mounted.current && request.current === current) {
        setTasks([]);
        setOptions(emptyOptions);
        setError(errorMessage(cause));
      }
    } finally {
      if (mounted.current && request.current === current) setIsLoading(false);
    }
  }, [includeArchived, repository, scope]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, [reload]);

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
        if (mounted.current) {
          setTasks((current) =>
            current.map((item) => (item.id === saved.id ? saved : item)),
          );
        }
        return saved;
      } catch (cause) {
        if (mounted.current) {
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id && item.status === nextStatus ? task : item,
            ),
          );
        }
        throw cause;
      } finally {
        moving.current = false;
        if (mounted.current) {
          setIsMoving(false);
          setMovingTaskId(null);
        }
      }
    },
    [options.canWrite, options.statuses, repository, scope],
  );

  return {
    error,
    isLoading,
    isMoving,
    moveTask,
    movingTaskId,
    options,
    reload,
    tasks,
  };
}
