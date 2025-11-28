'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/types/workflows/graph-definition';
import { Brain } from 'lucide-react';
import { useCanvasStore } from '@/store/workflows/canvasStore';
import { useExecutionStore } from '@/store/workflows/executionStore';
import { EditableLabel } from './EditableLabel';
import { LiveNodeStatus } from '../monitoring/LiveNodeStatus';

export const AIStepNode = memo(({ id, data, selected }: NodeProps<Node<NodeData>>) => {
  const nodeStatus = useExecutionStore((state) => state.nodeStatus[id]);
  const updateNodeLabel = useCanvasStore((state) => state.updateNodeLabel);

  return (
    <div className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[220px] bg-card text-card-foreground ${selected ? 'ring-2 ring-blue-400 border-blue-400' : 'border-border'}`}>
      <LiveNodeStatus nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-600"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full text-white">
          <Brain size={16} />
        </div>
        <div className="flex-1">
          <EditableLabel
            value={data.label || 'AI Step'}
            onChange={(newLabel) => updateNodeLabel(id, newLabel)}
            className="font-semibold text-sm"
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-1">
        {data.config?.model || 'No model selected'}
      </div>

      <div className="text-xs text-muted-foreground/70 truncate">
        {data.config?.prompt ? data.config.prompt.slice(0, 60) + '...' : 'No prompt set'}
      </div>

      {nodeStatus?.error && (
        <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-200">
          {nodeStatus.error}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-600"
      />
    </div>
  );
});

AIStepNode.displayName = 'AIStepNode';
