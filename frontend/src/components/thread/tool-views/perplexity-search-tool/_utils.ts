import { ToolCallData, ToolResultData } from '../types';

/**
 * Extract Perplexity search data from structured metadata props
 * Handles both single query and batch mode results, plus video categorization
 */
export function extractPerplexitySearchData(
    toolCall: ToolCallData | undefined,
    toolResult?: ToolResultData,
    isSuccess: boolean = true,
    toolTimestamp?: string,
    assistantTimestamp?: string
): {
    query: string | null;
    searchResults: Array<{ title: string; url: string; snippet?: string; date?: string; is_video?: boolean }>;
    videos: Array<{ title: string; url: string; snippet?: string; date?: string }>;
    actualIsSuccess: boolean;
    actualToolTimestamp?: string;
    actualAssistantTimestamp?: string;
    isBatch?: boolean;
    batchResults?: Array<{
        query: string;
        success: boolean;
        results: Array<{ title: string; url: string; snippet?: string; date?: string }>;
        videos: Array<{ title: string; url: string; snippet?: string; date?: string }>;
    }>;
} {
    // Default return value
    const defaultReturn = {
        query: null,
        searchResults: [],
        videos: [],
        actualIsSuccess: isSuccess,
        actualToolTimestamp: toolTimestamp,
        actualAssistantTimestamp: assistantTimestamp,
        isBatch: false,
        batchResults: undefined
    };

    try {
        if (!toolCall) {
            return defaultReturn;
        }

        // Extract query from toolCall.arguments
        const args = toolCall.arguments || {};
        const query: string | null = args.query || null;

        // Extract output from toolResult
        let output: any = null;
        let actualIsSuccess = isSuccess;
        let actualToolTimestamp = toolTimestamp;

        if (toolResult?.output) {
            output = toolResult.output;
            if (toolResult?.success !== undefined) {
                actualIsSuccess = toolResult.success;
            }
        }

        // Parse output
        let searchResults: Array<{ title: string; url: string; snippet?: string; date?: string; is_video?: boolean }> = [];
        let videos: Array<{ title: string; url: string; snippet?: string; date?: string }> = [];
        let isBatch = false;
        let batchResults: Array<{
            query: string;
            success: boolean;
            results: Array<{ title: string; url: string; snippet?: string; date?: string }>;
            videos: Array<{ title: string; url: string; snippet?: string; date?: string }>;
        }> | undefined = undefined;

        if (output && typeof output === 'object' && output !== null) {
            // Handle batch mode
            if (output.batch_mode === true && Array.isArray(output.results)) {
                isBatch = true;
                batchResults = output.results.map((batchItem: any) => ({
                    query: batchItem.query || '',
                    success: batchItem.success !== false,
                    results: (batchItem.results || []).map((result: any) => ({
                        title: result.title || '',
                        url: result.url || '',
                        snippet: result.content || result.snippet || '',
                        date: result.date || result.last_updated || ''
                    })),
                    videos: (batchItem.videos || []).map((video: any) => ({
                        title: video.title || '',
                        url: video.url || '',
                        snippet: video.content || video.snippet || '',
                        date: video.date || video.last_updated || ''
                    }))
                }));

                // Flatten for combined display
                const allResults = batchResults.flatMap(br => br.results);
                const allVideos = batchResults.flatMap(br => br.videos);
                const allQueries = batchResults.map(br => br.query).filter(Boolean);
                const combinedQuery = allQueries.length > 1
                    ? `${allQueries.length} queries: ${allQueries.join(', ')}`
                    : allQueries[0] || query;
                const allSuccessful = batchResults.every(br => br.success);

                return {
                    query: combinedQuery || query,
                    searchResults: allResults,
                    videos: allVideos,
                    actualIsSuccess: allSuccessful,
                    actualToolTimestamp,
                    actualAssistantTimestamp: assistantTimestamp,
                    isBatch: true,
                    batchResults
                };
            }

            // Handle single search result
            if (Array.isArray(output.results)) {
                searchResults = output.results.map((result: any) => ({
                    title: result.title || '',
                    url: result.url || '',
                    snippet: result.content || result.snippet || '',
                    date: result.date || result.last_updated || '',
                    is_video: result.is_video || false
                }));
            }

            // Extract videos
            if (Array.isArray(output.videos)) {
                videos = output.videos.map((video: any) => ({
                    title: video.title || '',
                    url: video.url || '',
                    snippet: video.content || video.snippet || '',
                    date: video.date || video.last_updated || ''
                }));
            }
        } else if (typeof output === 'string') {
            // Handle string output - try to parse as JSON
            try {
                const parsed = JSON.parse(output);
                if (parsed && typeof parsed === 'object' && parsed !== null) {
                    if (Array.isArray(parsed.results)) {
                        searchResults = parsed.results.map((result: any) => ({
                            title: result.title || '',
                            url: result.url || '',
                            snippet: result.content || result.snippet || '',
                            date: result.date || result.last_updated || ''
                        }));
                    }
                    if (Array.isArray(parsed.videos)) {
                        videos = parsed.videos.map((video: any) => ({
                            title: video.title || '',
                            url: video.url || '',
                            snippet: video.content || video.snippet || '',
                            date: video.date || video.last_updated || ''
                        }));
                    }
                }
            } catch (e) {
                // Not JSON
            }
        }

        return {
            query,
            searchResults,
            videos,
            actualIsSuccess,
            actualToolTimestamp,
            actualAssistantTimestamp: assistantTimestamp,
            isBatch,
            batchResults
        };
    } catch (error) {
        console.error('extractPerplexitySearchData error:', error);
        return defaultReturn;
    }
}
