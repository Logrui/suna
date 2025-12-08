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

You **MUST** consider the user input before proceeding (if not empty).

## Goal
Decompose the Implementation Plan into atomic, dependency-ordered tasks executable by a builder agent.

## Note
Tasks must be granular enough (one file per task ideally) to prevent the downstream implementation agents from getting overwhelmed.

## Outline
1.  **Parse Input**: Identify Feature Name.
2.  **Verify Context**: Ensure `implementation_plan.md` exists. Use absolute paths.
3.  **Task Generation Logic**:
    *   **Goal**: Translate "Morph Strategies" and "Bridge Adapters" into executable `T###` tasks.
    *   **Critical Constraint**: Tasks MUST be atomic. An agent should be able to execute one task without asking for clarification.

4.  **Task Format Rules (REQUIRED)**:
    *   Every task MUST strictly follow this format:
        ```text
        - [ ] [TaskID] [Phase] [P?] Description with file path/script
        ```
    *   **Components**:
        *   `[TaskID]`: Sequential (T001, T002...).
        *   `[Phase]`: The execution phase (Ingest, Adapt, Morph, Verify).
        *   `[P?]`: Include `[P]` ONLY if task is parallelizable (no dependencies on preceding incomplete tasks).
        *   **Description**: Clear action with exact file path or script command.

    *   **Examples**:
        *   ✅ `- [ ] T001 [Ingest] Run fetch-upstream script for tag v1.0`
        *   ✅ `- [ ] T005 [Adapt] [P] Create shim for @/lib/auth at src/lib/auth-shim.ts`
        *   ✅ `- [ ] T010 [Morph] [P] Run extract-region script on src/components/Sidebar.tsx`
        *   ❌ `- [ ] Create auth shim` (Missing ID, Phase, Path)

5.  **Draft `tasks.md`**:
    *   **Phase 1: Ingestion (Setup)**:
        *   `- [ ] T001 [Ingest] Fetch upstream dependencies (Recommend: fetch-upstream script)`
        *   `- [ ] T002 [Ingest] Sanitize code (Recommend: sanitize-upstream script)`
    
    *   **Phase 2: Adapters (Foundational)**:
        *   Blocking tasks. Create usage of "Bridge Adapters" defined in plan.
        *   Example: `- [ ] T003 [Adapt] Create Auth Shim at ...`

    *   **Phase 3: Integration (Morphing)**:
        *   Per-component tasks from the Plan's "Morph Strategy".
        *   *Parallelism*: Distinct components are usually `[P]`.
        *   *Tooling*: Recommend `extract-region` for complex merges.
        *   *Agent Discretion*: If a file is small, Manual Edit is fine.

    *   **Phase 4: Verification**:
        *   `- [ ] T900 [Verify] Run verify-project.py`
        *   `- [ ] T901 [Verify] Run portkit.verify workflow`

6.  **Output**:
    *   Write to: `.portkit/specs/[feature]/tasks.md`.
    *   *Self-Correction*: Ensure no tasks are ambiguous. Every task must mention a specific file or script.

7.  **Completion**:
    *   Report task count.
    *   **Recommendation**: Suggest the user runs `/portkit.implement` to begin code modification.
