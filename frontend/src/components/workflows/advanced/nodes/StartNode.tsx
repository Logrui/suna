'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { NodeData } from '@/components/workflows/types';
import { Play } from 'lucide-react';
import { useExecutionStore } from '@/stores/workflows';
import { LiveNodeStatus } from '../../shared/monitoring/LiveNodeStatus';

export const StartNode = memo(({ id, data, selected }: NodeProps<Node<NodeData>>) => {

  return (
    <div className={`relative flex flex-col text-base p-3 gap-3 rounded-lg border shadow-sm bg-card border-border w-[300px] ${selected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
      <LiveNodeStatus nodeId={id} />

      {/* Header */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
        <div className="p-2 rounded-md bg-muted text-foreground">
          <Play className="shrink-0 size-4" />
        </div>
        <div className="text-muted-foreground text-xs font-medium truncate">
          {data.config?.triggerType || 'Manual Trigger'}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="text-foreground text-[15px] leading-5 font-normal line-clamp-2">
          Starts the workflow execution.
        </div>
      </div>

      {/* Footer */}
      <div className="-mx-3 -mb-3 px-3 pb-3 pt-3 bg-muted/30 rounded-b-lg border-t border-border/50">
        <div className="flex flex-row items-center gap-1 text-muted-foreground text-[10px] font-normal">
          Output:
          <div className="flex flex-row items-center gap-2">
            <div className="inline-flex flex-row items-center gap-1 py-0.5 px-1.5 rounded-sm bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              <p className="text-xs font-normal truncate">@trigger</p>
            </div>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-green-600 !z-50"
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';
