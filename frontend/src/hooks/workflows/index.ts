/**
 * Workflow Hooks Index
 *
 * Exports all custom hooks for workflow management.
 * Includes validation, state management, and data fetching hooks.
 *
 * @module hooks/workflows
 */

// AI Validation Hook
export { useAIStepValidation } from './useAIStepValidation';
export type { ValidationError } from './useAIStepValidation';

// Agent Workflow Hooks
export {
    // Query hooks
    useAgentWorkflows,
    useAgentWorkflow,
    // Mutation hooks
    useCreateAgentWorkflow,
    useUpdateAgentWorkflow,
    useDeleteAgentWorkflow,
    useExecuteWorkflow,
    // Utility hooks
    usePrefetchWorkflow,
    useInvalidateWorkflows,
    // Query keys
    workflowKeys,
    agentWorkflowKeys, // Legacy alias
    // Error class
    WorkflowApiError,
} from './use-agent-workflows';

// Types
export type {
    AgentWorkflow,
    WorkflowStep,
    WorkflowStatus,
    WorkflowMode,
    CreateWorkflowRequest,
    UpdateWorkflowRequest,
    ExecuteWorkflowRequest,
    ExecuteWorkflowResponse,
} from './types';
