'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData } from '@/types/workflows/graph-definition';
import { GitBranch } from 'lucide-react';
import { useExecutionStore } from '@/store/workflows/executionStore';
import { LiveNodeStatus } from '../monitoring/LiveNodeStatus';

export const LLMConditionNode = memo(({ id, data, selected }: NodeProps<NodeData>) => {
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
    <div className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[220px] bg-white ${selected ? 'ring-2 ring-blue-400 border-blue-400' : 'border-gray-200'}`}>
      <LiveNodeStatus nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-purple-600"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-8 h-8 bg-purple-600 rounded-full text-white">
          <GitBranch size={16} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">{data.label || 'LLM Condition'}</div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="text-xs text-gray-600 mb-1">
        {data.config?.modelId || 'No model selected'}
      </div>

      <div className="text-xs text-gray-500 italic truncate">
        {data.config?.naturalLanguageCondition || 'Enter condition...'}
      </div>

      {nodeStatus?.error && (
        <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-200">
          {nodeStatus.error}
        </div>
      )}

      <div className="flex justify-between items-center mt-3">
        <div className="text-xs font-semibold text-green-600 relative">
          Yes
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="w-2 h-2 !bg-green-600 !left-1/2 !-bottom-3"
          />
        </div>

        <div className="text-xs font-semibold text-red-600 relative">
          No
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="w-2 h-2 !bg-red-600 !left-1/2 !-bottom-3"
          />
        </div>
      </div>
    </div>
  );
});

LLMConditionNode.displayName = 'LLMConditionNode';
