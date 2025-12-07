# Implementation Plan: Advanced Visual Workflow Builder

**Branch**: `advanced-workflows` | **Date**: 2025-11-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `D:\Homelab\suna\specs\003-advanced-workflows\spec.md`

## Summary

Build a sophisticated visual workflow builder that extends the existing/legacy list based Suna Kortix workflow system with an "Advanced Mode" featuring a node-based graph editor. The system will enable users to create complex, non-linear AI agent workflows with branching logic, conditions (both rule-based and LLM-based), variable management, and execution monitoring.

**Technical Approach**:
- **Dual-Mode System**: Refactor existing list based workflow system into "Simple" mode (list-based editor) while adding new "Advanced" mode (visual canvas)
- **Dual-State Storage**: Store both visual representation (`graph_definition` JSONB for UI) and compiled execution logic (`compiled_logic` JSONB for backend)
- **Frontend**: React Flow for visual graph editor, Lexical for rich text prompts with @ variable autocomplete
- **Backend**: New `GraphExecutor` service for graph traversal, integrated with existing AgentPress/ThreadManager architecture
- **Full Backward Compatibility**: Extend `agent_workflows` table without breaking existing workflows or execution patterns

## Technical Context

**Language/Version**:
- **Frontend**: TypeScript 5.x with React 18.3+, Next.js 15 (App Router)
- **Backend**: Python 3.11+ with FastAPI, asyncio event loop policy for Windows support

**Primary Dependencies**:
- **Frontend Visual Engine**: React Flow (xyflow) 12.x for node-based graph editing
- **Frontend Rich Text**: Lexical 0.16+ for prompt editing with structured variable mentions
- **Frontend State**: Zustand 4.x for canvas state (high-frequency updates), TanStack Query for server state
- **Frontend Auto-Layout**: Dagre 0.8.5 for automatic graph layout algorithm
- **Backend Execution**: Custom GraphExecutor service using existing Dramatiq, Redis, AgentPress
- **Backend Tools**: Existing tool registry auto-discovery (`backend/core/tools/`)

**Storage**:
- **Database**: PostgreSQL (Supabase) - Extend existing `agent_workflows` table
- **Schema Extension**: Add `mode` (ENUM), `graph_definition` (JSONB), `compiled_logic` (JSONB) columns
- **Caching**: Redis for execution state, ephemeral workflow context
- **Versioning**: Sync to `agent_versions.config.workflows` (existing pattern)

**Testing**:
- **Backend**: pytest with existing test patterns (`backend/TESTING.md`)
- **Frontend**: Jest + React Testing Library for component tests
- **E2E**: NEEDS CLARIFICATION - Playwright vs Cypress for graph editor interactions
- **Integration**: Test dual execution paths (simple vs advanced), graph compilation, execution monitoring

**Target Platform**:
- **Frontend**: Modern browsers (Chrome, Firefox, Safari, Edge) - 1280x720 minimum resolution
- **Backend**: Docker containers on Windows/Linux (existing self-hosted stack)
- **Deployment**: Existing Docker Compose setup with Cloudflare Tunnel support

**Project Type**: Full-stack web application (extends existing Next.js frontend + FastAPI backend)

**Performance Goals**:
- **Canvas Rendering**: 60fps interaction with up to 100 nodes
- **Workflow Save/Load**: < 2 seconds for 50-node workflows
- **Execution Overhead**: < 10% over theoretical minimum (sum of AI step response times)
- **Real-time Updates**: Sub-second WebSocket/SSE updates for execution status

**Constraints**:
- **Backward Compatibility**: 100% of existing simple workflows must continue working
- **No Breaking Changes**: Cannot modify or remove existing `agent_workflows` columns
- **Version Sync**: Must maintain `sync_workflows_to_version_config()` pattern
- **RLS Enforcement**: All queries must respect Basejump `has_role_on_account()` policies
- **Tool Compatibility**: Advanced workflows must call same tools as simple workflows
- **Execution Model**: Must reuse existing `execution_service.py`, ThreadManager, Dramatiq patterns

**Scale/Scope**:
- **Typical Workflows**: 5-20 nodes (primary use case)
- **Power User Workflows**: Up to 100 nodes (performance target)
- **Concurrent Users**: System-wide scaling (not workflow-specific concern)
- **MVP Scope**: P1 features only - visual editor, AI steps, basic execution monitoring, rule-based + LLM-based conditions, variable management with @ autocomplete

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Documentation Compliance

- ✅ **Maximum 3 Markdown Files**: Plan will generate `plan.md` (this file), `research.md`, `data-model.md` as primary docs. Contracts will be code/JSON. Quickstart will consolidate usage examples.
- ✅ **No Summary/Status Files**: No `STATUS.md` or `SUMMARY.md` - all status updates in chat/commits
- ✅ **Location Rules**: All docs under `specs/003-advanced-workflows/`, not repo root
- ✅ **Feature Documentation**: This is a major feature, properly placed under `specs/`

### Architecture Compliance

- ✅ **Graceful Degradation**: Advanced mode fails gracefully if visual editor unavailable; simple mode remains functional
- ✅ **AgentPress Tool Auto-Discovery**: Advanced workflows use same auto-discovered tools from `backend/core/tools/`
- ✅ **Self-Hosted Supabase & Basejump**: Extends `agent_workflows` table, respects RLS policies via `has_role_on_account()`
- ✅ **URL & Environment Flexibility**: Frontend uses existing three-layer URL detection (browser, server, middleware)
- ✅ **Performance & Observability**: Integrates with existing Redis, Dramatiq, Langfuse stack

### Development Workflow Compliance

- ✅ **Backend Testing**: Will use existing `backend/TESTING.md` patterns with pytest
- ✅ **Frontend Patterns**: Next.js App Router, server components by default, client components only when necessary (canvas requires client)
- ✅ **Knowledge Base Integration**: N/A - workflows don't directly interact with KB system
- ✅ **Windows Support**: Backend maintains existing Windows asyncio event loop policy
- ⚠️ **TDD Workflow**: SHOULD follow TDD for:
  - GraphExecutor graph traversal logic
  - Condition evaluation (rule-based and LLM-based)
  - Variable scoping and resolution
  - Graph compilation/decompilation algorithms
  - React Flow integration (prone to infinite render loops)

### Safety & Security Compliance

- ✅ **Secrets Management**: No new secrets required; uses existing LLM API keys from environment
- ✅ **Credential Encryption**: N/A - workflows don't store new credential types
- ✅ **Sandbox Safety**: Workflows execute in existing Daytona sandbox via ThreadManager

### GATE STATUS: ✅ **PASS** - All constitutional requirements met, no violations requiring justification

## Project Structure

> **📋 Complete File Structure**: See [project-structure.md](./project-structure.md) for the complete, detailed file tree with all 44 files (41 new, 3 modified), line counts, and implementation order.
>
> **⚠️ Living Document**: `project-structure.md` is a living document that MUST be updated as development progresses. When creating new files, modifying existing ones, or making architectural changes, immediately update project-structure.md to reflect the actual state of the codebase.

### Documentation (this feature)

```text
specs/003-advanced-workflows/
├── spec.md                    # ✅ Feature specification (completed)
├── plan.md                    # ✅ This file - implementation plan (completed)
├── research.md                # ✅ Phase 0 output - technology decisions (completed)
├── data-model.md              # ✅ Phase 1 output - database schema, types (completed)
├── quickstart.md              # ✅ Phase 1 output - developer onboarding (completed)
├── tasks.md                   # ✅ Phase 2 output - implementation tasks (completed)
├── project-structure.md       # ✅ Living document - file tree reference (completed)
├── contracts/                 # ✅ Phase 1 output - API contracts, type definitions
│   ├── api-endpoints.md       # ✅ REST API contract for workflow CRUD
│   ├── graph-definition.ts    # ✅ TypeScript: Visual state schema
│   └── compiled-logic.py      # ✅ Python: Execution logic schema
└── checklists/
    └── requirements.md        # ✅ Specification quality checklist (completed)
```

### Phase 1/2 Implementation Structure

**Key Files for Setup (Phase 1) and Foundational (Phase 2)**:

#### Backend Module: `backend/core/workflows/` (NEW)

```text
backend/core/workflows/              📁 NEW MODULE
├── __init__.py                      🆕 Module initialization, exports
├── models.py                        🆕 SQLAlchemy Workflow model (mode, graph_definition, compiled_logic)
├── types.py                         🆕 Python TypedDicts (CompiledLogic, ExecutionContext)
├── api.py                           🆕 FastAPI router (14 endpoints for workflow CRUD, execution, validation)
├── compiler.py                      🆕 GraphCompiler (graph_definition → compiled_logic)
├── validator.py                     🆕 GraphValidator (circular refs, orphaned nodes)
├── variables.py                     🆕 VariableResolver (@variable resolution in prompts)
├── executor.py                      🆕 GraphExecutor (iterative DFS graph traversal)
├── migrations/                      📁
│   └── 2025112400000000_advanced_workflows.sql   🆕 Schema extension (mode ENUM, JSONB columns, constraints)
└── tests/                           📁
    ├── test_compiler.py            🆕 Graph compilation tests
    ├── test_validator.py           🆕 Validation logic tests
    ├── test_executor.py            🆕 Execution engine tests
    └── test_variables.py           🆕 Variable resolution tests
```

**Backend Files**: 12 files (~3,850 lines including tests)

#### Frontend Structure: `frontend/src/` (EXTENDED)

```text
frontend/src/
├── app/(dashboard)/workflows/[id]/
│   ├── page.tsx                                 ✏️ MODIFY - Tab-based container for Simple/Advanced editors
│   └── advanced/                                📁 DEPRECATED - Merged into main page via tabs
│
├── components/workflows/                        📁 EXTENDS EXISTING
│   ├── workflow-tabs-navigation.tsx            🆕 Tab navigation component
│   ├── simple-workflow-editor.tsx              🆕 Extracted simple editor
│   ├── advanced-workflow-editor.tsx            🆕 Extracted advanced editor
│   ├── canvas/                                  📁 NEW
│   │   ├── WorkflowCanvas.tsx                  🆕 Main React Flow canvas (pan, zoom, nodes, edges)
│   │   ├── NodePalette.tsx                     🆕 Draggable node templates
│   │   ├── MiniMap.tsx                         🆕 Canvas overview navigation
│   │   └── AutoLayoutButton.tsx                🆕 Dagre auto-layout trigger
│   ├── nodes/                                   📁 NEW
│   │   ├── StartNode.tsx                       🆕 Trigger/start node
│   │   ├── EndNode.tsx                         🆕 Workflow termination node
│   │   ├── AIStepNode.tsx                      🆕 AI agent step node
│   │   ├── RuleConditionNode.tsx               🆕 Rule-based condition node
│   │   └── LLMConditionNode.tsx                🆕 LLM-based condition node
│   ├── config/                                  📁 NEW
│   │   ├── AIStepConfig.tsx                    🆕 AI step configuration panel
│   │   ├── RuleConditionConfig.tsx             🆕 Rule condition editor
│   │   ├── LLMConditionConfig.tsx              🆕 LLM condition editor
│   │   ├── ModelSelector.tsx                   🆕 Model dropdown
│   │   ├── ToolSelector.tsx                    🆕 Multi-select for tools
│   │   ├── VariableMentionNode.tsx             🆕 Lexical variable decorator (@variable rendering)
│   │   └── VariableMentionPlugin.tsx           🆕 Lexical autocomplete plugin (@ trigger)
│   ├── monitoring/                              📁 NEW
│   │   ├── ExecutionTimeline.tsx               🆕 Execution event log timeline
│   │   └── LiveNodeStatus.tsx                  🆕 Real-time node status indicators
│   └── ModeConversionDialog.tsx                ❌ REMOVED - Replaced by seamless tab switching
│
├── hooks/react-query/workflows/                 📁 NEW
│   ├── useWorkflow.ts                          🆕 Workflow CRUD operations (fetch, save, validate)
│   ├── useWorkflowValidation.ts                🆕 Graph validation hook
│   └── useWorkflowExecution.ts                 🆕 Execution & SSE monitoring hook
│
├── store/workflows/                             📁 NEW
│   ├── canvasStore.ts                          🆕 Zustand canvas state (nodes, edges, viewport)
│   └── executionStore.ts                       🆕 Execution monitoring state (events, status)
│
├── types/workflows/                             📁 NEW
│   ├── index.ts                                🆕 Type re-exports
│   └── graph-definition.ts                     🆕 Visual state types (from contracts/)
│
└── lib/workflows/                               📁 NEW
    └── autoLayout.ts                           🆕 Dagre layout integration
```

**Frontend Files**: 29 files (~5,220 lines)

### Modified Existing Files

1. **`backend/api.py`** (+5 lines): Register workflows router
2. **`frontend/src/app/(dashboard)/workflows/[id]/page.tsx`** (+50 lines): Mode switcher UI
3. **`CLAUDE.md`** (+200 lines): Document React Flow, Lexical, Zustand, Dagre usage

### New Dependencies

**Frontend** (`frontend/package.json`):
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

**Backend**: No new external dependencies (uses existing FastAPI, Pydantic, Supabase, Redis, Dramatiq)

### Implementation Summary

| Category | New Files | Modified Files | Lines of Code |
|----------|-----------|----------------|---------------|
| **Backend Core** | 8 | 1 | ~2,700 |
| **Backend Tests** | 4 | 0 | ~1,150 |
| **Frontend** | 29 | 2 | ~5,220 |
| **Database** | 1 | 0 | ~25 |
| **Documentation** | 0 | 1 | +200 |
| **TOTAL** | **42** | **4** | **~9,295** |

**Structure Decision**:

This feature extends the existing **Option 2: Web application** structure. We are NOT creating new top-level directories, but rather:
1. **Backend**: Adding a new| `GET /workflows/:id/variables` | List available variables |
| `POST /workflows/:id/variables/validate` | Validate prompt variables |execution logic
1. **Backend**: Adding a new `core/workflows/` service module for graph execution logic
2. **Frontend**: Adding new components under `components/workflows/` while preserving existing simple mode components
3. **Database**: Extending existing `agent_workflows` table via new migration
4. **Tests**: Adding parallel test structures in `backend/core/workflows/tests/`

**Rationale**: This approach maximizes code reuse, maintains backward compatibility, and follows existing Suna Kortix architectural patterns (AgentPress, ThreadManager, tool registry, TanStack Query hooks).

**Maintenance**: As implementation progresses, `project-structure.md` serves as the authoritative reference for all file locations, purposes, and dependencies. Update it whenever you:
- Create new files
- Modify existing files
- Change file locations
- Add/remove dependencies
- Refactor module boundaries

## Complexity Tracking

**No constitutional violations** - this section is empty per requirement: "Fill ONLY if Constitution Check has violations that must be justified."

All complexity is justified by functional requirements in the spec:
- Visual graph editor required for P1 success criteria (users understand workflow logic by viewing canvas)
- Dual-state storage required for both UI persistence and execution performance
- Custom nodes/edges required for domain-specific workflow features (condition branches, variable autocomplete)
- GraphExecutor required for non-linear execution that existing LLM-interpreted model cannot support

---

## Phase 0: Research & Technology Decisions

### Research Tasks

#### R1: React Flow Implementation Patterns
**Status**: NEEDS RESEARCH
**Question**: What are the best practices for implementing custom nodes, edges, and handling high-frequency state updates in React Flow 12.x?

**Research Areas**:
- Custom node implementation patterns (avoid re-renders on drag)
- Edge routing algorithms (smooth step vs bezier vs straight)
- State management strategies (when to use React Flow state vs external store)
- Performance optimization for 100+ node graphs
- Viewport persistence and restoration

**Decision Format**:
```
Decision: [React Flow architecture pattern]
Rationale: [Performance, maintainability trade-offs]
Alternatives: [Canvas API, SVG from scratch, other libraries]
```

#### R2: Lexical Variable Mention Plugin
**Status**: NEEDS RESEARCH
**Question**: How to implement custom Lexical nodes for @variable autocomplete that serialize to/from JSON?

**Research Areas**:
- Lexical plugin architecture for custom node types
- Autocomplete/typeahead implementation in Lexical
- Serialization of structured mentions to JSON (not just text)
- Variable substitution during prompt execution
- Accessibility considerations for keyboard-only variable insertion

**Decision Format**:
```
Decision: [Lexical plugin pattern]
Rationale: [Structured data vs string replacement trade-offs]
Alternatives: [Plain text with regex, Draft.js, Slate.js]
```

#### R3: Graph Traversal & Execution Algorithm
**Status**: NEEDS RESEARCH
**Question**: What is the optimal algorithm for traversing the compiled workflow graph and maintaining execution context?

**Research Areas**:
- Depth-first vs breadth-first traversal for workflow graphs
- Handling parallel branches (when to fork execution context)
- Cycle detection algorithms (prevent infinite loops in user-created workflows)
- Execution context management (when to copy vs reference variables)
- Error recovery strategies (what happens when a branch fails)

**Decision Format**:
```
Decision: [Traversal algorithm + context strategy]
Rationale: [Correctness, debuggability, performance]
Alternatives: [Event-driven execution, state machine, continuation-passing]
```

#### R4: LLM-Based Condition Evaluation
**Status**: NEEDS RESEARCH
**Question**: How to reliably evaluate natural language conditions ("if response seems urgent") using a mini LLM?

**Research Areas**:
- Few-shot prompting patterns for boolean classification
- Structured output formats (JSON mode, function calling)
- Model selection for fast, cheap condition evaluation (GPT-4o-mini, Claude Haiku)
- Fallback strategies when LLM unavailable or ambiguous
- Caching condition results for identical inputs

**Decision Format**:
```
Decision: [LLM-based condition pattern]
Rationale: [Accuracy vs cost vs latency]
Alternatives: [Sentiment analysis APIs, keyword matching, hybrid approach]
```

#### R5: Real-Time Execution Monitoring
**Status**: NEEDS RESEARCH
**Question**: How to push execution status updates to the frontend in real-time as workflow progresses?

**Research Areas**:
- WebSocket vs Server-Sent Events (SSE) for execution updates
- Integration with existing Redis pub/sub and SSE infrastructure
- Message format for execution events (node started, completed, failed)
- Frontend state synchronization (updating canvas node states)
- Handling reconnection and missed events

**Decision Format**:
```
Decision: [Real-time communication pattern]
Rationale: [Compatibility with existing system, reliability]
Alternatives: [Polling, webhooks, GraphQL subscriptions]
```

#### R6: Dagre Auto-Layout Configuration
**Status**: NEEDS RESEARCH
**Question**: What Dagre configuration produces clean, readable workflow layouts for various graph topologies?

**Research Areas**:
- Rankdir (TB, LR, BT, RL) and when to use each
- Node separation and rank separation values
- Handling parallel branches (spread horizontally vs stack vertically)
- Edge routing with Dagre vs manual adjustment
- Performance with 50+ nodes

**Decision Format**:
```
Decision: [Dagre configuration profile]
Rationale: [Readability, user expectations]
Alternatives: [ELK layout, force-directed layout, manual positioning only]
```

#### R7: Backward Compatibility Testing Strategy
**Status**: NEEDS RESEARCH
**Question**: How to ensure existing simple mode workflows continue working without regression?

**Research Areas**:
- Contract testing patterns for dual execution paths
- Migration testing (ensure NULL mode defaults to simple)
- Integration test coverage for existing workflow execution
- Test data generation for edge cases (nested conditionals, tool calls)
- Rollback procedures if advanced mode breaks production

**Decision Format**:
```
Decision: [Testing + rollout strategy]
Rationale: [Risk mitigation, confidence]
Alternatives: [Feature flags, staged rollout, shadow mode]
```

### Technology Decisions Summary

| Technology | Version | Purpose | Alternatives Considered |
|------------|---------|---------|-------------------------|
| React Flow | 12.x | Visual graph editor | Canvas API (too low-level), Rete.js (less maintained), JointJS (commercial) |
| Lexical | 0.16+ | Rich text prompts with variable mentions | Draft.js (deprecated), Slate.js (complex API), ProseMirror (steeper learning curve) |
| Zustand | 4.x | Canvas state management | Redux Toolkit (too heavy), React Context (performance issues), Jotai (less mature) |
| Dagre | 0.8.5 | Auto-layout algorithm | ELK (overkill), d3-force (not hierarchical), Cytoscape (graph viz not workflow-optimized) |
| Dramatiq | Existing | Background workflow execution | No change - reuse existing queue |
| Supabase | Existing | Database + RLS | No change - extend existing schema |

**Research Output**: All decisions documented in `research.md` with rationales and rejected alternatives.

---

## Phase 1: Design & Contracts

### Database Schema Design

**File**: `data-model.md`

#### Schema Extension (Migration)

```sql
-- Migration: [timestamp]_add_advanced_workflows.sql

-- 1. Create workflow mode enum
CREATE TYPE workflow_mode AS ENUM ('simple', 'advanced');

-- 2. Extend agent_workflows table
ALTER TABLE agent_workflows
ADD COLUMN mode workflow_mode DEFAULT 'simple',
ADD COLUMN graph_definition JSONB DEFAULT NULL,
ADD COLUMN compiled_logic JSONB DEFAULT NULL;

-- 3. Add check constraint
ALTER TABLE agent_workflows
ADD CONSTRAINT check_advanced_workflow_data
CHECK (
  (mode = 'simple') OR
  (mode = 'advanced' AND graph_definition IS NOT NULL AND compiled_logic IS NOT NULL)
);

-- 4. Add indexes for performance
CREATE INDEX idx_agent_workflows_mode ON agent_workflows(mode);
CREATE INDEX idx_agent_workflows_agent_mode ON agent_workflows(agent_id, mode);

-- 5. Update RLS policies (preserve existing logic)
-- No changes needed - existing policies apply to all columns
```

#### Data Model Entities

**Workflow** (extends existing `agent_workflows` row):
```typescript
interface Workflow {
  // Existing columns (unchanged)
  id: string;
  agent_id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger_phrase: string | null;
  is_default: boolean;
  steps: WorkflowStep[] | null;  // Preserved for simple mode
  created_at: string;
  updated_at: string;

  // New columns for advanced mode
  mode: 'simple' | 'advanced';
  graph_definition: GraphDefinition | null;  // Visual state
  compiled_logic: CompiledLogic | null;      // Execution logic
}
```

**GraphDefinition** (visual state):
```typescript
interface GraphDefinition {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  viewport: { x: number; y: number; zoom: number };
}

interface NodeData {
  id: string;
  label: string;
  type: 'TRIGGER' | 'AI_STEP' | 'RULE_CONDITION' | 'LLM_CONDITION' | 'STOP';
  config: NodeConfig;
  isValid?: boolean;
}

interface NodeConfig {
  // AI Step config
  modelId?: string;
  systemPrompt?: string;
  userPrompt?: LexicalJSON;  // Serialized Lexical editor state
  temperature?: number;
  maxTokens?: number;
  tools?: string[];

  // Condition config
  rules?: ConditionRule[];  // For rule-based conditions
  naturalLanguage?: string;  // For LLM-based conditions

  // Variable output config
  outputVariable?: string;  // Name to store step output
}

interface ConditionRule {
  field: string;  // Variable path (e.g., "response.sentiment")
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches_regex';
  value: string | number;
}
```

**CompiledLogic** (execution state):
```python
class CompiledLogic(TypedDict):
    version: str  # "1.0"
    start_node_id: str
    nodes: Dict[str, LogicNode]
    variables: List[str]  # Declared workflow-level variables

class LogicNode(TypedDict):
    id: str
    type: str  # "TRIGGER", "LLM", "TOOL", "RULE_CONDITION", "LLM_CONDITION", "STOP"
    config: Dict[str, Any]  # Type-specific configuration
    transitions: List[Transition]

class Transition(TypedDict):
    target_id: str
    condition: Optional[str]  # "true", "false", "default", None
```

### API Contracts

**File**: `contracts/api-endpoints.md`

#### Workflow CRUD Endpoints (Modified)

**GET /workflows/agents/{agent_id}/workflows**
- **Change**: Add `mode` field to response
- **Response**:
  ```json
  {
    "id": "uuid",
    "agent_id": "uuid",
    "name": "string",
    "mode": "simple" | "advanced",
    "status": "draft" | "active",
    "steps": [...] | null,
    "graph_definition": {...} | null,
    "compiled_logic": {...} | null
  }
  ```

**POST /workflows/agents/{agent_id}/workflows**
- **Change**: Accept `mode`, `graph_definition`, `compiled_logic` in request
- **Request**:
  ```json
  {
    "name": "string",
    "mode": "simple" | "advanced",
    "steps": [...] | null,  // Required if mode=simple
    "graph_definition": {...} | null,  // Required if mode=advanced
    "compiled_logic": {...} | null  // Auto-generated if not provided
  }
  ```

**PUT /workflows/agents/{agent_id}/workflows/{workflow_id}**
- **Change**: Support mode switching (simple → advanced only), validate constraints

**DELETE /workflows/agents/{agent_id}/workflows/{workflow_id}**
- **No change**

**POST /workflows/agents/{agent_id}/workflows/{workflow_id}/execute**
- **Change**: Detect mode and route to appropriate executor
- **Response**: Same (thread_id, agent_run_id)

#### New Graph Compilation Endpoint

**POST /workflows/agents/{agent_id}/workflows/{workflow_id}/compile**
- **Purpose**: Compile graph_definition → compiled_logic (frontend can validate before save)
- **Request**: `{ "graph_definition": {...} }`
- **Response**: `{ "compiled_logic": {...}, "validation_errors": [...] }`

#### New Execution Monitoring Endpoint

**GET /workflows/executions/{thread_id}/status** (SSE)
- **Purpose**: Stream real-time execution updates
- **Response Stream**:
  ```json
  {"event": "node_started", "node_id": "step_1", "timestamp": "..."}
  {"event": "node_completed", "node_id": "step_1", "output": "...", "duration_ms": 1234}
  {"event": "node_failed", "node_id": "step_2", "error": "..."}
  ```

#### New Variable Endpoints

**GET /workflows/{workflow_id}/variables**
- **Purpose**: List all available variables in workflow (from trigger context and step outputs)
- **Response**: `{ "variables": ["trigger.email", "step_1.output"] }`

**POST /workflows/{workflow_id}/variables/validate**
- **Purpose**: Validate prompt variables against available variables
- **Request**: `{ "prompt": "Hello @trigger.name" }`
- **Response**: `{ "valid": true, "missing_variables": [] }`

### Component Architecture

**File**: `contracts/component-tree.md`

```text
<AdvancedWorkflowBuilder>
  │
  ├─ <ReactFlowProvider>                  # React Flow context
  │   │
  │   └─ <WorkflowCanvas>                 # Main canvas
  │       ├─ <Background>                 # Grid background
  │       ├─ <Controls>                   # Zoom/pan controls
  │       ├─ <MiniMap>                    # Overview
  │       └─ nodes/edges (rendered by React Flow)
  │
  ├─ <NodePalette>                        # Left sidebar
  │   ├─ <DraggableNode type="trigger">
  │   ├─ <DraggableNode type="ai_step">
  │   ├─ <DraggableNode type="rule_condition">
  │   └─ <DraggableNode type="llm_condition">
  │
  └─ <PropertyPanel>                      # Right sidebar
      ├─ <AIStepConfig>                   # Conditional rendering
      │   ├─ <ModelSelector>
      │   ├─ <SystemPromptInput>
      │   └─ <VariableMentionEditor>      # Lexical
      │       └─ <VariableAutocomplete>
      │
      ├─ <RuleConditionConfig>
      │   └─ <RuleBuilder>
      │
      └─ <LLMConditionConfig>
          └─ <NaturalLanguageInput>
```

### Quickstart Guide

**File**: `quickstart.md`

Consolidated developer onboarding covering:
1. Local development setup (frontend + backend)
2. Running advanced workflow editor in dev mode
3. Creating a test workflow with conditions and variables
4. Executing workflow and viewing real-time updates
5. Writing tests for new graph components
6. Common troubleshooting (canvas not rendering, variable autocomplete not working)

---

## Phase 2: Task Breakdown

**Note**: This phase generates `tasks.md` via `/speckit.tasks` command. Not created by `/speckit.plan`.

The tasks will be organized by implementation phases from the spec:

**Phase 0: Foundation** (Database, Types, Validation)
- Database migration
- TypeScript interfaces
- Python data classes
- Graph validation logic

**Phase 1: Visual Editor** (Frontend Components)
- React Flow canvas setup
- Custom node components
- Property panel
- Node palette

**Phase 2: Graph Logic** (Compilation, Execution)
- Graph compiler (visual → logic)
- Graph hydrator (logic → visual)
- Graph executor (traversal)
- Condition evaluator

**Phase 3: Variable System** (Lexical Plugin, Resolution)
- Lexical variable mention plugin
- Variable autocomplete
- Variable resolver
- Variable scoping validation

**Phase 4: Execution & Monitoring** (Real-time Updates)
- Execution service integration
- Real-time SSE/WebSocket
- Execution monitor UI
- Execution history

**Phase 5: Testing & Polish** (E2E, Performance, Docs)
- Backend unit tests
- Frontend component tests
- Integration tests
- E2E tests
- Performance benchmarks
- User documentation

---

## Risk Management

### Critical Path Risks

1. **Lexical Variable Plugin Complexity** (HIGH)
   - **Risk**: Custom Lexical nodes for @ mentions more complex than anticipated
   - **Mitigation**: Prototype plugin in isolation before integrating, have fallback to simple text input
   - **Impact**: Could delay variable system by 1-2 weeks

2. **React Flow Performance** (MEDIUM)
   - **Risk**: Canvas lags with 100 nodes despite optimization
   - **Mitigation**: Early performance testing with synthetic 100-node graphs, virtualization if needed
   - **Impact**: May need to reduce node count target to 50 for MVP

3. **Backward Compatibility Regressions** (HIGH)
   - **Risk**: Changes to execution_service break existing simple workflows
   - **Mitigation**: Comprehensive contract tests, feature flag for advanced mode, staged rollout
   - **Impact**: Production incident if not caught in testing

4. **GraphExecutor Cycle Detection** (MEDIUM)
   - **Risk**: User creates workflow with infinite loop, crashes worker
   - **Mitigation**: Cycle detection in validation, step count limit, timeout enforcement
   - **Impact**: Worker downtime if loop executes before validation

5. **LLM Condition Evaluation Cost** (LOW)
   - **Risk**: LLM-based conditions incur unexpected API costs for frequent evaluations
   - **Mitigation**: Caching condition results, prompt optimization, model cost monitoring
   - **Impact**: Higher operating costs but not blocking

### Mitigation Strategies

- **Early Prototyping**: Build Lexical plugin and React Flow integration in separate sandbox before main implementation
- **Incremental Rollout**: Ship advanced mode behind feature flag, enable for internal users first
- **Monitoring**: Add Langfuse traces for all LLM-based condition evaluations
- **Testing**: Extensive integration tests for dual execution paths (simple vs advanced)
- **Documentation**: Clear migration guide for converting simple → advanced workflows

---

## Success Metrics (from Spec)

These metrics will be validated in Phase 5 testing:

1. ✅ **SC-001**: 5-step workflow creation in < 5 minutes (user testing)
2. ✅ **SC-002**: 60fps with 100 nodes (performance benchmark)
3. ✅ **SC-003**: 99% execution success rate (integration tests)
4. ✅ **SC-004**: 80%+ comprehension from visual alone (user testing)
5. ✅ **SC-005**: Save/load < 2 seconds for 50 nodes (performance benchmark)
6. ✅ **SC-006**: 90% self-service debugging (user testing + support tickets)
7. ✅ **SC-007**: 100% invalid workflow prevention (validation tests)
8. ✅ **SC-008**: < 10% execution overhead (performance benchmark)
9. ✅ **SC-009**: +20 NPS improvement (user survey)
10. ✅ **SC-010**: 3x faster creation than code (user testing)

---

## Next Steps

1. ✅ **Complete Phase 0**: Generate `research.md` resolving all NEEDS RESEARCH items
2. ✅ **Complete Phase 1**: Generate `data-model.md`, `contracts/*`, `quickstart.md`
3. ⏭️ **Run `/speckit.tasks`**: Generate `tasks.md` with dependency-ordered implementation tasks
4. ⏭️ **Begin Implementation**: Start with Phase 0 (database migration, types, validation)

**This plan is ready for Phase 0 research execution.**
