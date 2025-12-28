'use client';

import React from 'react';
import { useAgent } from '@/hooks/agents/use-agents';
import { AgentWorkflowsConfiguration } from '@/components/workflows/simple/workflows-list';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

interface WorkflowsScreenProps {
    agentId: string;
}

export function WorkflowsScreen({ agentId }: WorkflowsScreenProps) {
    const { data: agent, isLoading } = useAgent(agentId);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden pb-6">
                <div className="px-1 pt-1 flex flex-col flex-1 min-h-0 h-full">
                    {/* Button skeleton */}
                    <div className="flex-shrink-0 mb-4">
                        <Skeleton className="h-10 w-40" />
                    </div>
                    {/* Workflow cards skeleton */}
                    <div className="flex-1 overflow-y-auto space-y-4">
                        {[1, 2, 3].map((index) => (
                            <Card key={index} className="p-6 rounded-xl">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 space-y-3">
                                        <Skeleton className="h-6 w-48" />
                                        <div className="flex items-center space-x-2">
                                            <Skeleton className="h-5 w-16 rounded-full" />
                                            <Skeleton className="h-5 w-14 rounded-full" />
                                        </div>
                                        <Skeleton className="h-4 w-full max-w-md" />
                                        <Skeleton className="h-4 w-3/4 max-w-sm" />
                                        <div className="flex items-center pt-1">
                                            <Skeleton className="h-4 w-4 mr-2 rounded" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                        <Skeleton className="h-8 w-20 rounded-md" />
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
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
