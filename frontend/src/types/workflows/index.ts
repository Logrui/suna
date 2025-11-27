export * from './graph-definition';

export type WorkflowMode = 'simple' | 'advanced';
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface Workflow {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  trigger_phrase: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;

  // Mode and data
  mode: WorkflowMode;
  steps: any[] | null;           // Simple mode data
  graph_definition: any | null;  // Advanced mode visual state (typed as any to avoid circular deps if needed)
  compiled_logic: any | null;    // Advanced mode execution logic
}
