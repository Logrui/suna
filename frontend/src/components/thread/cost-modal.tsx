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
import { AgentBreakdown } from "./agent-breakdown";

interface ModelUsage {
    model: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    cache_read_tokens?: number;
    cache_creation_tokens?: number;
    cost_dollars?: number;
    call_count?: number;
}

interface ComponentBreakdown {
    system_prompt: number;
    tools: number;
    conversation_history: number;
    workspace_context: number;
    search_results: number;
    user_input: number;
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
    // Enhanced cache metrics
    fresh_input_tokens?: number;
    cache_hit_rate?: number;
    estimated_cache_savings?: number;
    // Agent component breakdown
    token_breakdown_by_component?: ComponentBreakdown;
    component_percentages?: ComponentBreakdown;
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
            console.log("API Response:", response);
            console.log("Response data:", response.data);

            // Unwrap the double-wrapped API response to get the actual token usage data
            const actualData = response.data.data || response.data;
            console.log("Actual data after unwrapping:", actualData);

            // Debug component breakdown data
            console.log("Component breakdown data:", {
                token_breakdown_by_component: actualData?.token_breakdown_by_component,
                component_percentages: actualData?.component_percentages,
                hasBreakdown: !!(actualData?.token_breakdown_by_component && actualData?.component_percentages)
            });

            if (response.success && actualData) {
                setTokenUsage(actualData);
                console.log("TokenUsage state set:", actualData);
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

    const calculatePercentage = (part?: number, total?: number): string => {
        if (!part || !total || total === 0) return "0.0";
        return ((part / total) * 100).toFixed(1);
    };

    const calculatePromptCost = (tokens?: number): number => {
        if (!tokens || !tokenUsage?.total_prompt_tokens || !tokenUsage?.estimated_cost_dollars) return 0;
        // Approximate: assume prompt tokens are proportional to total cost
        const promptRatio = tokenUsage.total_prompt_tokens / (tokenUsage.total_prompt_tokens + (tokenUsage.total_completion_tokens ?? 0));
        return (tokens / tokenUsage.total_prompt_tokens) * (tokenUsage.estimated_cost_dollars * promptRatio);
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

                            {/* Two-Column Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr,1fr] gap-6">
                                {/* Left Column - Main Content */}
                                <div className="space-y-6">
                                    {/* Enhanced Token Efficiency & Cache Performance */}
                                    {(tokenUsage.total_prompt_tokens ?? 0) > 0 && (
                                        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-5">
                                            <div className="font-semibold text-blue-600 dark:text-blue-400 mb-4">
                                                Token Efficiency & Cache Performance
                                            </div>

                                            {/* Prompt Token Breakdown */}
                                            <div className="space-y-3 mb-4">
                                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                    Prompt Token Breakdown
                                                </div>

                                                {/* Fresh Input Tokens */}
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                                        <span className="text-muted-foreground">Fresh Input Tokens</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-xs text-muted-foreground">
                                                            {calculatePercentage(tokenUsage.fresh_input_tokens, tokenUsage.total_prompt_tokens)}%
                                                        </span>
                                                        <span className="font-mono">{formatNumber(tokenUsage.fresh_input_tokens)}</span>
                                                        <span className="font-mono text-xs text-muted-foreground min-w-[60px] text-right">
                                                            {formatCost(calculatePromptCost(tokenUsage.fresh_input_tokens))}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Cached Tokens (Read) */}
                                                {(tokenUsage.total_cache_read_tokens ?? 0) > 0 && (
                                                    <div className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                            <span className="text-muted-foreground">Cached Tokens (Read)</span>
                                                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                                                90% discount
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono text-xs text-muted-foreground">
                                                                {calculatePercentage(tokenUsage.total_cache_read_tokens, tokenUsage.total_prompt_tokens)}%
                                                            </span>
                                                            <span className="font-mono text-green-600 dark:text-green-400">
                                                                {formatNumber(tokenUsage.total_cache_read_tokens)}
                                                            </span>
                                                            <span className="font-mono text-xs text-muted-foreground min-w-[60px] text-right">
                                                                {formatCost(calculatePromptCost(tokenUsage.total_cache_read_tokens) * 0.1)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Cache Creation Tokens */}
                                                {(tokenUsage.total_cache_creation_tokens ?? 0) > 0 && (
                                                    <div className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                            <span className="text-muted-foreground">Cache Creation Tokens</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono text-xs text-muted-foreground">
                                                                {calculatePercentage(tokenUsage.total_cache_creation_tokens, tokenUsage.total_prompt_tokens)}%
                                                            </span>
                                                            <span className="font-mono text-blue-600 dark:text-blue-400">
                                                                {formatNumber(tokenUsage.total_cache_creation_tokens)}
                                                            </span>
                                                            <span className="font-mono text-xs text-muted-foreground min-w-[60px] text-right">
                                                                {formatCost(calculatePromptCost(tokenUsage.total_cache_creation_tokens))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Total */}
                                                <div className="pt-2 border-t border-border/50">
                                                    <div className="flex items-center justify-between text-sm font-semibold">
                                                        <span>Total Prompt Tokens</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono text-xs text-muted-foreground">100%</span>
                                                            <span className="font-mono">{formatNumber(tokenUsage.total_prompt_tokens)}</span>
                                                            <span className="font-mono text-xs min-w-[60px] text-right">
                                                                {formatCost(calculatePromptCost(tokenUsage.total_prompt_tokens))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Cache Performance Metrics */}
                                            {(tokenUsage.total_cache_read_tokens ?? 0) > 0 && (
                                                <div className="space-y-3 pt-4 border-t border-border/50">
                                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                        Cache Performance
                                                    </div>

                                                    {/* Cache Hit Rate with Progress Bar */}
                                                    <div>
                                                        <div className="flex items-center justify-between text-sm mb-2">
                                                            <span className="text-muted-foreground">Cache Hit Rate</span>
                                                            <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                                                                {(tokenUsage.cache_hit_rate ?? 0).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-500"
                                                                style={{ width: `${Math.min(tokenUsage.cache_hit_rate ?? 0, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            {formatNumber(tokenUsage.total_cache_read_tokens)} / {formatNumber(tokenUsage.total_prompt_tokens)} tokens
                                                        </div>
                                                    </div>

                                                    {/* Estimated Savings */}
                                                    {tokenUsage.estimated_cache_savings && tokenUsage.estimated_cache_savings > 0 && (
                                                        <div className="flex items-center justify-between text-sm bg-green-500/10 rounded-lg p-3">
                                                            <span className="font-medium text-green-600 dark:text-green-400">
                                                                Estimated Savings (vs. no cache)
                                                            </span>
                                                            <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                                                                {formatCost(tokenUsage.estimated_cache_savings)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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

                                    {/* Cost Breakdown */}
                                    {tokenUsage.estimated_cost_dollars && tokenUsage.estimated_cost_dollars > 0 && (
                                        <div className="mt-6 pt-6 border-t">
                                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                                Cost Breakdown
                                            </h3>
                                            <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Base Provider Cost (Base)</span>
                                                    <span className="font-mono">
                                                        {formatCost((tokenUsage.estimated_cost_dollars ?? 0) / 1.2)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Markup (20%) (if Paid User)</span>
                                                    <span className="font-mono text-amber-600 dark:text-amber-400">
                                                        +{formatCost((tokenUsage.estimated_cost_dollars ?? 0) - ((tokenUsage.estimated_cost_dollars ?? 0) / 1.2))}
                                                    </span>
                                                </div>
                                                <div className="h-px bg-border my-2"></div>
                                                <div className="flex justify-between items-center font-semibold">
                                                    <span>Total Cost</span>
                                                    <span className="font-mono text-lg text-green-600 dark:text-green-400">
                                                        {formatCost(tokenUsage.estimated_cost_dollars)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column - Agent Component Breakdown */}
                                <div className="space-y-6">
                                    <div className="bg-muted/20 border border-border rounded-lg p-5">
                                        {tokenUsage.token_breakdown_by_component && tokenUsage.component_percentages ? (
                                            <AgentBreakdown
                                                breakdown={tokenUsage.token_breakdown_by_component}
                                                percentages={tokenUsage.component_percentages}
                                            />
                                        ) : (
                                            <div>
                                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                                    Agent Component Breakdown
                                                </h3>
                                                <p className="text-xs text-muted-foreground mb-4">
                                                    Where your tokens go in the agent workflow
                                                </p>
                                                <div className="text-sm text-muted-foreground text-center py-8">
                                                    No component breakdown data available
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
