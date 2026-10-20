import { useCallback, useEffect, useRef, useState } from "react";
import {
  cycleRepository,
  type CycleAction,
  type CycleDraft,
  type CycleRecord,
  type CycleRepository,
} from "./cycle-repository.js";
import {
  taskRepository,
  type TaskOptions,
  type TaskRecord,
  type TaskRepository,
  type TaskScope,
} from "../tasks/task-repository.js";

function message(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "Could not update planning data.";
}

export function usePlanning(
  scope: TaskScope,
  cycleStore: CycleRepository = cycleRepository,
  taskStore: TaskRepository = taskRepository,
) {
  const [cycles, setCycles] = useState<CycleRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [options, setOptions] = useState<TaskOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const context = useRef(0);
  const mounted = useRef(false);
  const saving = useRef(false);
  const { organizationId, projectId, projectKey, userId } = scope;

  const reload = useCallback(async () => {
    const current = ++request.current;
    setIsLoading(true);
    setError(null);
    setTasks([]);
    setCycles([]);
    setOptions(null);
    try {
      const nextScope = { organizationId, projectId, projectKey, userId };
      const [nextCycles, nextTasks, nextOptions] = await Promise.all([
        cycleStore.list(nextScope),
        taskStore.list(nextScope, false),
        taskStore.options(nextScope),
      ]);
      if (mounted.current && request.current === current) {
        setCycles(nextCycles);
        setTasks(nextTasks);
        setOptions(nextOptions);
      }
    } catch (cause) {
      if (mounted.current && request.current === current)
        setError(message(cause));
    } finally {
      if (mounted.current && request.current === current) setIsLoading(false);
    }
  }, [cycleStore, taskStore, organizationId, projectId, projectKey, userId]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      request.current += 1;
      context.current += 1;
    };
  }, [reload]);

  async function mutate<T>(operation: () => Promise<T>) {
    if (saving.current)
      throw new Error("A planning change is already being saved.");
    if (!options?.canWrite)
      throw new Error("You have read-only access to planning.");
    const version = context.current;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const saved = await operation();
      if (mounted.current && version === context.current) await reload();
      return saved;
    } catch (cause) {
      if (mounted.current && version === context.current)
        setError(message(cause));
      throw cause;
    } finally {
      saving.current = false;
      if (mounted.current && version === context.current) setIsSaving(false);
    }
  }

  return {
    cycles,
    tasks,
    options,
    error,
    isLoading,
    isSaving,
    reload,
    saveCycle: (draft: CycleDraft, cycle?: CycleRecord) =>
      mutate(() =>
        cycle
          ? cycleStore.edit(scope, cycle, draft)
          : cycleStore.create(scope, draft),
      ),
    manageCycle: (action: CycleAction, cycle: CycleRecord) =>
      mutate(() => cycleStore.manage(scope, action, cycle)),
    updatePlan: (
      task: TaskRecord,
      cycleId: string | null,
      estimate: number | null,
    ) =>
      mutate(() =>
        taskStore.updatePlanning(scope, task, { cycleId, estimate }),
      ),
  };
}
