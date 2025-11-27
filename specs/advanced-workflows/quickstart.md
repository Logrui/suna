# Developer Quickstart Guide: Advanced Visual Workflows

**Feature**: Advanced Visual Workflow Builder
**Version**: 1.0.0
**Created**: 2025-11-23
**Branch**: `feature/workflows-playbooks`

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Key Technologies](#key-technologies)
5. [Development Setup](#development-setup)
6. [Architecture Primer](#architecture-primer)
7. [Common Development Tasks](#common-development-tasks)
8. [Testing Strategy](#testing-strategy)
9. [Debugging Tips](#debugging-tips)
10. [Resources](#resources)

---

## Overview

This feature adds a **visual graph-based workflow builder** to Suna Kortix, enabling users to design complex AI agent workflows using a drag-and-drop interface. The system maintains **backward compatibility** with existing "Simple Mode" list-based workflows while introducing an "Advanced Mode" for power users.

### What You'll Build

- **Frontend**: React Flow-based visual canvas with custom nodes (AI Steps, Conditions, etc.)
- **Backend**: Graph execution engine using iterative DFS traversal
- **Database**: Dual-state storage (visual `graph_definition` + optimized `compiled_logic`)
- **Real-time**: SSE monitoring of workflow execution with Redis pub/sub

### Key Design Principle

**Dual Execution Model**: Simple and Advanced modes coexist. The system automatically routes workflows to the appropriate execution engine based on the `mode` field. No breaking changes to existing workflows.

---

## Prerequisites

### Required Knowledge

- **TypeScript/React**: Functional components, hooks, context
- **Python**: Async/await, type hints, dataclasses
- **FastAPI**: Routing, dependency injection, background tasks
- **PostgreSQL**: JSONB columns, row-level security
- **Supabase**: Auth, database client, storage

### Required Tools

- **Node.js**: v20+ with npm/pnpm
- **Python**: 3.11+ with `uv` package manager
- **Docker**: For Redis and Supabase
- **Git**: For version control

### Recommended Reading

1. **Project Context**: `D:\Homelab\suna\CLAUDE.md` (project overview)
2. **Specification**: `specs/003-advanced-workflows/spec.md` (feature requirements)
3. **Implementation Plan**: `specs/003-advanced-workflows/plan.md` (technical approach)
4. **Research**: `specs/003-advanced-workflows/research.md` (technology decisions)

---

## Project Structure

```
D:\Homelab\suna\
├── backend/
│   ├── core/
│   │   ├── agentpress/          # Existing ThreadManager, tool system
│   │   │   ├── thread_manager.py
│   │   │   └── tool_registry.py
│   │   ├── workflows/           # NEW: Advanced workflow system
│   │   │   ├── __init__.py
│   │   │   ├── models.py        # Database models
│   │   │   ├── api.py           # FastAPI router
│   │   │   ├── compiler.py      # graph_definition → compiled_logic
│   │   │   ├── executor.py      # Graph execution engine
│   │   │   ├── validator.py     # Graph validation
│   │   │   ├── variables.py     # Variable resolution
│   │   │   └── tests/
│   │   │       ├── test_compiler.py
│   │   │       ├── test_executor.py
│   │   │       └── test_validator.py
│   │   └── services/
│   │       ├── supabase.py      # Database client
│   │       └── redis.py         # Cache & pub/sub
│   └── api.py                   # Main FastAPI app
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── (dashboard)/
│   │   │       └── workflows/   # Existing simple workflows UI
│   │   │           └── [id]/
│   │   │               ├── page.tsx              # Workflow detail (simple)
│   │   │               └── advanced/             # NEW: Advanced editor
│   │   │                   └── page.tsx
│   │   ├── components/
│   │   │   └── workflows/
│   │   │       ├── canvas/                       # NEW: React Flow canvas
│   │   │       │   ├── WorkflowCanvas.tsx
│   │   │       │   ├── NodePalette.tsx
│   │   │       │   └── MiniMap.tsx
│   │   │       ├── nodes/                        # NEW: Custom nodes
│   │   │       │   ├── AIStepNode.tsx
│   │   │       │   ├── RuleConditionNode.tsx
│   │   │       │   ├── LLMConditionNode.tsx
│   │   │       │   └── StartEndNode.tsx
│   │   │       ├── config/                       # NEW: Node config panels
│   │   │       │   ├── AIStepConfig.tsx
│   │   │       │   ├── ConditionConfig.tsx
│   │   │       │   └── VariableEditor.tsx
│   │   │       └── monitoring/                   # NEW: Execution monitor
│   │   │           ├── ExecutionTimeline.tsx
│   │   │           └── LiveNodeStatus.tsx
│   │   ├── hooks/
│   │   │   └── react-query/
│   │   │       └── workflows/                    # NEW: API hooks
│   │   │           ├── useWorkflow.ts
│   │   │           ├── useWorkflowValidation.ts
│   │   │           └── useWorkflowExecution.ts
│   │   └── store/
│   │       └── workflows/                        # NEW: Zustand stores
│   │           ├── canvasStore.ts
│   │           └── executionStore.ts
│   └── package.json
│
└── specs/
    └── 003-advanced-workflows/
        ├── spec.md              # Feature specification
        ├── plan.md              # Implementation plan
        ├── research.md          # Technology research
        ├── data-model.md        # Database schema
        ├── contracts/           # API & type contracts
        │   ├── api-endpoints.md
        │   ├── graph-definition.ts
        │   └── compiled-logic.py
        └── quickstart.md        # This file
```

---

## Key Technologies

### Frontend Stack

| Technology | Version | Purpose | Docs |
|------------|---------|---------|------|
| **React Flow** | 12.x | Visual graph editor | [reactflow.dev](https://reactflow.dev) |
| **Lexical** | 0.16+ | Rich text editor for prompts | [lexical.dev](https://lexical.dev) |
| **Zustand** | 4.x | Canvas state management | [zustand-demo.pmnd.rs](https://zustand-demo.pmnd.rs) |
| **Dagre** | 0.8.5 | Auto-layout algorithm | [github.com/dagrejs/dagre](https://github.com/dagrejs/dagre) |
| **TanStack Query** | 5.x | Server state caching | [tanstack.com/query](https://tanstack.com/query) |
| **Radix UI** | Latest | Unstyled UI primitives | [radix-ui.com](https://radix-ui.com) |

### Backend Stack

| Technology | Version | Purpose | Docs |
|------------|---------|---------|------|
| **FastAPI** | 0.115+ | REST API framework | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) |
| **Dramatiq** | 1.17+ | Background job queue | [dramatiq.io](https://dramatiq.io) |
| **Pydantic** | 2.x | Data validation | [docs.pydantic.dev](https://docs.pydantic.dev) |
| **Redis** | 7.x | Pub/sub & caching | [redis.io](https://redis.io) |
| **Supabase** | Latest | PostgreSQL + Auth | [supabase.com](https://supabase.com) |

### Key Patterns

- **Dual-State Storage**: `graph_definition` (visual) + `compiled_logic` (execution)
- **Iterative DFS**: Graph traversal without recursion (avoid stack overflow)
- **SSE Streaming**: Real-time execution updates via Redis pub/sub
- **Contract-First**: TypeScript/Python types defined before implementation
- **Snapshot Testing**: Validate graph compilation output

---

## Development Setup

### 1. Clone and Branch

```bash
# Already on feature/workflows-playbooks branch
git status  # Verify branch

# If needed, create branch
git checkout -b feature/workflows-playbooks
```

### 2. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
uv sync
```

### 3. Start Services

```bash
# Start Redis (required)
cd backend
docker compose up redis -d

# Start Supabase (separate terminal)
cd ../../suna-supabase/docker
docker compose up -d

# Start backend API (terminal 1)
cd ../../suna/backend
uv run uvicorn api:app --host 0.0.0.0 --port 8000 --reload

# Start Dramatiq worker (terminal 2)
cd backend
uv run dramatiq --processes 4 --threads 4 run_agent_background

# Start frontend (terminal 3)
cd frontend
npm run dev
```

### 4. Verify Setup

- Frontend: http://localhost:9990
- Backend API: http://localhost:8000/docs
- Supabase Studio: http://localhost:6005

---

## Architecture Primer

### Data Flow

```
User Actions (Canvas)
  ↓
React Flow State (Zustand)
  ↓
graph_definition (JSONB)
  ↓
GraphCompiler.compile()
  ↓
compiled_logic (JSONB)
  ↓
GraphExecutor.execute()
  ↓
Thread Messages
```

### Dual-State Storage

#### graph_definition (Visual State)
- **Purpose**: Render canvas in React Flow
- **Structure**: React Flow nodes/edges with position, style metadata
- **Updated**: Every canvas change (high frequency)
- **Example**:
  ```json
  {
    "nodes": [
      {
        "id": "node_1",
        "type": "ai_step",
        "position": {"x": 100, "y": 100},
        "data": {
          "label": "Research",
          "config": {"prompt": "@trigger.topic"}
        }
      }
    ],
    "edges": [...],
    "viewport": {"x": 0, "y": 0, "zoom": 1}
  }
  ```

#### compiled_logic (Execution State)
- **Purpose**: Execute workflow efficiently
- **Structure**: Flattened node lookup with next_nodes lists
- **Updated**: Only when workflow saved
- **Example**:
  ```json
  {
    "version": "1.0.0",
    "start_node_id": "node_1",
    "nodes": {
      "node_1": {
        "id": "node_1",
        "type": "ai_step",
        "config": {"prompt": "@trigger.topic"},
        "next_nodes": ["node_2"]
      }
    }
  }
  ```

### Mode Detection

Backend router inspects `mode` field to determine execution path:

```python
# backend/core/workflows/api.py
@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str):
    workflow = await get_workflow(workflow_id)

    if workflow.mode == "simple":
        # Use existing SimpleWorkflowExecutor
        return await execute_simple_workflow(workflow)
    elif workflow.mode == "advanced":
        # Use new GraphExecutor
        return await execute_advanced_workflow(workflow)
```

### Variable System

Variables use `@` prefix and support dot notation:

- **Trigger context**: `@trigger.topic`, `@trigger.user_email`
- **Node outputs**: `@research_results`, `@summary`
- **Nested objects**: `@trigger.user.name`

**Resolution Process**:
1. Extract all `@variable` patterns from prompt
2. Look up in `ExecutionContext.variables`
3. Replace with string representation
4. Error if required variable undefined

---

## Common Development Tasks

### Task 1: Create a New Node Type

**Example**: Add a "Delay" node that waits N seconds before continuing.

#### 1. Define TypeScript Interface

Edit `contracts/graph-definition.ts`:

```typescript
export interface DelayNodeData extends BaseNodeData {
  config: {
    duration_seconds: number;
    message?: string;
  };
}

export type WorkflowNode =
  | Node<StartNodeData, 'start'>
  | Node<DelayNodeData, 'delay'>  // Add here
  | ...;
```

#### 2. Define Python Model

Edit `contracts/compiled-logic.py`:

```python
class DelayLogicNode(TypedDict):
    id: str
    type: Literal['delay']
    label: str
    config: 'DelayConfig'
    next_nodes: list[str]

class DelayConfig(TypedDict):
    duration_seconds: int
    message: NotRequired[str]
```

#### 3. Create React Component

Create `frontend/src/components/workflows/nodes/DelayNode.tsx`:

```tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import type { DelayNodeData } from '@/types/workflows';

export const DelayNode = memo(({ data, id }: NodeProps<DelayNodeData>) => {
  return (
    <div className="delay-node">
      <Handle type="target" position={Position.Top} />

      <div className="node-header">
        <Clock className="w-4 h-4" />
        <span>{data.label}</span>
      </div>

      <div className="node-body">
        Wait {data.config.duration_seconds}s
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});
```

#### 4. Register Node Type

Edit `frontend/src/components/workflows/canvas/WorkflowCanvas.tsx`:

```tsx
const nodeTypes = {
  start: StartNode,
  ai_step: AIStepNode,
  delay: DelayNode,  // Add here
  ...
};
```

#### 5. Add to Node Palette

Edit `frontend/src/components/workflows/canvas/NodePalette.tsx`:

```tsx
const nodeTemplates = [
  {
    type: 'delay',
    displayName: 'Delay',
    icon: Clock,
    color: 'gray',
    defaultData: {
      label: 'Delay',
      config: { duration_seconds: 5 }
    }
  },
  ...
];
```

#### 6. Implement Backend Executor

Edit `backend/core/workflows/executor.py`:

```python
async def _execute_delay(
    self,
    node: DelayLogicNode,
    context: ExecutionContext,
) -> str:
    """Execute delay node"""
    duration = node['config']['duration_seconds']

    # Publish start event
    self._publish_event({
        'event_type': 'node_started',
        'node_id': node['id'],
        'details': {'duration': duration}
    })

    # Wait
    await asyncio.sleep(duration)

    # Publish completion
    self._publish_event({
        'event_type': 'node_completed',
        'node_id': node['id']
    })

    return node['next_nodes'][0]
```

---

### Task 2: Add a New API Endpoint

**Example**: Add `GET /workflows/:id/export` to export workflow as JSON.

#### 1. Define Contract

Edit `contracts/api-endpoints.md`:

```markdown
### GET /workflows/:workflowId/export

**Description**: Export workflow as portable JSON
**Response 200**:
```json
{
  "workflow": { ... },
  "export_version": "1.0.0",
  "exported_at": "2025-11-23T10:00:00Z"
}
```
```

#### 2. Implement Backend Route

Edit `backend/core/workflows/api.py`:

```python
@router.get("/workflows/{workflow_id}/export")
async def export_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
):
    # Get workflow
    workflow = await get_workflow(workflow_id)

    # Verify permissions
    if not has_access(current_user, workflow.account_id):
        raise HTTPException(403, "Access denied")

    # Build export
    export_data = {
        "workflow": workflow.dict(exclude={'id', 'account_id'}),
        "export_version": "1.0.0",
        "exported_at": datetime.utcnow().isoformat()
    }

    return export_data
```

#### 3. Create Frontend Hook

Create `frontend/src/hooks/react-query/workflows/useWorkflowExport.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';

export function useWorkflowExport(workflowId: string) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'export'],
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${workflowId}/export`);
      if (!res.ok) throw new Error('Export failed');
      return res.json();
    },
    enabled: !!workflowId,
  });
}
```

#### 4. Add UI Button

Edit workflow page:

```tsx
function WorkflowActions({ workflowId }: { workflowId: string }) {
  const { data, refetch } = useWorkflowExport(workflowId);

  const handleExport = async () => {
    const result = await refetch();
    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${workflowId}.json`;
    a.click();
  };

  return (
    <Button onClick={handleExport}>
      <Download /> Export
    </Button>
  );
}
```

---

### Task 3: Debug a Graph Execution Issue

**Scenario**: Workflow fails at step 3 with "Variable not found" error.

#### 1. Check Execution Logs

```bash
# Backend logs
docker compose logs backend -f | grep "workflow_execution"

# Look for ExecutionEvent with error details
```

#### 2. Inspect ExecutionContext

Add logging to `executor.py`:

```python
async def _execute_node(self, node, context):
    logger.info(f"Executing {node['id']}")
    logger.info(f"Available variables: {list(context.variables.keys())}")
    ...
```

#### 3. Validate compiled_logic

```bash
# Query database
psql -h localhost -U postgres -d supabase
SELECT compiled_logic->'variables' FROM agent_workflows WHERE id = 'workflow_id';
```

#### 4. Check Variable Resolution

Use Python debugger:

```python
# Add breakpoint in variables.py
import pdb; pdb.set_trace()

def resolve_prompt(self, prompt: str, context: ExecutionContext) -> str:
    variables = self.extract_variables(prompt)
    # Check which variable is missing
    ...
```

#### 5. Fix Common Issues

- **Variable name mismatch**: Check `output_variable` in node config
- **Conditional variable**: Check if upstream condition failed
- **Typo in reference**: Use autocomplete system (FR-031)

---

## Testing Strategy

### Test Pyramid

```
     E2E Tests (5%)
    ─────────────────
   Integration Tests (25%)
  ─────────────────────────
  Unit Tests (70%)
──────────────────────────────
```

### Unit Tests (Fast, No External Dependencies)

**Backend**: `backend/core/workflows/tests/`

```python
# test_compiler.py
def test_compile_simple_workflow():
    graph_def = {
        "nodes": [
            {"id": "start", "type": "start", ...},
            {"id": "step1", "type": "ai_step", ...}
        ],
        "edges": [{"source": "start", "target": "step1"}]
    }

    compiler = GraphCompiler()
    compiled = compiler.compile(graph_def)

    assert compiled['start_node_id'] == 'start'
    assert 'step1' in compiled['nodes']['start']['next_nodes']

# test_validator.py
def test_detect_circular_reference():
    graph_def = {
        "nodes": [...],
        "edges": [
            {"source": "a", "target": "b"},
            {"source": "b", "target": "c"},
            {"source": "c", "target": "a"}  # Circular!
        ]
    }

    validator = GraphValidator()
    result = validator.validate(graph_def)

    assert not result['valid']
    assert result['errors'][0]['code'] == 'CIRCULAR_REFERENCE'
```

**Frontend**: `frontend/src/components/workflows/__tests__/`

```typescript
// AIStepNode.test.tsx
import { render } from '@testing-library/react';
import { AIStepNode } from '../nodes/AIStepNode';

test('renders AI step node with label', () => {
  const { getByText } = render(
    <AIStepNode
      id="node_1"
      data={{
        label: 'Research',
        config: { prompt: 'Test', model: 'claude', tools: [] }
      }}
    />
  );

  expect(getByText('Research')).toBeInTheDocument();
});
```

### Integration Tests (Real Database, Mock LLM)

```python
# test_workflow_api.py
@pytest.mark.integration
async def test_create_and_execute_workflow(test_client, mock_llm):
    # Create workflow
    response = await test_client.post('/api/workflows', json={
        "agent_id": "agent_123",
        "mode": "advanced",
        "graph_definition": {...}
    })
    workflow_id = response.json()['id']

    # Execute
    exec_response = await test_client.post(
        f'/api/workflows/{workflow_id}/execute',
        json={"trigger_context": {"topic": "AI"}}
    )

    assert exec_response.status_code == 202
    execution_id = exec_response.json()['execution_id']

    # Poll until complete
    await wait_for_completion(execution_id)

    # Verify result
    result = await test_client.get(f'/api/workflows/executions/{execution_id}')
    assert result.json()['status'] == 'completed'
```

### Snapshot Tests (Validate Compilation Output)

```python
# test_compilation_snapshots.py
def test_compilation_snapshot(snapshot):
    graph_def = load_fixture('complex_workflow.json')
    compiler = GraphCompiler()
    compiled = compiler.compile(graph_def)

    # Compare against saved snapshot
    snapshot.assert_match(compiled, 'complex_workflow_compiled.json')
```

### Contract Tests (Validate API Schema)

```typescript
// api-contract.test.ts
import { validateSchema } from 'openapi-schema-validator';
import apiSpec from '../contracts/api-endpoints.json';

test('GET /workflows/:id matches OpenAPI spec', async () => {
  const response = await fetch('/api/workflows/test_id');
  const data = await response.json();

  const result = validateSchema(data, apiSpec.paths['/workflows/{id}'].get.responses[200]);
  expect(result.valid).toBe(true);
});
```

### Running Tests

```bash
# Backend unit tests
cd backend
./test --unit

# Backend integration tests (requires database)
./test --integration

# Frontend tests
cd frontend
npm test

# E2E tests (Playwright)
npm run test:e2e
```

---

## Debugging Tips

### React Flow Canvas Issues

**Problem**: Nodes not rendering or positioned incorrectly

**Debug**:
```typescript
// Add logging to canvas component
useEffect(() => {
  console.log('Nodes:', nodes);
  console.log('Edges:', edges);
}, [nodes, edges]);

// Check React Flow devtools
<ReactFlow
  nodes={nodes}
  edges={edges}
  onError={(error) => console.error('React Flow error:', error)}
/>
```

### Variable Resolution Failures

**Problem**: Variable `@step2_output` undefined at runtime

**Debug**:
1. Check `compiled_logic.variables` includes the variable
2. Verify `output_variable` set in source node
3. Check if source node actually executed (conditional path?)
4. Add logging in `VariableResolver.resolve_prompt()`

### Dramatiq Worker Not Processing Jobs

**Problem**: Workflow execution stuck in "running" status

**Debug**:
```bash
# Check worker logs
docker compose logs worker -f

# Check Redis queue
redis-cli
> LLEN dramatiq:default  # Should show pending jobs
> LINDEX dramatiq:default 0  # Inspect job

# Restart worker
docker compose restart worker
```

### SSE Stream Not Updating

**Problem**: Execution monitor not showing real-time updates

**Debug**:
```typescript
// Check SSE connection
const eventSource = new EventSource('/api/workflows/executions/123/stream');
eventSource.onerror = (error) => console.error('SSE error:', error);
eventSource.onmessage = (event) => console.log('Event:', event.data);

// Check Redis pub/sub
redis-cli
> SUBSCRIBE workflow_execution:123
```

### Database Schema Issues

**Problem**: Migration fails or constraint violations

**Debug**:
```sql
-- Check table structure
\d agent_workflows

-- Check constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'agent_workflows'::regclass;

-- Verify mode field
SELECT id, mode, graph_definition IS NOT NULL, compiled_logic IS NOT NULL
FROM agent_workflows
WHERE mode = 'advanced';
```

---

## Resources

### Documentation

- **Project Docs**: `D:\Homelab\suna\CLAUDE.md`
- **Feature Spec**: `specs/003-advanced-workflows/spec.md`
- **API Contract**: `specs/003-advanced-workflows/contracts/api-endpoints.md`
- **Type Schemas**: `specs/003-advanced-workflows/contracts/graph-definition.ts`

### External Resources

- **React Flow**: https://reactflow.dev/learn
- **Lexical**: https://lexical.dev/docs/intro
- **Zustand**: https://github.com/pmndrs/zustand
- **FastAPI**: https://fastapi.tiangolo.com/
- **Dramatiq**: https://dramatiq.io/guide.html
- **Supabase**: https://supabase.com/docs

### Code Examples

- **Graph Traversal**: `specs/003-advanced-workflows/research.md` (R3)
- **Variable Plugin**: `specs/003-advanced-workflows/research.md` (R2)
- **SSE Implementation**: `specs/003-advanced-workflows/research.md` (R5)
- **Snapshot Tests**: `specs/003-advanced-workflows/research.md` (R7)

### Getting Help

1. **Check existing code**: Look for similar patterns in backend/core/agentpress/
2. **Review research.md**: Contains detailed implementation decisions
3. **Test first**: Write failing test, then implement
4. **Ask questions**: Tag @team in Slack/Discord

---

## Next Steps

1. **Read the spec**: `specs/003-advanced-workflows/spec.md`
2. **Review research**: `specs/003-advanced-workflows/research.md`
3. **Set up environment**: Follow [Development Setup](#development-setup)
4. **Pick a task**: Start with small node types or validation rules
5. **Write tests**: Contract → Unit → Integration → E2E
6. **Submit PR**: Follow contribution guidelines in `CONTRIBUTING.md`

Welcome to the team! 🚀
