---
description: Generate a comprehensive technical "codemap" document for a specific feature in the codebase.
---

# /codemap

Generate a comprehensive technical "codemap" document for a specific feature in the codebase.

## Purpose
To create a detailed, deep-dive technical reference document (`[feature]-codemap.md`) that maps out the file structure, architecture, data flow, and core components of a specific feature. This helps developers quickly understand complex parts of the system.

## Instructions

### 1. Analyze the Request
- **If the user DOES NOT specify a feature**:
    - Briefly scan the current workspace to identify major features or modules.
    - Provide a numbered list of 3 potential codemaps you could generate (e.g., "1. Authentication System", "2. Agent Builder", "3. Data Ingestion Pipeline").
    - Ask the user to select one or provide their own topic.

- **If the user DOES specify a feature**:
    - Proceed to Step 2 immediately.

### 2. Research Phase
- **Search**: Use file search and grep tools to locate all files related to the requested feature. Look for frontend components, backend controllers, services, types, and database models.
- **Understand**: Read key files to understand the purpose, logic, and relationships between components.
- **Identify Critical Paths**: Determine which files are `⭐ CRITICAL` to the feature's functionality.

### 3. Generate Codemap
Create a new file named `[feature]-codemap.md` in the **root** of the workspace (unless the user specified a different location). The file MUST include the following sections:

#### A. File Structure (Core Files)
- List only the most essential files.

#### B. File Structure (Comprehensive)
- Create a visual text-based tree diagram of ALL related components.
- Mark critical core files with `⭐ CRITICAL`.
- Include a short description of the purpose of each file/folder.
- **Format Example**:
    ```text
    frontend/src/sections/feature/
    ├── main-component.tsx               # Main entry point
    │   └── Orchestrates sub-components
    ├── components/
    │   ├── sub-component.tsx            # Renders specific UI elements ⭐ CRITICAL
    │   │   └── Handles user interactions
    ```

#### C. Architecture & Data Flow
- **Component Interaction Flow**: Describe how components talk to each other.
- **Data Flow**: Describe how data moves through the feature.
- **Mermaid Charts**: Include Mermaid diagrams for:
    - User Interaction Flow
    - Component Interaction Flow
    - Networking/API Interaction Flow

#### D. Code Examples
- Provide snippets of `⭐ CRITICAL` components to illustrate key logic.

#### E. Additional Sections
- Add any other relevant sections (e.g., "State Management", "API Endpoints", "Database Schema", "Configuration") that would be useful for a developer.

## Constraints & Best Practices
- **Length**: Aim for a comprehensive document (target at least ~500 lines if the feature complexity warrants it).
- **Location**: Save to the root workspace directory by default.
- **Style**: Be technical, precise, and exhaustive.
- **Visuals**: Use ASCII trees for file structures and Mermaid for flows.
