import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261021040000_t027_search_filters_saved_views.sql",
  "utf8",
);
const databaseTests = readFileSync("supabase/saved-view-tests.sql", "utf8");

describe("saved task view database contract", () => {
  it("keeps saved views scoped to the current user and accessible project", () => {
    expect(migration).toContain("create table public.task_saved_views");
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain(
      "public.can_access_project(project_id, organization_id)",
    );
    expect(migration).toContain("task_saved_views_update");
    expect(migration).toContain("task_saved_views_delete");
  });

  it("covers saved-view readback and permission boundaries in SQL", () => {
    expect(databaseTests).toContain(
      "saved view readback lost its name or filters",
    );
    expect(databaseTests).toContain(
      "saved view owner data leaked to another user",
    );
    expect(databaseTests).toContain(
      "viewer created a saved view in an inaccessible project",
    );
    expect(databaseTests).toContain("saved view delete did not persist");
  });
});
