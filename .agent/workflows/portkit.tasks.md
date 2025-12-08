---
description: Decompose Portkit strategies into atomic, dependency-ordered tasks. Generates `tasks.md`.
handoffs:
  - label: Implement Feature
    agent: portkit.implement
    prompt: Tasks ready at `specs/[feature]/tasks.md`. Begin code implementation.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1.  **Parse Input**: Identify Feature Name.
2.  **Verify Context**: Ensure `implementation_plan.md` exists. Use absolute paths.
3.  **Task Generation Logic**:
    *   **Goal**: Translate "Morph Strategies" and "Bridge Adapters" into `T###` tasks.
    *   **Strict Format**: `- [ ] [TaskID] [Phase] Description with file path`
    *   **Phase Definitions**:
        *   **Phase 1: Ingestion** (Scripts: Fetch, Map).
        *   **Phase 2: Adapters** (Creating Shims to block poison code).
        *   **Phase 3: Integration** (The Component Morphing -- Extract/Overwrite/Inject).
        *   **Phase 4: Verification** (Registry updates, Build check, Tests).

4.  **Draft `tasks.md`**:
    *   Read template: `.portkit/templates/tasks.md` (or standard structure).
    *   **Phase 1 Tasks**:
        *   `- [ ] T001 [Setup] Run fetch-upstream.py for [TargetRef]`
        *   `- [ ] T002 [Setup] Run sanitize-upstream.py configuration check`
    *   **Phase 2 Tasks (from Bridge Adapters)**:
        *   For each needed shim: `- [ ] T### [Adapter] Create [ShimFile] to replace [Dependency]`
    *   **Phase 3 Tasks (from Morph Strategy)**:
        *   For each component:
            *   `- [ ] T### [Morph] Run extract-region.py on [LocalFile]`
            *   `- [ ] T### [Morph] Copy [UpstreamFile] to [LocalFile] (Overwrite)`
            *   `- [ ] T### [Morph] Re-inject extracted regions into [LocalFile]`
    *   **Phase 4 Tasks**:
        *   `- [ ] T900 [Verify] Run verify-project.py`
        *   `- [ ] T901 [Verify] Run portkit.verify workflow`

5.  **Output**:
    *   Write to: `.portkit/specs/[feature]/tasks.md`.
    *   *Self-Correction*: Ensure no tasks are ambiguous. Every task must mention a specific file or script.

6.  **Completion**: Report task count and handoff to `/portkit.implement`.
