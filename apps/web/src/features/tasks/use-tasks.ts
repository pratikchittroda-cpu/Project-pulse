import { useCallback, useEffect, useRef, useState } from "react";

import {
  taskRepository,
  type TaskDraft,
  type TaskOptions,
  type TaskRecord,
  type TaskRepository,
  type TaskScope,
} from "./task-repository.js";

const emptyOptions: TaskOptions = {
  assignees: [],
  canWrite: false,
  statuses: [],
};

export function useTasks(
  scope: TaskScope,
  includeArchived: boolean,
  repository: TaskRepository = taskRepository,
) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [options, setOptions] = useState(emptyOptions);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const mounted = useRef(false);
  const saving = useRef(false);

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
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load tasks. Try again.",
        );
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

  async function mutate(operation: () => Promise<TaskRecord>) {
    if (saving.current)
      throw new Error("A task change is already being saved.");
    saving.current = true;
    setIsSaving(true);
    try {
      const saved = await operation();
      // Wait for server confirmation, then read back the scoped list. No optimistic writes.
      if (mounted.current) await reload();
      return saved;
    } finally {
      saving.current = false;
      if (mounted.current) setIsSaving(false);
    }
  }

  return {
    error,
    isLoading,
    isSaving,
    options,
    reload,
    save: (draft: TaskDraft, previous?: TaskRecord) =>
      mutate(() => repository.save(scope, draft, previous)),
    setArchived: (task: TaskRecord, archived: boolean) =>
      mutate(() => repository.setArchived(scope, task, archived)),
    tasks,
  };
}
