import type { Node, Edge, Viewport } from '@xyflow/react';

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
export interface NodeData extends Record<string, unknown> {
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
  | 'COMPOSIO_TRIGGER'
  | 'AI_STEP'
  | 'RULE_CONDITION'
  | 'LLM_CONDITION'
  | 'STOP';

/**
 * Type-specific node configuration
 */
export interface NodeConfig {
  // AI Step configuration
  model?: string;                    // e.g., "gpt-4o", "claude-3-5-sonnet"
  system_prompt?: string;            // Agent persona/instructions
  prompt?: string;                   // Serialized Lexical JSON or plain text
  userPrompt?: LexicalEditorState;   // Keeping this for backward compatibility if needed, or remove?
  temperature?: number;              // 0.0 - 2.0
  max_tokens?: number;
  tools?: string[];                  // Tool names from tool registry
  grounding?: boolean;               // Enable web search/grounding

  // Rule-based condition configuration
  rules?: ConditionRule[];

  // LLM-based condition configuration
  natural_language_condition?: string;   // e.g., "if the response seems urgent"

  // Variable output configuration
  output_variable?: string;             // Variable name to store step output

  // Trigger configuration
  triggerType?: 'manual' | 'webhook' | 'schedule' | 'email' | 'composio';
  triggerConfig?: Record<string, any>;  // Trigger-specific settings

  // Composio Trigger specific config
  composioTriggerConfig?: {
    appName: string;
    appSlug: string;
    triggerName: string;
    triggerSlug: string;
    config?: Record<string, any>;
    logo?: string;
  };

  outputFormat?: string;                // End node output format
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
export interface EdgeData extends Record<string, unknown> {
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
