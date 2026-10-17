# T043 — Task-Key Parser and Link Resolver

## Status

Planned

## Depends on

`T020`, `T042`.

## Unblocks

`T045`, `T052`.

## Goal

Resolve task keys from branches, commits, pull requests, and related provider text.

## Owned paths

- Task-key parser package
- Link-resolution rules
- Ambiguity and missing-key handling
- Parser tests

## Supported examples

```text
PULSE-42
feature/PULSE-42-auth
fix(PULSE-42): rotate expired tokens
[PULSE-42] Improve refresh handling
```

## Acceptance criteria

- [ ] Keys are case-normalized according to project rules.
- [ ] Branches, commits, PR titles, and PR descriptions can be parsed.
- [ ] Keys from another project are not linked accidentally.
- [ ] Multiple matches are handled explicitly.
- [ ] Manual linking can resolve a missing key.

## Verification

- Test valid, invalid, multiple, and malformed key strings.
- Test repository and project boundaries.

## Handoff

Record parsing regex, normalization behavior, ambiguous-match behavior, and supported provider fields.

## Commit

`T043: parse and resolve task keys`
