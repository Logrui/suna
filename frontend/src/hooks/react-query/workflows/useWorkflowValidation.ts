import { useMutation } from '@tanstack/react-query';
import type { GraphDefinition } from '@/components/workflows/types';

interface ValidationResult {
  is_valid: boolean;
  errors: Array<{
    node_id?: string;
    edge_id?: string;
    message: string;
  }>;
  warnings: Array<{
    node_id?: string;
    message: string;
  }>;
}

export function useWorkflowValidation(workflowId: string) {
  return useMutation({
    mutationFn: async (graphDefinition: GraphDefinition): Promise<ValidationResult> => {
      const res = await fetch(`/api/workflows/${workflowId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphDefinition),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Validation request failed');
      }

      return res.json();
    },
  });
}
