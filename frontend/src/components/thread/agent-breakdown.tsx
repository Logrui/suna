import { Settings, Wrench, MessageSquare, FileCode, Search, User } from "lucide-react";

interface ComponentBreakdown {
    system_prompt: number;
    tools: number;
    conversation_history: number;
    workspace_context: number;
    search_results: number;
    user_input: number;
}

interface AgentBreakdownProps {
    breakdown: ComponentBreakdown;
    percentages: ComponentBreakdown;
}

interface ComponentRowProps {
    icon: React.ReactNode;
    label: string;
    tokens: number;
    percentage: number;
    color: string;
}

function ComponentRow({ icon, label, tokens, percentage, color }: ComponentRowProps) {
    const colorClasses: Record<string, string> = {
        purple: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
        blue: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
        indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
        green: 'text-green-600 dark:text-green-400 bg-green-500/10',
        amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
        pink: 'text-pink-600 dark:text-pink-400 bg-pink-500/10',
    };
    
    const barColorClasses: Record<string, string> = {
        purple: 'bg-purple-500',
        blue: 'bg-blue-500',
        indigo: 'bg-indigo-500',
        green: 'bg-green-500',
        amber: 'bg-amber-500',
        pink: 'bg-pink-500',
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString();
    };
    
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${colorClasses[color]}`}>
                        {icon}
                    </div>
                    <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">
                        {percentage.toFixed(1)}%
                    </span>
                    <span className="font-mono text-sm font-medium min-w-[80px] text-right">
                        {formatNumber(tokens)}
                    </span>
                </div>
            </div>
            {percentage > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                        className={`${barColorClasses[color]} h-full transition-all duration-500`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    ></div>
                </div>
            )}
        </div>
    );
}

export function AgentBreakdown({ breakdown, percentages }: AgentBreakdownProps) {
    const totalTracked = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    if (totalTracked === 0) {
        return (
            <div className="text-sm text-muted-foreground text-center py-8">
                No component breakdown data available
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Agent Component Breakdown
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Where your tokens go in the agent workflow
                </p>
            </div>

            <div className="space-y-3">
                {/* System Prompt */}
                <ComponentRow
                    icon={<Settings className="w-4 h-4" />}
                    label="System Prompt"
                    tokens={breakdown.system_prompt}
                    percentage={percentages.system_prompt}
                    color="purple"
                />

                {/* Tools */}
                <ComponentRow
                    icon={<Wrench className="w-4 h-4" />}
                    label="Tool Definitions"
                    tokens={breakdown.tools}
                    percentage={percentages.tools}
                    color="blue"
                />

                {/* Conversation History */}
                <ComponentRow
                    icon={<MessageSquare className="w-4 h-4" />}
                    label="Conversation History"
                    tokens={breakdown.conversation_history}
                    percentage={percentages.conversation_history}
                    color="indigo"
                />

                {/* Workspace Context */}
                <ComponentRow
                    icon={<FileCode className="w-4 h-4" />}
                    label="Workspace Context"
                    tokens={breakdown.workspace_context}
                    percentage={percentages.workspace_context}
                    color="green"
                />

                {/* Search Results */}
                <ComponentRow
                    icon={<Search className="w-4 h-4" />}
                    label="Search Results"
                    tokens={breakdown.search_results}
                    percentage={percentages.search_results}
                    color="amber"
                />

                {/* User Input */}
                <ComponentRow
                    icon={<User className="w-4 h-4" />}
                    label="User Input"
                    tokens={breakdown.user_input}
                    percentage={percentages.user_input}
                    color="pink"
                />
            </div>

            {/* Total */}
            <div className="pt-3 border-t border-border/50">
                <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Total Tracked</span>
                    <span className="font-mono">{totalTracked.toLocaleString()} tokens</span>
                </div>
            </div>
        </div>
    );
}
