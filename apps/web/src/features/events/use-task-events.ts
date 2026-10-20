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

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextEvents = await repository.list(scope);
      if (mounted.current) setEvents(nextEvents);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load task events.",
        );
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [repository, scope]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  async function record(draft: TaskEventDraft) {
    setIsRecording(true);
    setError(null);
    try {
      const saved = await repository.record(scope, draft);
      if (mounted.current) await reload();
      return saved;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not record task event.";
      if (mounted.current) setError(message);
      throw cause;
    } finally {
      if (mounted.current) setIsRecording(false);
    }
  }

  return { error, events, isLoading, isRecording, record, reload };
}
