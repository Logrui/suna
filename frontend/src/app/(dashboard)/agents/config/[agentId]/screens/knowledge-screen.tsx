'use client';

import React from 'react';
import { KnowledgeBaseManager } from '@/components/knowledge-base/knowledge-base-manager';
import { useAgent } from '@/hooks/agents/use-agents';

interface KnowledgeScreenProps {
    agentId: string;
}

export function KnowledgeScreen({ agentId }: KnowledgeScreenProps) {
    const { data: agent } = useAgent(agentId);

    return (
        <div className="flex-1 overflow-auto pb-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="px-1 pt-1">
                <KnowledgeBaseManager
                    agentId={agentId}
                    agentName={agent?.name || 'this Worker'}
                    showHeader={false}
                    showRecentFiles={false}
                    enableAssignments={true}
                    emptyStateMessage="No knowledge base content available. Create folders and upload files to provide this Worker with searchable knowledge."
                />
            </div>
        </div>
    );
}
