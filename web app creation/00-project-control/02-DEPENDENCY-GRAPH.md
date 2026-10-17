# Dependency Graph

## Graph rules

- A task may start only when every listed dependency is `Done`.
- Tasks in separate branches may run in parallel when their owned paths do not overlap.
- A dependency is a product or technical contract, not merely a folder order.
- If a task discovers a missing contract, mark it `Blocked` rather than silently duplicating the contract.

## Foundation and access graph

```text
T001
 └── T002
      ├── T003
      ├── T004 ── T005 ── T006
      ├── T007
      └── T050

T010 ── T011 ── T012 ── T013 ── T014 ── T015
```

## Agile and realtime graph

```text
T015 ── T020 ── T021
                 ├── T022
                 ├── T023 ── T031
                 ├── T024 ── T025
                 ├── T026
                 ├── T027
                 └── T028

T020 + T007 + T011 ── T030 ── T032
                         ├── T031
                         └── T033
```

## GitHub graph

```text
T015 ── T040 ── T041 ── T042 ── T043
                         └────── T044 ── T045
T040 + T041 + T042 ── T046
```

## Extension graph

```text
T002 ── T050 ── T051 ── T052
                     └── T053 ── T054
                              └── T055 ── T056
```

## Analytics graph

```text
T030 + T053 ── T060
T060 + T024 ── T061
T060 + T044 ── T062
T060 + T044 ── T063
T061 + T062 + T063 ── T064
```

## Release graph

```text
T045 + T054 + T061 ── T093
T006 + T023 + T064 ── T094
T041 + T053 + T060 ── T091
T031 + T041 + T064 ── T092
T013 + T040 + T055 ── T090
T003 + T004 + T090 + T091 + T092 + T093 + T094 ── T095 ── T096
```
