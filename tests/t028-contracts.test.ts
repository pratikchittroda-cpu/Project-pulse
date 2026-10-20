import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261021050000_t028_comments_attachments_checklists.sql",
  "utf8",
);
const databaseTests = readFileSync(
  "supabase/t028-collaboration-tests.sql",
  "utf8",
);

describe("T028 collaboration database contract", () => {
  it("protects comments, mentions, checklist rows, and attachment storage", () => {
    expect(migration).toContain(
      "create or replace function public.manage_task_comment",
    );
    expect(migration).toContain("Mentions must target project members");
    expect(migration).toContain("task.comment_mentioned");
    expect(migration).toContain("contentState', 'redacted'");
    expect(migration).toContain("create table public.task_checklist_items");
    expect(migration).toContain("register_task_attachment");
    expect(migration).toContain("attachments_byte_size_limit_check");
    expect(migration).toContain("projectpulse-attachments");
    expect(migration).toContain(
      "public.can_access_project(path.project_id, path.organization_id)",
    );
  });

  it("covers the requested database permission and history boundaries", () => {
    for (const assertion of [
      "comment edit did not increment history version",
      "non-member mention unexpectedly succeeded",
      "deleted comment history exposed body",
      "checklist changed task status",
      "oversized attachment unexpectedly succeeded",
      "viewer attachment read was denied",
      "archived comment write unexpectedly succeeded",
    ]) {
      expect(databaseTests).toContain(assertion);
    }
  });
});
