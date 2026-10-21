import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261021060000_t033_in_app_notifications.sql",
  "utf8",
);
const databaseTests = readFileSync(
  "supabase/t033-notifications-tests.sql",
  "utf8",
);

describe("T033 in-app notifications database contract", () => {
  it("defines durable recipient-scoped notification storage and helpers", () => {
    for (const assertion of [
      "create table public.notifications",
      "unique (organization_id, recipient_user_id, dedupe_key)",
      "create policy notifications_select",
      "enqueue_notification_for_event",
      "dispatch_task_event_notifications",
      "list_unread_notifications",
      "mark_notification_read",
      "mark_all_notifications_read",
      "alter publication supabase_realtime add table public.notifications",
    ]) {
      expect(migration).toContain(assertion);
    }
  });

  it("covers scoping, duplicate delivery, read state, and viewer boundaries", () => {
    for (const assertion of [
      "mention notification was not created",
      "duplicate source event created another notification",
      "mark read did not persist",
      "mark all read left unread notifications",
      "viewer notification scoping returned",
      "outsider read project notifications",
      "authenticated notification insert unexpectedly succeeded",
    ]) {
      expect(databaseTests).toContain(assertion);
    }
  });
});
