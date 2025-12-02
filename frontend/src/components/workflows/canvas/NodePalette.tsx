import React from 'react';
import { NodeType } from '@/types/workflows/graph-definition';

export const NodePalette = () => {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 border-r bg-background p-4 flex flex-col gap-4 h-full">
      <div className="font-semibold text-sm text-muted-foreground mb-2">
        Nodes
      </div>

      <div className="flex flex-col gap-3">
        <DraggableNode
          type="TRIGGER"
          label="Start Trigger"
          onDragStart={(e) => onDragStart(e, 'TRIGGER')}
          color="border-blue-500"
        />
        <DraggableNode
          type="COMPOSIO_TRIGGER"
          label="Composio Trigger"
          onDragStart={(e) => onDragStart(e, 'COMPOSIO_TRIGGER')}
          color="border-blue-600"
        />
        <DraggableNode
          type="AI_STEP"
          label="AI Agent Step"
          onDragStart={(e) => onDragStart(e, 'AI_STEP')}
          color="border-purple-500"
        />
        <DraggableNode
          type="RULE_CONDITION"
          label="Condition (Rule)"
          onDragStart={(e) => onDragStart(e, 'RULE_CONDITION')}
          color="border-orange-500"
        />
        <DraggableNode
          type="LLM_CONDITION"
          label="Conditional Split"
          onDragStart={(e) => onDragStart(e, 'LLM_CONDITION')}
          color="border-yellow-500"
        />
        <DraggableNode
          type="STOP"
          label="End"
          onDragStart={(e) => onDragStart(e, 'STOP')}
          color="border-red-500"
        />
      </div>
    </aside>
  );
};

interface DraggableNodeProps {
  type: NodeType;
  label: string;
  onDragStart: (event: React.DragEvent) => void;
  color: string;
}

import { Play, Zap, Bot, GitBranch, BrainCircuit, Square } from 'lucide-react';

const NODE_ICONS: Record<string, any> = {
  'TRIGGER': Play,
  'COMPOSIO_TRIGGER': Zap,
  'AI_STEP': Bot,
  'RULE_CONDITION': GitBranch,
  'LLM_CONDITION': BrainCircuit,
  'STOP': Square,
};

const DraggableNode = ({ type, label, onDragStart, color }: DraggableNodeProps) => {
  const IconComponent = NODE_ICONS[type] || Square;

  return (
    <div
      className="flex items-center gap-3 p-3 border rounded-lg cursor-grab bg-card shadow-sm hover:bg-accent/50 transition-colors"
      onDragStart={onDragStart}
      draggable
    >
      <div className="p-2 rounded-md bg-muted text-foreground">
        <IconComponent className="w-4 h-4" />
      </div>
      <div>
        <div className="text-sm font-medium leading-none">{label}</div>
        <div className="text-xs text-muted-foreground mt-1 lowercase opacity-70">
          {type.replace('_', ' ')}
        </div>
      </div>
    </div>
  );
};
