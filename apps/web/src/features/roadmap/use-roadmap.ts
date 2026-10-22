import { useCallback, useEffect, useRef, useState } from "react";

import {
  roadmapRepository,
  type EpicDraft,
  type EpicRecord,
  type InitiativeDraft,
  type InitiativeRecord,
  type MilestoneDraft,
  type MilestoneRecord,
  type RoadmapRepository,
} from "./roadmap-repository.js";
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
    : "Could not update the roadmap.";
}

export function useRoadmap(
  scope: TaskScope,
  roadmapStore: RoadmapRepository = roadmapRepository,
  taskStore: TaskRepository = taskRepository,
) {
  const [initiatives, setInitiatives] = useState<InitiativeRecord[]>([]);
  const [epics, setEpics] = useState<EpicRecord[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>([]);
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
    setInitiatives([]);
    setEpics([]);
    setMilestones([]);
    setTasks([]);
    setOptions(null);
    try {
      const nextScope = { organizationId, projectId, projectKey, userId };
      const [roadmap, nextTasks, nextOptions] = await Promise.all([
        roadmapStore.list(nextScope),
        taskStore.list(nextScope, false),
        taskStore.options(nextScope),
      ]);
      if (mounted.current && request.current === current) {
        setInitiatives(roadmap.initiatives);
        setEpics(roadmap.epics);
        setMilestones(roadmap.milestones);
        setTasks(nextTasks);
        setOptions(nextOptions);
      }
    } catch (cause) {
      if (mounted.current && request.current === current)
        setError(message(cause));
    } finally {
      if (mounted.current && request.current === current) setIsLoading(false);
    }
  }, [organizationId, projectId, projectKey, roadmapStore, taskStore, userId]);

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
      throw new Error("A roadmap change is already being saved.");
    if (!options?.canWrite)
      throw new Error("You have read-only access to this project's roadmap.");
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
    initiatives,
    epics,
    milestones,
    tasks,
    options,
    error,
    isLoading,
    isSaving,
    reload,
    saveInitiative: (draft: InitiativeDraft, item?: InitiativeRecord) =>
      mutate(() =>
        item
          ? roadmapStore.editInitiative(scope, item, draft)
          : roadmapStore.createInitiative(scope, draft),
      ),
    saveEpic: (draft: EpicDraft, item?: EpicRecord) =>
      mutate(() =>
        item
          ? roadmapStore.editEpic(scope, item, draft)
          : roadmapStore.createEpic(scope, draft),
      ),
    saveMilestone: (draft: MilestoneDraft, item?: MilestoneRecord) =>
      mutate(() =>
        item
          ? roadmapStore.editMilestone(scope, item, draft)
          : roadmapStore.createMilestone(scope, draft),
      ),
    updateTaskHierarchy: (
      task: TaskRecord,
      epicId: string | null,
      milestoneId: string | null,
    ) =>
      mutate(() =>
        taskStore.updatePlanning(scope, task, {
          cycleId: task.cycleId,
          estimate: task.estimate,
          epicId,
          milestoneId,
        }),
      ),
  };
}
