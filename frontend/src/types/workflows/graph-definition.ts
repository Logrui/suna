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
