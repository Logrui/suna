# Project Structure: Advanced Visual Workflow Builder

**Feature**: Advanced Visual Workflow Builder
**Created**: 2025-11-23
**Purpose**: Complete file tree showing all new and modified files for this feature

## Overview

This document provides a comprehensive view of all code files that will be created or modified for the Advanced Visual Workflow feature. Files are organized by module/directory to show the complete project structure.

**Legend**:
- 🆕 New file (will be created)
- ✏️ Modified file (existing file that will be extended)
- 📁 New directory

---

## Repository Root Changes

```
D:\Homelab\suna\
├── backend/
│   └── core/
│       └── workflows/              📁 NEW MODULE
│           ├── __init__.py         🆕
│           ├── models.py           🆕
│           ├── api.py              🆕
│           ├── compiler.py         🆕
│           ├── validator.py        🆕
│           ├── variables.py        🆕
│           ├── executor.py         🆕
│           ├── types.py            🆕
│           ├── migrations/         📁
│           │   └── 001_add_advanced_mode.sql  🆕
│           └── tests/              📁
│               ├── __init__.py     🆕
│               ├── test_compiler.py  🆕
│               ├── test_validator.py 🆕
│               ├── test_executor.py  🆕
│               └── test_variables.py 🆕
├── frontend/
│   └── src/
│       ├── app/
│       │   └── (dashboard)/
│       │       └── workflows/
│       │           └── [id]/
│       │           └── [id]/
│       │               ├── page.tsx              ✏️ (tab-based container)
│       │               └── advanced/             📁 (deprecated)
│       │                   └── page.tsx          ❌ (merged into main page)
│       ├── components/
│       │   └── workflows/                        📁 (extends existing)
│       │       ├── workflow-tabs-navigation.tsx  🆕
│       │       ├── simple-workflow-editor.tsx    🆕
│       │       ├── advanced-workflow-editor.tsx  🆕
│       │       ├── canvas/                       📁 NEW
│       │       │   ├── WorkflowCanvas.tsx        🆕
│       │       │   ├── NodePalette.tsx           🆕
│       │       │   ├── MiniMap.tsx               🆕
│       │       │   └── AutoLayoutButton.tsx      🆕
│       │       ├── nodes/                        📁 NEW
│       │       │   ├── StartNode.tsx             🆕
│       │       │   ├── EndNode.tsx               🆕
│       │       │   ├── AIStepNode.tsx            🆕
│       │       │   ├── RuleConditionNode.tsx     🆕
│       │       │   └── LLMConditionNode.tsx      🆕
│       │       ├── config/                       📁 NEW
│       │       │   ├── AIStepConfig.tsx          🆕
│       │       │   ├── RuleConditionConfig.tsx   🆕
│       │       │   ├── LLMConditionConfig.tsx    🆕
│       │       │   ├── ModelSelector.tsx         🆕
│       │       │   ├── ToolSelector.tsx          🆕
│       │       │   ├── VariableMentionNode.tsx   🆕
│       │       │   └── VariableMentionPlugin.tsx 🆕
│       │       ├── monitoring/                   📁 NEW
│       │       │   ├── ExecutionTimeline.tsx     🆕
│       │       │   └── LiveNodeStatus.tsx        🆕
│       │       └── ModeConversionDialog.tsx      ❌ (removed)
│       ├── hooks/
│       │   └── react-query/
│       │       └── workflows/                    📁 NEW
│       │           ├── useWorkflow.ts            🆕
│       │           ├── useWorkflowValidation.ts  🆕
│       │           └── useWorkflowExecution.ts   🆕
│       ├── store/
│       │   └── workflows/                        📁 NEW
│       │       ├── canvasStore.ts                🆕
│       │       └── executionStore.ts             🆕
│       ├── types/
│       │   └── workflows/                        📁 NEW
│       │       ├── index.ts                      🆕
│       │       └── graph-definition.ts           🆕 (from contracts/)
│       └── lib/
│           └── workflows/                        📁 NEW
│               └── autoLayout.ts                 🆕
├── specs/
│   └── 003-advanced-workflows/
│       ├── spec.md                               ✅ (already created)
│       ├── plan.md                               ✅ (already created)
│       ├── research.md                           ✅ (already created)
│       ├── data-model.md                         ✅ (already created)
│       ├── quickstart.md                         ✅ (already created)
│       ├── tasks.md                              ✅ (already created)
│       ├── project-structure.md                  ✅ (this file)
│       ├── checklists/
│       │   └── requirements.md                   ✅ (already created)
│       └── contracts/
│           ├── api-endpoints.md                  ✅ (already created)
│           ├── graph-definition.ts               ✅ (already created)
│           └── compiled-logic.py                 ✅ (already created)
└── CLAUDE.md                                     ✏️ (will update with tech stack)
```

---

## Backend File Details

### Module: `backend/core/workflows/`

**Purpose**: Complete backend implementation for advanced workflow system

| File | Lines Est. | Purpose | Key Exports |
|------|------------|---------|-------------|
| `__init__.py` | 50 | Module initialization, exports | `GraphExecutor`, `GraphCompiler`, `GraphValidator` |
| `models.py` | 200 | SQLAlchemy models for workflows | `Workflow`, `WorkflowExecution` |
| `api.py` | 500 | FastAPI router with all endpoints | `router` (14 endpoints) |
| `compiler.py` | 400 | Graph compilation logic | `GraphCompiler` class |
| `validator.py` | 300 | Graph validation rules | `GraphValidator` class |
| `variables.py` | 250 | Variable resolution system | `VariableResolver` class |
| `executor.py` | 600 | Graph execution engine | `GraphExecutor` class |
| `types.py` | 400 | Python TypedDicts from contracts | `CompiledLogic`, `ExecutionContext` |

**Total Backend Code**: ~2,700 lines

### Database Migration

**File**: `backend/core/workflows/migrations/001_add_advanced_mode.sql`

```sql
-- Add mode column (ENUM)
CREATE TYPE workflow_mode AS ENUM ('simple', 'advanced');
ALTER TABLE agent_workflows ADD COLUMN mode workflow_mode DEFAULT 'simple' NOT NULL;

-- Add graph definition storage (visual state)
ALTER TABLE agent_workflows ADD COLUMN graph_definition JSONB DEFAULT NULL;

-- Add compiled logic storage (execution state)
ALTER TABLE agent_workflows ADD COLUMN compiled_logic JSONB DEFAULT NULL;

-- Add constraint: advanced workflows must have both graph_definition and compiled_logic
ALTER TABLE agent_workflows ADD CONSTRAINT check_advanced_workflow_data
CHECK (
  (mode = 'simple') OR
  (mode = 'advanced' AND graph_definition IS NOT NULL AND compiled_logic IS NOT NULL)
);

-- Add indexes for performance
CREATE INDEX idx_agent_workflows_mode ON agent_workflows(mode);
CREATE INDEX idx_agent_workflows_graph_definition ON agent_workflows USING GIN (graph_definition);
```

**Lines**: ~25

### Backend Tests

| Test File | Lines Est. | Purpose | Test Count |
|-----------|------------|---------|------------|
| `test_compiler.py` | 300 | Graph compilation tests | ~15 tests |
| `test_validator.py` | 250 | Validation logic tests | ~12 tests |
| `test_executor.py` | 400 | Execution engine tests | ~18 tests |
| `test_variables.py` | 200 | Variable resolution tests | ~10 tests |

**Total Test Code**: ~1,150 lines

---

## Frontend File Details

### Routes: `frontend/src/app/(dashboard)/workflows/[id]/`

| File | Lines Est. | Purpose |
|------|------------|---------|
| `advanced/page.tsx` | 150 | Advanced mode workflow editor page |
| `page.tsx` (modified) | +50 | Tab-based container for Simple/Advanced editors |
| `advanced/page.tsx` | - | Deprecated - logic moved to AdvancedWorkflowEditor |

**New Route**: `/workflows/[id]/advanced` - Visual canvas editor

### Components: `frontend/src/components/workflows/`

#### Canvas Components (`canvas/`)

| Component | Lines Est. | Purpose | Key Features |
|-----------|------------|---------|--------------|
| `WorkflowCanvas.tsx` | 400 | Main React Flow canvas | Pan, zoom, node management, edge creation |
| `NodePalette.tsx` | 200 | Draggable node templates | Drag-and-drop, node types, search/filter |
| `MiniMap.tsx` | 80 | Canvas overview map | Navigation for large workflows |
| `AutoLayoutButton.tsx` | 100 | Auto-layout trigger | Dagre integration, layout options |

**Total Canvas**: ~780 lines

#### Node Components (`nodes/`)

| Component | Lines Est. | Purpose | Props |
|-----------|------------|---------|-------|
| `StartNode.tsx` | 100 | Trigger/start node | Trigger context configuration |
| `EndNode.tsx` | 80 | Workflow termination node | Success/failure status |
| `AIStepNode.tsx` | 150 | AI agent step node | Model, prompt, tools display |
| `RuleConditionNode.tsx` | 120 | Rule-based condition | Multiple output handles |
| `LLMConditionNode.tsx` | 120 | LLM-based condition | Branch labels |

**Total Nodes**: ~570 lines

#### Configuration Panels (`config/`)

| Component | Lines Est. | Purpose | Key Features |
|-----------|------------|---------|--------------|
| `AIStepConfig.tsx` | 300 | AI step configuration panel | Model selector, prompt editor, tools |
| `RuleConditionConfig.tsx` | 250 | Rule condition editor | Rule builder, operator selector |
| `LLMConditionConfig.tsx` | 200 | LLM condition editor | Branch editor, context prompt |
| `ModelSelector.tsx` | 100 | Model dropdown | Available models, descriptions |
| `ToolSelector.tsx` | 150 | Multi-select for tools | Tool list with icons |
| `VariableMentionNode.tsx` | 120 | Lexical variable decorator | @variable rendering |
| `VariableMentionPlugin.tsx` | 200 | Lexical autocomplete | @ trigger, dropdown |

**Total Config**: ~1,320 lines

#### Monitoring Components (`monitoring/`)

| Component | Lines Est. | Purpose | Key Features |
|-----------|------------|---------|--------------|
| `ExecutionTimeline.tsx` | 250 | Execution log display | Event timeline, timestamps |
| `LiveNodeStatus.tsx` | 200 | Real-time node status | Active/completed/failed indicators |

**Total Monitoring**: ~450 lines

#### Other Components

| Component | Lines Est. | Purpose |
|-----------|------------|---------|
| `ModeConversionDialog.tsx` | - | Removed - Replaced by seamless tab switching |

### Hooks: `frontend/src/hooks/react-query/workflows/`

| Hook | Lines Est. | Purpose | Returns |
|------|------------|---------|---------|
| `useWorkflow.ts` | 150 | Fetch/save workflow | `{ workflow, save, isLoading }` |
| `useWorkflowValidation.ts` | 100 | Validate graph | `{ validate, errors, warnings }` |
| `useWorkflowExecution.ts` | 200 | Execute & monitor | `{ execute, events, status }` |

**Total Hooks**: ~450 lines

### State Management: `frontend/src/store/workflows/`

| Store | Lines Est. | Purpose | State |
|-------|------------|---------|-------|
| `canvasStore.ts` | 300 | Zustand canvas state | `nodes`, `edges`, `viewport`, `selectedNodes` |
| `executionStore.ts` | 200 | Execution monitoring state | `executionId`, `events`, `status` |

**Total Stores**: ~500 lines

### Types: `frontend/src/types/workflows/`

| File | Lines Est. | Purpose | Key Types |
|------|------------|---------|-----------|
| `index.ts` | 50 | Re-exports all types | - |
| `graph-definition.ts` | 350 | Visual state types (from contracts) | `GraphDefinition`, `WorkflowNode`, `NodeData` |

**Total Types**: ~400 lines

### Utilities: `frontend/src/lib/workflows/`

| File | Lines Est. | Purpose | Key Functions |
|------|------------|---------|---------------|
| `autoLayout.ts` | 200 | Dagre layout integration | `calculateLayout()`, `applyLayout()` |

**Total Utilities**: ~200 lines

### Frontend Summary

| Category | Files | Lines Est. |
|----------|-------|------------|
| Routes | 2 | 200 |
| Canvas Components | 4 | 780 |
| Node Components | 5 | 570 |
| Config Components | 7 | 1,320 |
| Monitoring Components | 2 | 450 |
| Other Components | 1 | 150 |
| Hooks | 3 | 450 |
| Stores | 2 | 500 |
| Types | 2 | 400 |
| Utilities | 1 | 200 |
| **TOTAL FRONTEND** | **29** | **~5,020 lines** |

---

## Complete File Count Summary

### By Category

| Category | New Files | Modified Files | Total Files | Lines Est. |
|----------|-----------|----------------|-------------|------------|
| **Backend Core** | 8 | 0 | 8 | 2,700 |
| **Backend Tests** | 4 | 0 | 4 | 1,150 |
| **Database Migrations** | 1 | 0 | 1 | 25 |
| **Frontend Components** | 19 | 1 | 20 | 3,270 |
| **Frontend Hooks** | 3 | 0 | 3 | 450 |
| **Frontend Stores** | 2 | 0 | 2 | 500 |
| **Frontend Types** | 2 | 0 | 2 | 400 |
| **Frontend Utilities** | 1 | 0 | 1 | 200 |
| **Frontend Routes** | 1 | 1 | 2 | 200 |
| **Documentation** | 0 | 1 | 1 | +200 |
| **TOTAL** | **41** | **3** | **44** | **~8,895 lines** |

### By Language/Type

| Type | Files | Lines Est. | Percentage |
|------|-------|------------|------------|
| **TypeScript/TSX** | 29 | ~5,220 | 59% |
| **Python** | 12 | ~3,850 | 43% |
| **SQL** | 1 | ~25 | <1% |
| **Markdown** | 1 | +200 | - |

---

## File Dependencies

### Critical Path Dependencies

1. **Database Migration** → Backend Models → Backend Services
2. **Backend Types** → Frontend Types → Frontend Components
3. **Canvas Store** → Canvas Components → Node Components
4. **Backend API** → Frontend Hooks → Frontend Components

### Import Relationships

#### Backend

```python
# Core imports
from backend.core.workflows.models import Workflow
from backend.core.workflows.types import CompiledLogic, ExecutionContext
from backend.core.workflows.compiler import GraphCompiler
from backend.core.workflows.validator import GraphValidator
from backend.core.workflows.executor import GraphExecutor
from backend.core.workflows.variables import VariableResolver

# External dependencies
from backend.core.agentpress.thread_manager import ThreadManager
from backend.core.services.redis import get_redis_client
from backend.core.services.supabase import get_supabase_client
```

#### Frontend

```typescript
// Type imports
import type { GraphDefinition, WorkflowNode } from '@/types/workflows/graph-definition';

// Component imports
import { WorkflowCanvas } from '@/components/workflows/canvas/WorkflowCanvas';
import { NodePalette } from '@/components/workflows/canvas/NodePalette';
import { AIStepNode } from '@/components/workflows/nodes/AIStepNode';

// Hook imports
import { useWorkflow } from '@/hooks/react-query/workflows/useWorkflow';
import { useWorkflowExecution } from '@/hooks/react-query/workflows/useWorkflowExecution';

// Store imports
import { useCanvasStore } from '@/store/workflows/canvasStore';

// External dependencies
import { ReactFlow, Node, Edge } from '@xyflow/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { create } from 'zustand';
import dagre from 'dagre';
```

---

## External Dependencies

### New Package Dependencies

#### Frontend (`frontend/package.json`)

```json
{
  "dependencies": {
    "@xyflow/react": "^12.0.0",
    "lexical": "^0.16.0",
    "@lexical/react": "^0.16.0",
    "zustand": "^4.0.0",
    "dagre": "^0.8.5"
  },
  "devDependencies": {
    "@types/dagre": "^0.7.52"
  }
}
```

**Total New Dependencies**: 5 packages

#### Backend (No new external dependencies)

All backend functionality uses existing dependencies:
- `fastapi` (existing)
- `pydantic` (existing)
- `supabase` (existing)
- `redis` (existing)
- `dramatiq` (existing)

---

## Modified Existing Files

### 1. `frontend/src/app/(dashboard)/workflows/[id]/page.tsx`

**Changes**:
- Add mode switcher toggle UI (Simple ⇄ Advanced)
- Add link to advanced editor route
- Add mode badge indicator

**Lines Added**: ~50

### 2. `backend/api.py`

**Changes**:
- Register new workflows router
- Add `/workflows` route prefix

**Lines Added**: ~5

```python
from backend.core.workflows import api as workflows_api

app.include_router(workflows_api.router, prefix="/api")
```

### 3. `CLAUDE.md`

**Changes**:
- Add "Advanced Workflows" section under "Key Technology Choices"
- Document React Flow, Lexical, Zustand, Dagre usage
- Add workflow execution architecture notes

**Lines Added**: ~200

---

## Directory Structure Visualization

### Backend Structure

```
backend/
└── core/
    ├── agentpress/          (existing - integrates with workflows)
    │   ├── thread_manager.py
    │   └── tool_registry.py
    ├── services/            (existing - used by workflows)
    │   ├── redis.py
    │   └── supabase.py
    └── workflows/           📁 NEW MODULE
        ├── __init__.py      🆕 Module exports
        ├── models.py        🆕 SQLAlchemy Workflow model
        ├── api.py           🆕 FastAPI router (14 endpoints)
        ├── compiler.py      🆕 GraphCompiler class
        ├── validator.py     🆕 GraphValidator class
        ├── variables.py     🆕 VariableResolver class
        ├── executor.py      🆕 GraphExecutor class
        ├── types.py         🆕 Python TypedDicts
        ├── migrations/      📁
        │   └── 001_add_advanced_mode.sql
        └── tests/           📁
            ├── test_compiler.py
            ├── test_validator.py
            ├── test_executor.py
            └── test_variables.py
```

### Frontend Structure

```
frontend/src/
├── app/
│   └── (dashboard)/
│       └── workflows/
│           └── [id]/
│               ├── page.tsx              ✏️ (add mode switcher)
│               └── advanced/             📁 NEW
│                   └── page.tsx          🆕 Advanced editor page
├── components/
│   └── workflows/                        📁 (extends existing)
│       ├── canvas/                       📁 NEW
│       │   ├── WorkflowCanvas.tsx        🆕 Main canvas
│       │   ├── NodePalette.tsx           🆕 Draggable palette
│       │   ├── MiniMap.tsx               🆕 Overview map
│       │   └── AutoLayoutButton.tsx      🆕 Auto-layout
│       ├── nodes/                        📁 NEW
│       │   ├── StartNode.tsx             🆕 Start/trigger
│       │   ├── EndNode.tsx               🆕 Termination
│       │   ├── AIStepNode.tsx            🆕 AI step
│       │   ├── RuleConditionNode.tsx     🆕 Rule condition
│       │   └── LLMConditionNode.tsx      🆕 LLM condition
│       ├── config/                       📁 NEW
│       │   ├── AIStepConfig.tsx          🆕 AI config panel
│       │   ├── RuleConditionConfig.tsx   🆕 Rule editor
│       │   ├── LLMConditionConfig.tsx    🆕 LLM editor
│       │   ├── ModelSelector.tsx         🆕 Model dropdown
│       │   ├── ToolSelector.tsx          🆕 Tool selector
│       │   ├── VariableMentionNode.tsx   🆕 Variable decorator
│       │   └── VariableMentionPlugin.tsx 🆕 Autocomplete
│       ├── monitoring/                   📁 NEW
│       │   ├── ExecutionTimeline.tsx     🆕 Event log
│       │   └── LiveNodeStatus.tsx        🆕 Status indicators
│       └── ModeConversionDialog.tsx      🆕 Mode switcher
├── hooks/
│   └── react-query/
│       └── workflows/                    📁 NEW
│           ├── useWorkflow.ts            🆕 CRUD operations
│           ├── useWorkflowValidation.ts  🆕 Validation
│           └── useWorkflowExecution.ts   🆕 Execution/SSE
├── store/
│   └── workflows/                        📁 NEW
│       ├── canvasStore.ts                🆕 Canvas state
│       └── executionStore.ts             🆕 Execution state
├── types/
│   └── workflows/                        📁 NEW
│       ├── index.ts                      🆕 Re-exports
│       └── graph-definition.ts           🆕 Type definitions
└── lib/
    └── workflows/                        📁 NEW
        └── autoLayout.ts                 🆕 Dagre integration
```

---

## Size and Complexity Metrics

### Code Complexity

| Complexity Level | Files | Lines | Percentage |
|------------------|-------|-------|------------|
| **Simple** (< 100 lines) | 8 | ~640 | 7% |
| **Medium** (100-250 lines) | 20 | ~3,400 | 38% |
| **Complex** (250-500 lines) | 12 | ~4,200 | 47% |
| **Very Complex** (> 500 lines) | 3 | ~1,500 | 17% |

### Most Complex Files

1. **`backend/core/workflows/executor.py`** (~600 lines) - Graph execution engine with DFS traversal
2. **`backend/core/workflows/api.py`** (~500 lines) - 14 API endpoints
3. **`backend/core/workflows/compiler.py`** (~400 lines) - Graph compilation logic
4. **`frontend/src/components/workflows/canvas/WorkflowCanvas.tsx`** (~400 lines) - React Flow integration
5. **`frontend/src/types/workflows/graph-definition.ts`** (~350 lines) - Complete type system

### Test Coverage Target

| Module | Test Files | Test Lines | Coverage Target |
|--------|------------|------------|-----------------|
| Compiler | 1 | 300 | 90%+ |
| Validator | 1 | 250 | 95%+ |
| Executor | 1 | 400 | 85%+ |
| Variables | 1 | 200 | 90%+ |

**Total Test Code**: ~1,150 lines for ~2,700 lines of backend code = **43% test-to-code ratio**

---

## Implementation Order

Files should be created in this order to minimize dependency issues:

### Phase 1: Foundation (Setup)
1. Database migration SQL
2. Backend `types.py` (Python TypedDicts)
3. Frontend `graph-definition.ts` (TypeScript types)
4. Package dependency installation

### Phase 2: Core Backend
5. Backend `models.py`
6. Backend `compiler.py`
7. Backend `validator.py`
8. Backend `variables.py`
9. Backend `executor.py`
10. Backend `api.py`
11. Backend `__init__.py`

### Phase 3: Frontend Foundation
12. Frontend stores (`canvasStore.ts`, `executionStore.ts`)
13. Frontend hooks (`useWorkflow.ts`, etc.)
14. Frontend utilities (`autoLayout.ts`)

### Phase 4: UI Components
15. Node components (Start, End, AIStep, Condition)
16. Canvas components (WorkflowCanvas, NodePalette, MiniMap)
17. Config components (AIStepConfig, ConditionConfig, selectors)
18. Monitoring components (Timeline, LiveStatus)
19. Other components (ModeConversionDialog)

### Phase 5: Integration
20. Advanced editor page route
21. Modify existing workflow page
22. Update CLAUDE.md documentation

### Phase 6: Testing
23. Backend test files
24. Frontend component tests (optional)

---

## Repository Impact Analysis

### New Directories Created: 8

1. `backend/core/workflows/`
2. `backend/core/workflows/migrations/`
3. `backend/core/workflows/tests/`
4. `frontend/src/app/(dashboard)/workflows/[id]/advanced/`
5. `frontend/src/components/workflows/canvas/`
6. `frontend/src/components/workflows/nodes/`
7. `frontend/src/components/workflows/config/`
8. `frontend/src/components/workflows/monitoring/`
9. `frontend/src/hooks/react-query/workflows/`
10. `frontend/src/store/workflows/`
11. `frontend/src/types/workflows/`
12. `frontend/src/lib/workflows/`

### Files by Type

| Extension | Count | Purpose |
|-----------|-------|---------|
| `.tsx` | 21 | React components |
| `.ts` | 8 | TypeScript utilities, types, hooks, stores |
| `.py` | 12 | Python backend code + tests |
| `.sql` | 1 | Database migration |
| `.md` | 1 | Documentation update |

### Repository Size Impact

**Current Repository** (estimated):
- Backend: ~50,000 lines
- Frontend: ~80,000 lines
- Total: ~130,000 lines

**After This Feature**:
- Backend: +3,850 lines (+7.7%)
- Frontend: +5,220 lines (+6.5%)
- Total: +9,070 lines (+7.0%)

**Relative Impact**: This feature adds approximately **7% to total codebase size**

---

## Maintenance Considerations

### Files Requiring Frequent Updates

**High Maintenance** (likely to change often):
- `frontend/src/components/workflows/canvas/WorkflowCanvas.tsx` - Core interaction logic
- `backend/core/workflows/executor.py` - Execution engine enhancements
- `backend/core/workflows/api.py` - New endpoint additions

**Medium Maintenance**:
- Node components (new node types)
- Config components (new configuration options)
- Validation rules (new validation logic)

**Low Maintenance**:
- Types (stable once defined)
- Database migration (one-time)
- Utilities (stable algorithms)

### Documentation Requirements

Each new file should include:
- File-level docstring explaining purpose
- Function/class docstrings with parameters and return types
- Complex algorithm comments (especially in executor.py, compiler.py)
- Example usage in critical components

---

## Summary

✅ **Total Impact**: 44 files (41 new, 3 modified)
✅ **Total Code**: ~8,895 lines (excluding specs documentation)
✅ **Backend/Frontend Split**: 43% backend, 59% frontend
✅ **New Dependencies**: 5 npm packages, 0 Python packages
✅ **Test Coverage**: 1,150 test lines for critical backend logic
✅ **Repository Growth**: +7% total codebase size

This feature represents a significant but well-structured addition to the Suna Kortix platform, extending the existing workflow system with advanced visual capabilities while maintaining full backward compatibility.

All files are organized logically by concern (backend/frontend, module boundaries, component hierarchy) and follow existing project patterns (Next.js App Router, FastAPI modules, AgentPress integration).

**Ready for implementation!** 🚀
