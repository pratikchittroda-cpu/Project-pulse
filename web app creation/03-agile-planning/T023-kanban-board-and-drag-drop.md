# T023 — Kanban Board and Drag-and-Drop

## Status

Planned

## Depends on

`T006`, `T021`.

## Unblocks

`T027`, `T031`, `T064`.

## Goal

Build the interactive board that combines manual planning state with live task signals.

## Owned paths

- Board page
- Board columns and cards
- Board filters shell
- Drag-and-drop behavior

## Implementation steps

1. Group tasks by workflow status.
2. Render task cards with priority, estimate, assignee, CI, PR, and presence slots.
3. Add drag-and-drop status changes.
4. Add optimistic updates with rollback on failure.
5. Add WIP-limit indicators.
6. Add keyboard-accessible movement.

## Acceptance criteria

- [ ] Tasks appear in the correct status column.
- [ ] Authorized users can move tasks.
- [ ] Failed updates restore the previous state.
- [ ] Board cards have useful compact and expanded content.
- [ ] Board is usable without a mouse.
- [ ] Board works on small screens.

## Verification

- Test status movement and rollback.
- Test viewer and unauthorized behavior.
- Test keyboard and responsive behavior.

## Handoff

Record board state model, card extension points, WIP behavior, and drag-and-drop library assumptions.

## Commit

`T023: build kanban board`
