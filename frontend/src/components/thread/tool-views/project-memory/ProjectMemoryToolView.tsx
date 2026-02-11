import type React from 'react';
import {
    Brain,
    CheckCircle,
    AlertTriangle,
    Clock,
    Trash2,
    BookmarkPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractProjectMemoryData, getMemoryActionType } from './_utils';
import { getToolTitle } from '../utils';
import type { ToolViewProps } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ────────────────────────────────────────────────────────────────
// Memory Type Badge
// ────────────────────────────────────────────────────────────────

const MEMORY_TYPE_STYLES: Record<string, string> = {
    fact: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    preference:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    instruction:
        'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
    context:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
};

const MemoryTypeBadge: React.FC<{ type?: string }> = ({ type }) => {
    if (!type) return null;
    return (
        <Badge
            variant="outline"
            className={cn(
                'text-xs h-5 px-2 py-0 font-normal capitalize',
                MEMORY_TYPE_STYLES[type] ?? ''
            )}
        >
            {type}
        </Badge>
    );
};

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export const ProjectMemoryToolView: React.FC<ToolViewProps> = ({
    toolCall,
    toolResult,
    assistantTimestamp,
    toolTimestamp,
    isSuccess = true,
    isStreaming = false,
}) => {
    const name = toolCall.function_name.replace(/_/g, '-').toLowerCase();
    const actionType = getMemoryActionType(toolCall.function_name);
    const data = extractProjectMemoryData(
        toolCall.arguments,
        toolResult?.output
    );
    const toolTitle = getToolTitle(name);

    const isSave = actionType === 'save';
    const ActionIcon = isSave ? BookmarkPlus : Trash2;
    const gradientFrom = isSave ? 'from-violet-500/20' : 'from-rose-500/20';
    const gradientTo = isSave ? 'to-violet-600/10' : 'to-rose-600/10';
    const iconBorder = isSave ? 'border-violet-500/20' : 'border-rose-500/20';
    const iconColor = isSave
        ? 'text-violet-500 dark:text-violet-400'
        : 'text-rose-500 dark:text-rose-400';

    const hasContent = Boolean(data?.content || data?.message);

    return (
        <Card className="gap-0 flex border-0 shadow-none p-0 py-0 rounded-none flex-col h-full overflow-hidden bg-card">
            {/* Header */}
            <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
                <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className={cn(
                                'relative p-2 rounded-xl bg-gradient-to-br border',
                                gradientFrom,
                                gradientTo,
                                iconBorder
                            )}
                        >
                            <ActionIcon className={cn('w-5 h-5', iconColor)} />
                        </div>
                        <div>
                            <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                                {toolTitle}
                            </CardTitle>
                        </div>
                    </div>

                    {!isStreaming && (
                        <div className="flex items-center gap-2">
                            {data?.memory_type && (
                                <MemoryTypeBadge type={data.memory_type} />
                            )}
                            <Badge
                                variant="secondary"
                                className={
                                    isSuccess
                                        ? 'bg-gradient-to-b from-emerald-200 to-emerald-100 text-emerald-700 dark:from-emerald-800/50 dark:to-emerald-900/60 dark:text-emerald-300'
                                        : 'bg-gradient-to-b from-rose-200 to-rose-100 text-rose-700 dark:from-rose-800/50 dark:to-rose-900/60 dark:text-rose-300'
                                }
                            >
                                {isSuccess ? (
                                    <CheckCircle className="h-3.5 w-3.5" />
                                ) : (
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                )}
                                {isSuccess
                                    ? isSave
                                        ? 'Memory saved'
                                        : 'Memory deleted'
                                    : 'Failed'}
                            </Badge>
                        </div>
                    )}
                </div>
            </CardHeader>

            {/* Content */}
            <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
                {isStreaming && !hasContent ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-violet-100 to-violet-50 shadow-inner dark:from-violet-800/40 dark:to-violet-900/60">
                            <Clock className="h-10 w-10 text-violet-500 dark:text-violet-400 animate-spin" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
                            {isSave ? 'Saving Memory' : 'Deleting Memory'}
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {isSave
                                ? 'Storing project knowledge...'
                                : 'Removing project memory...'}
                        </p>
                    </div>
                ) : hasContent ? (
                    <div className="p-4 space-y-3">
                        {/* Memory content */}
                        {data?.content && (
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 p-4">
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {data.content}
                                </p>
                            </div>
                        )}

                        {/* Status message */}
                        {data?.message && !data.content && (
                            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                <Brain className="h-4 w-4 flex-shrink-0" />
                                <span>{data.message}</span>
                            </div>
                        )}

                        {/* Memory ID for delete */}
                        {!isSave && data?.memory_id && (
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                                ID: {data.memory_id}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-zinc-100 to-zinc-50 shadow-inner dark:from-zinc-800/40 dark:to-zinc-900/60">
                            <Brain className="h-10 w-10 text-zinc-400 dark:text-zinc-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
                            No Details
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Memory operation details will appear here
                        </p>
                    </div>
                )}
            </CardContent>

            {/* Footer */}
            <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
                <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {!isStreaming && hasContent && (
                        <Badge
                            variant="outline"
                            className="h-6 py-0.5"
                        >
                            <Brain className="h-3 w-3" />
                            {isSave ? 'Saved' : 'Deleted'}
                        </Badge>
                    )}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {toolTimestamp && !isStreaming
                        ? new Date(toolTimestamp).toLocaleTimeString()
                        : assistantTimestamp
                            ? new Date(assistantTimestamp).toLocaleTimeString()
                            : ''}
                </div>
            </div>
        </Card>
    );
};
