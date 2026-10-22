# T006 — Design System and Responsive Layout

## Status

Done

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

- [x] Components are reusable from the web app.
- [x] Status is not communicated by color alone.
- [x] Components have keyboard-accessible states.
- [x] Layout works on mobile, tablet, and desktop.
- [x] Feature sessions do not need to create duplicate primitives.

## Verification

Completed verification:

- `corepack pnpm install --frozen-lockfile --offline --ignore-scripts`
  completed successfully from the committed lockfile.
- `make test` passed workspace validation, typechecking, linting, formatting,
  all workspace builds, route tests, workspace checks, and ten Vitest tests.
- `tests/ui-components.test.tsx` verifies input error semantics, visible
  status/icon pairing, keyboard tab movement, and Escape-key dialog dismissal
  in a jsdom accessibility-focused test environment.
- `corepack pnpm run build` completed the shared UI package build and the web
  Vite production bundle using the shared `@projectpulse/ui` package.

## Handoff

- Import reusable primitives and tokens from `@projectpulse/ui`; import its
  shared stylesheet with `@projectpulse/ui/styles.css` before app-specific
  styles. The web dashboard consumes `StatusBadge` as the first integration
  point.
- Exported primitives are `Button`, `Input`, `Card`, `CardHeader`,
  `CardTitle`, `CardDescription`, `CardContent`, `Badge`, `StatusBadge`,
  `PriorityBadge`, `Dialog`, `Tabs`, `TabPanel`, `Menu`, `DataTable`, `Toast`,
  and `PageLayout`.
- Tokens are exported from `tokens.ts`: `designTokens`, `statusTokens`,
  `priorityTokens`, `TaskStatus`, `TaskPriority`, and `StatusTone`. Status and
  priority badges pair visible text with Lucide icons so color is supplemental.
- `tailwind.preset.mjs` provides the shared neutral, accent, success, warning,
  and danger color tokens for future Tailwind consumers. Current primitives
  use framework-free CSS so the package remains usable by the Vite shell.
- Tabs implement roving focus with Arrow/Home/End keys; dialogs close with
  Escape and focus their close control; inputs expose described errors through
  `aria-invalid` and `role="alert"`. Responsive styles collapse page actions
  and tables without removing keyboard access.
- A full browser axe audit and visual regression suite remain part of T094;
  this task covers representative component semantics and keyboard behavior.
- T003, T007, and T050 remain ready for parallel work.

## Commit

`T006: add shared design system`
