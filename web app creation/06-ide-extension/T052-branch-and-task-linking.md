# T052 — Branch and Task Linking

## Status

Planned

## Depends on

`T051`, `T043`.

## Unblocks

`T056`, automatic task activity.

## Goal

Map the current local Git branch to a ReleaseArc task.

## Owned paths

- Git branch detection
- Task-linking commands
- Branch status UI
- Extension-to-dashboard link behavior

## Implementation steps

1. Detect the current repository and branch.
2. Parse task keys from the branch.
3. Resolve matching tasks through the API.
4. Support manual task selection.
5. React to branch changes.
6. Show ambiguity and no-match states.

## Acceptance criteria

- [ ] A matching branch links to the correct task.
- [ ] Branch changes update the linked task.
- [ ] Ambiguous keys require user selection.
- [ ] No-match branches do not create accidental tasks.
- [ ] The user can unlink or change the current task.

## Verification

- Test branch changes, detached HEAD, missing repository, and ambiguous keys.
- Test project access boundaries.

## Handoff

Record branch polling/event behavior, API calls, and task-link persistence rules.

## Commit

`T052: link IDE branches to tasks`
