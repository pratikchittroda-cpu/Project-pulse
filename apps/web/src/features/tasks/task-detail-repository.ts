import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../app/auth-client.js";
import {
  createTaskRepository,
  type TaskOptions,
  type TaskRecord,
  type TaskScope,
} from "./task-repository.js";
import {
  createTaskRelationRepository,
  type TaskDependencyDraft,
  type TaskDependencyState,
  type TaskRelationRecord,
} from "./task-relations-repository.js";

export interface TaskDetailAddress {
  organizationId: string;
  projectId: string;
  taskId: string;
  userId: string;
}

export interface TaskDetail {
  scope: TaskScope;
  task: TaskRecord;
  options: TaskOptions;
  projectName: string;
  projectArchived: boolean;
  cycleName: string | null;
  dependencies?: TaskDependencyState;
}

export interface TaskDetailRepository {
  load(address: TaskDetailAddress): Promise<TaskDetail | null>;
  save: ReturnType<typeof createTaskRepository>["save"];
  setArchived: ReturnType<typeof createTaskRepository>["setArchived"];
  createDependency?: (
    scope: TaskScope,
    draft: TaskDependencyDraft,
  ) => Promise<TaskRelationRecord>;
  removeDependency?: (
    scope: TaskScope,
    relation: TaskRelationRecord,
  ) => Promise<TaskRelationRecord>;
}

export function taskDetailPath(
  scope: Pick<TaskScope, "organizationId" | "projectId">,
  taskId: string,
) {
  return `/app/organizations/${encodeURIComponent(scope.organizationId)}/projects/${encodeURIComponent(scope.projectId)}/tasks/${encodeURIComponent(taskId)}`;
}

export function createTaskDetailRepository(client: SupabaseClient = supabase) {
  const tasks = createTaskRepository(client);
  const relations = createTaskRelationRepository(client, tasks);
  return {
    async load(address: TaskDetailAddress): Promise<TaskDetail | null> {
      const { data: project, error } = await client
        .from("projects")
        .select("name, project_key, archived_at")
        .eq("id", address.projectId)
        .eq("organization_id", address.organizationId)
        .maybeSingle<{
          name: string;
          project_key: string;
          archived_at: string | null;
        }>();
      if (error)
        throw new Error("Could not load the task's project. Try again.");
      if (!project) return null;
      const scope = {
        organizationId: address.organizationId,
        projectId: address.projectId,
        projectKey: project.project_key,
        userId: address.userId,
      };
      const task = await tasks.get(scope, address.taskId);
      if (!task) return null;
      const [options, cycleName, dependencies] = await Promise.all([
        tasks.options(scope),
        task.cycleId
          ? tasks.cycleName(scope, task.cycleId)
          : Promise.resolve(null),
        relations.list(scope, task.id),
      ]);
      return {
        scope,
        task,
        options,
        cycleName,
        projectName: project.name,
        projectArchived: Boolean(project.archived_at),
        dependencies,
      };
    },
    save: tasks.save,
    setArchived: tasks.setArchived,
    createDependency: (scope: TaskScope, draft: TaskDependencyDraft) =>
      relations.create(scope, draft),
    removeDependency: (scope: TaskScope, relation: TaskRelationRecord) =>
      relations.remove(scope, relation),
  };
}

export const taskDetailRepository = createTaskDetailRepository();
