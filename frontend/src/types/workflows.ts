/**
 * TypeScript Types: Workflows
 *
 * Type definitions for the Advanced Visual Workflow Builder feature.
 * Exports both GraphDefinition (visual state) and execution types.
 *
 * Feature: Advanced Visual Workflow Builder
 * Version: 1.0.0
 * Created: 2025-11-27
 */

import type { Node, Edge, Viewport } from '@xyflow/react';

// ============================================================================
// Top-Level Graph Definition
// ============================================================================

/**
 * Complete graph definition stored in database
 * Maps to: agent_workflows.graph_definition (JSONB)
 */
export interface GraphDefinition {
  /** All nodes in the workflow graph */
  nodes: WorkflowNode[];

  /** All edges connecting nodes */
  edges: WorkflowEdge[];

  /** Canvas viewport state (position and zoom) */
  viewport: Viewport;

  /** Schema version for future migrations */
  version?: string;
}

// ============================================================================
// Node Types and Data Structures
// ============================================================================

/**
 * Discriminated union of all workflow node types
 * React Flow requires Node<NodeData> structure
 */
export type WorkflowNode =
  | Node<StartNodeData, 'start'>
  | Node<AIStepNodeData, 'ai_step'>
  | Node<RuleConditionNodeData, 'rule_condition'>
  | Node<LLMConditionNodeData, 'llm_condition'>
  | Node<EndNodeData, 'end'>;

/**
 * Base data structure common to all nodes
 */
interface BaseNodeData {
  /** Human-readable label displayed on canvas */
  label: string;

  /** Optional description shown in tooltips */
  description?: string;

  /** Visual metadata */
  color?: string;
  icon?: string;
}

/**
 * Start node - Entry point of workflow
 * Maps to: FR-014 (Start node)
 */
export interface StartNodeData extends BaseNodeData {
  label: 'Start';
  /** Trigger context schema (for UI hints) */
  expectedTriggerFields?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    description?: string;
  }>;
}

/**
 * AI Step node - Executes LLM call with tools
 * Maps to: FR-015 (AI Step nodes), FR-031 (Variable references)
 */
export interface AIStepNodeData extends BaseNodeData {
  config: {
    /** Prompt with variable references (@variable syntax) */
    prompt: string;

    /** LLM model identifier */
    model: string;

    /** Tool identifiers to make available */
    tools: string[];

    /** Variable name to store output (optional) */
    output_variable?: string;

    /** Max tokens for LLM response */
    max_tokens?: number;

    /** Temperature setting */
    temperature?: number;

    /** System prompt override */
    system_prompt?: string;
  };
}

/**
 * Rule-Based Condition node - Deterministic branching
 * Maps to: FR-022 (Rule-based conditions), FR-023 (Comparison operators)
 */
export interface RuleConditionNodeData extends BaseNodeData {
  config: {
    /** Ordered list of conditional rules */
    rules: Array<{
      /** Variable to evaluate (without @ prefix) */
      variable: string;

      /** Comparison operator */
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'matches_regex';

      /** Value to compare against */
      value: string | number | boolean;

      /** Target node ID if rule matches */
      next_node_id: string;

      /** Human-readable label for this branch */
      label?: string;
    }>;

    /** Default branch if no rules match */
    default_next_node_id: string | null;
  };
}

/**
 * LLM-Based Condition node - Semantic branching
 * Maps to: FR-022 (LLM-based conditions), FR-024 (Semantic evaluation)
 */
export interface LLMConditionNodeData extends BaseNodeData {
  config: {
    /** Context prompt explaining the decision */
    context_prompt: string;

    /** Possible branches (2-5 options) */
    branches: Array<{
      /** Branch identifier */
      label: string;

      /** Description of when this branch should be taken */
      description: string;

      /** Target node ID for this branch */
      next_node_id: string;
    }>;

    /** Model to use for evaluation (mini model) */
    model: string;

    /** Variables to include in context */
    context_variables?: string[];
  };
}

/**
 * End node - Workflow termination point
 * Maps to: FR-016 (End nodes)
 */
export interface EndNodeData extends BaseNodeData {
  config?: {
    /** Optional final message */
    message?: string;

    /** Success/failure indicator */
    status?: 'success' | 'failure';
  };
}

// ============================================================================
// Edge Types and Data Structures
// ============================================================================

/**
 * Workflow edge connecting nodes
 * React Flow Edge structure with custom data
 */
export type WorkflowEdge = Edge<EdgeData>;

/**
 * Custom data attached to edges
 */
export interface EdgeData {
  /** Label shown on edge (for conditional branches) */
  label?: string;

  /** Condition this edge represents (for UI) */
  condition?: string;

  /** Visual style */
  animated?: boolean;
  style?: React.CSSProperties;
}

// ============================================================================
// Node Configuration Schemas (for Validation)
// ============================================================================

/**
 * JSON Schema definitions for node configurations
 * Used by validation engine (FR-041)
 */
export const NODE_CONFIG_SCHEMAS = {
  ai_step: {
    type: 'object',
    required: ['prompt', 'model', 'tools'],
    properties: {
      prompt: { type: 'string', minLength: 1 },
      model: {
        type: 'string',
        enum: [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'gpt-4o',
          'gpt-4o-mini',
          'gemini-2.0-flash-exp',
        ],
      },
      tools: { type: 'array', items: { type: 'string' } },
      output_variable: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' },
      max_tokens: { type: 'number', minimum: 1, maximum: 200000 },
      temperature: { type: 'number', minimum: 0, maximum: 2 },
      system_prompt: { type: 'string' },
    },
  },

  rule_condition: {
    type: 'object',
    required: ['rules'],
    properties: {
      rules: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['variable', 'operator', 'value', 'next_node_id'],
          properties: {
            variable: { type: 'string' },
            operator: {
              type: 'string',
              enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'matches_regex'],
            },
            value: { type: ['string', 'number', 'boolean'] },
            next_node_id: { type: 'string' },
            label: { type: 'string' },
          },
        },
      },
      default_next_node_id: { type: ['string', 'null'] },
    },
  },

  llm_condition: {
    type: 'object',
    required: ['context_prompt', 'branches', 'model'],
    properties: {
      context_prompt: { type: 'string', minLength: 1 },
      branches: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: {
          type: 'object',
          required: ['label', 'description', 'next_node_id'],
          properties: {
            label: { type: 'string' },
            description: { type: 'string' },
            next_node_id: { type: 'string' },
          },
        },
      },
      model: { type: 'string', enum: ['gpt-4o-mini', 'claude-3-5-haiku-20241022'] },
      context_variables: { type: 'array', items: { type: 'string' } },
    },
  },
} as const;

// ============================================================================
// Helper Types for Frontend Components
// ============================================================================

/**
 * Node type discriminator
 */
export type NodeType = WorkflowNode['type'];

/**
 * Extract data type for a specific node type
 */
export type NodeDataForType<T extends NodeType> = Extract<WorkflowNode, { type: T }>['data'];

/**
 * Node palette item for UI
 * Maps to: FR-003 (Node palette)
 */
export interface NodeTemplate {
  type: NodeType;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  defaultData: BaseNodeData & { config?: any };
  category: 'core' | 'logic' | 'terminal';
}

/**
 * Canvas state for Zustand store
 * Maps to: R1 (React Flow state management)
 */
export interface CanvasState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: Viewport;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  isDirty: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result from graph validation
 * Maps to: FR-041 (Validation engine)
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  severity: 'error';
  code: 'CIRCULAR_REFERENCE' | 'ORPHANED_NODE' | 'MISSING_START' | 'UNDEFINED_VARIABLE' | 'INVALID_CONFIG';
  message: string;
  node_id?: string;
  edge_id?: string;
  details?: Record<string, any>;
}

export interface ValidationWarning {
  severity: 'warning';
  code: 'UNREACHABLE_NODE' | 'UNUSED_VARIABLE' | 'CONDITIONAL_VARIABLE' | 'MISSING_DEFAULT_BRANCH';
  message: string;
  node_id?: string;
  details?: Record<string, any>;
}

// ============================================================================
// Variable Reference Types
// ============================================================================

/**
 * Variable available in workflow
 * Maps to: FR-031 (Autocomplete), FR-033 (Validation)
 */
export interface WorkflowVariable {
  /** Variable name (without @ prefix) */
  name: string;

  /** Data type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown';

  /** Source of variable */
  source: 'trigger' | 'node_output';

  /** Source node ID (if source === 'node_output') */
  source_node_id?: string;

  /** Source node label (for UI) */
  source_node_label?: string;

  /** Description */
  description?: string;

  /** Whether variable is always defined or conditional */
  always_defined: boolean;
}

/**
 * Variable mention in Lexical editor
 * Maps to: R2 (Lexical variable plugin)
 */
export interface VariableMention {
  /** Variable name */
  variable: string;

  /** Display text */
  label: string;

  /** Whether variable is currently valid */
  valid: boolean;

  /** Warning message if conditionally defined */
  warning?: string;
}

// ============================================================================
// Execution Context Types
// ============================================================================

/**
 * Execution context during workflow run
 */
export interface ExecutionContext {
  thread_id: string;
  workflow_id: string;
  variables: Record<string, any>;
  step_outputs: Record<string, any>;
  execution_log: ExecutionEvent[];
  step_count: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
}

/**
 * Single execution event for logging
 * Maps to: FR-030 (Real-time monitoring)
 */
export interface ExecutionEvent {
  /** Timestamp */
  timestamp: string; // ISO 8601

  /** Event type */
  event_type:
    | 'execution_started'
    | 'node_started'
    | 'node_progress'
    | 'node_completed'
    | 'node_failed'
    | 'execution_paused'
    | 'execution_completed'
    | 'execution_failed';

  /** Node ID (if applicable) */
  node_id?: string;

  /** Event details */
  details?: Record<string, any>;
}

/**
 * Compiled logic for execution (from backend)
 */
export interface CompiledLogic {
  version: string;
  start_node_id: string;
  nodes: Record<string, LogicNode>;
  variables: VariableDeclaration[];
}

export interface LogicNode {
  id: string;
  type: string;
  config: Record<string, any>;
  transitions: Transition[];
}

export interface Transition {
  target_id: string;
  condition: string | null;
}

export interface VariableDeclaration {
  name: string;
  source: string;
  source_id?: string;
  type?: string;
}
