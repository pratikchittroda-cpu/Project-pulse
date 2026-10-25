# T072 — Sprint Digests and Release Notes

## Status

Planned

## Depends on

`T061`, `T064`, `T070`.

## Unblocks

Team review workflows.

## Goal

Turn verified ReleaseArc events into useful sprint and release summaries.

## Implementation steps

1. Summarize completed, carried-over, and added work.
2. Include scope and delivery health.
3. Include merged PRs and deployments.
4. Allow users to edit before publishing.
5. Send through configured channels.

## Acceptance criteria

- [ ] Summaries distinguish completed from merged and deployed.
- [ ] Scope changes are visible.
- [ ] Users can review and edit generated content.
- [ ] Source links are included.
- [ ] Digest generation respects project access.

## Verification

- Test known sprint and release fixtures.
- Test permission and notification preferences.

## Handoff

Record digest fields, source queries, edit flow, and delivery behavior.

## Commit

`T072: add sprint digests and release notes`
