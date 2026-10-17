# T028 — Comments, Attachments, and Checklists

## Status

Planned

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

1. Add comments and threaded replies if supported by the chosen model.
2. Add member mentions with notification hooks.
3. Upload attachments to protected storage.
4. Add checklists with completion tracking.
5. Record edit and delete events.

## Acceptance criteria

- [ ] Authorized members can comment.
- [ ] Mentions resolve only to project members.
- [ ] Attachments are protected by project access.
- [ ] Checklists update task detail without changing task status automatically.
- [ ] Deleted content is represented safely in history.

## Verification

- Test storage access and file type/size limits.
- Test mention and permission behavior.

## Handoff

Record storage bucket rules, upload limits, mention events, and moderation assumptions.

## Commit

`T028: add comments attachments and checklists`
