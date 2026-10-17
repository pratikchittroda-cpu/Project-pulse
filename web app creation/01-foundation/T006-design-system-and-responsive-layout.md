# T006 — Design System and Responsive Layout

## Status

Planned

## Depends on

`T005`.

## Unblocks

All feature UI tasks.

## Goal

Create consistent, accessible UI primitives for the ProjectPulse dashboard.

## Owned paths

- `packages/ui/`
- Shared Tailwind configuration
- Shared icons and status tokens
- Responsive layout primitives

## Implementation steps

1. Define neutral, accent, success, warning, and danger tokens.
2. Build buttons, inputs, cards, dialogs, tabs, badges, menus, tables, and toasts.
3. Build responsive page and panel layouts.
4. Define priority and task-status visual rules.
5. Add keyboard and focus behavior.

## Acceptance criteria

- [ ] Components are reusable from the web app.
- [ ] Status is not communicated by color alone.
- [ ] Components have keyboard-accessible states.
- [ ] Layout works on mobile, tablet, and desktop.
- [ ] Feature sessions do not need to create duplicate primitives.

## Verification

- Add component tests for keyboard and error states.
- Run accessibility checks on representative components.

## Handoff

Record component names, import conventions, token names, and known gaps.

## Commit

`T006: add shared design system`
