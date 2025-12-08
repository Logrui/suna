---
description: Execute the Portkit implementation tasks.
handoffs:
  - label: Verify Implementation
    agent: portkit.verify
    prompt: Implementation complete. Proceed to verification.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1.  **Parse Input**: Identify Feature Name.
2.  **Verify Context**: Ensure `tasks.md` and `implementation_plan.md` exist.

3.  **Gate Check (Checklists)**:
    *   Scan `implementation_plan.md` (or `checklists/requirements_check.md`).
    *   If any unchecked items in the "Requirements Checklist", **STOP** and warn user.
    *   *Portkit Specific*: Verify `research.md` confirms Upstream Ref is valid.

4.  **Execution Loop**:
    *   Read `tasks.md`.
    *   Identify next unchecked task `[ ] T###`.
    *   **Execute**:
        *   **If Script**: Run the specified `uv run ...` or `npx ts-node ...` command.
        *   **If Code**: Open the file, apply changes (Shim, Morph, Inject).
        *   **If Manual**: Ask user or skip (if marked optional).
    *   **Mark Complete**: Update `tasks.md` entry to `[x] T###`.
    *   *Progress*: Report back to user after every Phase completion.

5.  **Error Handling**:
    *   If a task fails (script error, compile error):
        *   Attempt self-correction (1 retry).
        *   If still failing, **Stop** and ask User for intervention. Do not blindly leverage hallucinations.

6.  **Completion**:
    *   When all tasks are `[x]`, run a quick `verify-project` check.
    *   Handoff to `/portkit.verify`.
