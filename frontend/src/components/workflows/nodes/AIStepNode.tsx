'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '@/types/workflows/graph-definition';
import { Brain } from 'lucide-react';
import { useExecutionStore } from '@/store/workflows/executionStore';
import { useCanvasStore } from '@/store/workflows/canvasStore';
import { EditableLabel } from './EditableLabel';

export const AIStepNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
  const nodeStatus = useExecutionStore((state) => state.nodeStatus[id]);
  const executionStatus = useExecutionStore((state) => state.status);
  const updateNodeLabel = useCanvasStore((state) => state.updateNodeLabel);

  // Determine visual status
  const getStatusColor = () => {
    if (!nodeStatus || executionStatus === 'idle') return 'bg-blue-50 border-blue-500';
    if (nodeStatus.status === 'running') return 'bg-blue-200 border-blue-600 animate-pulse';
    if (nodeStatus.status === 'completed') return 'bg-blue-100 border-blue-500';
    if (nodeStatus.status === 'failed') return 'bg-red-100 border-red-500';
    if (nodeStatus.status === 'pending') return 'bg-gray-100 border-gray-400';
    return 'bg-blue-50 border-blue-500';
  };

  const getStatusBadge = () => {
    if (!nodeStatus || executionStatus === 'idle') return null;
    if (nodeStatus.status === 'running') return <span className="text-xs text-blue-700">Running...</span>;
    if (nodeStatus.status === 'completed') return <span className="text-xs text-green-700">Completed</span>;
    if (nodeStatus.status === 'failed') return <span className="text-xs text-red-700">Failed</span>;
    if (nodeStatus.status === 'pending') return <span className="text-xs text-gray-600">Pending</span>;
    return null;
  };

  return (
    <div className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[220px] ${getStatusColor()} ${selected ? 'ring-2 ring-blue-400' : ''}`}>
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
          {getStatusBadge()}
        </div>
      </div>

      <div className="text-xs text-gray-600 mb-1">
        {data.config?.model || 'No model selected'}
      </div>

      <div className="text-xs text-gray-500 truncate">
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
