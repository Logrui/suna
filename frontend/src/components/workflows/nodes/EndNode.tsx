'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '@/types/workflows/graph-definition';
import { Square } from 'lucide-react';
import { LiveNodeStatus } from '../monitoring/LiveNodeStatus';
import { useExecutionStore } from '@/store/workflows/executionStore';

export const EndNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
  const nodeStatus = useExecutionStore((state) => state.nodeStatus[id]);
  const executionStatus = useExecutionStore((state) => state.status);

  // Determine visual status
  const getStatusColor = () => {
    if (!nodeStatus || executionStatus === 'idle') return 'bg-red-50 border-red-500';
    if (nodeStatus.status === 'running') return 'bg-red-200 border-red-600 animate-pulse';
    if (nodeStatus.status === 'completed') return 'bg-red-100 border-red-500';
    if (nodeStatus.status === 'failed') return 'bg-red-100 border-red-500';
    if (nodeStatus.status === 'pending') return 'bg-gray-100 border-gray-400';
    return 'bg-red-50 border-red-500';
  };

  const getStatusBadge = () => {
    if (!nodeStatus || executionStatus === 'idle') return null;
    if (nodeStatus.status === 'running') return <span className="text-xs text-red-700">Finalizing...</span>;
    if (nodeStatus.status === 'completed') return <span className="text-xs text-green-700">Complete</span>;
    if (nodeStatus.status === 'failed') return <span className="text-xs text-red-700">Failed</span>;
    if (nodeStatus.status === 'pending') return <span className="text-xs text-gray-600">Pending</span>;
    return null;
  };

  return (
    <div className={`px-4 py-3 shadow-md rounded-md border-2 w-[180px] bg-white ${selected ? 'ring-2 ring-blue-400 border-blue-400' : 'border-gray-200'}`}>
      <LiveNodeStatus nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-red-600"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-8 h-8 bg-red-600 rounded-full text-white">
          <Square size={16} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">End</div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="text-xs text-gray-600">
        Format: {data.config?.outputFormat || 'default'}
      </div>

      {nodeStatus?.error && (
        <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-200">
          {nodeStatus.error}
        </div>
      )}
    </div>
  );
});

EndNode.displayName = 'EndNode';
