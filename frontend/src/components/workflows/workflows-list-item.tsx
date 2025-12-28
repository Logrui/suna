'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { type AgentWorkflow } from '@/hooks/workflows';
import { cn } from '@/lib/utils';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';
import { getModeIcon, getModeStyles, getStatusStyles, getTimeAgo } from './workflows-utils';

// Extended workflow type with agent ID
export type WorkflowWithAgent = AgentWorkflow & { agentId: string };

// Workflow Card Props
export interface WorkflowListItemProps {
    workflow: WorkflowWithAgent;
    agent: any;
    onClick: () => void;
    index: number;
    isSelected?: boolean;
}

export function WorkflowListItem({ workflow, agent, onClick, index, isSelected }: WorkflowListItemProps) {
    const ModeIcon = getModeIcon(workflow.mode || 'simple');
    const modeStyles = getModeStyles(workflow.mode || 'simple');
    const statusStyles = getStatusStyles(workflow.status);
    const StatusIcon = statusStyles.icon;

    const updatedAt = new Date(workflow.updated_at);
    const timeAgo = getTimeAgo(updatedAt);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            onClick={onClick}
            className={cn(
                "relative overflow-hidden rounded-xl border border-border/50 bg-background/50 p-4 backdrop-blur-sm hover:border-border/80 cursor-pointer transition-all group",
                isSelected && "border-primary/50 bg-primary/5"
            )}
        >
            {/* Grain Overlay */}
            <div
                className="pointer-events-none absolute inset-0 opacity-10 mix-blend-multiply"
                style={{ backgroundImage: "url('/noise.png')" }}
            />

            <div className="relative z-10 flex items-center gap-4">
                {/* Agent Avatar */}
                <div className="flex-shrink-0">
                    <AgentAvatar agent={agent} agentId={agent?.agent_id} size={40} />
                </div>

                {/* Workflow Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{workflow.name}</h3>
                        {workflow.is_default && (
                            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                Default
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground truncate">
                            {agent?.name || 'Unknown Agent'}
                        </span>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="text-xs text-muted-foreground/80">{timeAgo}</span>
                    </div>
                </div>

                {/* Mode Badge */}
                <div className={cn(
                    "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs",
                    modeStyles.bg, modeStyles.text, "border", modeStyles.border
                )}>
                    <ModeIcon className="h-3.5 w-3.5" />
                    <span className="capitalize hidden sm:inline">{workflow.mode || 'simple'}</span>
                </div>

                {/* Status indicator */}
                <div className={cn(
                    "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs",
                    statusStyles.bg, statusStyles.text
                )}>
                    <StatusIcon className="h-3 w-3" />
                    <span className="capitalize hidden sm:inline">{workflow.status}</span>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
            </div>
        </motion.div>
    );
}
