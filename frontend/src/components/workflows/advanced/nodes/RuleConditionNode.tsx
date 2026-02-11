'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/components/workflows/types';
import { Scale } from 'lucide-react';
import { useExecutionStore } from '@/stores/workflows';
import { LiveNodeStatus } from '../../shared/monitoring/LiveNodeStatus';

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
    <div className={`relative flex flex-col text-base p-3 gap-3 rounded-lg border shadow-sm bg-card border-border w-[250px] ${selected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
      <LiveNodeStatus nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-yellow-600 !z-50"
      />

      {/* Header */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
        <div className="p-2 rounded-md bg-muted text-foreground">
          <Scale className="shrink-0 size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{data.label || 'Rule Condition'}</div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="text-muted-foreground text-xs leading-5 font-normal">
          {data.config?.rules?.length || 0} rule{data.config?.rules?.length !== 1 ? 's' : ''} defined
        </div>
      </div>

      {nodeStatus?.error && (
        <div className="text-xs text-red-600 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
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
            className="w-2 h-2 !bg-green-600 !left-1/2 !-bottom-3 !z-50"
            style={{ left: '50%' }}
          />
        </div>

        <div className="text-xs font-semibold text-red-600 relative">
          False
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="w-2 h-2 !bg-red-600 !left-1/2 !-bottom-3 !z-50"
            style={{ left: '50%' }}
          />
        </div>
      </div>
    </div>
  );
});

RuleConditionNode.displayName = 'RuleConditionNode';
