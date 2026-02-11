'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Clock,
    X,
    Trash2,
    Edit2,
    Settings,
    Timer,
    Target,
    Play,
    Pause,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Loader2,
    History,
    GitBranch,
    ArrowRight,
    List,
    Network,
    User,
    Zap,
    Info,
    Plus,
} from 'lucide-react';
import Link from 'next/link';
import { type WorkflowWithAgent } from './workflows-list-item';
import { cn } from '@/lib/utils';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface WorkflowDetailPanelProps {
    workflow: WorkflowWithAgent;
    agent: any;
    onClose: () => void;
    onEdit: () => void;
}

// Mock execution data type - replace with real API types when available
interface WorkflowExecution {
    execution_id: string;
    thread_id: string;
    started_at: string;
    status: string;
}

const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
        case 'completed':
            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'failed':
        case 'error':
            return <XCircle className="h-4 w-4 text-red-500" />;
        case 'running':
        case 'in_progress':
            return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        default:
            return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
};

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "highlight" => {
    switch (status.toLowerCase()) {
        case 'completed':
            return 'highlight';
        case 'failed':
        case 'error':
            return 'destructive';
        case 'running':
        case 'in_progress':
            return 'default';
        default:
            return 'secondary';
    }
};

const ExecutionItem = ({ execution }: { execution: WorkflowExecution }) => {
    const startedAt = parseISO(execution.started_at);
    const timeAgo = formatDistanceToNow(startedAt, { addSuffix: true });
    const formattedTime = format(startedAt, 'MMM d, h:mm a');

    return (
        <Link
            href={`/threads/${execution.thread_id}`}
            className="block"
        >
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-3">
                    {getStatusIcon(execution.status)}
                    <div>
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            {formattedTime}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {timeAgo}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(execution.status)} className="text-xs capitalize">
                        {execution.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>
        </Link>
    );
};

const ExecutionsSkeleton = () => (
    <div className="space-y-2">
        {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
            </div>
        ))}
    </div>
);

export function WorkflowDetailPanel({ workflow, agent, onClose, onEdit }: WorkflowDetailPanelProps) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [localName, setLocalName] = useState(workflow.name);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Mock execution history - replace with real hook when API is available
    const executionHistory: WorkflowExecution[] = useMemo(() => {
        // TODO: Replace with actual API data from useWorkflowExecutions hook
        return [];
    }, []);
    const isLoadingExecutions = false;

    // Sync local name with workflow name
    useEffect(() => {
        setLocalName(workflow.name);
    }, [workflow.name]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const isAdvanced = workflow.mode === 'advanced' || workflow.mode === 'advanced-legacy';
    const ModeIcon = isAdvanced ? Network : List;

    const handleToggle = async () => {
        setIsLoading(true);
        try {
            // TODO: Implement toggle mutation
            toast.success(`Workflow ${workflow.status === 'active' ? 'paused' : 'activated'}`);
        } catch (error) {
            toast.error('Failed to toggle workflow');
            console.error('Error toggling workflow:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            // TODO: Implement delete mutation
            toast.success('Workflow deleted successfully');
            onClose();
        } catch (error) {
            toast.error('Failed to delete workflow');
            console.error('Error deleting workflow:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNameSave = async () => {
        setIsEditingName(false);
        const trimmedName = localName.trim();

        if (trimmedName && trimmedName !== workflow.name) {
            try {
                // TODO: Implement name update mutation
                toast.success('Workflow name updated');
            } catch (error) {
                console.error('Failed to update name:', error);
                toast.error('Failed to update name');
                setLocalName(workflow.name);
            }
        } else if (!trimmedName) {
            setLocalName(workflow.name);
        }
    };

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameSave();
        } else if (e.key === 'Escape') {
            setIsEditingName(false);
            setLocalName(workflow.name);
        }
    };

    // Format dates
    const createdDate = workflow.created_at ? format(parseISO(workflow.created_at), 'MMM d, yyyy') : 'N/A';
    const updatedDate = workflow.updated_at ? format(parseISO(workflow.updated_at), 'MMM d, yyyy') : 'N/A';
    const updatedAgo = workflow.updated_at ? formatDistanceToNow(parseISO(workflow.updated_at), { addSuffix: true }) : '';

    return (
        <div className="h-full bg-background flex flex-col w-full">
            {/* Header */}
            <div className="px-6 py-6 border-b">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex-1 py-1 space-y-2">
                        <div className="flex items-center gap-3 mb-2">
                            {isEditingName ? (
                                <Input
                                    ref={nameInputRef}
                                    value={localName}
                                    onChange={(e) => setLocalName(e.target.value)}
                                    onBlur={handleNameSave}
                                    onKeyDown={handleNameKeyDown}
                                    className="h-9 text-2xl font-medium bg-transparent border-primary/30 focus:border-primary w-full max-w-md px-0 border-none shadow-none focus-visible:ring-0"
                                    placeholder="Enter workflow name"
                                />
                            ) : (
                                <h1
                                    onClick={() => setIsEditingName(true)}
                                    className="text-2xl font-medium text-foreground cursor-pointer hover:text-primary transition-colors truncate"
                                    title="Click to edit name"
                                >
                                    {localName || workflow.name}
                                </h1>
                            )}
                        </div>
                        {workflow.description && (
                            <p className="text-muted-foreground text-sm leading-relaxed">{workflow.description}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-muted"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3">
                    <Button
                        size="sm"
                        variant={workflow.status === 'active' ? "outline" : "default"}
                        onClick={handleToggle}
                        disabled={isLoading}
                        className={cn(
                            "flex-1",
                            workflow.status === 'active'
                                ? "hover:bg-muted"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        )}
                    >
                        {workflow.status === 'active' ? (
                            <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4 mr-2" />
                                Activate
                            </>
                        )}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onEdit}
                        className="flex hover:bg-muted"
                    >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={isLoading}
                        className="flex hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content - padding wrapper controls scrollbar position */}
            <div className="flex-1 overflow-hidden pt-6 pb-4">
                {/* Scrollbar container */}
                <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent px-8">
                    {/* Content cards container */}
                    <div className="space-y-6">
                        {/* Associated Trigger - Placeholder for now */}
                        <div className="border rounded-lg p-6 bg-card">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-muted">
                                        <Zap className="h-5 w-5 text-amber-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-foreground">Associated Trigger</h3>
                                        <p className="text-xs text-muted-foreground">No trigger configured</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Trigger
                                </Button>
                            </div>
                        </div>

                        {/* Assigned Agent */}
                        <div className="border rounded-lg p-6 bg-card">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <AgentAvatar
                                        agent={agent}
                                        agentId={workflow.agentId}
                                        size={40}
                                        fallbackName={agent?.name || 'Unknown'}
                                    />
                                    <div>
                                        <h3 className="font-medium text-foreground">{agent?.name || 'Unknown Agent'}</h3>
                                        <p className="text-xs text-muted-foreground">Assigned Agent</p>
                                    </div>
                                </div>
                                <Link
                                    href={`/agents/config/${workflow.agentId}`}
                                    className="p-2 rounded-2xl hover:bg-muted transition-colors"
                                >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </Link>
                            </div>
                        </div>

                        {/* Workflow Configuration */}
                        <div className="border rounded-lg p-6 bg-card">
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-muted">
                                    <Settings className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-foreground mb-3">Workflow Configuration</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm text-muted-foreground">Mode</span>
                                            <div className="flex items-center gap-2">
                                                <ModeIcon className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm font-medium capitalize">{workflow.mode || 'Simple'}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b">
                                            <span className="text-sm text-muted-foreground">Status</span>
                                            <Badge variant={workflow.status === 'active' ? 'highlight' : 'secondary'} className="text-xs capitalize">
                                                {workflow.status}
                                            </Badge>
                                        </div>
                                        {workflow.is_default && (
                                            <div className="flex justify-between items-center py-2 border-b">
                                                <span className="text-sm text-muted-foreground">Default</span>
                                                <Badge variant="outline" className="text-xs">Yes</Badge>
                                            </div>
                                        )}
                                        {workflow.steps && (
                                            <div className="flex justify-between items-center py-2">
                                                <span className="text-sm text-muted-foreground">Steps</span>
                                                <span className="text-sm font-medium">{workflow.steps.length || 0}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Runs */}
                        <div className="border rounded-lg p-6 bg-card">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-muted">
                                        <History className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-foreground">Recent Runs</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {executionHistory.length} execution{executionHistory.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {isLoadingExecutions ? (
                                <ExecutionsSkeleton />
                            ) : executionHistory && executionHistory.length > 0 ? (
                                <div className="space-y-1 -mx-3">
                                    {executionHistory.slice(0, 5).map((execution) => (
                                        <ExecutionItem key={execution.execution_id} execution={execution} />
                                    ))}
                                    {executionHistory.length > 5 && (
                                        <div className="text-center pt-2">
                                            <span className="text-xs text-muted-foreground">
                                                Showing 5 of {executionHistory.length} runs
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No executions yet</p>
                                    <p className="text-xs mt-1">Runs will appear here when the workflow executes</p>
                                </div>
                            )}
                        </div>

                        {/* Technical Details */}
                        <div className="border rounded-lg p-6 bg-card">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-2 rounded-lg bg-muted">
                                    <Info className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <h3 className="font-medium text-foreground pt-1">Technical Details</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b last:border-b-0">
                                    <span className="text-sm text-muted-foreground">Workflow ID</span>
                                    <span className="text-sm font-mono text-foreground truncate max-w-[180px]" title={workflow.id}>
                                        {workflow.id.substring(0, 8)}...
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b last:border-b-0">
                                    <span className="text-sm text-muted-foreground">Agent ID</span>
                                    <span className="text-sm font-mono text-foreground truncate max-w-[180px]" title={workflow.agentId}>
                                        {workflow.agentId.substring(0, 8)}...
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b last:border-b-0">
                                    <span className="text-sm text-muted-foreground">Created</span>
                                    <span className="text-sm text-foreground">{createdDate}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-muted-foreground">Last Updated</span>
                                    <span className="text-sm text-foreground" title={updatedAgo}>{updatedDate}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Delete Dialog */}
                    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <AlertDialogContent className="bg-background border">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-foreground font-medium">Delete Workflow</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                    Are you sure you want to delete "{workflow.name}"? This action cannot be undone and will remove all associated steps and configurations.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="hover:bg-muted">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                >
                                    Delete Workflow
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    );
}
