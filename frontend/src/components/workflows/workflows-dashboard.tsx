'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Workflow,
    List,
    Network,
    GitBranch,
    Play,
    Pause,
    Clock,
    ChevronRight,
    Sparkles,
    Loader2,
    Plus,
    Zap,
    Activity,
    AlertTriangle,
    Bell,
} from 'lucide-react';
import { useAgents } from '@/hooks/agents/use-agents';
import { type AgentWorkflow, type WorkflowMode, type WorkflowStatus } from '@/hooks/workflows';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';
import { backendApi } from '@/lib/api-client';
import { WorkflowsPageHeader } from './workflows-page-header';

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

// Helper function to get mode styles
function getModeStyles(mode: WorkflowMode) {
    switch (mode) {
        case 'simple':
            return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' };
        case 'advanced':
            return { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' };
        case 'advanced-legacy':
            return { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' };
        default:
            return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
    }
}

// Helper function to get status styles
function getStatusStyles(status: WorkflowStatus) {
    switch (status) {
        case 'active':
            return { bg: 'bg-green-500/10', text: 'text-green-500', icon: Play };
        case 'paused':
            return { bg: 'bg-yellow-500/10', text: 'text-yellow-500', icon: Pause };
        case 'draft':
            return { bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock };
        case 'archived':
            return { bg: 'bg-muted/50', text: 'text-muted-foreground/60', icon: Clock };
        default:
            return { bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock };
    }
}

// Stat Card component aligned with Kortix design language
interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: number;
    secondaryValue?: number;
    secondaryLabel?: string;
    description?: string;
    status?: 'default' | 'success' | 'warning' | 'error';
    delay?: number;
    showRing?: boolean;
    ringPercentage?: number;
}

function StatCard({
    icon: Icon,
    label,
    value,
    secondaryValue,
    secondaryLabel,
    description,
    status = 'default',
    delay = 0,
    showRing = false,
    ringPercentage = 0,
}: StatCardProps) {
    // Calculate ring circumference for the progress indicator
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (ringPercentage / 100) * circumference;

    // Status-based accent colors (subtle, used sparingly)
    const statusAccent = {
        default: 'text-muted-foreground',
        success: 'text-primary',
        warning: 'text-muted-foreground', // Keep neutral - orange is too jarring
        error: 'text-muted-foreground',
    };

    const ringAccent = {
        default: 'stroke-primary/60',
        success: 'stroke-primary',
        warning: 'stroke-primary/60', // Neutral ring
        error: 'stroke-primary/60',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className="relative overflow-hidden rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-all group"
        >
            {/* Subtle gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Grain Overlay */}
            <div
                className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
                style={{ backgroundImage: "url('/noise.png')" }}
            />

            <div className="relative z-10 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                        {/* Label */}
                        <p className="text-sm text-muted-foreground">{label}</p>

                        {/* Values Row */}
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold tracking-tight">{value.toLocaleString()}</span>
                            {secondaryValue !== undefined && (
                                <span className="text-sm text-muted-foreground">
                                    · {secondaryValue} {secondaryLabel}
                                </span>
                            )}
                        </div>

                        {/* Description */}
                        {description && (
                            <p className="text-xs text-muted-foreground/80">{description}</p>
                        )}
                    </div>

                    {/* Icon with optional ring progress */}
                    {showRing ? (
                        <div className="relative flex-shrink-0 w-14 h-14">
                            {/* Background ring */}
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                                <circle
                                    cx="28"
                                    cy="28"
                                    r={radius}
                                    fill="none"
                                    strokeWidth="3"
                                    className="stroke-border"
                                />
                                <motion.circle
                                    cx="28"
                                    cy="28"
                                    r={radius}
                                    fill="none"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    className={ringAccent[status]}
                                    initial={{ strokeDashoffset: circumference }}
                                    animate={{ strokeDashoffset }}
                                    transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
                                    style={{
                                        strokeDasharray: circumference,
                                    }}
                                />
                            </svg>
                            {/* Center icon */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Icon className={cn("h-5 w-5", statusAccent[status])} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-muted border border-border group-hover:border-border/80 transition-colors flex items-center justify-center">
                            <Icon className={cn("h-5 w-5", statusAccent[status])} />
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// Workflow Card component
interface WorkflowCardProps {
    workflow: AgentWorkflow & { agentId: string };
    agent: any;
    onClick: () => void;
    index: number;
}

function WorkflowCard({ workflow, agent, onClick, index }: WorkflowCardProps) {
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
            className="relative overflow-hidden rounded-xl border border-border/50 bg-background/50 p-4 backdrop-blur-sm hover:border-border/80 cursor-pointer transition-all group"
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

// Time ago helper
function getTimeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// Empty state component
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/50 p-12 backdrop-blur-sm text-center"
        >
            {/* Grain Overlay */}
            <div
                className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
                style={{ backgroundImage: "url('/noise.png')" }}
            />

            <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-8 w-8" />
                </div>

                <div className="space-y-2 max-w-md">
                    <h2 className="text-xl font-medium tracking-tight">No workflows yet</h2>
                    <p className="text-muted-foreground">
                        Create your first workflow to automate tasks and supercharge your agents.
                    </p>
                </div>

                <Button onClick={onCreateClick} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Workflow
                </Button>
            </div>
        </motion.div>
    );
}

// Extended workflow type with agent ID
type WorkflowWithAgent = AgentWorkflow & { agentId: string };

// Main Dashboard Component
export function WorkflowsDashboard() {
    const router = useRouter();
    const [allWorkflows, setAllWorkflows] = useState<WorkflowWithAgent[]>([]);
    const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);

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
                // Use the new endpoint that returns all workflows for the user
                const response = await backendApi.get<AgentWorkflow[]>('/workflows');
                if (response.success && response.data) {
                    // Map to include agentId from the workflow's agent_id
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

    // Calculate stats
    const stats = useMemo(() => {
        const activeCount = allWorkflows.filter(w => w.status === 'active').length;
        const draftCount = allWorkflows.filter(w => w.status === 'draft').length;
        const simpleCount = allWorkflows.filter(w => w.mode === 'simple').length;
        const advancedCount = allWorkflows.filter(w => w.mode === 'advanced' || w.mode === 'advanced-legacy').length;

        // TODO: These are scaffold values - replace with actual API data when available
        const recentRuns = 247; // Placeholder: executions in last 30 days
        const failedRuns = 3; // Placeholder: failed executions
        const pendingAuth = 2; // Placeholder: awaiting user feedback/authorization

        return {
            total: allWorkflows.length,
            active: activeCount,
            draft: draftCount,
            simple: simpleCount,
            advanced: advancedCount,
            agents: agents.length,
            recentRuns,
            failedRuns,
            pendingAuth,
            // Calculate percentage for ring chart (simple out of total workflows)
            simplePercentage: allWorkflows.length > 0 ? Math.round((simpleCount / allWorkflows.length) * 100) : 0,
        };
    }, [allWorkflows, agents]);

    const isLoading = isAgentsLoading || isLoadingWorkflows;

    const handleWorkflowClick = (agentId: string, workflowId: string) => {
        router.push(`/agents/config/${agentId}/workflow/${workflowId}`);
    };

    const handleCreateClick = () => {
        router.push('/agents');
    };

    if (isLoading) {
        return (
            <div className="container mx-auto max-w-6xl py-8">
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Animated Header */}
            <div className="container mx-auto max-w-7xl px-4 py-8">
                <WorkflowsPageHeader />
            </div>

            {/* Main Content */}
            <div className="container mx-auto max-w-7xl px-4 py-2 space-y-8">

                {/* Actions Row */}
                <div className="flex items-center justify-end">
                    <Button onClick={handleCreateClick} className="gap-2">
                        <Plus className="h-4 w-4" />
                        New Workflow
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Simple/Advanced Workflows */}
                    <StatCard
                        icon={Workflow}
                        label="Workflows"
                        value={stats.simple}
                        secondaryValue={stats.advanced}
                        secondaryLabel="advanced"
                        description={`${stats.total} total across ${stats.agents} agents`}
                        status="success"
                        showRing={true}
                        ringPercentage={stats.simplePercentage}
                        delay={0}
                    />

                    {/* Recent Runs (30 Days) */}
                    <StatCard
                        icon={Activity}
                        label="Recent Runs"
                        value={stats.recentRuns}
                        description="Executions in the last 30 days"
                        status="success"
                        showRing={true}
                        ringPercentage={100}
                        delay={0.05}
                    />

                    {/* Failed Executions */}
                    <StatCard
                        icon={AlertTriangle}
                        label="Failed Executions"
                        value={stats.failedRuns}
                        description={stats.failedRuns === 0 ? "All systems running smoothly" : "Requires attention"}
                        status={stats.failedRuns > 0 ? 'error' : 'default'}
                        showRing={true}
                        ringPercentage={100}
                        delay={0.1}
                    />

                    {/* Pending Authorizations */}
                    <StatCard
                        icon={Bell}
                        label="Pending Authorizations"
                        value={stats.pendingAuth}
                        description={stats.pendingAuth > 0 ? "Awaiting your approval" : "No actions required"}
                        status={stats.pendingAuth > 0 ? 'warning' : 'default'}
                        showRing={true}
                        ringPercentage={100}
                        delay={0.15}
                    />
                </div>

                {/* Workflows List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium tracking-tight">Recent Workflows</h2>
                        {allWorkflows.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                                {allWorkflows.length} workflow{allWorkflows.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {allWorkflows.length === 0 ? (
                        <EmptyState onCreateClick={handleCreateClick} />
                    ) : (
                        <div className="space-y-2">
                            {allWorkflows.slice(0, 20).map((workflow, index) => (
                                <WorkflowCard
                                    key={workflow.id}
                                    workflow={workflow}
                                    agent={agentMap.get(workflow.agent_id)}
                                    onClick={() => handleWorkflowClick(workflow.agent_id, workflow.id)}
                                    index={index}
                                />
                            ))}

                            {allWorkflows.length > 20 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-center py-4"
                                >
                                    <Button variant="ghost" className="text-muted-foreground">
                                        View all {allWorkflows.length} workflows
                                    </Button>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
