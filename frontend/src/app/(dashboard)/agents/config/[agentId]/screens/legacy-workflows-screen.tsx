'use client';

import React from 'react';
import { useAgent } from '@/hooks/agents/use-agents';
import { AgentWorkflowsConfiguration } from '@/components/agents/workflows/agent-workflows-configuration';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkflowsScreenProps {
    agentId: string;
}

export function WorkflowsScreen({ agentId }: WorkflowsScreenProps) {
    const { data: agent, isLoading } = useAgent(agentId);

    if (isLoading) {
        return (
            <div className="flex-1 overflow-auto pb-6">
                <div className="px-1 pt-1 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden pb-6">
            <div className="px-1 pt-1 flex flex-col flex-1 min-h-0 h-full">
                <AgentWorkflowsConfiguration 
                    agentId={agentId} 
                    agentName={agent?.name || 'Agent'}
                />
            </div>
        </div>
    );
}
