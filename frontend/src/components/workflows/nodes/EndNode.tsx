'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/types/workflows/graph-definition';
import { Square } from 'lucide-react';
import { LiveNodeStatus } from '../monitoring/LiveNodeStatus';
import { useExecutionStore } from '@/store/workflows/executionStore';

export const EndNode = memo(({ id, data, selected }: NodeProps<Node<NodeData>>) => {
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
    <div className={`relative flex flex-col items-center justify-center ${selected ? 'ring-2 ring-blue-500 rounded-full' : ''}`}>
      <LiveNodeStatus nodeId={id} />

      <div className="flex flex-row items-center gap-1 rounded-full truncate select-none text-sm py-0.5 px-2 h-7 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-transparent">
        <div className="truncate">
          <div className="flex flex-row items-center gap-1.5">
            <Square className="size-3 text-red-600 dark:text-red-400 fill-current" />
            <span className="font-medium">Stop Running Skill</span>
          </div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-red-600 !-top-3"
      />

      {/* Status Badge Overlay */}
      {nodeStatus?.status && nodeStatus.status !== 'pending' && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          {getStatusBadge()}
        </div>
      )}

      {/* Error Message */}
      {nodeStatus?.error && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-48 z-10 text-xs text-red-600 p-2 bg-red-50 dark:bg-red-900/90 rounded border border-red-200 dark:border-red-800 shadow-lg">
          {nodeStatus.error}
        </div>
      )}
    </div>
  );
});

EndNode.displayName = 'EndNode';
