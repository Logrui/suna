import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { RefreshCw, Loader2, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { backendApi } from "@/lib/api-client";

interface ModelUsage {
    model: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    cache_read_tokens?: number;
    cache_creation_tokens?: number;
    cost_dollars?: number;
    call_count?: number;
}

interface TokenUsageData {
    thread_id: string;
    total_prompt_tokens?: number;
    total_completion_tokens?: number;
    total_cache_read_tokens?: number;
    total_cache_creation_tokens?: number;
    estimated_cost_dollars?: number;
    models?: ModelUsage[];
    total_llm_calls?: number;
}

interface CostModalProps {
    isOpen: boolean;
    onClose: () => void;
    threadId?: string;
}

export function CostModal({ isOpen, onClose, threadId }: CostModalProps) {
    const [tokenUsage, setTokenUsage] = useState<TokenUsageData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchTokenUsage = async () => {
        if (!threadId) return;

        setIsLoading(true);
        try {
            const response = await backendApi.get(`/billing/thread-token-usage/${threadId}`);
            console.log("🔍 Cost Modal API Response:", response);
            console.log("🔍 Response data:", response.data);
            
            if (response.success && response.data) {
                // Handle double-wrapped response: response.data might be {success: true, data: {...}}
                const actualData = response.data.data || response.data;
                console.log("✅ Setting token usage data:", actualData);
                setTokenUsage(actualData);
            } else {
                console.warn("⚠️ No data in response:", response);
            }
        } catch (error) {
            console.error("❌ Failed to fetch token usage:", error);
            toast.error("Failed to load token usage data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && threadId) {
            fetchTokenUsage();
        }
    }, [isOpen, threadId]);

    const formatNumber = (num?: number | null) => {
        if (typeof num !== "number" || Number.isNaN(num)) {
            return "0";
        }
        return num.toLocaleString();
    };

    const formatCost = (cost?: number | null) => {
        if (typeof cost !== "number" || Number.isNaN(cost)) {
            return "-";
        }
        return `$${cost.toFixed(6)}`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader className="flex flex-row items-center justify-between pr-8">
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                        Cost & Token Usage
                    </DialogTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchTokenUsage}
                        disabled={isLoading}
                        className="h-8 w-8"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </DialogHeader>

                <div className="flex-1 overflow-auto min-h-0 mt-4">
                    {isLoading && !tokenUsage ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !tokenUsage ? (
                        <div className="text-center text-muted-foreground py-12">
                            No token usage data available for this thread.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="border rounded-lg p-4 bg-muted/30">
                                    <div className="text-sm text-muted-foreground mb-1">Total Cost</div>
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {formatCost(tokenUsage.estimated_cost_dollars)}
                                    </div>
                                </div>
                                <div className="border rounded-lg p-4 bg-muted/30">
                                    <div className="text-sm text-muted-foreground mb-1">Prompt Tokens</div>
                                    <div className="text-2xl font-bold">
                                        {formatNumber(tokenUsage.total_prompt_tokens)}
                                    </div>
                                </div>
                                <div className="border rounded-lg p-4 bg-muted/30">
                                    <div className="text-sm text-muted-foreground mb-1">Completion Tokens</div>
                                    <div className="text-2xl font-bold">
                                        {formatNumber(tokenUsage.total_completion_tokens)}
                                    </div>
                                </div>
                                <div className="border rounded-lg p-4 bg-muted/30">
                                    <div className="text-sm text-muted-foreground mb-1">LLM Calls</div>
                                    <div className="text-2xl font-bold">
                                        {formatNumber(tokenUsage.total_llm_calls)}
                                    </div>
                                </div>
                            </div>

                            {/* Cache Info (if any) */}
                            {((tokenUsage.total_cache_read_tokens ?? 0) > 0 || (tokenUsage.total_cache_creation_tokens ?? 0) > 0) && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                    <div className="font-medium text-blue-600 dark:text-blue-400 mb-2">Cache Performance</div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        {(tokenUsage.total_cache_read_tokens ?? 0) > 0 && (
                                            <div>
                                                <span className="text-muted-foreground">Cache Hits:</span>{" "}
                                                <span className="font-mono">{formatNumber(tokenUsage.total_cache_read_tokens)}</span>
                                            </div>
                                        )}
                                        {(tokenUsage.total_cache_creation_tokens ?? 0) > 0 && (
                                            <div>
                                                <span className="text-muted-foreground">Cache Created:</span>{" "}
                                                <span className="font-mono">{formatNumber(tokenUsage.total_cache_creation_tokens)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Model Breakdown */}
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                    Agent Run Usage Breakdown
                                </h3>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Model</TableHead>
                                                <TableHead className="text-right">Calls</TableHead>
                                                <TableHead className="text-right">Prompt</TableHead>
                                                <TableHead className="text-right">Completion</TableHead>
                                                <TableHead className="text-right">Cache</TableHead>
                                                <TableHead className="text-right">Cost</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(tokenUsage.models?.length ?? 0) === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                        No model usage data found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                tokenUsage.models?.map((model, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium">
                                                            <span className="font-mono text-sm">{model.model}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant="secondary" className="font-mono text-xs">
                                                                {model.call_count ?? 0}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm">
                                                            {formatNumber(model.prompt_tokens)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm">
                                                            {formatNumber(model.completion_tokens)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                                                            {(model.cache_read_tokens ?? 0) > 0 ? formatNumber(model.cache_read_tokens) : "-"}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm font-medium">
                                                            {formatCost(model.cost_dollars)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                            {/* Total Row */}
                                            {(tokenUsage.models?.length ?? 0) > 1 && (
                                                <TableRow className="bg-muted/50 font-bold">
                                                    <TableCell>Total</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="default" className="font-mono">
                                                            {tokenUsage.total_llm_calls ?? 0}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatNumber(tokenUsage.total_prompt_tokens)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {formatNumber(tokenUsage.total_completion_tokens)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400">
                                                        {(tokenUsage.total_cache_read_tokens ?? 0) > 0 ? formatNumber(tokenUsage.total_cache_read_tokens) : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                                                        {formatCost(tokenUsage.estimated_cost_dollars)}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
