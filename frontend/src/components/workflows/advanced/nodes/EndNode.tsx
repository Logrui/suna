'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/components/workflows/types';
import { Square } from 'lucide-react';
import { LiveNodeStatus } from '../../shared/monitoring/LiveNodeStatus';
import { useExecutionStore } from '@/stores/workflows';

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
    <div className={`relative flex flex-col text-base p-3 gap-3 rounded-lg border shadow-sm bg-card border-border w-[200px] ${selected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
      <LiveNodeStatus nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-red-600 !z-50"
      />

      {/* Header */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
        <div className="p-2 rounded-md bg-muted text-foreground">
          <Square className="shrink-0 size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">Stop</div>
          <div className="text-xs text-muted-foreground truncate">End Workflow</div>
        </div>
      </div>

      {/* Status Badge Overlay */}
      {nodeStatus?.status && nodeStatus.status !== 'pending' && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          {getStatusBadge()}
        </div>
      )}

      {/* Error Message */}
      {nodeStatus?.error && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 z-10 text-xs text-red-600 p-2 bg-red-50 dark:bg-red-900/90 rounded border border-red-200 dark:border-red-800 shadow-lg mt-2">
          {nodeStatus.error}
        </div>
      )}
    </div>
  );
});

EndNode.displayName = 'EndNode';
