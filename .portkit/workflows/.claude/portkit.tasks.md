---
description: Decompose Portkit strategies into atomic, dependency-ordered tasks. Generates `tasks.md`.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To decompose the `implementation_plan.md` into atomic, executable tasks (`T###`) that a Builder Agent can strictly follow.

## Operating Constraints
*   **Granularity**: Each task must be doable in one turn.
*   **Format**: `- [ ] [TaskID] [Phase] Description`.

## Execution Steps
1.  **Parse Plan**:
    *   Read `implementation_plan.md`.
    *   Extract "Bridge Adapters" and "Morph Strategies".

2.  **Generate Tasks**:
    *   **Phase 1 (Ingestion)**: Tasks for `fetch-upstream` scripts.
    *   **Phase 2 (Adapters)**: Tasks to create Shims.
    *   **Phase 3 (Integration)**: Per-file tasks for `extract`, `copy`, `inject`.
    *   **Phase 4 (Verify)**: Verification script tasks.

3.  **Output**:
    *   Write to `.portkit/specs/[feature]/tasks.md`.
    *   Verify no duplicate IDs.

4.  **Report**:
    *   Confirm Task List created.
    *   Handoff to `/portkit.implement`.
