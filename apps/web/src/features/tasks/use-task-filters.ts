import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  emptyTaskFilters,
  normalizeTaskFilters,
  parseTaskFilters,
  serializeTaskFilters,
  type TaskFilters,
} from "./task-filters.js";

export function useTaskFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseTaskFilters(searchParams), [searchParams]);

  const setFilters = useCallback(
    (next: Partial<TaskFilters>) => {
      const normalized = normalizeTaskFilters({ ...filters, ...next });
      const serialized = serializeTaskFilters(normalized);
      setSearchParams(
        serialized ? new URLSearchParams(serialized) : new URLSearchParams(),
        { replace: true },
      );
    },
    [filters, setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return {
    clearFilters,
    filters,
    setFilters,
    defaults: emptyTaskFilters,
  };
}
