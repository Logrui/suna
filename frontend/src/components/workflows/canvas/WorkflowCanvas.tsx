'use client';

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  OnSelectionChangeParams,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/store/workflows/canvasStore';
import { StartNode } from '../nodes/StartNode';
import { EndNode } from '../nodes/EndNode';
import { AIStepNode } from '../nodes/AIStepNode';
import { RuleConditionNode } from '../nodes/RuleConditionNode';
import { LLMConditionNode } from '../nodes/LLMConditionNode';
import { NodeType } from '@/types/workflows/graph-definition';

const nodeTypes: any = {
  TRIGGER: StartNode,
  STOP: EndNode,
  AI_STEP: AIStepNode,
  RULE_CONDITION: RuleConditionNode,
  LLM_CONDITION: LLMConditionNode,
};

// Inner component that has access to ReactFlow instance
const WorkflowCanvasInner = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const {
    nodes,
    edges,
    viewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setViewport,
    setSelectedNodeIds,
  } = useCanvasStore();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type) {
        return;
      }

      // Use React Flow's screenToFlowPosition for accurate coordinate projection
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [addNode, reactFlowInstance]
  );

  // Handle viewport changes
  const onMoveEnd = useCallback(
    (_event: any, viewport: any) => {
      setViewport(viewport);
    },
    [setViewport]
  );

  // Handle selection changes
  const onSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams) => {
      setSelectedNodeIds(nodes.map((node) => node.id));
    },
    [setSelectedNodeIds]
  );

  return (
    <div className="flex-1 h-full w-full" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMoveEnd={onMoveEnd}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        defaultViewport={viewport}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          className="!bg-card !border-border shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent [&>button:hover]:!text-accent-foreground [&>button>svg]:!fill-foreground"
        />
        <Background gap={12} size={1} className="bg-background" color="#555" />
        <MiniMap
          className="!bg-card !border-border shadow-sm"
          maskColor="rgba(0, 0, 0, 0.1)"
          nodeColor={(node) => {
            switch (node.type) {
              case 'TRIGGER': return '#16a34a'; // green-600
              case 'AI_STEP': return '#2563eb'; // blue-600
              case 'RULE_CONDITION': return '#ca8a04'; // yellow-600
              case 'LLM_CONDITION': return '#9333ea'; // purple-600
              case 'STOP': return '#dc2626'; // red-600
              default: return '#888';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
};

// Wrapper component with ReactFlowProvider
export const WorkflowCanvas = () => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
};
