'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/components/workflows/types';
import { GitBranch } from 'lucide-react';
import { useExecutionStore } from '@/stores/workflows';
import { LiveNodeStatus } from '../../shared/monitoring/LiveNodeStatus';

export const LLMConditionNode = memo(({ id, data, selected }: NodeProps<Node<NodeData>>) => {
  const nodeStatus = useExecutionStore((state) => state.nodeStatus[id]);
  const executionStatus = useExecutionStore((state) => state.status);

  // Determine visual status
  const getStatusColor = () => {
    if (!nodeStatus || executionStatus === 'idle') return 'bg-purple-50 border-purple-500';
    if (nodeStatus.status === 'running') return 'bg-purple-200 border-purple-600 animate-pulse';
    if (nodeStatus.status === 'completed') return 'bg-purple-100 border-purple-500';
    if (nodeStatus.status === 'failed') return 'bg-red-100 border-red-500';
    if (nodeStatus.status === 'pending') return 'bg-gray-100 border-gray-400';
    return 'bg-purple-50 border-purple-500';
  };

  const getStatusBadge = () => {
    if (!nodeStatus || executionStatus === 'idle') return null;
    if (nodeStatus.status === 'running') return <span className="text-xs text-purple-700">Deciding...</span>;
    if (nodeStatus.status === 'completed') return <span className="text-xs text-green-700">Decided</span>;
    if (nodeStatus.status === 'failed') return <span className="text-xs text-red-700">Failed</span>;
    if (nodeStatus.status === 'pending') return <span className="text-xs text-gray-600">Pending</span>;
    return null;
  };

  return (
    <div className={`relative flex items-center gap-2 px-2 py-1.5 rounded-md border shadow-sm bg-card border-border min-w-[140px] ${selected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
      <LiveNodeStatus nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-purple-600 !z-50"
      />

      <GitBranch className="shrink-0 size-4 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{data.label || 'Conditional Split'}</div>
      </div>

      {/* Status Badge (Compact) */}
      {nodeStatus?.status === 'running' && (
        <div className="absolute -top-1 right-0 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
      )}

      {/* Error Indicator */}
      {nodeStatus?.error && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" title={nodeStatus.error} />
      )}

      {/* Output Handles - Distributed at the bottom */}
      <div className="absolute bottom-0 left-0 w-full flex justify-evenly px-2">
        {/* True Handle */}
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="w-2 h-2 !bg-green-600 !-bottom-[5px] !z-50"
            style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
          />
        </div>

        {/* False Handle */}
        <div className="relative">
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="w-2 h-2 !bg-red-600 !-bottom-[5px] !z-50"
            style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
          />
        </div>
      </div>
    </div>
  );
});

LLMConditionNode.displayName = 'LLMConditionNode';
