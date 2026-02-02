# Implementation Plan: Project-Based Memories

## Phase 1: Persistence & API (Foundation)
- [ ] Task: Create Supabase migration for `user_project_memories` table with `project_id` and vector index.
- [ ] Task: Implement `ProjectMemoryService` in the backend to handle logic for the new table.
- [ ] Task: Create FastAPI CRUD endpoints for project memories in `core/memory/api.py`.
- [ ] Task: Implement unit tests for the new service and endpoints.

## Phase 2: Agent Agency (Tools & Prompts)
- [ ] Task: Create `save_project_memory_tool.py` and `delete_project_memory_tool.py` following the Agent Zero pattern.
- [ ] Task: Update logic in `PromptManager.py` to fetch and format project-level memories.
- [ ] Task: Update the System Prompt template to include `### PROJECT MEMORIES` and `### USER MEMORIES` blocks.
- [ ] Task: Verify that the agent can successfully save a fact and have it reappear in the prompt on the next turn.

## Phase 3: Sidebar Intelligence (UI Infrastructure)
- [ ] Task: Implement the 3-dot context menu for projects/chats in the sidebar.
- [ ] Task: Add the "Rename" inline editing feature to the sidebar.
- [ ] Task: Add the "Delete Project" confirmation modal.
- [ ] Task: Add the "Project Memories" entry point to the context menu.

## Phase 4: The "Project Brain" UI (CRUD Modal)
- [ ] Task: Build the `ProjectMemoriesModal` component with premium aesthetics (OKLCH, animations).
- [ ] Task: Implement list view with categories and search functionality within the modal.
- [ ] Task: Implement manual creation, editing, and deletion of memories for project owners.

## Phase 5: Verification & Polish
- [ ] Task: Conduct a full E2E walkthrough: Manual save -> Automatic prompt injection -> UI management.
- [ ] Task: Verify context window management when global vs project memory counts are high.
- [ ] Task: Final design polish and documentation update in `memories-codemap.md`.
