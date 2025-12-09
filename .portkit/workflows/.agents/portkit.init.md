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
Initialize Portkit for agent memory files such as `agent.md`, `gemini.md`, `AGENTS.md`, etc. and the repository structure to support the Portkit workflow. You will find these files or create them if missing in the root of the repository.

## Note
This should be run once when portkit is installed or initialized in a directory or when the agent is amnesic to ensure it understands the Portkit conventions. If it is run multiple times, ensure to ask the user if they want to reinitialize the Portkit structure and/or update the workflow files by copying the contents of the `.portkit/workflows/[environment folder]` directory from the Portkit installation directory.

## Outline
1.  **Welcome**: Acknowledge that this is the **Portkit** initialization workflow (Speckit for Upstream Sync).
2.  **Verify Structure**: Check for existence of core Portkit files:
    *   `.portkit/README.md`
    *   `.portkit/addon-features-registry/feature-registry.json`
    *   `.portkit/ecosystem-rules.json` (Constitution)
    *   `.portkit/scripts/` (Ensure contents exist)
    *   `.portkit/templates/` (Ensure spec-template, etc. exist)
    *   **Action**: 
        *   Run `.portkit/scripts/powershell/init-portkit.ps1` or bash equivalent to ensure registry exists and portkit files are setup correctly.

3.  **Update Gitignore**:
    *   Ensure `.portkit-cache/` is added to `.gitignore`.

4.  **Update Agent Memory/Constitution**:
    *   Locate the active memory file (e.g., `.agent/AGENTS.md`, `[repo root]/Claude.md`, or `[repo root]/AGENTS.md`or create if missing).
    *   **Action**: Append or Update a standard `## Portkit Awareness` section.
    *   **Content to Inject**:
        ```markdown
        ## Portkit Awareness
            **This repo uses Portkit and is found at `.portkit/` folder. Portkit specific scripts are found at `.portkit/scripts/` folder.** 
            *   To port a **NEW** feature from upstream:
                *   Run: `/portkit.specify "Description of the feature"`
            *   To lock **EXISTING** code to protect it from overwrites:
                *   Run: `/portkit.tag.features "Description of the feature"`
            *   To just **EXPLORE** the upstream codebase::
                *   Run: `/portkit.codemap "Description of the feature"`