import { useCallback, useEffect, useRef, useState } from "react";

import {
  taskEventRepository,
  type TaskEventDraft,
  type TaskEventRecord,
  type TaskEventRepository,
  type TaskEventScope,
} from "./task-events-repository.js";

export function useTaskEvents(
  scope: TaskEventScope,
  repository: TaskEventRepository = taskEventRepository,
) {
  const [events, setEvents] = useState<TaskEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const scopeVersion = useRef(0);
  const { organizationId, projectId, taskId } = scope;

  const reload = useCallback(async () => {
    const request = ++generation.current;
    setIsLoading(true);
    setEvents([]);
    setError(null);
    try {
      const nextEvents = await repository.list({
        organizationId,
        projectId,
        taskId,
      });
      if (mounted.current && request === generation.current)
        setEvents(nextEvents);
    } catch (cause) {
      if (mounted.current && request === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load task events.",
        );
    } finally {
      if (mounted.current && request === generation.current)
        setIsLoading(false);
    }
  }, [repository, organizationId, projectId, taskId]);

  useEffect(() => {
    mounted.current = true;
    setIsRecording(false);
    void reload();
    return () => {
      mounted.current = false;
      generation.current += 1;
      scopeVersion.current += 1;
    };
  }, [reload]);

  async function record(draft: TaskEventDraft) {
    const version = scopeVersion.current;
    setIsRecording(true);
    setError(null);
    try {
      const saved = await repository.record(scope, draft);
      if (mounted.current && version === scopeVersion.current) await reload();
      return saved;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not record task event.";
      if (mounted.current && version === scopeVersion.current)
        setError(message);
      throw cause;
    } finally {
      if (mounted.current && version === scopeVersion.current)
        setIsRecording(false);
    }
  }

  return { error, events, isLoading, isRecording, record, reload };
}
