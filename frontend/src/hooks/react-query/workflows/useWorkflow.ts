import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GraphDefinition, CompiledLogic } from '@/types/workflows/graph-definition';

interface Workflow {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  graph_definition: GraphDefinition;
  compiled_logic: CompiledLogic | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SaveWorkflowData {
  graphDefinition: GraphDefinition;
  compiledLogic: CompiledLogic;
}

export function useWorkflow(workflowId: string) {
  const queryClient = useQueryClient();

  // Fetch workflow
  const fetchWorkflow = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: async (): Promise<Workflow> => {
      const res = await fetch(`/api/workflows/${workflowId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch workflow');
      }
      return res.json();
    },
    enabled: !!workflowId,
  });

  // Save workflow (graph_definition + compiled_logic)
  const saveWorkflow = useMutation({
    mutationFn: async (data: SaveWorkflowData) => {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph_definition: data.graphDefinition,
          compiled_logic: data.compiledLogic,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to save workflow');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  // Update workflow metadata (name, description, is_active)
  const updateMetadata = useMutation({
    mutationFn: async (data: Partial<Pick<Workflow, 'name' | 'description' | 'is_active'>>) => {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to update workflow metadata');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  return {
    workflow: fetchWorkflow.data,
    loading: fetchWorkflow.isPending,
    error: fetchWorkflow.error,
    saveWorkflow,
    updateMetadata,
    refetch: fetchWorkflow.refetch,
  };
}
