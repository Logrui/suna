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
- [x] Task: Add the "Project Brain" entry point to the sidebar context menu.
  - File: `frontend/src/components/sidebar/nav-agents.tsx` — added Brain icon + DropdownMenuItem calling Zustand store.
- [x] Task: Create Zustand store for ProjectMemoriesModal state management.
  - File: `frontend/src/stores/use-project-memories-modal-store.ts`

## Phase 4: The "Project Brain" UI (CRUD Modal + Tool Views)
- [x] Task: Create frontend API client for project memories REST endpoints.
  - File: `frontend/src/lib/api/project-memories.ts`
- [x] Task: Build the `ProjectMemoriesModal` component with premium aesthetics (glassmorphism, framer-motion, OKLCH, grouped by type, search/filter, inline add/edit forms).
  - File: `frontend/src/components/project-memories/ProjectMemoriesModal.tsx`
- [x] Task: Create frontend tool view utility functions.
  - File: `frontend/src/components/thread/tool-views/project-memory/_utils.ts`
- [x] Task: Create `ProjectMemoryToolView` component for inline chat display of save/delete operations.
  - File: `frontend/src/components/thread/tool-views/project-memory/ProjectMemoryToolView.tsx`
- [x] Task: Register tool views in `ToolViewRegistry.tsx` for both hyphenated and underscored variants.
  - File: `frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx`
- [x] Task: Add tool title mappings for project memory tools.
  - File: `frontend/src/components/thread/tool-views/utils.ts`
- [ ] Task: Create mobile tool view components (if mobile app is active).
  - Following `implementing-tools.md` checklist: ToolView.tsx, _utils.ts, registry.ts

## Phase 5: Verification & Polish
- [ ] Task: Apply and verify database migration on Supabase container.
- [ ] Task: Docker compose build verification.
- [ ] Task: Conduct a full E2E walkthrough: Manual save -> Automatic prompt injection -> UI management.
- [ ] Task: Verify context window management when global vs project memory counts are high.
## Phase 6: Intelligence & Consolidation (Agent-Zero Parity)
- [x] Task: Create `memory_consolidation_prompt.py` with system and message templates.
- [x] Task: Add `search_project_memories` to `ProjectMemoryTool`.
- [ ] Task: Implement `extract_keywords` in `ProjectMemoryService` using LLM.
- [ ] Task: Implement `consolidate_memory` logic in `ProjectMemoryService` (Search -> Analyze -> Resolve).
- [ ] Task: Update `save_project_memory` tool method to use the consolidation flow.
- [ ] Task: Refine `core_prompt.py` instructions based on consolidation capabilities.
