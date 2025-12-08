---
description: Entry point for Portkit. Initialize agent memory/constitution (`agent.md`, `gemini.md`) to be aware of Portkit structure.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal
Initialize Portkit for agent memory files such as `agent.md`, `gemini.md`, `AGENTS.md`, etc. and the repository structure to support the Portkit workflow.

## Note
This should be run when portkit is installed or initialized in a directory or when the agent is amnesic to ensure it understands the Portkit conventions.

## Outline
1.  **Welcome**: Acknowledge that this is the **Portkit** initialization workflow (Speckit for Upstream Sync).
2.  **Verify Structure**: Check for existence of core Portkit files:
    *   `.portkit/README.md`
    *   `.portkit/addon-features-registry/feature-registry.json`
    *   `.portkit/scripts/` (Ensure contents exist)
    *   `.portkit/templates/` (Ensure spec-template, etc. exist)
    *   **Action**: Run `.portkit/scripts/powershell/init-registry.ps1` to ensure registry exists (will skip if present unless `-Force` is specified with user permission).

3.  **Update Agent Memory/Constitution**:
    *   Locate the active memory file (e.g., `.agent/memory/agent.md`, `repo root/Claude.md`, or `repo root/AGENTS.md`or create if missing).
    *   **Action**: Append or Update a standard `## Portkit Awareness` section.
    *   **Content to Inject**:
        ```markdown
        ## Portkit Awareness
        This repository uses **Portkit** for syncing upstream features to this soft-fork.
        - **Strategy**: `.portkit/README.md` (Read this first for any Portkit task).
        - **Registry**: `.portkit/addon-features-registry/feature-registry.json` (Source of Truth for features).
        - **Tools**: `.portkit/scripts/` (Use `uv run scripts/python/script.py` or `npx ts-node scripts/typescript/script.ts`).
        - **Workflow**: Specify -> Research -> Plan -> Tasks -> Implement -> Verify.
        ```
    *   *Validation**: Ensure this section doesn't duplicate.

4.  **Registry Sanity Check**:
    *   Read `.portkit/addon-features-registry/feature-registry.json`.
    *   If valid JSON: Report "Registry Online".
    *   If invalid/missing: Warn user and suggest running `/portkit.update.registry` immediately.

5.  **Completion**:
    *   **Status Report**: Confirm that:
        *   Portkit structure is valid.
        *   Feature Registry is online.
        *   Agent Memory has been updated.
    *   **Recommendation**:
        *   "Provide summary and feedback to user that "Portkit is now active. How would you like to proceed?"
        *   Potential next steps to suggest to users:
            *   To port a **NEW** feature from upstream:
                *   Run: `/portkit.specify "Description of the feature"`
            *   To lock **EXISTING** code to protect it from overwrites:
                *   Run: `/portkit.tag.features "Description of the feature"`
            *   To just **EXPLORE** the upstream codebase::
                *   Run: `/portkit.codemap "Description of the feature"`