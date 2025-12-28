import { useQuery } from '@tanstack/react-query';
import { composioApi } from '@/hooks/composio/utils';

/**
 * Simple in-memory cache for toolkit icons to avoid redundant API calls.
 * This persists across component re-renders and is shared across all hook instances.
 */
const iconCache = new Map<string, string | null>();

/**
 * Hook to fetch a toolkit icon by its slug.
 * Uses React Query for caching and the Composio API to fetch icons.
 * 
 * @param toolkitSlug - The toolkit slug (e.g., 'gmail', 'slack', 'github')
 * @param enabled - Whether to enable the query (default: true)
 * @returns Object with iconUrl, isLoading, and error states
 * 
 * @example
 * ```tsx
 * const { iconUrl, isLoading } = useToolkitIcon('gmail');
 * 
 * if (isLoading) return <Skeleton />;
 * if (iconUrl) return <img src={iconUrl} />;
 * return <FallbackIcon />;
 * ```
 */
export function useToolkitIcon(toolkitSlug: string | undefined, enabled = true) {
    const query = useQuery({
        queryKey: ['toolkit-icon', toolkitSlug],
        queryFn: async () => {
            if (!toolkitSlug) return null;

            // Check in-memory cache first
            if (iconCache.has(toolkitSlug)) {
                return iconCache.get(toolkitSlug) ?? null;
            }

            try {
                const response = await composioApi.getToolkitIcon(toolkitSlug);
                const iconUrl = response.success ? response.icon_url ?? null : null;

                // Store in cache
                iconCache.set(toolkitSlug, iconUrl);

                return iconUrl;
            } catch (error) {
                console.warn(`[useToolkitIcon] Failed to fetch icon for ${toolkitSlug}:`, error);
                // Cache the failure to avoid repeated failed requests
                iconCache.set(toolkitSlug, null);
                return null;
            }
        },
        enabled: enabled && !!toolkitSlug,
        staleTime: 1000 * 60 * 60, // 1 hour - icons don't change often
        gcTime: 1000 * 60 * 60 * 24, // 24 hours cache
        retry: 1, // Only retry once on failure
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });

    return {
        iconUrl: query.data ?? null,
        isLoading: query.isLoading,
        error: query.error,
    };
}

/**
 * Utility function to get a cached icon URL synchronously.
 * Returns null if the icon hasn't been fetched yet.
 * 
 * @param toolkitSlug - The toolkit slug
 * @returns The cached icon URL or null
 */
export function getCachedToolkitIcon(toolkitSlug: string): string | null {
    return iconCache.get(toolkitSlug) ?? null;
}

/**
 * Utility function to preload multiple toolkit icons.
 * Useful for batch-loading icons when displaying a list.
 * 
 * @param toolkitSlugs - Array of toolkit slugs to preload
 */
export async function preloadToolkitIcons(toolkitSlugs: string[]): Promise<void> {
    const uniqueSlugs = [...new Set(toolkitSlugs)].filter(Boolean);
    const uncachedSlugs = uniqueSlugs.filter(slug => !iconCache.has(slug));

    if (uncachedSlugs.length === 0) return;

    // Fetch uncached icons in parallel (with concurrency limit)
    const batchSize = 5;
    for (let i = 0; i < uncachedSlugs.length; i += batchSize) {
        const batch = uncachedSlugs.slice(i, i + batchSize);
        await Promise.all(
            batch.map(async (slug) => {
                try {
                    const response = await composioApi.getToolkitIcon(slug);
                    iconCache.set(slug, response.success ? response.icon_url ?? null : null);
                } catch {
                    iconCache.set(slug, null);
                }
            })
        );
    }
}

/**
 * Clear the icon cache. Useful for testing or forcing a refresh.
 */
export function clearToolkitIconCache(): void {
    iconCache.clear();
}
