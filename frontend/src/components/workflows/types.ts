export type NodeType = 'TRIGGER' | 'COMPOSIO_TRIGGER' | 'AI_STEP' | 'RULE_CONDITION' | 'LLM_CONDITION' | 'STOP';
export interface NodeData { label?: string; config?: Record<string, any>;[key: string]: any; }
export type NodeConfig = NodeData;
export interface AIStepNodeData extends NodeData { config?: { prompt?: string; model?: string; tools?: string[]; temperature?: number; max_tokens?: number; system_prompt?: string; output_variable?: string;[key: string]: any; }; }
export interface WorkflowNode { id: string; type: NodeType; data: NodeData; position: { x: number; y: number }; }
export interface EdgeData { label?: string;[key: string]: any; }
export interface WorkflowEdge { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string; }
export interface WorkflowGraph { nodes: WorkflowNode[]; edges: WorkflowEdge[]; }
export interface GraphDefinition { nodes: any[]; edges: any[]; viewport?: { x: number; y: number; zoom: number }; }
export interface CompiledLogic { [key: string]: any; }

/**
 * ConditionalStep - Core type for simple workflow editor steps.
 * Represents a single step in a workflow, which can be an instruction,
 * condition, parallel, or sequence type.
 * 
 * Moved from components/agents/workflows/conditional-workflow-builder.tsx
 */
export interface ConditionalStep {
    id: string;
    name: string;
    description: string;
    type: 'instruction' | 'condition' | 'parallel' | 'sequence';
    config: Record<string, any>;
    conditions?: {
        type: 'if' | 'else' | 'elseif';
        expression?: string;
    };
    children?: ConditionalStep[];
    order: number;
    enabled?: boolean;
    hasIssues?: boolean;
    position?: { x: number; y: number };
    parentConditionalId?: string;
}
