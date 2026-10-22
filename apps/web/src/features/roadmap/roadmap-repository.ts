import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "../../app/auth-client.js";
import type { TaskScope } from "../tasks/task-repository.js";

export type RoadmapStatus = "planned" | "active" | "completed" | "canceled";

export interface InitiativeRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: RoadmapStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EpicRecord {
  id: string;
  organizationId: string;
  projectId: string;
  initiativeId: string | null;
  title: string;
  description: string | null;
  status: RoadmapStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneRecord {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  targetDate: string | null;
  status: RoadmapStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeDraft {
  name: string;
  description: string;
  status: RoadmapStatus;
}

export interface EpicDraft {
  title: string;
  description: string;
  initiativeId: string | null;
  status: RoadmapStatus;
}

export interface MilestoneDraft {
  name: string;
  targetDate: string;
  status: RoadmapStatus;
}

export interface RoadmapData {
  initiatives: InitiativeRecord[];
  epics: EpicRecord[];
  milestones: MilestoneRecord[];
}

export interface RoadmapRepository {
  list(scope: TaskScope): Promise<RoadmapData>;
  createInitiative(
    scope: TaskScope,
    draft: InitiativeDraft,
  ): Promise<InitiativeRecord>;
  editInitiative(
    scope: TaskScope,
    item: InitiativeRecord,
    draft: InitiativeDraft,
  ): Promise<InitiativeRecord>;
  createEpic(scope: TaskScope, draft: EpicDraft): Promise<EpicRecord>;
  editEpic(
    scope: TaskScope,
    item: EpicRecord,
    draft: EpicDraft,
  ): Promise<EpicRecord>;
  createMilestone(
    scope: TaskScope,
    draft: MilestoneDraft,
  ): Promise<MilestoneRecord>;
  editMilestone(
    scope: TaskScope,
    item: MilestoneRecord,
    draft: MilestoneDraft,
  ): Promise<MilestoneRecord>;
}

interface InitiativeRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: RoadmapStatus;
  created_at: string;
  updated_at: string;
}

interface EpicRow {
  id: string;
  organization_id: string;
  project_id: string;
  initiative_id: string | null;
  title: string;
  description: string | null;
  status: RoadmapStatus;
  created_at: string;
  updated_at: string;
}

interface MilestoneRow {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  target_date: string | null;
  status: RoadmapStatus;
  created_at: string;
  updated_at: string;
}

const initiativeColumns =
  "id, organization_id, name, description, status, created_at, updated_at";
const epicColumns =
  "id, organization_id, project_id, initiative_id, title, description, status, created_at, updated_at";
const milestoneColumns =
  "id, organization_id, project_id, name, target_date, status, created_at, updated_at";
const statuses: RoadmapStatus[] = [
  "planned",
  "active",
  "completed",
  "canceled",
];

function errorMessage(error: { code?: string; message: string }) {
  if (error.code === "42501")
    return new Error(
      "You no longer have permission to change this roadmap. Reload to check your access.",
    );
  if (error.code === "PGRST116" || error.code === "40001")
    return new Error(
      "This roadmap item changed or is no longer available. Reload the roadmap before trying again.",
    );
  if (error.code === "23503")
    return new Error(
      "The selected initiative or project is no longer available. Reload the roadmap and choose again.",
    );
  if (
    error.code === "23514" ||
    error.code === "22007" ||
    error.code === "22008"
  )
    return new Error(
      "Check the roadmap name, status, and target date. " + error.message,
    );
  return new Error(error.message || "Could not load or save the roadmap.");
}

function parseDate(value: string, label: string) {
  if (!value) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000") ||
    !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Choose a valid ${label}.`);
  }
  return value;
}

function statusValue(value: string): RoadmapStatus {
  if (!statuses.includes(value as RoadmapStatus))
    throw new Error("Choose a valid roadmap status.");
  return value as RoadmapStatus;
}

function requiredText(value: string, label: string, maximum: number) {
  const text = value.trim();
  if (!text || text.length > maximum)
    throw new Error(`Use a ${label} between 1 and ${maximum} characters.`);
  return text;
}

export function validateInitiativeDraft(draft: InitiativeDraft) {
  return {
    name: requiredText(draft.name, "initiative name", 200),
    description: draft.description.trim() || null,
    status: statusValue(draft.status),
  };
}

export function validateEpicDraft(draft: EpicDraft) {
  return {
    title: requiredText(draft.title, "epic title", 240),
    description: draft.description.trim() || null,
    initiative_id: draft.initiativeId || null,
    status: statusValue(draft.status),
  };
}

export function validateMilestoneDraft(draft: MilestoneDraft) {
  return {
    name: requiredText(draft.name, "milestone name", 200),
    target_date: parseDate(draft.targetDate, "milestone target date"),
    status: statusValue(draft.status),
  };
}

function toInitiative(row: InitiativeRow): InitiativeRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEpic(row: EpicRow): EpicRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    initiativeId: row.initiative_id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMilestone(row: MilestoneRow): MilestoneRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    name: row.name,
    targetDate: row.target_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createRoadmapRepository(
  client: SupabaseClient = supabase,
): RoadmapRepository {
  async function listPaged<T>(
    queryFactory: (
      from: number,
      to: number,
    ) => PromiseLike<{
      data: T[] | null;
      error: { code?: string; message: string } | null;
    }>,
  ) {
    const rows: T[] = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await queryFactory(offset, offset + pageSize - 1);
      if (error) throw errorMessage(error);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) return rows;
    }
  }

  async function write<T>(
    operation: PromiseLike<{
      data: T | null;
      error: { code?: string; message: string } | null;
    }>,
  ) {
    const { data, error } = await operation;
    if (error) throw errorMessage(error);
    if (!data)
      throw new Error(
        "The roadmap change was not returned. Reload the roadmap.",
      );
    return data;
  }

  return {
    async list(scope) {
      const [initiatives, epics, milestones] = await Promise.all([
        listPaged<InitiativeRow>((from, to) =>
          client
            .from("initiatives")
            .select(initiativeColumns)
            .eq("organization_id", scope.organizationId)
            .order("updated_at", { ascending: false })
            .order("id")
            .range(from, to),
        ),
        listPaged<EpicRow>((from, to) =>
          client
            .from("epics")
            .select(epicColumns)
            .eq("organization_id", scope.organizationId)
            .eq("project_id", scope.projectId)
            .order("updated_at", { ascending: false })
            .order("id")
            .range(from, to),
        ),
        listPaged<MilestoneRow>((from, to) =>
          client
            .from("milestones")
            .select(milestoneColumns)
            .eq("organization_id", scope.organizationId)
            .eq("project_id", scope.projectId)
            .order("target_date", { ascending: true, nullsFirst: false })
            .order("id")
            .range(from, to),
        ),
      ]);
      return {
        initiatives: initiatives.map(toInitiative),
        epics: epics.map(toEpic),
        milestones: milestones.map(toMilestone),
      };
    },
    async createInitiative(scope, draft) {
      return toInitiative(
        await write<InitiativeRow>(
          client
            .from("initiatives")
            .insert({
              organization_id: scope.organizationId,
              ...validateInitiativeDraft(draft),
            })
            .select(initiativeColumns)
            .single<InitiativeRow>(),
        ),
      );
    },
    async editInitiative(scope, item, draft) {
      return toInitiative(
        await write<InitiativeRow>(
          client
            .from("initiatives")
            .update(validateInitiativeDraft(draft))
            .eq("organization_id", scope.organizationId)
            .eq("id", item.id)
            .eq("updated_at", item.updatedAt)
            .select(initiativeColumns)
            .single<InitiativeRow>(),
        ),
      );
    },
    async createEpic(scope, draft) {
      return toEpic(
        await write<EpicRow>(
          client
            .from("epics")
            .insert({
              organization_id: scope.organizationId,
              project_id: scope.projectId,
              ...validateEpicDraft(draft),
            })
            .select(epicColumns)
            .single<EpicRow>(),
        ),
      );
    },
    async editEpic(scope, item, draft) {
      return toEpic(
        await write<EpicRow>(
          client
            .from("epics")
            .update(validateEpicDraft(draft))
            .eq("organization_id", scope.organizationId)
            .eq("project_id", scope.projectId)
            .eq("id", item.id)
            .eq("updated_at", item.updatedAt)
            .select(epicColumns)
            .single<EpicRow>(),
        ),
      );
    },
    async createMilestone(scope, draft) {
      return toMilestone(
        await write<MilestoneRow>(
          client
            .from("milestones")
            .insert({
              organization_id: scope.organizationId,
              project_id: scope.projectId,
              ...validateMilestoneDraft(draft),
            })
            .select(milestoneColumns)
            .single<MilestoneRow>(),
        ),
      );
    },
    async editMilestone(scope, item, draft) {
      return toMilestone(
        await write<MilestoneRow>(
          client
            .from("milestones")
            .update(validateMilestoneDraft(draft))
            .eq("organization_id", scope.organizationId)
            .eq("project_id", scope.projectId)
            .eq("id", item.id)
            .eq("updated_at", item.updatedAt)
            .select(milestoneColumns)
            .single<MilestoneRow>(),
        ),
      );
    },
  };
}

export const roadmapRepository = createRoadmapRepository();
