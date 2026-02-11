'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Workflow,
    Loader2,
    Plus,
    Activity,
    AlertTriangle,
    Bell,
    Search,
    List,
    Network,
} from 'lucide-react';
import { useAgents } from '@/hooks/agents/use-agents';
import { type AgentWorkflow } from '@/hooks/workflows';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { backendApi } from '@/lib/api-client';

// Import modular components
import { WorkflowsPageHeader } from './workflows-page-header';
import { StatCard } from './workflows-stat-cards';
import { WorkflowListItem, type WorkflowWithAgent } from './workflows-list-item';
import { WorkflowsEmptyState } from './workflows-empty-state';

// Loading skeleton for the workflow list
function LoadingSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <div
                    key={i}
                    className="h-20 rounded-xl bg-muted/50 animate-pulse"
                />
            ))}
        </div>
    );
}

// Main Workflows Page Component (following triggers-page layout pattern)
export function WorkflowsPage() {
    const router = useRouter();
    const [allWorkflows, setAllWorkflows] = useState<WorkflowWithAgent[]>([]);
    const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowWithAgent | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch all agents
    const { data: agentsResponse, isLoading: isAgentsLoading } = useAgents({
        limit: 50,
        sort_by: 'updated_at',
        sort_order: 'desc',
    });

    const agents = agentsResponse?.agents || [];

    // Create a map of agent IDs to agents for quick lookup
    const agentMap = useMemo(() => {
        const map = new Map<string, any>();
        agents.forEach(agent => map.set(agent.agent_id, agent));
        return map;
    }, [agents]);

    // Fetch all workflows using the dedicated endpoint
    useEffect(() => {
        async function fetchAllWorkflows() {
            setIsLoadingWorkflows(true);
            try {
                const response = await backendApi.get<AgentWorkflow[]>('/workflows');
                if (response.success && response.data) {
                    const workflowsWithAgent = response.data.map(wf => ({
                        ...wf,
                        agentId: wf.agent_id
                    }));
                    setAllWorkflows(workflowsWithAgent);
                } else {
                    setAllWorkflows([]);
                }
            } catch (error) {
                console.error('Failed to fetch workflows:', error);
                setAllWorkflows([]);
            } finally {
                setIsLoadingWorkflows(false);
            }
        }

        fetchAllWorkflows();
    }, []);

    // Filter workflows based on search query
    const filteredWorkflows = useMemo(() => {
        if (!searchQuery.trim()) return allWorkflows;
        const query = searchQuery.toLowerCase();
        return allWorkflows.filter(workflow =>
            workflow.name.toLowerCase().includes(query) ||
            agentMap.get(workflow.agent_id)?.name?.toLowerCase().includes(query)
        );
    }, [allWorkflows, searchQuery, agentMap]);

    // Calculate stats
    const stats = useMemo(() => {
        const activeCount = allWorkflows.filter(w => w.status === 'active').length;
        const simpleCount = allWorkflows.filter(w => w.mode === 'simple').length;
        const advancedCount = allWorkflows.filter(w => w.mode === 'advanced' || w.mode === 'advanced-legacy').length;

        // TODO: These are scaffold values - replace with actual API data when available
        const recentRuns = 247; // Placeholder: executions in last 30 days
        const failedRuns = 3; // Placeholder: failed executions
        const pendingAuth = 2; // Placeholder: awaiting user feedback/authorization

        return {
            total: allWorkflows.length,
            active: activeCount,
            simple: simpleCount,
            advanced: advancedCount,
            agents: agents.length,
            recentRuns,
            failedRuns,
            pendingAuth,
            simplePercentage: allWorkflows.length > 0 ? Math.round((simpleCount / allWorkflows.length) * 100) : 0,
        };
    }, [allWorkflows, agents]);

    const isLoading = isAgentsLoading || isLoadingWorkflows;

    const handleWorkflowClick = (workflow: WorkflowWithAgent) => {
        // Navigate directly to the workflow editor
        router.push(`/agents/config/${workflow.agent_id}/workflow/${workflow.id}`);
    };

    const handleClosePanel = () => {
        setSelectedWorkflow(null);
    };

    const handleCreateClick = (mode?: 'simple' | 'advanced') => {
        // For now, navigate to agents page
        // TODO: Could be enhanced with a workflow creation dialog
        router.push('/agents');
    };

    return (
        <div className="h-screen overflow-hidden 2xl:flex">
            {/* Backdrop overlay - shows when sidebar is open on screens < 2xl (1536px) */}
            {selectedWorkflow && (
                <div
                    className="block 2xl:hidden fixed inset-0 bg-black/70 z-30"
                    onClick={handleClosePanel}
                />
            )}

            {/* Main Content - Contains header + list, flex-1 on 2xl+ */}
            <div className="h-full flex flex-col overflow-hidden 2xl:flex-1 relative z-0">
                {/* Animated Header */}
                <div className="container mx-auto max-w-7xl px-4 py-8">
                    <WorkflowsPageHeader />
                </div>

                {/* Stats Grid */}
                <div className="container mx-auto max-w-7xl px-4 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Simple/Advanced Workflows */}
                        <StatCard
                            icon={Workflow}
                            label="Workflows"
                            value={stats.simple}
                            secondaryValue={stats.advanced}
                            secondaryLabel="advanced"
                            description={`${stats.total} total across ${stats.agents} agents`}
                            status="default"
                            showRing={true}
                            ringPercentage={stats.simplePercentage}
                            delay={0}
                            ringAnimation={{ type: 'shimmer', duration: 4, brightness: 1, glowSpread: 2 }}
                            borderAnimation={{ type: 'shimmer', duration: 8, opacity: 0.4, brightness: 1 }}
                        />

                        {/* Recent Runs (30 Days) */}
                        <StatCard
                            icon={Activity}
                            label="Recent Runs"
                            value={stats.recentRuns}
                            description="Executions in the last 30 days"
                            status="success"
                            showRing={true}
                            ringPercentage={50}
                            delay={0.05}
                            ringAnimation={{ type: 'glow', duration: 3, brightness: 1, glowSpread: 2 }}
                            borderAnimation={{ type: 'shimmer', duration: 10, opacity: 0.3, brightness: 0.9 }}
                        />

                        {/* Failed Executions */}
                        <StatCard
                            icon={AlertTriangle}
                            label="Failed Executions"
                            value={stats.failedRuns}
                            description={stats.failedRuns === 0 ? "All systems running smoothly" : "Requires attention"}
                            status={stats.failedRuns > 0 ? 'error' : 'default'}
                            showRing={true}
                            ringPercentage={75}
                            delay={0.1}
                            ringAnimation={{ type: 'shimmer', duration: 5, brightness: 1, glowSpread: 2 }}
                            borderAnimation={{ type: 'shimmer', duration: 8, opacity: 0.35, brightness: 0.95 }}
                        />

                        {/* Pending Authorizations */}
                        <StatCard
                            icon={Bell}
                            label="Pending Authorizations"
                            value={stats.pendingAuth}
                            description={stats.pendingAuth > 0 ? "Awaiting your approval" : "No actions required"}
                            status={stats.pendingAuth > 0 ? 'warning' : 'default'}
                            showRing={true}
                            ringPercentage={10}
                            delay={0.15}
                            ringAnimation={{ type: 'sparkle', duration: 4, brightness: 1, glowSpread: 2, sparkleDelay: 2 }}
                            borderAnimation={{ type: 'shimmer', duration: 8, opacity: 0.5, brightness: 1 }}
                            enableFloat={true}
                            floatAmount={2}
                            floatDuration={5}
                        />
                    </div>
                </div>

                {/* Search Bar and Create Button */}
                <div className="container mx-auto max-w-7xl px-4">
                    <div className="flex items-center justify-between pb-4 pt-3">
                        <div className="max-w-md w-md">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search workflows..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <Search className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="h-10 px-4 rounded-xl gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create new
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72">
                                <DropdownMenuItem onClick={() => handleCreateClick('simple')} className='rounded-lg'>
                                    <List className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span>Simple Workflow</span>
                                        <span className="text-xs text-muted-foreground">
                                            Step-by-step automation flow
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCreateClick('advanced')} className='rounded-lg'>
                                    <Network className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span>Advanced Workflow</span>
                                        <span className="text-xs text-muted-foreground">
                                            Complex pipeline with visual editor
                                        </span>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Workflow List Container */}
                <div className="flex-1 overflow-hidden pt-4 pb-2">
                    <div className="h-full mx-auto max-w-7xl overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                        <div className="px-4 pb-4">
                            {isLoading ? (
                                <LoadingSkeleton />
                            ) : filteredWorkflows.length === 0 ? (
                                searchQuery ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        No workflows matching "{searchQuery}"
                                    </div>
                                ) : (
                                    <WorkflowsEmptyState onCreateClick={() => handleCreateClick()} />
                                )
                            ) : (
                                <div className="space-y-2">
                                    {filteredWorkflows.map((workflow, index) => (
                                        <WorkflowListItem
                                            key={workflow.id}
                                            workflow={workflow}
                                            agent={agentMap.get(workflow.agent_id)}
                                            onClick={() => handleWorkflowClick(workflow)}
                                            index={index}
                                            isSelected={selectedWorkflow?.id === workflow.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Panel - Reserved for future detail panel (like triggers page) */}
            <div className={cn(
                "h-full transition-all duration-300 ease-in-out bg-background",
                "fixed 2xl:relative top-0 right-0",
                "z-40 2xl:z-auto",
                selectedWorkflow ? "overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent" : "overflow-hidden",
                selectedWorkflow && "border-l",
                selectedWorkflow
                    ? "w-full min-[400px]:w-[90vw] min-[500px]:w-[85vw] sm:w-[480px] md:w-[540px] lg:w-[600px] xl:w-[640px] 2xl:w-[580px]"
                    : "w-0 border-none"
            )}>
                {selectedWorkflow && (
                    <div className="p-6">
                        {/* TODO: WorkflowDetailPanel component */}
                        <div className="text-muted-foreground">
                            Workflow detail panel coming soon...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
