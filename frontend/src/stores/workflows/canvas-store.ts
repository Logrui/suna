/**
 * Workflows Canvas Store
 * 
 * Zustand store for managing workflow canvas state including nodes, edges,
 * viewport, and selection in the visual workflow editor.
 * 
 * @deprecated This store is used by the legacy advanced workflow editor.
 * New implementations should use the advanced-workflows-bridge-store for iframe mode.
 */

import { create } from 'zustand';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
    Viewport,
    MarkerType,
} from '@xyflow/react';
import type {
    NodeData,
    NodeType,
    NodeConfig,
    GraphDefinition,
    EdgeData,
} from '@/components/workflows/types';
import { getLayoutedElements } from '@/lib/workflows/autoLayout';

interface CanvasState {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
    viewport: Viewport;
    selectedNodeIds: string[];

    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;

    addNode: (type: NodeType, position: { x: number; y: number }) => void;
    updateNodeConfig: (id: string, config: any) => void;
    updateNodeLabel: (id: string, label: string) => void;
    setViewport: (viewport: Viewport) => void;
    setSelectedNodeIds: (ids: string[]) => void;

    // Load initial state
    setGraph: (nodes: Node<NodeData>[], edges: Edge[], viewport: Viewport) => void;
    layoutNodes: (direction?: 'TB' | 'LR') => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeIds: [],

    onNodesChange: (changes: NodeChange[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes) as Node<NodeData>[],
        });
    },

    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    onConnect: (connection: Connection) => {
        const edge = {
            ...connection,
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'var(--workflow-edge-border)', strokeWidth: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--workflow-edge-border)' },
        };
        set({
            edges: addEdge(edge, get().edges),
        });
    },

    addNode: (type: NodeType, position: { x: number; y: number }) => {
        const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNode: Node<NodeData> = {
            id,
            type,
            position,
            data: {
                id,
                type,
                label: formatLabel(type),
                config: {},
            },
        };

        set({ nodes: [...get().nodes, newNode] });
    },

    updateNodeConfig: (id: string, config: Partial<NodeConfig>) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            config: { ...node.data.config, ...config },
                        },
                    };
                }
                return node;
            }),
        });
    },

    updateNodeLabel: (id: string, label: string) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            label,
                        },
                    };
                }
                return node;
            }),
        });
    },

    setViewport: (viewport: Viewport) => {
        set({ viewport });
    },

    setSelectedNodeIds: (ids: string[]) => {
        set({ selectedNodeIds: ids });
    },

    setGraph: (nodes, edges, viewport) => {
        set({ nodes, edges, viewport });
    },

    layoutNodes: (direction = 'TB') => {
        const { nodes, edges } = get();
        const layouted = getLayoutedElements(nodes, edges, direction);
        set({ nodes: layouted.nodes as Node<NodeData>[], edges: layouted.edges });
    },
}));

function formatLabel(type: NodeType): string {
    switch (type) {
        case 'TRIGGER': return 'Start Trigger';
        case 'AI_STEP': return 'AI Agent Step';
        case 'RULE_CONDITION': return 'Rule Condition';
        case 'LLM_CONDITION': return 'Semantic Condition';
        case 'STOP': return 'End Workflow';
        default: return 'New Node';
    }
}
