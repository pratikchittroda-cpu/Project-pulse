# T064 — Analytics Dashboard and Reports

## Status

Planned

## Depends on

`T061`, `T062`, `T063`.

## Unblocks

`T072`, `T084`, `T093`.

## Goal

Present project health metrics in an actionable, explainable dashboard.

## Implementation steps

1. Add project health summary.
2. Add scope, delivery, review, CI, and deployment sections.
3. Add date-range and sprint filters.
4. Add drill-down links to tasks and events.
5. Add exportable reports.
6. Add loading, stale-data, and permission states.

## Acceptance criteria

- [ ] Every metric has a label, definition, and time range.
- [ ] Warnings explain their cause.
- [ ] Users can navigate from a metric to underlying work.
- [ ] Dashboard is readable on mobile.
- [ ] Reports do not expose unauthorized project data.

## Verification

- Test metric rendering with known fixtures.
- Test filters, exports, and role restrictions.

## Handoff

Record dashboard routes, report formats, metric definitions, and known data gaps.

## Commit

`T064: build analytics dashboard`
