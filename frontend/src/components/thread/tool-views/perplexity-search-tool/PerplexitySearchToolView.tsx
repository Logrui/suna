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
    Copy,
    Check,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { cleanUrl, formatTimestamp, getToolTitle } from '../utils';
import { truncateString } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from '../shared/LoadingState';
import { extractPerplexitySearchData, extractYouTubeId } from './_utils';

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
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const handleCopy = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

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
            <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
                <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="relative p-2 rounded-lg border flex-shrink-0 bg-gradient-to-b from-zinc-200/60 to-zinc-100/60 dark:from-zinc-800/40 dark:to-zinc-900/50 border-zinc-300 dark:border-zinc-700">
                            <Sparkles className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <div className="flex flex-col">
                            <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                                {toolTitle}
                            </CardTitle>
                            {!isBatch && query && (
                                <p className="text-[10px] text-zinc-500 font-medium truncate max-w-[200px] mt-0.5">
                                    {query}
                                </p>
                            )}
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
                        <Badge className="bg-gradient-to-b from-zinc-200 to-zinc-100 text-zinc-700 dark:from-zinc-800/50 dark:to-zinc-900/60 dark:text-zinc-300">
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
                        iconColor="text-zinc-500 dark:text-zinc-400"
                        bgColor="bg-gradient-to-b from-zinc-100 to-zinc-50 shadow-inner dark:from-zinc-800/40 dark:to-zinc-900/60 dark:shadow-zinc-950/20"
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
                                                <Badge variant="outline" className="text-xs font-normal h-4 px-1.5 bg-zinc-50 dark:bg-zinc-900/30">
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
                                            ? 'bg-gradient-to-b from-zinc-600 to-zinc-700 text-white'
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
                                            ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
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
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleCopy(result.url);
                                                            }}
                                                        >
                                                            {copiedUrl === result.url ? (
                                                                <Check className="h-4 w-4 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </Button>
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
                                                className="bg-card border border-border rounded-lg hover:border-border/80 transition-colors hover:shadow-sm"
                                            >
                                                <div className="p-3.5">
                                                    <div className="flex items-start gap-4">
                                                        {/* Video Thumbnail */}
                                                        {(() => {
                                                            const ytId = extractYouTubeId(video.url);
                                                            if (ytId) {
                                                                return (
                                                                    <div className="relative w-32 aspect-video rounded-md overflow-hidden bg-zinc-100 flex-shrink-0 group">
                                                                        <img
                                                                            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                                                                            alt=""
                                                                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <Play className="w-8 h-8 text-white fill-white" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                                    <Play className="w-4 h-4 text-zinc-500" />
                                                                </div>
                                                            );
                                                        })()}

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal">
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
                                                                className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:underline line-clamp-1 mb-1 block"
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
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleCopy(video.url);
                                                            }}
                                                        >
                                                            {copiedUrl === video.url ? (
                                                                <Check className="h-4 w-4 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </Button>
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
                    <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50/30 dark:from-zinc-950 dark:to-zinc-900/10">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-zinc-100 to-zinc-50 shadow-inner dark:from-zinc-800/40 dark:to-zinc-900/60">
                            <Sparkles className="h-10 w-10 text-zinc-400 dark:text-zinc-500" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
                            No Results Found
                        </h3>
                        {query && (
                            <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 w-full max-w-md text-center mb-4 shadow-sm">
                                <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">
                                    {query}
                                </code>
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                            Try refining your search query for better results
                        </p>
                    </div>
                )}
            </CardContent>

            <div className="px-4 py-2 h-10 bg-linear-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
                <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {!isStreaming && (
                        <>
                            {isBatch && batchResults ? (
                                <Badge variant="outline" className="h-6 py-0.5">
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
                                        <Badge variant="outline" className="h-6 py-0.5">
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
