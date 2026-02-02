# Specification: Project-Based Memories

## Overview
A sophisticated manual knowledge system allowing Kortix workers and users to build a "Project Brain". Project memories are explicitly managed via tools or UI, providing high-precision context injection for project-specific tasks.

## Goals
- Provide agents with the ability to "learn" and "forget" project-specific information.
- Enable users to manually curate the knowledge base for a project.
- Implement a hierarchical memory injection system (Project > Global User).
- Add project management features (Rename, Delete, Memory Management) to the sidebar.

## Functional Requirements

### Backend
- New database table `user_project_memories` with `project_id`, `embedding`, and standard metadata.
- CRUD API for project memories.
- New agent tools: `save_project_memory`, `delete_project_memory`.
- Enhanced `PromptManager` to inject project-level context.

### Frontend
- Context menu in the sidebar for projects with Rename, Delete, and Project Memories options.
- Inline renaming for project titles.
- Confirmation dialogs for destructive actions.
- `ProjectMemoriesModal` for viewing, searching, and managing project-wide knowledge.

## Technical Architecture
- **Table Structure**: Mirrors `user_memories` but includes `project_id`.
- **Retrieval**: Semantic similarity search (pgvector) restricted to the active `project_id`.
- **Tools**: Atomic tools for agent agency in knowledge management.
- **Design**: Premium aesthetics using OKLCH color space and glassmorphism.
