import { describe, expect, it, vi } from "vitest";

import {
  createRoadmapRepository,
  validateEpicDraft,
  validateInitiativeDraft,
  validateMilestoneDraft,
} from "../apps/web/src/features/roadmap/roadmap-repository.js";
import { taskDetailFixture } from "./task-fixtures.js";

describe("roadmap validation", () => {
  it("normalizes hierarchy drafts and validates calendar dates", () => {
    expect(
      validateInitiativeDraft({
        name: " Platform ",
        description: "  Safer releases  ",
        status: "active",
      }),
    ).toEqual({
      name: "Platform",
      description: "Safer releases",
      status: "active",
    });
    expect(
      validateEpicDraft({
        title: " Release confidence ",
        description: "",
        initiativeId: "initiative-1",
        status: "planned",
      }),
    ).toEqual({
      title: "Release confidence",
      description: null,
      initiative_id: "initiative-1",
      status: "planned",
    });
    expect(
      validateMilestoneDraft({
        name: " Beta ",
        targetDate: "2026-11-01",
        status: "planned",
      }),
    ).toEqual({
      name: "Beta",
      target_date: "2026-11-01",
      status: "planned",
    });
    expect(() =>
      validateMilestoneDraft({
        name: "Beta",
        targetDate: "2026-02-30",
        status: "planned",
      }),
    ).toThrow(/valid milestone target date/);
  });
});

describe("roadmap repository", () => {
  it("loads every hierarchy page with tenant and project scopes", async () => {
    const rows = {
      initiatives: Array.from({ length: 101 }, (_, index) => ({
        id: `initiative-${index}`,
        organization_id: "organization-1",
        name: `Initiative ${index}`,
        description: null,
        status: "planned" as const,
        created_at: "2026-10-20T00:00:00.000Z",
        updated_at: "2026-10-20T00:00:00.000Z",
      })),
      epics: [],
      milestones: [],
    };
    const from = vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        range: vi.fn(async (start: number) => ({
          data:
            table === "initiatives"
              ? rows.initiatives.slice(start, start + 100)
              : [],
          error: null,
        })),
      };
      return query;
    });
    const repository = createRoadmapRepository({ from } as never);
    const data = await repository.list(taskDetailFixture().scope);
    expect(data.initiatives).toHaveLength(101);
    expect(from).toHaveBeenCalledWith("initiatives");
    expect(from).toHaveBeenCalledWith("epics");
    expect(from).toHaveBeenCalledWith("milestones");
  });
});
