'use client';

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/store/workflows/canvasStore';
import { StartNode } from '../nodes/StartNode';
import { EndNode } from '../nodes/EndNode';
import { AIStepNode } from '../nodes/AIStepNode';
import { RuleConditionNode } from '../nodes/RuleConditionNode';
import { LLMConditionNode } from '../nodes/LLMConditionNode';
import { NodeType } from '@/types/workflows/graph-definition';

const nodeTypes = {
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

  return (
    <div className="flex-1 h-full w-full" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        defaultViewport={viewport}
        fitView
      >
        <Controls />
        <Background gap={12} size={1} />
        <MiniMap />
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
