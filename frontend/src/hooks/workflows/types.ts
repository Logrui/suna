/**
 * Agent Workflow Types
 * Matches the backend Workflow model structure
 */

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type WorkflowMode = 'simple' | 'advanced' | 'advanced-legacy';

export interface WorkflowStep {
    id: string;
    name: string;
    description?: string;
    type: string;
    config?: Record<string, unknown>;
    conditions?: {
        type?: 'if' | 'elseif' | 'else';
        expression?: string;
    };
    order?: number;
    enabled?: boolean;
    children?: WorkflowStep[];
    parentConditionalId?: string;
    hasIssues?: boolean;
}

export interface AgentWorkflow {
    id: string;
    agent_id: string;
    name: string;
    description?: string | null;
    status: WorkflowStatus;
    trigger_phrase?: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
    mode: WorkflowMode;
    steps?: WorkflowStep[] | null;
    graph_definition?: Record<string, unknown> | null;
    compiled_logic?: Record<string, unknown> | null;
}

export interface CreateWorkflowRequest {
    name: string;
    description?: string;
    trigger_phrase?: string;
    is_default?: boolean;
    status?: WorkflowStatus;
    mode?: WorkflowMode;
    agent_id?: string;
    steps?: WorkflowStep[];
    graph_definition?: Record<string, unknown>;
    compiled_logic?: Record<string, unknown>;
}

export interface UpdateWorkflowRequest {
    name?: string;
    description?: string;
    status?: WorkflowStatus;
    trigger_phrase?: string;
    is_default?: boolean;
    steps?: WorkflowStep[];
    mode?: WorkflowMode;
    graph_definition?: Record<string, unknown>;
    compiled_logic?: Record<string, unknown>;
}

export interface ExecuteWorkflowRequest {
    input_data?: Record<string, unknown>;
    trigger_context?: Record<string, unknown>;
}

export interface ExecuteWorkflowResponse {
    execution_id: string;
    monitor_url: string;
    message: string;
    status: string;
}
