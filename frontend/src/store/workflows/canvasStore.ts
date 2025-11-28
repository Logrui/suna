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
} from '@xyflow/react';
import type {
  NodeData,
  NodeType,
  NodeConfig,
  GraphDefinition,
  EdgeData,
} from '@/types/workflows/graph-definition';

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
    set({
      edges: addEdge(connection, get().edges),
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
