'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    listUserBrowsers,
    listOnlineBrowsers,
    registerBrowser,
    deleteBrowser,
    setThreadBrowser,
    clearThreadBrowser,
    getThreadBrowser,
    type UserBrowser,
} from '@/lib/api/browsers';

// ========== Query Keys ==========

export const browserKeys = {
    all: ['browsers'] as const,
    list: () => [...browserKeys.all, 'list'] as const,
    online: () => [...browserKeys.all, 'online'] as const,
    thread: (threadId: string) => [...browserKeys.all, 'thread', threadId] as const,
};

// ========== Hooks ==========

/**
 * Hook to list all user browsers
 */
export function useUserBrowsers() {
    return useQuery({
        queryKey: browserKeys.list(),
        queryFn: listUserBrowsers,
        staleTime: 30 * 1000, // 30 seconds
        refetchInterval: 60 * 1000, // Refetch every minute to update online status
    });
}

/**
 * Hook to list only online browsers
 */
export function useOnlineBrowsers() {
    return useQuery({
        queryKey: browserKeys.online(),
        queryFn: listOnlineBrowsers,
        staleTime: 10 * 1000, // 10 seconds
        refetchInterval: 30 * 1000, // Refetch every 30 seconds
    });
}

/**
 * Hook to get the selected browser for a thread
 */
export function useThreadBrowser(threadId: string | null) {
    return useQuery({
        queryKey: browserKeys.thread(threadId || ''),
        queryFn: () => getThreadBrowser(threadId!),
        enabled: !!threadId,
        staleTime: 60 * 1000,
    });
}

/**
 * Hook to register a new browser
 */
export function useRegisterBrowser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ extensionId, browserInfo, name }: {
            extensionId: string;
            browserInfo?: { browser?: string; os?: string };
            name?: string;
        }) => {
            return registerBrowser(extensionId, browserInfo, name);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: browserKeys.all });
            toast.success('Browser connected!');
        },
        onError: (error) => {
            console.error('Failed to register browser:', error);
            toast.error(error.message || 'Failed to connect browser');
        },
    });
}

/**
 * Hook to delete a browser
 */
export function useDeleteBrowser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteBrowser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: browserKeys.all });
            toast.success('Browser removed');
        },
        onError: (error) => {
            console.error('Failed to delete browser:', error);
            toast.error(error.message || 'Failed to remove browser');
        },
    });
}

/**
 * Hook to rename a browser
 */
export function useRenameBrowser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ browserId, name }: { browserId: string; name: string }) => {
            const { updateBrowserName } = await import('@/lib/api/browsers');
            return updateBrowserName(browserId, name);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: browserKeys.all });
            toast.success('Browser renamed');
        },
        onError: (error) => {
            console.error('Failed to rename browser:', error);
            toast.error(error.message || 'Failed to rename browser');
        },
    });
}

/**
 * Hook to fetch a live screenshot from a browser extension
 */
export function useBrowserScreenshot(browserId?: string, options?: { enabled?: boolean; refetchInterval?: number | false }) {
    return useQuery({
        queryKey: ['browser-screenshot', browserId],
        queryFn: async () => {
            if (!browserId) return null;
            const { getBrowserScreenshot } = await import('@/lib/api/browsers');
            return getBrowserScreenshot(browserId);
        },
        enabled: !!browserId && options?.enabled !== false,
        refetchInterval: options?.refetchInterval,
        staleTime: 0,
    });
}

/**
 * Hook to set the browser for a thread
 */
export function useSetThreadBrowser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ threadId, browserId }: { threadId: string; browserId: string }) => {
            console.debug('[BROWSER_HOOKS] 🌐 setThreadBrowser: Starting', { threadId, browserId });
            const result = await setThreadBrowser(threadId, browserId);
            console.debug('[BROWSER_HOOKS] 🌐 setThreadBrowser: Completed', { threadId, browserId });
            return result;
        },
        onSuccess: (_, { threadId, browserId }) => {
            console.debug('[BROWSER_HOOKS] 🌐 setThreadBrowser: onSuccess, invalidating queries', { threadId, browserId });
            queryClient.invalidateQueries({ queryKey: browserKeys.thread(threadId) });
            toast.success('Browser connected to thread');
        },
        onError: (error, { threadId, browserId }) => {
            console.error('[BROWSER_HOOKS] 🌐 setThreadBrowser: FAILED', { threadId, browserId, error });
            toast.error(error.message || 'Failed to connect browser');
        },
    });
}

/**
 * Hook to clear the browser selection for a thread
 */
export function useClearThreadBrowser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: clearThreadBrowser,
        onSuccess: (_, threadId) => {
            queryClient.invalidateQueries({ queryKey: browserKeys.thread(threadId) });
            toast.success('Browser disconnected from thread');
        },
        onError: (error) => {
            console.error('Failed to clear thread browser:', error);
            toast.error(error.message || 'Failed to disconnect browser');
        },
    });
}

/**
 * Hook to invalidate all browser queries
 */
export function useInvalidateBrowserQueries() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: browserKeys.all });
    };
}

// ========== Re-exports ==========

export type { UserBrowser };
