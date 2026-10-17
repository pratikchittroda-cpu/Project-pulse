import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TASK_PRIORITIES,
  DEFAULT_TASK_STATUSES,
  formatTaskKey,
  isProjectKey,
  isTaskKey,
} from "@projectpulse/domain";

const migration = readFileSync(
  "supabase/migrations/20261017030000_task_domain_and_workflow.sql",
  "utf8",
);

describe("task domain and identity", () => {
  it("formats stable task keys and rejects unsafe identity values", () => {
    expect(formatTaskKey("pulse", 42)).toBe("PULSE-42");
    expect(formatTaskKey("API2", 7)).toBe("API2-7");
    expect(isProjectKey("PULSE")).toBe(true);
    expect(isProjectKey("pulse-1")).toBe(false);
    expect(isTaskKey("PULSE-42")).toBe(true);
    expect(isTaskKey("PULSE-0")).toBe(false);
    expect(() => formatTaskKey("too-long-key", 42)).toThrow(RangeError);
    expect(() => formatTaskKey("PULSE", 0)).toThrow(RangeError);
  });

  it("publishes default workflow values for extensible project configuration", () => {
    expect(DEFAULT_TASK_STATUSES).toEqual([
      "backlog",
      "planned",
      "in_progress",
      "blocked",
      "in_review",
      "changes_requested",
      "ready_to_merge",
      "completed",
      "canceled",
    ]);
    expect(DEFAULT_TASK_PRIORITIES).toEqual([
      "urgent",
      "high",
      "medium",
      "low",
    ]);
  });

  it("keeps task numbering concurrent-safe and identity immutable at the database boundary", () => {
    expect(migration).toContain("create table public.project_task_sequences");
    expect(migration).toContain(
      "create table public.project_workflow_statuses",
    );
    expect(migration).toContain(
      "create or replace function public.reserve_task_number",
    );
    expect(migration).toContain("tasks_assign_task_number");
    expect(migration).toContain("Task identity cannot change after creation");
    expect(migration).toContain(
      "Project key cannot change after tasks are created",
    );
    expect(migration).toContain("tasks_workflow_status_fkey");
  });
});
