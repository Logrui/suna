/**
 * Agent Workflow Hooks
 *
 * React Query hooks for managing agent workflows.
 * Provides CRUD operations and execution capabilities.
 *
 * @module hooks/workflows/use-agent-workflows
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
    AgentWorkflow,
    CreateWorkflowRequest,
    UpdateWorkflowRequest,
    ExecuteWorkflowRequest,
    ExecuteWorkflowResponse,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

/** Default stale time for workflow queries (2 minutes) */
const DEFAULT_STALE_TIME = 2 * 60 * 1000;

/** Default garbage collection time (10 minutes) */
const DEFAULT_GC_TIME = 10 * 60 * 1000;

// ============================================================================
// Query Keys Factory
// ============================================================================

/**
 * Query key factory for agent workflows.
 * Follows TanStack Query best practices for key management.
 *
 * @example
 * // Invalidate all workflows for an agent
 * queryClient.invalidateQueries({ queryKey: workflowKeys.list(agentId) })
 *
 * // Invalidate a specific workflow
 * queryClient.invalidateQueries({ queryKey: workflowKeys.detail(agentId, workflowId) })
 */
export const workflowKeys = {
    /** Root key for all workflow queries */
    all: ['workflows'] as const,

    /** Key for workflow lists */
    lists: () => [...workflowKeys.all, 'list'] as const,

    /** Key for a specific agent's workflow list */
    list: (agentId: string) => [...workflowKeys.lists(), { agentId }] as const,

    /** Key for workflow details */
    details: () => [...workflowKeys.all, 'detail'] as const,

    /** Key for a specific workflow detail */
    detail: (agentId: string, workflowId: string) =>
        [...workflowKeys.details(), { agentId, workflowId }] as const,
} as const;

// Legacy export for backwards compatibility
export const agentWorkflowKeys = workflowKeys;

// ============================================================================
// API Client
// ============================================================================

/**
 * Custom error class for API errors with additional context
 */
export class WorkflowApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly detail?: string
    ) {
        super(message);
        this.name = 'WorkflowApiError';
    }
}

/**
 * Get authenticated headers for API requests
 */
async function getAuthHeaders(): Promise<HeadersInit> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new WorkflowApiError('Not authenticated', 401);
    }

    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
    };
}

/**
 * Handle API response and extract error details
 * 
 * The backend now returns structured error responses with:
 * - error: Error title
 * - message: Actual error message
 * - type: Python exception type
 * - path: Request path
 * - hint: Debugging hint
 */
async function handleResponse<T>(response: Response, defaultError: string): Promise<T> {
    if (!response.ok) {
        let errorMessage = defaultError;
        let errorDetail: string | undefined;

        try {
            const errorData = await response.json();

            // Handle new structured error format from backend
            if (errorData.message) {
                errorMessage = errorData.message;
                errorDetail = errorData.hint || errorData.type;
            } else if (errorData.detail) {
                // Handle FastAPI HTTPException format
                errorMessage = errorData.detail;
                errorDetail = errorData.detail;
            }

            // Log the full error for debugging
            console.error('[Kortix API] Error response:', {
                status: response.status,
                error: errorData.error,
                message: errorData.message,
                type: errorData.type,
                path: errorData.path,
                hint: errorData.hint
            });
        } catch {
            // If response isn't JSON, use default error
            console.error('[Kortix API] Non-JSON error response:', {
                status: response.status,
                statusText: response.statusText,
                hint: 'This may indicate a server crash or networking issue. Check backend logs.'
            });
        }

        throw new WorkflowApiError(
            errorMessage,
            response.status,
            errorDetail
        );
    }
    return response.json();
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch all workflows for an agent
 */
async function fetchWorkflows(agentId: string): Promise<AgentWorkflow[]> {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${API_URL}/workflows/agents/${agentId}/workflows`,
        { headers }
    );
    return handleResponse<AgentWorkflow[]>(response, 'Failed to fetch workflows');
}

/**
 * Fetch a single workflow by ID
 */
async function fetchWorkflow(agentId: string, workflowId: string): Promise<AgentWorkflow> {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${API_URL}/workflows/agents/${agentId}/workflows/${workflowId}`,
        { headers }
    );
    return handleResponse<AgentWorkflow>(response, 'Failed to fetch workflow');
}

/**
 * Create a new workflow
 */
async function createWorkflow(
    agentId: string,
    workflow: CreateWorkflowRequest
): Promise<AgentWorkflow> {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${API_URL}/workflows/agents/${agentId}/workflows`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify(workflow),
        }
    );
    return handleResponse<AgentWorkflow>(response, 'Failed to create workflow');
}

/**
 * Update an existing workflow
 */
async function updateWorkflow(
    agentId: string,
    workflowId: string,
    workflow: UpdateWorkflowRequest
): Promise<AgentWorkflow> {
    const headers = await getAuthHeaders();
    const url = `${API_URL}/workflows/agents/${agentId}/workflows/${workflowId}`;
    const body = JSON.stringify(workflow);

    console.log('[Kortix Supabase API] 📤 PUT request:', {
        url,
        payload: workflow,
        bodyString: body,
        database: 'Suna Kortix Supabase (NOT Langflow)'
    });

    const response = await fetch(url, {
        method: 'PUT',
        headers,
        body,
    });

    console.log('[Kortix Supabase API] 📥 PUT response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        database: 'Suna Kortix Supabase'
    });

    const result = await handleResponse<AgentWorkflow>(response, 'Failed to update workflow in Kortix Supabase');

    console.log('[Kortix Supabase API] ✅ PUT result:', {
        id: result.id,
        mode: result.mode,
        name: result.name,
        updated_at: result.updated_at
    });

    return result;
}

/**
 * Delete a workflow
 */
async function deleteWorkflow(agentId: string, workflowId: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${API_URL}/workflows/agents/${agentId}/workflows/${workflowId}`,
        {
            method: 'DELETE',
            headers,
        }
    );
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to delete workflow' }));
        throw new WorkflowApiError(
            errorData.detail || 'Failed to delete workflow',
            response.status,
            errorData.detail
        );
    }
}

/**
 * Execute a workflow
 */
async function executeWorkflow(
    agentId: string,
    workflowId: string,
    execution: ExecuteWorkflowRequest
): Promise<ExecuteWorkflowResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${API_URL}/workflows/agents/${agentId}/workflows/${workflowId}/execute`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify(execution),
        }
    );
    return handleResponse<ExecuteWorkflowResponse>(response, 'Failed to execute workflow');
}

// ============================================================================
// Query Hooks
// ============================================================================

/** Options for workflow list query */
interface UseWorkflowsOptions {
    /** Whether to enable the query */
    enabled?: boolean;
    /** Stale time in milliseconds */
    staleTime?: number;
    /** Refetch on window focus */
    refetchOnWindowFocus?: boolean;
}

/**
 * Hook to fetch all workflows for an agent
 *
 * @param agentId - The agent ID to fetch workflows for
 * @param options - Query options
 * @returns Query result with workflows data
 *
 * @example
 * const { data: workflows, isLoading, error } = useAgentWorkflows(agentId);
 */
export function useAgentWorkflows(agentId: string, options?: UseWorkflowsOptions) {
    return useQuery({
        queryKey: workflowKeys.list(agentId),
        queryFn: () => fetchWorkflows(agentId),
        enabled: !!agentId && (options?.enabled ?? true),
        staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
        gcTime: DEFAULT_GC_TIME,
        refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    });
}

/** Options for single workflow query */
interface UseWorkflowOptions extends UseWorkflowsOptions {
    /** Initial data to use before query completes */
    initialData?: AgentWorkflow;
}

/**
 * Hook to fetch a single workflow
 *
 * @param agentId - The agent ID
 * @param workflowId - The workflow ID to fetch
 * @param options - Query options
 * @returns Query result with workflow data
 *
 * @example
 * const { data: workflow, isLoading } = useAgentWorkflow(agentId, workflowId);
 */
export function useAgentWorkflow(
    agentId: string,
    workflowId: string,
    options?: UseWorkflowOptions
) {
    return useQuery({
        queryKey: workflowKeys.detail(agentId, workflowId),
        queryFn: () => fetchWorkflow(agentId, workflowId),
        enabled: !!agentId && !!workflowId && (options?.enabled ?? true),
        staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
        gcTime: DEFAULT_GC_TIME,
        refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
        initialData: options?.initialData,
    });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/** Input type for create workflow mutation */
interface CreateWorkflowInput {
    agentId: string;
    workflow: CreateWorkflowRequest;
}

/**
 * Hook to create a new workflow
 *
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * const createMutation = useCreateAgentWorkflow();
 * await createMutation.mutateAsync({ agentId, workflow: { name: 'New Workflow', ... } });
 */
export function useCreateAgentWorkflow() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ agentId, workflow }: CreateWorkflowInput) =>
            createWorkflow(agentId, workflow),
        onSuccess: (newWorkflow, { agentId }) => {
            // Invalidate list to refetch
            queryClient.invalidateQueries({ queryKey: workflowKeys.list(agentId) });

            // Optionally set the new workflow in cache immediately
            queryClient.setQueryData(
                workflowKeys.detail(agentId, newWorkflow.id),
                newWorkflow
            );
        },
    });
}

/** Input type for update workflow mutation */
interface UpdateWorkflowInput {
    agentId: string;
    workflowId: string;
    workflow: UpdateWorkflowRequest;
}

/**
 * Hook to update an existing workflow
 *
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * const updateMutation = useUpdateAgentWorkflow();
 * await updateMutation.mutateAsync({ agentId, workflowId, workflow: { name: 'Updated' } });
 */
export function useUpdateAgentWorkflow() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ agentId, workflowId, workflow }: UpdateWorkflowInput) =>
            updateWorkflow(agentId, workflowId, workflow),
        onMutate: async ({ agentId, workflowId, workflow }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({
                queryKey: workflowKeys.detail(agentId, workflowId),
            });

            // Snapshot the previous value
            const previousWorkflow = queryClient.getQueryData<AgentWorkflow>(
                workflowKeys.detail(agentId, workflowId)
            );

            // Optimistically update to the new value
            if (previousWorkflow) {
                queryClient.setQueryData<AgentWorkflow>(
                    workflowKeys.detail(agentId, workflowId),
                    { ...previousWorkflow, ...workflow, updated_at: new Date().toISOString() }
                );
            }

            return { previousWorkflow };
        },
        onError: (_err, { agentId, workflowId }, context) => {
            // Rollback on error
            if (context?.previousWorkflow) {
                queryClient.setQueryData(
                    workflowKeys.detail(agentId, workflowId),
                    context.previousWorkflow
                );
            }
        },
        onSettled: (_data, _error, { agentId, workflowId }) => {
            // Always refetch after error or success
            queryClient.invalidateQueries({ queryKey: workflowKeys.list(agentId) });
            queryClient.invalidateQueries({ queryKey: workflowKeys.detail(agentId, workflowId) });
        },
    });
}

/** Input type for delete workflow mutation */
interface DeleteWorkflowInput {
    agentId: string;
    workflowId: string;
}

/**
 * Hook to delete a workflow
 *
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * const deleteMutation = useDeleteAgentWorkflow();
 * await deleteMutation.mutateAsync({ agentId, workflowId });
 */
export function useDeleteAgentWorkflow() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ agentId, workflowId }: DeleteWorkflowInput) =>
            deleteWorkflow(agentId, workflowId),
        onMutate: async ({ agentId, workflowId }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: workflowKeys.list(agentId) });

            // Snapshot the previous value
            const previousWorkflows = queryClient.getQueryData<AgentWorkflow[]>(
                workflowKeys.list(agentId)
            );

            // Optimistically remove from list
            if (previousWorkflows) {
                queryClient.setQueryData<AgentWorkflow[]>(
                    workflowKeys.list(agentId),
                    previousWorkflows.filter((w) => w.id !== workflowId)
                );
            }

            return { previousWorkflows };
        },
        onError: (_err, { agentId }, context) => {
            // Rollback on error
            if (context?.previousWorkflows) {
                queryClient.setQueryData(
                    workflowKeys.list(agentId),
                    context.previousWorkflows
                );
            }
        },
        onSettled: (_data, _error, { agentId, workflowId }) => {
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: workflowKeys.list(agentId) });
            // Remove the detail from cache
            queryClient.removeQueries({ queryKey: workflowKeys.detail(agentId, workflowId) });
        },
    });
}

/** Input type for execute workflow mutation */
interface ExecuteWorkflowInput {
    agentId: string;
    workflowId: string;
    execution: ExecuteWorkflowRequest;
}

/**
 * Hook to execute a workflow
 *
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * const executeMutation = useExecuteWorkflow();
 * const result = await executeMutation.mutateAsync({
 *   agentId,
 *   workflowId,
 *   execution: { input_data: { message: 'Hello' } }
 * });
 */
export function useExecuteWorkflow() {
    return useMutation({
        mutationFn: ({ agentId, workflowId, execution }: ExecuteWorkflowInput) =>
            executeWorkflow(agentId, workflowId, execution),
    });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to prefetch a workflow (useful for hover states)
 *
 * @example
 * const prefetchWorkflow = usePrefetchWorkflow();
 * onMouseEnter={() => prefetchWorkflow(agentId, workflowId)}
 */
export function usePrefetchWorkflow() {
    const queryClient = useQueryClient();

    return (agentId: string, workflowId: string) => {
        queryClient.prefetchQuery({
            queryKey: workflowKeys.detail(agentId, workflowId),
            queryFn: () => fetchWorkflow(agentId, workflowId),
            staleTime: DEFAULT_STALE_TIME,
        });
    };
}

/**
 * Hook to invalidate all workflow queries for an agent
 * Useful after bulk operations
 *
 * @example
 * const invalidateWorkflows = useInvalidateWorkflows();
 * await invalidateWorkflows(agentId);
 */
export function useInvalidateWorkflows() {
    const queryClient = useQueryClient();

    return async (agentId: string) => {
        await queryClient.invalidateQueries({ queryKey: workflowKeys.list(agentId) });
    };
}
