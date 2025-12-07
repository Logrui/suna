# Data Model: Advanced Visual Workflow Builder

**Date**: 2025-11-23
**Phase**: 1 - Data Model Design
**Status**: Complete

This document defines the complete data model for the Advanced Visual Workflow Builder, including database schema extensions, TypeScript interfaces, Python classes, and validation rules extracted from the feature specification.

---

## Database Schema

### Schema Extension Migration

```sql
-- Migration: 20251124000000_add_advanced_workflows.sql
-- Description: Extend agent_workflows table to support advanced visual workflow mode

-- 1. Create workflow mode enum
CREATE TYPE workflow_mode AS ENUM ('simple', 'advanced');

-- 2. Extend agent_workflows table
ALTER TABLE agent_workflows
ADD COLUMN mode workflow_mode DEFAULT 'simple' NOT NULL,
ADD COLUMN graph_definition JSONB DEFAULT NULL,
ADD COLUMN compiled_logic JSONB DEFAULT NULL;

-- 3. Add check constraints
ALTER TABLE agent_workflows
ADD CONSTRAINT check_advanced_workflow_data
CHECK (
  (mode = 'simple') OR
  (mode = 'advanced' AND graph_definition IS NOT NULL AND compiled_logic IS NOT NULL)
);

-- Ensures simple mode uses steps, advanced mode uses graph_definition + compiled_logic
ALTER TABLE agent_workflows
ADD CONSTRAINT check_mode_data_consistency
CHECK (
  (mode = 'simple' AND steps IS NOT NULL) OR
  (mode = 'advanced' AND graph_definition IS NOT NULL)
);

-- 4. Add indexes for performance
CREATE INDEX idx_agent_workflows_mode ON agent_workflows(mode);
CREATE INDEX idx_agent_workflows_agent_mode ON agent_workflows(agent_id, mode);
CREATE INDEX idx_agent_workflows_status_mode ON agent_workflows(status, mode);  -- For filtering active advanced workflows

-- 5. Add comments for documentation
COMMENT ON COLUMN agent_workflows.mode IS 'Workflow editor mode: simple (list-based) or advanced (visual graph)';
COMMENT ON COLUMN agent_workflows.graph_definition IS 'React Flow visual state (nodes, edges, viewport) - used only by advanced mode';
COMMENT ON COLUMN agent_workflows.compiled_logic IS 'Optimized execution graph (adjacency list) - used only by advanced mode';

-- 6. Update RLS policies (no changes needed - existing policies apply to all columns)
-- Row-Level Security via basejump.has_role_on_account() already covers new columns

-- 7. Backward compatibility: Ensure NULL mode is treated as 'simple'
-- This is handled in application code, not database (NULL not allowed due to NOT NULL constraint)
```

### Complete agent_workflows Table Schema

```sql
CREATE TABLE agent_workflows (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

    -- Workflow Metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status agent_workflow_status DEFAULT 'draft' NOT NULL,  -- 'draft' | 'active' | 'paused' | 'archived'
    trigger_phrase VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE NOT NULL,

    -- Simple Mode Data (legacy - preserved for backward compatibility)
    steps JSONB DEFAULT NULL,  -- Array of WorkflowStep objects

    -- Advanced Mode Data (new columns)
    mode workflow_mode DEFAULT 'simple' NOT NULL,  -- 'simple' | 'advanced'
    graph_definition JSONB DEFAULT NULL,           -- Visual state (React Flow)
    compiled_logic JSONB DEFAULT NULL,             -- Execution logic (adjacency map)

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT check_advanced_workflow_data CHECK (
        (mode = 'simple') OR (mode = 'advanced' AND graph_definition IS NOT NULL AND compiled_logic IS NOT NULL)
    ),
    CONSTRAINT check_mode_data_consistency CHECK (
        (mode = 'simple' AND steps IS NOT NULL) OR (mode = 'advanced' AND graph_definition IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_agent_workflows_agent_id ON agent_workflows(agent_id);
CREATE INDEX idx_agent_workflows_status ON agent_workflows(status);
CREATE INDEX idx_agent_workflows_mode ON agent_workflows(mode);
CREATE INDEX idx_agent_workflows_agent_mode ON agent_workflows(agent_id, mode);
CREATE INDEX idx_agent_workflows_status_mode ON agent_workflows(status, mode);

-- RLS Policies (existing - apply to all columns)
ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access workflows for agents in their account
CREATE POLICY agent_workflows_select_policy ON agent_workflows
    FOR SELECT USING (basejump.has_role_on_account(
        (SELECT account_id FROM agents WHERE agent_id = agent_workflows.agent_id),
        'owner'::basejump.account_role
    ) OR basejump.has_role_on_account(
        (SELECT account_id FROM agents WHERE agent_id = agent_workflows.agent_id),
        'member'::basejump.account_role
    ));

-- Similar policies for INSERT, UPDATE, DELETE (omitted for brevity - already exist)
```

---

## TypeScript Interfaces (Frontend)

### Workflow Entity

```typescript
/**
 * Complete workflow object returned by API
 */
export interface Workflow {
  // Existing columns (unchanged)
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  trigger_phrase: string | null;
  is_default: boolean;
  created_at: string;  // ISO 8601 timestamp
  updated_at: string;

  // Mode and data columns
  mode: WorkflowMode;
  steps: WorkflowStep[] | null;           // Simple mode data
  graph_definition: GraphDefinition | null;  // Advanced mode visual state
  compiled_logic: CompiledLogic | null;     // Advanced mode execution logic
}

export type WorkflowMode = 'simple' | 'advanced';

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

/**
 * Simple mode workflow step (legacy - preserved for backward compatibility)
 */
export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  type: 'instruction' | 'message' | 'tool_call' | 'condition' | 'loop' | 'wait' | 'input' | 'output';
  config: Record<string, any>;
  order: number;
  parentConditionalId?: string;  // For nested conditional steps
  children?: WorkflowStep[];     // Nested steps within conditionals
}
```

### Graph Definition (Visual State)

```typescript
import type { Node, Edge, Viewport } from 'reactflow';

/**
 * Visual state stored in graph_definition column
 * Used by React Flow editor to render the canvas
 */
export interface GraphDefinition {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  viewport: Viewport;
}

/**
 * Custom data attached to each React Flow node
 */
export interface NodeData {
  // Node identity
  id: string;
  label: string;
  type: NodeType;

  // Node configuration
  config: NodeConfig;

  // UI state (transient - not persisted)
  isValid?: boolean;
  executionState?: 'idle' | 'executing' | 'completed' | 'failed';
}

export type NodeType =
  | 'TRIGGER'
  | 'AI_STEP'
  | 'RULE_CONDITION'
  | 'LLM_CONDITION'
  | 'STOP';

/**
 * Type-specific node configuration
 */
export interface NodeConfig {
  // AI Step configuration
  modelId?: string;                    // e.g., "gpt-4o", "claude-3-5-sonnet"
  systemPrompt?: string;               // Agent persona/instructions
  userPrompt?: LexicalEditorState;     // Serialized Lexical JSON with variable mentions
  temperature?: number;                // 0.0 - 2.0
  maxTokens?: number;
  tools?: string[];                    // Tool names from tool registry
  grounding?: boolean;                 // Enable web search/grounding

  // Rule-based condition configuration
  rules?: ConditionRule[];

  // LLM-based condition configuration
  naturalLanguageCondition?: string;   // e.g., "if the response seems urgent"

  // Variable output configuration
  outputVariable?: string;             // Variable name to store step output

  // Trigger configuration
  triggerType?: 'manual' | 'webhook' | 'schedule' | 'email';
  triggerConfig?: Record<string, any>;  // Trigger-specific settings
}

/**
 * Rule for rule-based condition evaluation
 */
export interface ConditionRule {
  field: string;                        // Variable path, e.g., "response.sentiment"
  operator: ConditionOperator;
  value: string | number | boolean;
  connector?: 'AND' | 'OR';             // How to combine with next rule
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'matches_regex'
  | 'is_empty'
  | 'is_not_empty';

/**
 * Custom data attached to React Flow edges
 */
export interface EdgeData {
  condition?: string;  // 'true', 'false', 'default', 'error'
  label?: string;      // Display label on edge
}

/**
 * Lexical editor state (serialized JSON)
 */
export interface LexicalEditorState {
  root: {
    type: 'root';
    format: string;
    indent: number;
    version: number;
    children: LexicalNode[];
  };
}

export type LexicalNode = TextNode | ParagraphNode | VariableMentionNode;

export interface TextNode {
  type: 'text';
  text: string;
  format?: number;
  style?: string;
  version?: number;
}

export interface ParagraphNode {
  type: 'paragraph';
  format?: string;
  indent?: number;
  children: LexicalNode[];
  version?: number;
}

export interface VariableMentionNode {
  type: 'variable-mention';
  variable: string;      // Variable path, e.g., "trigger.email_subject"
  label: string;         // Display label, e.g., "Email Subject"
  version: number;
}
```

### Compiled Logic (Execution State)

```typescript
/**
 * Execution logic stored in compiled_logic column
 * Used by backend GraphExecutor to execute the workflow
 */
export interface CompiledLogic {
  version: string;              // Schema version, e.g., "1.0"
  start_node_id: string;        // ID of trigger node
  nodes: Record<string, LogicNode>;  // Map of node_id → LogicNode
  variables: VariableDeclaration[];  // Workflow-level variable declarations
}

/**
 * Node in execution logic (stripped of UI data)
 */
export interface LogicNode {
  id: string;
  type: LogicNodeType;
  config: Record<string, any>;  // Type-specific configuration
  transitions: Transition[];    // Outgoing edges
}

export type LogicNodeType =
  | 'TRIGGER'
  | 'LLM'                    // AI generation step
  | 'TOOL'                   // Tool call step
  | 'RULE_CONDITION'         // Rule-based branching
  | 'LLM_CONDITION'          // LLM-based semantic branching
  | 'STOP';                  // End of execution

export interface Transition {
  target_id: string;         // ID of next node
  condition: string | null;  // 'true', 'false', 'default', 'error', or null (unconditional)
}

export interface VariableDeclaration {
  name: string;              // Variable identifier
  source: 'trigger' | 'step';  // Where variable comes from
  source_id?: string;        // ID of source node (if from step)
  type?: string;             // Optional type hint
}
```

### Validation Rules

```typescript
/**
 * Validation result for workflow graph
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  nodeId?: string;
}

/**
 * Validation rule types
 */
export const VALIDATION_RULES = {
  // Graph structure
  MUST_HAVE_TRIGGER: 'workflow must have exactly one trigger node',
  NO_DISCONNECTED_NODES: 'all nodes must be reachable from trigger',
  NO_CYCLES: 'workflow must not contain cycles',
  ALL_PATHS_TERMINATE: 'all execution paths must end in a stop node or dead end',

  // Node configuration
  REQUIRED_FIELDS: 'all required fields must be filled',
  VALID_MODEL_ID: 'model ID must be from supported list',
  VALID_TEMPERATURE: 'temperature must be between 0.0 and 2.0',
  VALID_MAX_TOKENS: 'max tokens must be positive integer',

  // Variable references
  VARIABLE_EXISTS: 'referenced variable must exist in scope',
  VARIABLE_IN_SCOPE: 'variable must be accessible from this node',
  NO_CIRCULAR_VARIABLE_REFS: 'variables cannot reference themselves',

  // Condition nodes
  CONDITION_HAS_BRANCHES: 'condition node must have true and false outgoing edges',
  RULES_NOT_EMPTY: 'rule-based condition must have at least one rule',
  LLM_CONDITION_NOT_EMPTY: 'LLM condition description cannot be empty',
} as const;
```

---

## Python Classes (Backend)

### Workflow Models

```python
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, validator
from datetime import datetime

class Workflow(BaseModel):
    """Complete workflow object from database"""
    id: str
    agent_id: str
    name: str
    description: Optional[str]
    status: Literal['draft', 'active', 'paused', 'archived']
    trigger_phrase: Optional[str]
    is_default: bool
    created_at: datetime
    updated_at: datetime

    # Mode and data
    mode: Literal['simple', 'advanced']
    steps: Optional[List[Dict[str, Any]]]  # Simple mode
    graph_definition: Optional[Dict[str, Any]]  # Advanced mode
    compiled_logic: Optional[Dict[str, Any]]  # Advanced mode

    @validator('graph_definition')
    def validate_advanced_mode_data(cls, v, values):
        """Ensure advanced mode has required data"""
        if values.get('mode') == 'advanced' and v is None:
            raise ValueError('Advanced mode workflows must have graph_definition')
        return v

    class Config:
        orm_mode = True
```

### Compiled Logic Models

```python
from typing import TypedDict, List, Dict, Any, Optional

class CompiledLogic(TypedDict):
    """Execution logic for advanced workflows"""
    version: str  # e.g., "1.0"
    start_node_id: str
    nodes: Dict[str, 'LogicNode']
    variables: List['VariableDeclaration']

class LogicNode(TypedDict):
    """Node in execution graph"""
    id: str
    type: str  # 'TRIGGER', 'LLM', 'TOOL', 'RULE_CONDITION', 'LLM_CONDITION', 'STOP'
    config: Dict[str, Any]
    transitions: List['Transition']

class Transition(TypedDict):
    """Edge to next node in execution"""
    target_id: str
    condition: Optional[str]  # 'true', 'false', 'default', 'error', None

class VariableDeclaration(TypedDict):
    """Variable available in workflow"""
    name: str
    source: str  # 'trigger' | 'step'
    source_id: Optional[str]
    type: Optional[str]
```

### Execution Context

```python
from typing import Dict, Any, List
from dataclasses import dataclass, field

@dataclass
class ExecutionContext:
    """Runtime state during workflow execution"""
    thread_id: str
    workflow_id: str
    variables: Dict[str, Any] = field(default_factory=dict)
    step_outputs: Dict[str, Any] = field(default_factory=dict)
    execution_log: List['ExecutionEvent'] = field(default_factory=list)
    step_count: int = 0

    def set_variable(self, name: str, value: Any):
        """Store variable value"""
        self.variables[name] = value

    def get_variable(self, path: str) -> Any:
        """Resolve variable by path (e.g., 'trigger.email' or 'step_1.output')"""
        parts = path.split('.')
        value = self.variables

        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                raise KeyError(f"Variable path '{path}' not found in context")

        return value

    def set_step_output(self, node_id: str, output: Any):
        """Store step execution output"""
        self.step_outputs[node_id] = output
        self.variables[node_id] = output  # Also add to variables for easy access

    def log_event(self, event_type: str, node_id: str, data: Any = None):
        """Add execution event to log"""
        self.execution_log.append(ExecutionEvent(
            event_type=event_type,
            node_id=node_id,
            data=data,
            timestamp=datetime.utcnow()
        ))

@dataclass
class ExecutionEvent:
    """Single event during workflow execution"""
    event_type: str  # 'node_started', 'node_completed', 'node_failed'
    node_id: str
    data: Any
    timestamp: datetime
```

### Condition Evaluation Models

```python
from typing import List, Union
from pydantic import BaseModel

class ConditionRule(BaseModel):
    """Rule for rule-based condition"""
    field: str
    operator: str  # 'equals', 'contains', 'greater_than', etc.
    value: Union[str, int, float, bool]
    connector: Optional[str] = None  # 'AND', 'OR'

class RuleConditionConfig(BaseModel):
    """Configuration for rule-based condition node"""
    rules: List[ConditionRule]

class LLMConditionConfig(BaseModel):
    """Configuration for LLM-based condition node"""
    natural_language_condition: str
    model: str = "gpt-4o-mini"  # Model to use for evaluation
```

---

## Entity Relationships

```
┌─────────────────────────────────────────────┐
│               accounts                       │
│  (basejump multi-tenancy)                   │
└────────────┬────────────────────────────────┘
             │ 1:N
             │
┌────────────▼────────────────────────────────┐
│               agents                         │
│  - agent_id (PK)                            │
│  - account_id (FK)                          │
│  - name, config, etc.                       │
└────────────┬────────────────────────────────┘
             │ 1:N
             │
┌────────────▼────────────────────────────────┐
│          agent_workflows                     │
│  - id (PK)                                  │
│  - agent_id (FK)                            │
│  - mode: 'simple' | 'advanced'              │
│  - steps (JSONB) - simple mode              │
│  - graph_definition (JSONB) - advanced      │
│  - compiled_logic (JSONB) - advanced        │
└────────────┬────────────────────────────────┘
             │
             │ synced to
             │
┌────────────▼────────────────────────────────┐
│          agent_versions                      │
│  - id (PK)                                  │
│  - agent_id (FK)                            │
│  - config.workflows (JSONB) - copy          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│            agent_triggers                    │
│  - id (PK)                                  │
│  - agent_id (FK)                            │
│  - workflow_id (FK) - optional              │
│  - type, config, etc.                       │
└────────────┬────────────────────────────────┘
             │
             │ triggers execution
             │
┌────────────▼────────────────────────────────┐
│               threads                        │
│  - id (PK)                                  │
│  - agent_id (FK)                            │
│  - metadata includes workflow context        │
└────────────┬────────────────────────────────┘
             │ 1:N
             │
┌────────────▼────────────────────────────────┐
│              messages                        │
│  - id (PK)                                  │
│  - thread_id (FK)                           │
│  - role, content, etc.                      │
│  - execution events stored here             │
└─────────────────────────────────────────────┘
```

---

## State Transitions

### Workflow Status Lifecycle

```
┌───────┐
│ draft │ ← Initial state when workflow created
└───┬───┘
    │ activate()
    ▼
┌────────┐
│ active │ ← Workflow can be triggered
└───┬────┘
    │ pause()
    ▼
┌────────┐
│ paused │ ← Workflow temporarily disabled
└───┬────┘
    │ activate()
    ▼
┌────────┐
│ active │
└───┬────┘
    │ archive()
    ▼
┌──────────┐
│ archived │ ← Workflow soft-deleted (can be restored)
└──────────┘
```

**State Transition Rules**:
- `draft` → `active`: Must pass validation (no errors)
- `active` → `paused`: Immediately stops accepting new triggers
- `paused` → `active`: Resumes accepting triggers
- Any status → `archived`: Soft delete (preserves data for rollback)
- `archived` workflows cannot be executed or edited (must restore first)

### Node Execution States (Runtime Only)

```
┌──────┐
│ idle │ ← Initial state before execution
└───┬──┘
    │ execution starts
    ▼
┌───────────┐
│ executing │ ← Node currently running
└─────┬─────┘
      │
      ├─ success → ┌───────────┐
      │            │ completed │
      │            └───────────┘
      │
      └─ error ──→ ┌────────┐
                   │ failed │
                   └────────┘
```

---

## Validation Rules Mapping

Extracted from FR-049 through FR-052 in specification:

### Graph Structure Validation

| Rule | Check | Error Message |
|------|-------|---------------|
| **Single Trigger** | Count trigger nodes == 1 | "Workflow must have exactly one trigger node" |
| **No Disconnected Nodes** | All nodes reachable from trigger via DFS | "Nodes {ids} are not connected to the workflow and will never execute" |
| **No Cycles** | Detect cycles using DFS + visited set | "Cycle detected: {node_path}" |
| **Valid Edges** | All edge sources and targets exist | "Edge references non-existent node {id}" |

### Node Configuration Validation

| Node Type | Required Fields | Validation |
|-----------|----------------|------------|
| **AI_STEP** | `modelId`, `userPrompt` | Model must be in supported list, prompt not empty |
| **RULE_CONDITION** | `rules` (non-empty array) | At least one rule, valid operator, non-null value |
| **LLM_CONDITION** | `naturalLanguageCondition` | Non-empty string |
| **TRIGGER** | `triggerType`, `triggerConfig` | Type-specific validation |

### Variable Reference Validation

| Rule | Check | Error Message |
|------|-------|---------------|
| **Variable Exists** | Variable declared in workflow | "Variable '{name}' not found" |
| **Variable In Scope** | Variable reachable via graph | "Variable '{name}' not accessible from this node" |
| **No Self-Reference** | Output variable != referenced variables | "Variable cannot reference itself" |

---

## Data Model Complete

All entities, relationships, and validation rules have been defined based on the feature specification. Proceeding to API contracts generation.
