/**
 * Workflows Execution Store
 * 
 * Zustand store for tracking workflow execution state including
 * node-level status, execution events, and final results.
 * 
 * @deprecated This store is used by the legacy advanced workflow editor.
 * New implementations should use the advanced-workflows-bridge-store for iframe mode.
 */

import { create } from 'zustand';

export interface ExecutionEvent {
    timestamp: Date;
    type: 'node_started' | 'node_completed' | 'node_failed' | 'execution_started' | 'execution_completed' | 'execution_failed';
    node_id?: string;
    message: string;
    details?: any;
}

export interface NodeExecutionStatus {
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt: Date | null;
    completedAt: Date | null;
    error?: string;
    output?: any;
}

interface ExecutionState {
    // Execution tracking
    executionId: string | null;
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    startedAt: Date | null;
    completedAt: Date | null;

    // Node-level status tracking
    nodeStatus: Record<string, NodeExecutionStatus>;

    // Execution log
    events: ExecutionEvent[];

    // Final results
    finalVariables: Record<string, any>;
    error?: string;

    // Actions
    startExecution: (executionId: string) => void;
    updateNodeStatus: (nodeId: string, status: NodeExecutionStatus['status'], details?: any) => void;
    addEvent: (event: Omit<ExecutionEvent, 'timestamp'>) => void;
    setFinalVariables: (vars: Record<string, any>) => void;
    completeExecution: (status: 'completed' | 'failed', error?: string) => void;
    reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
    // Initial state
    executionId: null,
    status: 'idle',
    startedAt: null,
    completedAt: null,
    nodeStatus: {},
    events: [],
    finalVariables: {},
    error: undefined,

    // Actions
    startExecution: (executionId: string) => set((state) => ({
        executionId,
        status: 'running',
        startedAt: new Date(),
        completedAt: null,
        nodeStatus: {},
        events: [
            ...state.events,
            {
                timestamp: new Date(),
                type: 'execution_started',
                message: `Execution ${executionId} started`,
            }
        ],
        finalVariables: {},
        error: undefined,
    })),

    updateNodeStatus: (nodeId: string, status: NodeExecutionStatus['status'], details?: any) => set((state) => {
        const now = new Date();
        const currentStatus = state.nodeStatus[nodeId];

        const newStatus: NodeExecutionStatus = {
            ...currentStatus,
            status,
            startedAt: status === 'running' ? now : currentStatus?.startedAt || null,
            completedAt: status === 'completed' || status === 'failed' ? now : null,
            error: status === 'failed' ? details?.error : undefined,
            output: status === 'completed' ? details?.output : undefined,
        };

        let eventType: ExecutionEvent['type'] = 'node_started';
        let message = `Node ${nodeId} started`;

        if (status === 'completed') {
            eventType = 'node_completed';
            message = `Node ${nodeId} completed`;
        } else if (status === 'failed') {
            eventType = 'node_failed';
            message = `Node ${nodeId} failed: ${details?.error || 'Unknown error'}`;
        }

        return {
            nodeStatus: {
                ...state.nodeStatus,
                [nodeId]: newStatus,
            },
            events: [
                ...state.events,
                {
                    timestamp: now,
                    type: eventType,
                    node_id: nodeId,
                    message,
                    details,
                }
            ],
        };
    }),

    addEvent: (event: Omit<ExecutionEvent, 'timestamp'>) => set((state) => ({
        events: [
            ...state.events,
            {
                ...event,
                timestamp: new Date(),
            }
        ],
    })),

    setFinalVariables: (vars: Record<string, any>) => set({
        finalVariables: vars,
    }),

    completeExecution: (status: 'completed' | 'failed', error?: string) => set((state) => ({
        status,
        completedAt: new Date(),
        error,
        events: [
            ...state.events,
            {
                timestamp: new Date(),
                type: status === 'completed' ? 'execution_completed' : 'execution_failed',
                message: status === 'completed'
                    ? 'Execution completed successfully'
                    : `Execution failed: ${error || 'Unknown error'}`,
                details: error ? { error } : undefined,
            }
        ],
    })),

    reset: () => set({
        executionId: null,
        status: 'idle',
        startedAt: null,
        completedAt: null,
        nodeStatus: {},
        events: [],
        finalVariables: {},
        error: undefined,
    }),
}));
