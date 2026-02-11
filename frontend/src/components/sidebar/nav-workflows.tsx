'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, Plus, Workflow, List, Network, GitBranch, Loader2, Frown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useSidebar } from '@/components/ui/sidebar';
import { useAgents } from '@/hooks/agents/use-agents';
import { useAgentWorkflows, type AgentWorkflow, type WorkflowMode } from '@/hooks/workflows';
import { backendApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Button } from '@/components/ui/button';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Component for section headers with optional link
const SectionHeader: React.FC<{ title: string; count: number; href?: string }> = ({ title, count, href }) => {
    return (
        <div className="px-2.5 py-3 border-b border-transparent">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground pl-0.5">{title}</h3>
                {href && (
                    <Link href={href}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            aria-label={`View all ${title.toLowerCase()}`}
                        >
                            <ExternalLink className="h-3 w-3" />
                        </Button>
                    </Link>
                )}
            </div>
        </div>
    );
};

// Helper function to get mode icon
function getModeIcon(mode: WorkflowMode) {
    switch (mode) {
        case 'simple':
            return List;
        case 'advanced':
            return Network;
        case 'advanced-legacy':
            return GitBranch;
        default:
            return List;
    }
}

// Helper function to get mode badge styling
function getModeStyles(mode: WorkflowMode) {
    switch (mode) {
        case 'simple':
            return 'text-blue-600 dark:text-blue-400';
        case 'advanced':
            return 'text-purple-600 dark:text-purple-400';
        case 'advanced-legacy':
            return 'text-orange-600 dark:text-orange-400';
        default:
            return 'text-muted-foreground';
    }
}

// Component for individual workflow item
interface WorkflowItemProps {
    workflow: AgentWorkflow;
    agentId: string;
    isActive: boolean;
    onWorkflowClick: (agentId: string, workflowId: string) => void;
}

const WorkflowItem: React.FC<WorkflowItemProps> = ({
    workflow,
    agentId,
    isActive,
    onWorkflowClick,
}) => {
    return (
        <div
            className={cn(
                "flex items-center gap-2  p-1.5 pl-6 text-sm cursor-pointer rounded-lg transition-colors",
                "hover:bg-muted/60",
                isActive && "bg-muted"
            )}
            onClick={() => onWorkflowClick(agentId, workflow.id)}
        >
            <div className={cn(
                "h-1.5 w-1.5 rounded-full flex-shrink-0",
                workflow.status === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-muted-foreground/30"
            )} />
            <span className="flex-1 truncate">
                {workflow.name}
            </span>
        </div>
    );
};

// Component for agent with workflows dropdown
interface AgentWithWorkflowsProps {
    agent: any;
    isExpanded: boolean;
    onToggle: () => void;
    onAgentClick: (agentId: string) => void;
    onWorkflowClick: (agentId: string, workflowId: string) => void;
    currentWorkflowId?: string;
}

const AgentWithWorkflows: React.FC<AgentWithWorkflowsProps> = ({
    agent,
    isExpanded,
    onToggle,
    onAgentClick,
    onWorkflowClick,
    currentWorkflowId,
}) => {
    const { data: workflows = [], isLoading: isLoadingWorkflows } = useAgentWorkflows(
        agent.agent_id,
        { enabled: isExpanded } // Only fetch when expanded
    );

    return (
        <Collapsible open={isExpanded} onOpenChange={onToggle}>
            <CollapsibleTrigger asChild>
                <SpotlightCard className="bg-transparent transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 p-2.5 text-sm">
                        <div className="flex-shrink-0">
                            <AgentAvatar
                                agent={agent}
                                agentId={agent.agent_id}
                                size={32}
                            />
                        </div>
                        <span className="flex-1 truncate">{agent.name}</span>
                        {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                    </div>
                </SpotlightCard>
            </CollapsibleTrigger>


            <CollapsibleContent>
                {isLoadingWorkflows ? (
                    <div className="p-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                ) : workflows.length > 0 ? (
                    <div className="space-y-0.5">
                        {workflows.map((workflow) => (
                            <WorkflowItem
                                key={workflow.id}
                                workflow={workflow}
                                agentId={agent.agent_id}
                                isActive={currentWorkflowId === workflow.id}
                                onWorkflowClick={onWorkflowClick}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="p-2.5 text-sm text-muted-foreground">
                        No workflows
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};

export function NavWorkflows() {
    const { isMobile, state, setOpenMobile } = useSidebar();
    const router = useRouter();
    const pathname = usePathname();

    // Track which agents are expanded
    const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

    // Track agents that have workflows (for filtering)
    const [agentsWithWorkflows, setAgentsWithWorkflows] = useState<Set<string>>(new Set());
    const [isLoadingWorkflowCounts, setIsLoadingWorkflowCounts] = useState(true);

    // Fetch agents
    const {
        data: agentsResponse,
        isLoading: isAgentsLoading,
    } = useAgents({
        limit: 50,
        sort_by: 'updated_at',
        sort_order: 'desc'
    });

    const allAgents = agentsResponse?.agents || [];

    // Pre-fetch workflow counts for all agents to filter those without workflows
    useEffect(() => {
        async function fetchWorkflowCounts() {
            if (allAgents.length === 0) {
                setIsLoadingWorkflowCounts(false);
                return;
            }

            setIsLoadingWorkflowCounts(true);

            try {
                // Fetch workflows for each agent in parallel
                const results = await Promise.all(
                    allAgents.map(async (agent) => {
                        try {
                            const response = await backendApi.get<AgentWorkflow[]>(`/workflows/agents/${agent.agent_id}/workflows`);
                            if (response.success && response.data && response.data.length > 0) {
                                return agent.agent_id;
                            }
                            return null;
                        } catch {
                            return null;
                        }
                    })
                );

                // Filter out nulls and create a Set of agent IDs that have workflows
                const agentIdsWithWorkflows = new Set(
                    results.filter((id): id is string => id !== null)
                );
                setAgentsWithWorkflows(agentIdsWithWorkflows);
            } catch {
                // On error, show all agents as a fallback
                setAgentsWithWorkflows(new Set(allAgents.map(a => a.agent_id)));
            } finally {
                setIsLoadingWorkflowCounts(false);
            }
        }

        fetchWorkflowCounts();
    }, [allAgents]);

    // Filter agents to only show those with workflows
    const agents = allAgents.filter(agent => agentsWithWorkflows.has(agent.agent_id));

    // Extract current workflow ID from pathname
    const currentWorkflowId = pathname?.match(/\/workflow\/([^\/]+)/)?.[1];

    // Toggle agent expansion
    const toggleAgent = (agentId: string) => {
        setExpandedAgents(prev => {
            const next = new Set(prev);
            if (next.has(agentId)) {
                next.delete(agentId);
            } else {
                next.add(agentId);
            }
            return next;
        });
    };

    // Handle agent click - navigate to agent's workflows page
    const handleAgentClick = (agentId: string) => {
        router.push(`/agents/config/${agentId}?tab=workflows`);
        if (isMobile) {
            setOpenMobile(false);
        }
    };

    // Handle workflow click - navigate to specific workflow editor
    const handleWorkflowClick = (agentId: string, workflowId: string) => {
        router.push(`/agents/config/${agentId}/workflow/${workflowId}`);
        if (isMobile) {
            setOpenMobile(false);
        }
    };

    return (
        <div className="w-full">
            <div className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-32">
                {(state !== 'collapsed' || isMobile) && (
                    <>
                        {/* Section header */}
                        <SectionHeader title="Assigned Workflows" count={agents.length} href="/workflows" />

                        {(isAgentsLoading || isLoadingWorkflowCounts) ? (
                            // Show skeleton loaders while loading
                            <div className="space-y-1">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <div key={`skeleton-${index}`} className="flex items-center gap-3 px-2 py-2">
                                        <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
                                        <div className="h-8 w-8 bg-muted/10 border-[1.5px] border-border rounded-xl animate-pulse"></div>
                                        <div className="h-4 bg-muted rounded flex-1 animate-pulse"></div>
                                        <div className="h-3 w-4 bg-muted rounded animate-pulse"></div>
                                    </div>
                                ))}
                            </div>
                        ) : agents.length > 0 ? (
                            // Show agents with workflow dropdowns
                            <div className="space-y-1">
                                {agents.map((agent) => (
                                    <AgentWithWorkflows
                                        key={agent.agent_id}
                                        agent={agent}
                                        isExpanded={expandedAgents.has(agent.agent_id)}
                                        onToggle={() => toggleAgent(agent.agent_id)}
                                        onAgentClick={handleAgentClick}
                                        onWorkflowClick={handleWorkflowClick}
                                        currentWorkflowId={currentWorkflowId}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                <Frown className="h-12 w-12 text-muted-foreground/40 mb-3" />
                                <p className="text-sm text-muted-foreground">
                                    No agents found
                                </p>
                            </div>
                        )}

                        {/* Quick action button */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full shadow-none justify-center items-center h-10 px-4 bg-background mt-3"
                            onClick={() => router.push('/workflows')}
                        >
                            <div className="flex items-center gap-2">
                                <Workflow className="h-4 w-4" />
                                Manage Workflows
                            </div>
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
