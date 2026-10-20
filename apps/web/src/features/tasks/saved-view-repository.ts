import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "../../app/auth-client.js";
import { normalizeTaskFilters, type TaskFilters } from "./task-filters.js";
import type { TaskScope } from "./task-repository.js";

export interface SavedTaskView {
  createdAt: string;
  filters: TaskFilters;
  id: string;
  name: string;
  updatedAt: string;
}

interface SavedTaskViewRow {
  created_at: string;
  filters: unknown;
  id: string;
  name: string;
  updated_at: string;
}

const savedViewColumns = "id, name, filters, created_at, updated_at";

function toSavedTaskView(row: SavedTaskViewRow): SavedTaskView {
  return {
    createdAt: row.created_at,
    filters: normalizeTaskFilters(
      typeof row.filters === "object" && row.filters !== null
        ? (row.filters as Partial<TaskFilters>)
        : {},
    ),
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
  };
}

function viewName(name: string) {
  const normalized = name.trim();
  if (!normalized || normalized.length > 120) {
    throw new Error("Use a saved view name between 1 and 120 characters.");
  }
  return normalized;
}

function databaseError(error: { code?: string; message: string }) {
  if (error.code === "42501") {
    return new Error(
      "You no longer have permission to manage saved views in this project.",
    );
  }
  if (error.code === "23505") {
    return new Error("A saved view with that name already exists.");
  }
  if (error.code === "PGRST116") {
    return new Error("That saved view is no longer available.");
  }
  return new Error(error.message || "Could not load saved views.");
}

export interface SavedTaskViewRepository {
  create(
    scope: TaskScope,
    name: string,
    filters: TaskFilters,
  ): Promise<SavedTaskView>;
  list(scope: TaskScope): Promise<SavedTaskView[]>;
  remove(scope: TaskScope, view: SavedTaskView): Promise<void>;
  update(
    scope: TaskScope,
    view: SavedTaskView,
    name: string,
    filters: TaskFilters,
  ): Promise<SavedTaskView>;
}

export function createSavedTaskViewRepository(
  client: SupabaseClient = supabase,
): SavedTaskViewRepository {
  return {
    async create(scope, name, filters) {
      const { data, error } = await client
        .from("task_saved_views")
        .insert({
          filters: normalizeTaskFilters(filters),
          name: viewName(name),
          organization_id: scope.organizationId,
          project_id: scope.projectId,
          user_id: scope.userId,
        })
        .select(savedViewColumns)
        .single<SavedTaskViewRow>();
      if (error) throw databaseError(error);
      return toSavedTaskView(data);
    },
    async list(scope) {
      const { data, error } = await client
        .from("task_saved_views")
        .select(savedViewColumns)
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("user_id", scope.userId)
        .order("name")
        .returns<SavedTaskViewRow[]>();
      if (error) throw databaseError(error);
      return (data ?? []).map(toSavedTaskView);
    },
    async remove(scope, view) {
      const { error } = await client
        .from("task_saved_views")
        .delete()
        .eq("id", view.id)
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("user_id", scope.userId);
      if (error) throw databaseError(error);
    },
    async update(scope, view, name, filters) {
      const { data, error } = await client
        .from("task_saved_views")
        .update({
          filters: normalizeTaskFilters(filters),
          name: viewName(name),
        })
        .eq("id", view.id)
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("user_id", scope.userId)
        .select(savedViewColumns)
        .single<SavedTaskViewRow>();
      if (error) throw databaseError(error);
      return toSavedTaskView(data);
    },
  };
}

export const savedTaskViewRepository = createSavedTaskViewRepository();
