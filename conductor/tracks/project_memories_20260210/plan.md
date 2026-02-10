# Implementation Plan: Project-Based Memories

## Phase 1: Persistence & API (Foundation)
- [x] Task: Create Supabase migration for `user_project_memories` table with `project_id` and vector index.
  - File: `backend/supabase/migrations/20260210_project_memories.sql`
- [x] Task: Add `ProjectMemoryItem` dataclass to models.
  - File: `backend/core/memory/models.py`
- [x] Task: Implement `ProjectMemoryService` in the backend to handle CRUD, search, and prompt formatting.
  - File: `backend/core/memory/project_memory_service.py`
- [x] Task: Create FastAPI CRUD endpoints for project memories.
  - File: `backend/core/memory/project_memory_api.py`
- [x] Task: Register project memory API router in `api.py`.
- [ ] Task: Implement unit tests for the new service and endpoints.

## Phase 2: Agent Agency (Tools & Prompts)
- [x] Task: Create `ProjectMemoryTool` with `save_project_memory` and `delete_project_memory` methods.
  - File: `backend/core/tools/project_memory_tool.py`
- [x] Task: Register tool in `tool_registry.py` (CORE_TOOLS) and `tool_guide_registry.py` (category_map).
- [x] Task: Register tool in `tool_manager.py` `_register_core_tools()` with account_id guard.
- [x] Task: Update `PromptManager.build_system_prompt()` to accept `project_id` and fetch project memories.
  - File: `backend/core/run/prompt_manager.py` — added `_fetch_project_memories()` static method.
- [x] Task: Update `AgentRunner` to pass `project_id` to `build_system_prompt()`.
  - File: `backend/core/run/agent_runner.py` — both call sites updated.
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
- [ ] Task: Create frontend tool view components for `save_project_memory` / `delete_project_memory`.
  - Following `implementing-tools.md` checklist: ToolView.tsx, _utils.ts, ToolViewRegistry.tsx
- [ ] Task: Create mobile tool view components (if mobile app is active).
  - Following `implementing-tools.md` checklist: ToolView.tsx, _utils.ts, registry.ts

## Phase 5: Verification & Polish
- [ ] Task: Apply and verify database migration on Supabase container.
- [ ] Task: Docker compose build verification.
- [ ] Task: Conduct a full E2E walkthrough: Manual save -> Automatic prompt injection -> UI management.
- [ ] Task: Verify context window management when global vs project memory counts are high.
- [ ] Task: Final design polish and documentation update in `memories-codemap.md`.
