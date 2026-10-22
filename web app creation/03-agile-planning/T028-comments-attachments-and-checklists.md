# T028 — Comments, Attachments, and Checklists

## Status

Done

## Depends on

`T022`, `T011`, `T013`.

## Unblocks

Collaboration and AI summaries.

## Goal

Give teams a structured place to discuss work and track task completion details.

## Owned paths

- Comment components and mutations
- Mentions
- Attachment metadata and upload flow
- Checklist model and UI

## Implementation steps

1. Add task comments with author-controlled edit and soft-delete behavior.
2. Add project-member mentions with notification-hook events.
3. Upload attachment metadata and files to protected storage.
4. Add checklists with completion tracking independent of task status.
5. Record comment, attachment, and checklist history events with safe tombstones.

## Acceptance criteria

- [x] Authorized members can comment.
- [x] Mentions resolve only to project members.
- [x] Attachments are protected by project access.
- [x] Checklists update task detail without changing task status automatically.
- [x] Deleted content is represented safely in history.

## Verification

- Test storage access, path rules, file type/size limits, and signed URLs.
- Test mention scope, author ownership, viewer/archived permissions, checklist
  behavior, and safe deleted-content history.

## Handoff

- Comments are stored in the existing `comments` table with `deleted_at`,
  `deleted_by`, and `edit_version`. Deletes retain a tombstone and redact body
  content from repository/timeline responses; threaded replies were not added
  because the current model has no parent-comment field.
- Mention IDs are checked against `project_memberships`. Mention events contain
  recipient IDs and a `task_comment_mention` notification hook; delivery is left
  to a later event consumer.
- Attachments use the private `projectpulse-attachments` bucket, signed URLs,
  organization/project/task-prefixed paths, an allowlist for PDF, ZIP, GIF, JPEG,
  PNG, WEBP, Markdown, and plain text, and a 10 MiB maximum.
- Checklist items are project/task scoped, ordered by position, and toggle
  completion without mutating task workflow status. Viewers and archived projects
  retain read access but no mutation controls.

## Commit

`T028: add comments attachments and checklists`
