---
description: Execute the Portkit implementation tasks.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To execute the generated tasks in `tasks.md` sequentially, marking them complete upon success.

## Operating Constraints
*   **Gate Check**: Do not start if Checklists in `implementation_plan.md` are incomplete.
*   **Sequential**: Must follow dependency order.

## Execution Steps
1.  **Gate Check**:
    *   Verify `implementation_plan.md` checklists are passed.

2.  **Execution Loop**:
    *   Find first unchecked task `[ ] T###`.
    *   **Execute**: Run script or apply code edit.
    *   **Mark**: Change `[ ]` to `[x]`.
    *   **Repeat**.

3.  **Error Handling**:
    *   If task fails, retry once (self-correction).
    *   If fail again, Stop and Report.

4.  **Report**:
    *   Upon 100% completion, trigger `/portkit.verify`.
