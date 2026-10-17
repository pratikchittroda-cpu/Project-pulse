# T085 — AI Summaries and Risk Assistant

## Status

Planned

## Depends on

`T084`.

## Unblocks

Future AI capabilities.

## Goal

Provide useful, source-linked summaries without allowing unreviewed destructive actions.

## Capabilities

- Task and PR summaries
- Sprint summaries
- Scope explanations
- Risk explanations
- Release-note drafts
- Natural-language project questions

## Implementation steps

1. Add read-only assistant interactions.
2. Cite tasks, events, PRs, and metrics.
3. Add explicit confirmation for any mutation.
4. Add response fallback when data is incomplete.
5. Add usage and error telemetry without storing sensitive prompts by default.

## Acceptance criteria

- [ ] Answers are grounded in accessible ProjectPulse records.
- [ ] Unsupported claims are identified as unknown.
- [ ] Mutations require explicit confirmation.
- [ ] Users can disable AI per organization or project.
- [ ] Responses link to evidence.

## Verification

- Test correct, incomplete, conflicting, and unauthorized context.
- Test mutation confirmation boundaries.

## Handoff

Record supported prompts, provider behavior, citation format, and known limitations.

## Commit

`T085: add AI summaries and risk assistant`
