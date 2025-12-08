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
    *   `.portkit/ecosystem-rules.json` (Constitution)
    *   `.portkit/scripts/` (Ensure contents exist)
    *   `.portkit/templates/` (Ensure spec-template, etc. exist)
    *   **Action**: 
        *   Run `.portkit/scripts/powershell/init-portkit.ps1` to ensure registry exists.
        *   If `ecosystem-rules.json` is missing, create it with default values (No Billing, No Translations).

3.  **Update Gitignore**:
    *   Ensure `.portkit-cache/` is added to `.gitignore`.

4.  **Update Agent Memory/Constitution**:
    *   Locate the active memory file (e.g., `.agent/memory/agent.md`, `repo root/Claude.md`, or `repo root/AGENTS.md`or create if missing).
    *   **Action**: Append or Update a standard `## Portkit Awareness` section.
    *   **Content to Inject**:
        ```markdown
        ## Portkit Awareness
            *   To port a **NEW** feature from upstream:
                *   Run: `/portkit.specify "Description of the feature"`
            *   To lock **EXISTING** code to protect it from overwrites:
                *   Run: `/portkit.tag.features "Description of the feature"`
            *   To just **EXPLORE** the upstream codebase::
                *   Run: `/portkit.codemap "Description of the feature"`