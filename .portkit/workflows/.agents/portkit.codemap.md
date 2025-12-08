---
description: Research target/existing repo and create a standalone codemap of the feature
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal
Research target/existing repo and create a standalone codemap of the feature.

## Note
This is an exploratory tool. It does not initiate a full porting process or modify the registry.

## Instructions
1.  **Parse Input**: Identify Target Directory/Feature and Feature Name.
    *   *Naming Convention*: `[YYYY-MM-DD]-[feature-name].codemap.md`.
    *   *Path*: `.portkit/specs/[feature-name]/[filename]`.
    *   If `specs/[feature-name]` does not exist, create it.

2.  **Research Phase**:
    *   **Goal**: Research and understand the files related to the feature deeply to create a technical analysis document codemap. Don't just list files; understand the *flow* of the codebase related to the feature
    *   **Action**: Explore the codebase using your preferred tools (`grep`, `find`, `read_file`).
    *   **Tools you have available to you (Optional but highly recommended)**:
        *   Use `.portkit/scripts/` if they help you move faster (e.g. `map-dependencies` for import graphs).
        *   Use `tree` or `Get-ChildItem` for high-level structure.

3.  **Draft Codemap**:
    *   **Requirement**: Be technical, precise, and exhaustive. Mark critical components clearly.
    *   **Format Template**:
        ```markdown
        # Codemap: [Feature Name]
        Date: [YYYY-MM-DD]
        Target: [Target Directory]

        ## 1. High-Level Architecture
        [Brief description of purpose and scope]

        ## 2. File Topology/Feature Structure
        (Visual Text Tree)
        - src/features/X/
          - main.tsx                 # Entry Point ⭐ CRITICAL
          - utils/
            - helper.ts              # Data Processor

        ## 3. Dependency Graph
        (List internal and external dependencies. Use `map-dependencies` script if helpful.)
        - Internal: @/lib/auth, @/hooks/use-user
        - External: react-query, zod

        ## 4. Architecture & Data Flow
        *   **Component Interaction**: How components talk to each other.
        *   **Data Flow**: How data moves (API -> Store -> UI).

        ### 4.1 User Interaction Flow (Mermaid)
        ```mermaid
        sequenceDiagram
            User->>Component: Action
            Component->>Store: Update
        ```

        ### 4.2 API/Network Flow (Mermaid)
        ```mermaid
        sequenceDiagram
            Service->>API: Request
            API-->>Service: Response
        ```

        ## 5. Critical Files Content
        (Packed content or snippets of the top 3-5 most important files to provide context)
        ```

4.  **Completion**:
    *   Save file to `.portkit/specs/[feature-name]/[YYYY-MM-DD]-[feature-name].codemap.md`.
    *   Report success and full path.
