# Agentic Outline — Frontend Phase (Phases 2b + 3 + 4)

## Scope
This phase implements three frontend deliverables:
1. **Tool Views** — inline chat views for `save_project_memory` / `delete_project_memory`
2. **Sidebar Context Menu** — add "Project Memories" entry to existing dropdown
3. **ProjectMemoriesModal** — CRUD UI for project memories

## Architecture Notes

### Tool Views Pattern (from task-list example)
- Directory: `frontend/src/components/thread/tool-views/project-memory/`
- Files: `_utils.ts`, `ProjectMemoryToolView.tsx`
- Register in: `wrapper/ToolViewRegistry.tsx`
- Interface: implements `ToolViewProps` from `../types`
- Design: Card + CardHeader + CardContent, gradient badges, premium aesthetics

### Sidebar Context Menu (from nav-agents.tsx)
- The `SingleChatCard` component (line 68) has a `DropdownMenu` (line 210) with items: "New chat", "Rename", "Delete"
- We add a "Project Memories" `DropdownMenuItem` with `Brain` icon from lucide-react
- Clicking opens `ProjectMemoriesModal`

### ProjectMemoriesModal
- New file: `frontend/src/components/project-memories/ProjectMemoriesModal.tsx`
- ShadCN `Dialog` + premium aesthetics (glassmorphism, OKLCH, framer-motion)
- Fetches from `GET /api/projects/{project_id}/memories`
- CRUD operations mapped to REST endpoints
- Category filters, search, inline editing
- Zustand store for modal open/close state + project_id

### API Client
- New file: `frontend/src/lib/api/project-memories.ts`
- Typed functions for all endpoints

---

## Task Breakdown

### Task A: API Client + Types (no dependencies)
**File:** `frontend/src/lib/api/project-memories.ts`
- Define TypeScript interfaces mirroring backend models
- Create functions: `listProjectMemories`, `getProjectMemory`, `createProjectMemory`, `updateProjectMemory`, `deleteProjectMemory`, `searchProjectMemories`
- Use existing `createClient()` pattern from `frontend/src/lib/supabase/client.ts` or direct fetch to backend API

### Task B: Tool View Components (depends on nothing)
**Files:**
- `frontend/src/components/thread/tool-views/project-memory/_utils.ts`
- `frontend/src/components/thread/tool-views/project-memory/ProjectMemoryToolView.tsx`

**_utils.ts:**
- Interface `ProjectMemoryResult` with fields: `memory_id`, `content`, `memory_type`, `project_id`
- Function `extractProjectMemoryData(argumentsData, outputData)` to extract structured data

**ProjectMemoryToolView.tsx:**
- Follows TaskListToolView pattern exactly
- Card layout with Brain icon (from lucide-react) in gradient icon box
- Shows memory content, type badge, success/failure state
- Handles both save and delete actions
- Streaming state support

### Task C: Registry Update (depends on Task B)
**File:** `frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx`
- Add import for `ProjectMemoryToolView`
- Register both: `'save-project-memory'` and `'delete-project-memory'` → `ProjectMemoryToolView`
- Also register underscore variants: `'save_project_memory'` and `'delete_project_memory'`

### Task D: Zustand Store for Modal (no dependencies)
**File:** `frontend/src/stores/use-project-memories-modal-store.ts`
- `projectId: string | null`
- `isOpen: boolean`
- `openModal(projectId: string): void`
- `closeModal(): void`

### Task E: ProjectMemoriesModal (depends on Task A + Task D)
**File:** `frontend/src/components/project-memories/ProjectMemoriesModal.tsx`
- Premium Dialog with glassmorphism
- Header with Brain icon + project name
- List of memories grouped by `memory_type` (fact, preference, instruction, context)
- Each memory card: content, type badge, created date, edit/delete buttons
- "Add Memory" button → inline form with textarea + type selector
- Search input for filtering
- Framer-motion for list animations (AnimatePresence, layout)
- React Query hooks for data fetching

### Task F: Sidebar Integration (depends on Task D + Task E)
**File:** `frontend/src/components/sidebar/nav-agents.tsx`A
- Import Brain icon from lucide-react
- Import `useProjectMemoriesModalStore` 
- Add "Project Memories" DropdownMenuItem in SingleChatCard's dropdown (after "Rename", before separator)
- Clicking calls `openModal(projectGroup.projectId)`
- Render `<ProjectMemoriesModal />` at the bottom of `NavAgents` component

---

## Agent Assignment

### Agent 1: Tool View + Registry (Tasks B + C)
- Create `_utils.ts` and `ProjectMemoryToolView.tsx`
- Update `ToolViewRegistry.tsx`
- Independent, no blockers

### Agent 2: API Client + Store + Modal + Sidebar (Tasks A + D + E + F)  
- Create API client
- Create Zustand store
- Build ProjectMemoriesModal
- Wire sidebar integration
- Sequential within agent, but can run parallel with Agent 1

---

## Quality Checklist
- [ ] All components use `cn()` for class merging
- [ ] OKLCH colors via CSS variables only (no hex)
- [ ] Dark mode support on all components
- [ ] `framer-motion` for list animations
- [ ] Tooltips on interactive elements
- [ ] Error boundaries / error states
- [ ] Loading states (shimmer/spinner)
- [ ] Empty state illustration
- [ ] TypeScript strict mode compliance (no `any` in public interfaces)
