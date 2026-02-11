'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/components/workflows/types';
import { Brain } from 'lucide-react';
import { useCanvasStore, useExecutionStore } from '@/stores/workflows';
import { EditableLabel } from './EditableLabel';
import { LiveNodeStatus } from '../../shared/monitoring/LiveNodeStatus';

export const AIStepNode = memo(({ id, data, selected }: NodeProps<Node<NodeData>>) => {
  const nodeStatus = useExecutionStore((state) => state.nodeStatus[id]);
  const updateNodeLabel = useCanvasStore((state) => state.updateNodeLabel);

  return (
    <div className={`relative flex flex-col text-base p-3 gap-3 rounded-lg border shadow-sm bg-card border-border w-[300px] ${selected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
      <LiveNodeStatus nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-600 !z-50"
      />

      {/* Header */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
        <div className="p-2 rounded-md bg-muted text-foreground">
          <Brain className="shrink-0 size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <EditableLabel
            value={data.label || 'AI Step'}
            onChange={(newLabel) => updateNodeLabel(id, newLabel)}
            className="font-medium text-sm truncate"
          />
          <div className="text-xs text-muted-foreground truncate">
            {data.config?.model || 'No model selected'}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="text-foreground text-[15px] leading-5 font-normal line-clamp-2">
          {data.config?.prompt || 'No prompt set'}
        </div>
      </div>

      {nodeStatus?.error && (
        <div className="text-xs text-red-600 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          {nodeStatus.error}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-600 !z-50"
      />
    </div>
  );
});

AIStepNode.displayName = 'AIStepNode';
