import { useMutation } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useExecutionStore } from '@/stores/workflows';

interface ExecuteWorkflowParams {
  triggerContext: Record<string, any>;
}

interface ExecuteWorkflowResult {
  execution_id: string;
  monitor_url: string;
  status: string;
}

export function useWorkflowExecution(workflowId: string) {
  const executionStore = useExecutionStore();
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource on unmount or when workflowId changes
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
    };
  }, [workflowId]);

  // Control execution mutation
  const controlExecution = useMutation({
    mutationFn: async (action: 'pause' | 'resume' | 'stop') => {
      const executionId = executionStore.executionId;
      if (!executionId) return;

      const res = await fetch(`/api/workflows/executions/${executionId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        throw new Error('Failed to control execution');
      }

      return action;
    },
  });

  // Stop execution (closes SSE connection and calls API)
  const stopExecution = useCallback(async () => {
    // Call API to stop backend
    if (executionStore.executionId) {
      controlExecution.mutateAsync('stop').catch(console.error);
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      executionStore.completeExecution('failed', 'Execution stopped by user');
    }
  }, [executionStore, controlExecution]);

  const pauseExecution = useCallback(() => controlExecution.mutateAsync('pause'), [controlExecution]);
  const resumeExecution = useCallback(() => controlExecution.mutateAsync('resume'), [controlExecution]);

  // Execute workflow mutation
  const executeWorkflow = useMutation({
    mutationFn: async ({ triggerContext }: ExecuteWorkflowParams): Promise<ExecuteWorkflowResult> => {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Reset execution store
      executionStore.reset();

      // Start execution
      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_context: triggerContext }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to start workflow execution');
      }

      const result: ExecuteWorkflowResult = await res.json();
      const { execution_id, monitor_url } = result;

      // Initialize execution store
      executionStore.startExecution(execution_id);

      // Connect to SSE stream
      const eventSource = new EventSource(monitor_url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;

        // Only mark as failed if not already completed
        if (executionStore.status === 'running') {
          executionStore.completeExecution('failed', 'Connection to execution monitor lost');
        }
      };

      // Event listeners for execution events
      eventSource.addEventListener('node_started', (e: MessageEvent) => {
        const event = JSON.parse(e.data);
        executionStore.updateNodeStatus(event.node_id, 'running');
      });

      eventSource.addEventListener('node_completed', (e: MessageEvent) => {
        const event = JSON.parse(e.data);
        executionStore.updateNodeStatus(event.node_id, 'completed', {
          output: event.details?.output,
        });
      });

      eventSource.addEventListener('node_failed', (e: MessageEvent) => {
        const event = JSON.parse(e.data);
        executionStore.updateNodeStatus(event.node_id, 'failed', {
          error: event.details?.error || 'Node execution failed',
        });
      });

      eventSource.addEventListener('execution_completed', (e: MessageEvent) => {
        const event = JSON.parse(e.data);
        executionStore.setFinalVariables(event.details?.final_variables || {});
        executionStore.completeExecution('completed');
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      });

      eventSource.addEventListener('execution_failed', (e: MessageEvent) => {
        const event = JSON.parse(e.data);
        executionStore.completeExecution('failed', event.details?.error || 'Execution failed');
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      });

      return result;
    },
  });

  return {
    executeWorkflow,
    isConnected,
    stopExecution,
    pauseExecution,
    resumeExecution,
    executionState: executionStore,
  };
}
