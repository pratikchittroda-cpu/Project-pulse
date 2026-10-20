import type {
  EpicRecord,
  InitiativeRecord,
  MilestoneRecord,
  RoadmapData,
} from "../apps/web/src/features/roadmap/roadmap-repository.js";
import { taskDetailFixture } from "./task-fixtures.js";

export function roadmapFixture(
  overrides: Partial<RoadmapData> = {},
): RoadmapData {
  const { scope } = taskDetailFixture();
  const initiative: InitiativeRecord = {
    id: "initiative-1",
    organizationId: scope.organizationId,
    name: "Platform reliability",
    description: "Make delivery safer.",
    status: "active",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  };
  const epic: EpicRecord = {
    id: "epic-1",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    initiativeId: initiative.id,
    title: "Release confidence",
    description: "Reduce delivery risk.",
    status: "active",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  };
  const milestone: MilestoneRecord = {
    id: "milestone-1",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    name: "Beta release",
    targetDate: "2026-10-19",
    status: "active",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  };
  return {
    initiatives: [initiative],
    epics: [epic],
    milestones: [milestone],
    ...overrides,
  };
}
