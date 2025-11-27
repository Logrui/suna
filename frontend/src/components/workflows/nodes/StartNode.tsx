'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '@/types/workflows/graph-definition';
import { Play } from 'lucide-react';
import { useExecutionStore } from '@/store/workflows/executionStore';

export const StartNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
  const nodeStatus = useExecutionStore((state) => state.nodeStatus[id]);
  const executionStatus = useExecutionStore((state) => state.status);

  // Determine visual status
  const getStatusColor = () => {
    if (!nodeStatus || executionStatus === 'idle') return 'bg-green-50 border-green-500';
    if (nodeStatus.status === 'running') return 'bg-green-200 border-green-600 animate-pulse';
    if (nodeStatus.status === 'completed') return 'bg-green-100 border-green-500';
    if (nodeStatus.status === 'failed') return 'bg-red-100 border-red-500';
    return 'bg-green-50 border-green-500';
  };

  const getStatusBadge = () => {
    if (!nodeStatus || executionStatus === 'idle') return null;
    if (nodeStatus.status === 'running') return <span className="text-xs text-green-700">Running...</span>;
    if (nodeStatus.status === 'completed') return <span className="text-xs text-green-700">Started</span>;
    if (nodeStatus.status === 'failed') return <span className="text-xs text-red-700">Failed</span>;
    return null;
  };

  return (
    <div className={`px-4 py-3 shadow-md rounded-md border-2 w-[180px] ${getStatusColor()} ${selected ? 'ring-2 ring-blue-400' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-8 h-8 bg-green-600 rounded-full text-white">
          <Play size={16} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Start</div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="text-xs text-gray-600">
        Trigger: {data.config?.trigger || 'Manual'}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-green-600"
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';
