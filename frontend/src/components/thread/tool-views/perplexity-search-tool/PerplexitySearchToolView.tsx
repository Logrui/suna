import React, { useState, useEffect } from 'react';
import {
    Sparkles,
    CheckCircle,
    AlertTriangle,
    ExternalLink,
    Globe,
    FileText,
    Clock,
    BookOpen,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Video,
    Play,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { cleanUrl, formatTimestamp, getToolTitle } from '../utils';
import { truncateString } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from '../shared/LoadingState';
import { extractPerplexitySearchData } from './_utils';

export function PerplexitySearchToolView({
    toolCall,
    toolResult,
    assistantTimestamp,
    toolTimestamp,
    isSuccess = true,
    isStreaming = false,
}: ToolViewProps) {
    const [expandedResults, setExpandedResults] = useState<Record<number, boolean>>({});
    const [currentQueryIndex, setCurrentQueryIndex] = useState(0);
    const [activeTab, setActiveTab] = useState<'results' | 'videos'>('results');

    const {
        query,
        searchResults,
        videos,
        actualIsSuccess,
        actualToolTimestamp,
        actualAssistantTimestamp,
        isBatch,
        batchResults
    } = extractPerplexitySearchData(
        toolCall,
        toolResult,
        isSuccess,
        toolTimestamp,
        assistantTimestamp
    );

    // Reset to first query when batch results change
    useEffect(() => {
        if (isBatch && batchResults && batchResults.length > 0) {
            setCurrentQueryIndex(0);
        }
    }, [isBatch, batchResults?.length]);

    // Safe index bounds checking
    const safeQueryIndex = batchResults && batchResults.length > 0
        ? Math.min(currentQueryIndex, batchResults.length - 1)
        : 0;

    const currentBatchItem = batchResults?.[safeQueryIndex];

    const name = 'perplexity-search';
    const toolTitle = 'Perplexity Search';

    const getFavicon = (url: string | undefined) => {
        if (!url) return null;
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        } catch {
            return null;
        }
    };

    const getResultType = (result: any) => {
        const { url, title } = result;
        if (!url || !title) return { icon: Globe, label: 'Website' };

        const urlLower = url.toLowerCase();
        const titleLower = title.toLowerCase();

        // Video detection
        if (urlLower.includes('youtube') || urlLower.includes('youtu.be') ||
            urlLower.includes('vimeo') || urlLower.includes('/video') ||
            urlLower.includes('/watch')) {
            return { icon: Play, label: 'Video' };
        }
        if (urlLower.includes('news') || urlLower.includes('article') || titleLower.includes('news')) {
            return { icon: FileText, label: 'Article' };
        } else if (urlLower.includes('wiki')) {
            return { icon: BookOpen, label: 'Wiki' };
        } else if (urlLower.includes('blog')) {
            return { icon: CalendarDays, label: 'Blog' };
        }
        return { icon: Globe, label: 'Website' };
    };

    // Get current results based on mode
    const currentResults = isBatch && currentBatchItem
        ? currentBatchItem.results
        : searchResults;
    const currentVideos = isBatch && currentBatchItem
        ? currentBatchItem.videos
        : videos;

    const hasVideos = currentVideos.length > 0;
    const hasResults = currentResults.length > 0;

    return (
        <Card className="gap-0 flex border-0 shadow-none p-0 py-0 rounded-none flex-col h-full overflow-hidden bg-card">
            <CardHeader className="h-14 bg-gradient-to-r from-violet-50/80 to-purple-50/80 dark:from-violet-900/20 dark:to-purple-900/20 backdrop-blur-sm border-b p-2 px-4 space-y-2">
                <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative p-2 rounded-lg border flex-shrink-0 bg-gradient-to-b from-violet-200/60 to-violet-100/60 dark:from-violet-800/40 dark:to-violet-900/50 border-violet-300 dark:border-violet-700">
                            <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                                {toolTitle}
                            </CardTitle>
                        </div>
                    </div>

                    {!isStreaming && (
                        <Badge
                            variant="secondary"
                            className={
                                actualIsSuccess
                                    ? "bg-gradient-to-b from-emerald-200 to-emerald-100 text-emerald-700 dark:from-emerald-800/50 dark:to-emerald-900/60 dark:text-emerald-300"
                                    : "bg-gradient-to-b from-rose-200 to-rose-100 text-rose-700 dark:from-rose-800/50 dark:to-rose-900/60 dark:text-rose-300"
                            }
                        >
                            {actualIsSuccess ? 'Search completed' : 'Search failed'}
                        </Badge>
                    )}

                    {isStreaming && (
                        <Badge className="bg-gradient-to-b from-violet-200 to-violet-100 text-violet-700 dark:from-violet-800/50 dark:to-violet-900/60 dark:text-violet-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            Searching
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
                {isStreaming && searchResults.length === 0 && videos.length === 0 ? (
                    <LoadingState
                        icon={Sparkles}
                        iconColor="text-violet-500 dark:text-violet-400"
                        bgColor="bg-gradient-to-b from-violet-100 to-violet-50 shadow-inner dark:from-violet-800/40 dark:to-violet-900/60 dark:shadow-violet-950/20"
                        title="Searching with Perplexity AI"
                        filePath={typeof query === 'string' ? query : query?.[0] || ''}
                        showProgress={true}
                    />
                ) : hasResults || hasVideos ? (
                    <ScrollArea className="h-full w-full">
                        <div className="p-4 py-0 my-4">
                            {/* Batch Navigation Header */}
                            {isBatch && batchResults && currentBatchItem && (
                                <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                Query {safeQueryIndex + 1} of {batchResults.length}
                                            </span>
                                            {currentBatchItem.success ? (
                                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                            ) : (
                                                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                            )}
                                            {currentBatchItem.results?.length > 0 && (
                                                <Badge variant="outline" className="text-xs font-normal h-4 px-1.5">
                                                    {currentBatchItem.results.length} results
                                                </Badge>
                                            )}
                                            {currentBatchItem.videos?.length > 0 && (
                                                <Badge variant="outline" className="text-xs font-normal h-4 px-1.5 bg-violet-50 dark:bg-violet-900/30">
                                                    <Video className="h-2.5 w-2.5 mr-0.5" />
                                                    {currentBatchItem.videos.length} videos
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {currentBatchItem.query}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1 ml-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => setCurrentQueryIndex(Math.max(0, safeQueryIndex - 1))}
                                            disabled={safeQueryIndex === 0}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => setCurrentQueryIndex(Math.min(batchResults.length - 1, safeQueryIndex + 1))}
                                            disabled={safeQueryIndex === batchResults.length - 1}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Tab Navigation for Results/Videos */}
                            {hasVideos && (
                                <div className="flex gap-2 mb-4">
                                    <Button
                                        variant={activeTab === 'results' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setActiveTab('results')}
                                        className={activeTab === 'results'
                                            ? 'bg-gradient-to-b from-violet-500 to-violet-600 text-white'
                                            : ''}
                                    >
                                        <Globe className="h-3.5 w-3.5 mr-1.5" />
                                        Results ({currentResults.length})
                                    </Button>
                                    <Button
                                        variant={activeTab === 'videos' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setActiveTab('videos')}
                                        className={activeTab === 'videos'
                                            ? 'bg-gradient-to-b from-rose-500 to-rose-600 text-white'
                                            : ''}
                                    >
                                        <Video className="h-3.5 w-3.5 mr-1.5" />
                                        Videos ({currentVideos.length})
                                    </Button>
                                </div>
                            )}

                            {/* Results List */}
                            {(activeTab === 'results' || !hasVideos) && hasResults && (
                                <div className="space-y-2.5">
                                    {currentResults.map((result, idx) => {
                                        if (!result?.url || !result?.title) return null;

                                        const { icon: ResultTypeIcon, label: resultTypeLabel } = getResultType(result);
                                        const favicon = getFavicon(result.url);

                                        return (
                                            <div
                                                key={`result-${idx}`}
                                                className="bg-card border border-border rounded-lg hover:border-border/80 transition-colors hover:shadow-sm"
                                            >
                                                <div className="p-3.5">
                                                    <div className="flex items-start gap-2.5">
                                                        {favicon && (
                                                            <img
                                                                src={favicon}
                                                                alt=""
                                                                className="w-4 h-4 mt-0.5 rounded flex-shrink-0"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal">
                                                                    <ResultTypeIcon className="h-2.5 w-2.5 mr-1 opacity-70" />
                                                                    {resultTypeLabel}
                                                                </Badge>
                                                                {result.date && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {result.date}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <a
                                                                href={result.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm font-medium text-primary hover:underline line-clamp-1 mb-1 block"
                                                            >
                                                                {truncateString(cleanUrl(result.title), 60)}
                                                            </a>
                                                            <div className="text-xs text-muted-foreground flex items-center">
                                                                <Globe className="h-3 w-3 mr-1 flex-shrink-0 opacity-60" />
                                                                <span className="truncate">{truncateString(cleanUrl(result.url), 65)}</span>
                                                            </div>
                                                            {result.snippet && (
                                                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                                                    {result.snippet}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Videos List */}
                            {activeTab === 'videos' && hasVideos && (
                                <div className="space-y-2.5">
                                    {currentVideos.map((video, idx) => {
                                        if (!video?.url || !video?.title) return null;

                                        const favicon = getFavicon(video.url);

                                        return (
                                            <div
                                                key={`video-${idx}`}
                                                className="bg-gradient-to-r from-rose-50/50 to-orange-50/50 dark:from-rose-900/20 dark:to-orange-900/20 border border-rose-200/50 dark:border-rose-800/50 rounded-lg hover:shadow-sm transition-all"
                                            >
                                                <div className="p-3.5">
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-b from-rose-400 to-rose-500 flex items-center justify-center">
                                                            <Play className="w-4 h-4 text-white" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700">
                                                                    <Video className="h-2.5 w-2.5 mr-1 opacity-70" />
                                                                    Video
                                                                </Badge>
                                                                {video.date && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {video.date}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <a
                                                                href={video.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:underline line-clamp-1 mb-1 block"
                                                            >
                                                                {truncateString(video.title, 60)}
                                                            </a>
                                                            <div className="text-xs text-muted-foreground flex items-center">
                                                                <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0 opacity-60" />
                                                                <span className="truncate">{truncateString(cleanUrl(video.url), 65)}</span>
                                                            </div>
                                                            {video.snippet && (
                                                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                                                    {video.snippet}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-violet-50/30 dark:from-zinc-950 dark:to-violet-900/10">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-violet-100 to-violet-50 shadow-inner dark:from-violet-800/40 dark:to-violet-900/60">
                            <Sparkles className="h-10 w-10 text-violet-400 dark:text-violet-500" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
                            No Results Found
                        </h3>
                        {query && (
                            <div className="bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 rounded-lg p-4 w-full max-w-md text-center mb-4 shadow-sm">
                                <code className="text-sm font-mono text-violet-700 dark:text-violet-300 break-all">
                                    {typeof query === 'string' ? query : Array.isArray(query) ? query.join(', ') : 'Unknown query'}
                                </code>
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                            Try refining your search query for better results
                        </p>
                    </div>
                )}
            </CardContent>

            <div className="px-4 py-2 h-10 bg-gradient-to-r from-violet-50/90 to-purple-50/90 dark:from-violet-900/30 dark:to-purple-900/30 backdrop-blur-sm border-t border-violet-200 dark:border-violet-800 flex justify-between items-center gap-4">
                <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {!isStreaming && (
                        <>
                            {isBatch && batchResults ? (
                                <Badge variant="outline" className="h-6 py-0.5 bg-violet-50/50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-700">
                                    <Globe className="h-3 w-3" />
                                    {batchResults.length} queries • {searchResults.length + videos.length} results
                                </Badge>
                            ) : (
                                <>
                                    {searchResults.length > 0 && (
                                        <Badge variant="outline" className="h-6 py-0.5">
                                            <Globe className="h-3 w-3" />
                                            {searchResults.length} results
                                        </Badge>
                                    )}
                                    {videos.length > 0 && (
                                        <Badge variant="outline" className="h-6 py-0.5 bg-rose-50/50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700">
                                            <Video className="h-3 w-3" />
                                            {videos.length} videos
                                        </Badge>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {actualToolTimestamp && !isStreaming
                        ? formatTimestamp(actualToolTimestamp)
                        : actualAssistantTimestamp
                            ? formatTimestamp(actualAssistantTimestamp)
                            : ''}
                </div>
            </div>
        </Card>
    );
}
