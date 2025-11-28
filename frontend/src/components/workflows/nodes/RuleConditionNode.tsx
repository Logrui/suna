'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/types/workflows/graph-definition';
import { Scale } from 'lucide-react';
import { useExecutionStore } from '@/store/workflows/executionStore';
import { LiveNodeStatus } from '../monitoring/LiveNodeStatus';

export const RuleConditionNode = memo(({ id, data, selected }: NodeProps<Node<NodeData>>) => {
  const nodeStatus = useExecutionStore((state) => state.nodeStatus[id]);
  const executionStatus = useExecutionStore((state) => state.status);

  // Determine visual status
  const getStatusColor = () => {
    if (!nodeStatus || executionStatus === 'idle') return 'bg-yellow-50 border-yellow-500';
    if (nodeStatus.status === 'running') return 'bg-yellow-200 border-yellow-600 animate-pulse';
    if (nodeStatus.status === 'completed') return 'bg-yellow-100 border-yellow-500';
    if (nodeStatus.status === 'failed') return 'bg-red-100 border-red-500';
    if (nodeStatus.status === 'pending') return 'bg-gray-100 border-gray-400';
    return 'bg-yellow-50 border-yellow-500';
  };

  const getStatusBadge = () => {
    if (!nodeStatus || executionStatus === 'idle') return null;
    if (nodeStatus.status === 'running') return <span className="text-xs text-yellow-700">Evaluating...</span>;
    if (nodeStatus.status === 'completed') return <span className="text-xs text-green-700">Evaluated</span>;
    if (nodeStatus.status === 'failed') return <span className="text-xs text-red-700">Failed</span>;
    if (nodeStatus.status === 'pending') return <span className="text-xs text-gray-600">Pending</span>;
    return null;
  };

  return (
    <div className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[200px] bg-card text-card-foreground ${selected ? 'ring-2 ring-blue-400 border-blue-400' : 'border-border'}`}>
      <LiveNodeStatus nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-yellow-600"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-8 h-8 bg-yellow-600 rounded-full text-white">
          <Scale size={16} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">{data.label || 'Rule Condition'}</div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        {data.config?.rules?.length || 0} rule{data.config?.rules?.length !== 1 ? 's' : ''} defined
      </div>

      {nodeStatus?.error && (
        <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-200">
          {nodeStatus.error}
        </div>
      )}

      <div className="flex justify-between items-center mt-3">
        <div className="text-xs font-semibold text-green-600 relative">
          True
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="w-2 h-2 !bg-green-600 !left-1/2 !-bottom-3"
            style={{ left: '50%' }}
          />
        </div>

        <div className="text-xs font-semibold text-red-600 relative">
          False
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="w-2 h-2 !bg-red-600 !left-1/2 !-bottom-3"
            style={{ left: '50%' }}
          />
        </div>
      </div>
    </div>
  );
});

RuleConditionNode.displayName = 'RuleConditionNode';
