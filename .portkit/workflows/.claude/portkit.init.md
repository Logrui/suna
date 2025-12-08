---
description: Entry point for Portkit. Initialize agent memory to be aware of Portkit structure.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To initialize the Claude environment with "Portkit Awareness", ensuring subsequent interactions understand the `.portkit` structure and workflow.

## Operating Constraints
*   **Context Awareness**: Must not hallucinate files. Verify existence of Strategy and Registry.
*   **Memory Update**: If `Claude.md` or `AGENTS.md` exists, append context.

## Execution Steps
1.  **Verify Structure**:
    *   Check for `.portkit/UPSTREAM_SYNC_STRATEGY.md`.
    *   Check for `.portkit/addon-features-registry/addon-features-registry.json`.

2.  **Update Memory**:
    *   Locate `Claude.md` (or similar project rule file).
    *   Append `## Portkit Awareness` section referencing the Strategy and Registry paths.

3.  **Report**:
    *   Confirm initialization.
    *   List key paths found.
    *   Recommend running `/portkit.specify` to start a feature.
