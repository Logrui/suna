---
description: Entry point for Portkit. Initialize agent memory/constitution (`agent.md`, `gemini.md`) to be aware of Portkit structure.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1.  **Welcome**: Acknowledge that this is the **Portkit** initialization workflow (Speckit for Upstream Sync).
2.  **Verify Structure**: Check for existence of core Portkit files:
    *   `.portkit/README.md`
    *   `.portkit/addon-features-registry/addon-features-registry.json`
    *   `.portkit/scripts/` (Ensure contents exist)
    *   `.portkit/templates/` (Ensure spec-template, etc. exist)

3.  **Update Agent Memory/Constitution**:
    *   Locate the active memory file (e.g., `.agent/memory/agent.md`, `repo root/Claude.md`, or `repo root/AGENTS.md`or create if missing).
    *   **Action**: Append or Update a standard `## Portkit Awareness` section.
    *   **Content to Inject**:
        ```markdown
        ## Portkit Awareness
        This repository uses **Portkit** for syncing upstream features to this soft-fork.
        - **Strategy**: `.portkit/README.md` (Read this first for any Portkit task).
        - **Registry**: `.portkit/addon-features-registry/addon-features-registry.json` (Source of Truth for features).
        - **Tools**: `.portkit/scripts/` (Use `uv run scripts/python/script.py` or `npx ts-node scripts/typescript/script.ts`).
        - **Workflow**: Specify -> Research -> Plan -> Tasks -> Implement -> Verify.
        ```
    *   *Validation**: Ensure this section doesn't duplicate.

4.  **Registry Sanity Check**:
    *   Read `.portkit/addon-features-registry/addon-features-registry.json`.
    *   If valid JSON: Report "Registry Online".
    *   If invalid/missing: Warn user and suggest running `/portkit.update.registry` immediately.

5.  **Completion**: Report status and suggest running `/portkit.specify`.