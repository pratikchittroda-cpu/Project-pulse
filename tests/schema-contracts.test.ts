import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261017000000_initial_schema.sql",
  "utf8",
);

describe("initial database schema contract", () => {
  it("contains the organization, planning, event, and audit boundaries", () => {
    for (const table of [
      "organizations",
      "organization_memberships",
      "teams",
      "team_memberships",
      "projects",
      "repositories",
      "integrations",
      "cycles",
      "initiatives",
      "epics",
      "milestones",
      "tasks",
      "task_relations",
      "task_events",
      "comments",
      "attachments",
      "webhook_events",
      "audit_records",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }
  });

  it("protects time, task identity, webhook idempotency, and RLS requirements", () => {
    expect(migration).toContain("timestamptz not null");
    expect(migration).toContain("unique (project_id, task_number)");
    expect(migration).toContain("unique (provider, provider_event_id)");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("public.set_updated_at()");
  });
});
