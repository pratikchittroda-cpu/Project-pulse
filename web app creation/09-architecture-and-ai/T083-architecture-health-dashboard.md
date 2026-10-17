# T083 — Architecture Health Dashboard

## Status

Planned

## Depends on

`T080`, `T081`, `T082`.

## Unblocks

`T084`.

## Goal

Combine code, dependency, build, and test signals into an explainable architecture-health view.

## Implementation steps

1. Add repository health summary.
2. Add hotspot, dependency, build, test, and security sections.
3. Add drill-down links to source events.
4. Add severity and freshness indicators.
5. Avoid reducing architecture health to one unexplained score.

## Acceptance criteria

- [ ] Each warning identifies evidence and source.
- [ ] Data freshness is visible.
- [ ] Users can drill down to repository events.
- [ ] Sensitive paths and findings respect access rules.
- [ ] The dashboard works when one signal source is unavailable.

## Verification

- Test partial data and stale source behavior.
- Test project and repository permissions.

## Handoff

Record dashboard sections, health definitions, freshness policy, and missing-source behavior.

## Commit

`T083: build architecture health dashboard`
