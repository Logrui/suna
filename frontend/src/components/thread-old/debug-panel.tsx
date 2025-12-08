import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, RefreshCw, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { getAgentRuns, AgentRun } from "@/lib/api/agents";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface DebugPanelProps {
    isOpen: boolean;
    onClose: () => void;
    threadId?: string;
    projectId?: string;
}

export function DebugPanel({ isOpen, onClose, threadId, projectId }: DebugPanelProps) {
    const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const langfuseProjectId = process.env.NEXT_PUBLIC_LANGFUSE_PROJECT_ID;

    const fetchAgentRuns = async () => {
        if (!threadId) return;

        setIsLoading(true);
        try {
            const runs = await getAgentRuns(threadId);
            setAgentRuns(runs);
        } catch (error) {
            console.error("Failed to fetch agent runs:", error);
            toast.error("Failed to load agent runs");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && threadId) {
            fetchAgentRuns();
        }
    }, [isOpen, threadId]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "running":
                return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
            case "completed":
                return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
            case "failed":
            case "error":
                return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
            case "stopped":
                return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
            default:
                return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="sm:max-w-2xl w-full flex flex-col">
                <SheetHeader className="flex flex-row items-center justify-between pr-8 space-y-0 pb-4 border-b">
                    <SheetTitle>Debug Panel</SheetTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchAgentRuns}
                        disabled={isLoading}
                        className="h-8 w-8"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto min-h-0 py-6 space-y-6">
                    {/* Thread Info Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Context Info</h3>
                        <div className="grid gap-3 p-4 rounded-lg border bg-muted/40">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Thread ID</span>
                                <div className="flex items-center gap-2">
                                    <code className="text-xs bg-background px-2 py-1 rounded border">{threadId}</code>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(threadId || '', 'Thread ID')}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            {projectId && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Project ID</span>
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs bg-background px-2 py-1 rounded border">{projectId}</code>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(projectId, 'Project ID')}>
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Agent Runs Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Agent Runs</h3>

                        {!langfuseProjectId && (
                            <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-3 rounded-md text-sm border border-yellow-500/20">
                                Warning: NEXT_PUBLIC_LANGFUSE_PROJECT_ID is not set. Trace links will not work correctly.
                            </div>
                        )}

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Run ID</TableHead>
                                        <TableHead>Started</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead className="text-right">Trace</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading && agentRuns.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : agentRuns.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                No agent runs found for this thread.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        agentRuns.map((run) => (
                                            <TableRow key={run.id}>
                                                <TableCell>
                                                    <Badge variant="secondary" className={getStatusColor(run.status)}>
                                                        {run.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {run.id.substring(0, 8)}...
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {run.completed_at
                                                        ? `${((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
                                                        : "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {langfuseProjectId && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-2 text-xs"
                                                            asChild
                                                        >
                                                            <a
                                                                href={`https://us.cloud.langfuse.com/project/${langfuseProjectId}/traces/${run.id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-primary hover:underline"
                                                            >
                                                                View
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
