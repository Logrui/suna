'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/types/workflows/graph-definition';
import { Play } from 'lucide-react';
import { useExecutionStore } from '@/store/workflows/executionStore';
import { LiveNodeStatus } from '../monitoring/LiveNodeStatus';

export const StartNode = memo(({ id, data, selected }: NodeProps<Node<NodeData>>) => {

  return (
    <div className={`px-4 py-3 shadow-md rounded-md border-2 w-[180px] bg-card text-card-foreground ${selected ? 'ring-2 ring-blue-400 border-blue-400' : 'border-border'}`}>
      <LiveNodeStatus nodeId={id} />
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-8 h-8 bg-green-600 rounded-full text-white">
          <Play size={16} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Start</div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-1">
        Trigger: {data.config?.triggerType || 'Manual'}
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
