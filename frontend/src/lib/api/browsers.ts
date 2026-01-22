/**
 * Browser Extension API Client
 * 
 * Handles communication with the backend for browser extension management.
 */

import { backendApi } from '../api-client';

// ========== Types ==========

export interface UserBrowser {
    id: string;
    user_id: string;
    extension_id: string;
    name: string;
    browser_info: {
        browser?: string;
        version?: string;
        os?: string;
        last_ip?: string;
    };
    is_online: boolean;
    last_seen_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface RegisterBrowserRequest {
    extension_id: string;
    browser_info?: {
        browser?: string;
        os?: string;
    };
}

export interface RegisterBrowserResponse {
    browser: UserBrowser;
    token: string;
}

export interface ListBrowsersResponse {
    browsers: UserBrowser[];
}

// ========== API Functions ==========

/**
 * List all browsers registered to the current user
 */
export async function listUserBrowsers(): Promise<UserBrowser[]> {
    const response = await backendApi.get<ListBrowsersResponse>('/user/browsers');

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to list browsers');
    }

    return response.data.browsers;
}

/**
 * List only online browsers for the current user
 */
export async function listOnlineBrowsers(): Promise<UserBrowser[]> {
    const response = await backendApi.get<ListBrowsersResponse>('/user/browsers/online');

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to list online browsers');
    }

    return response.data.browsers;
}

/**
 * Register a new browser extension for the current user
 * Returns a browser token to be passed to the extension
 */
export async function registerBrowser(
    extensionId: string,
    browserInfo?: { browser?: string; os?: string },
    name?: string
): Promise<RegisterBrowserResponse> {
    const response = await backendApi.post<RegisterBrowserResponse>('/user/browsers/register', {
        extension_id: extensionId,
        browser_info: browserInfo,
        name: name || undefined,
    });

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to register browser');
    }

    return response.data;
}

/**
 * Set the browser for a thread
 */
export async function setThreadBrowser(
    threadId: string,
    browserId: string
): Promise<void> {
    console.debug('[BROWSER_API] 🌐 setThreadBrowser: Sending PATCH request', { threadId, browserId });

    const response = await backendApi.patch(`/threads/${threadId}/browser`, {
        browser_id: browserId,
    });

    if (!response.success) {
        console.error('[BROWSER_API] 🌐 setThreadBrowser: FAILED', { threadId, browserId, error: response.error });
        throw new Error(response.error?.message || 'Failed to set thread browser');
    }

    console.debug('[BROWSER_API] 🌐 setThreadBrowser: SUCCESS', { threadId, browserId });
}

/**
 * Clear the browser selection for a thread
 */
export async function clearThreadBrowser(threadId: string): Promise<void> {
    console.debug('[BROWSER_API] 🌐 clearThreadBrowser: Sending DELETE request', { threadId });

    const response = await backendApi.delete(`/threads/${threadId}/browser`);

    if (!response.success) {
        console.error('[BROWSER_API] 🌐 clearThreadBrowser: FAILED', { threadId, error: response.error });
        throw new Error(response.error?.message || 'Failed to clear thread browser');
    }

    console.debug('[BROWSER_API] 🌐 clearThreadBrowser: SUCCESS', { threadId });
}

/**
 * Get the browser ID for a thread
 */
export async function getThreadBrowser(threadId: string): Promise<string | null> {
    console.debug('[BROWSER_API] 🌐 getThreadBrowser: Sending GET request', { threadId });

    const response = await backendApi.get<{ browser_id: string | null }>(
        `/threads/${threadId}/browser`
    );

    if (!response.success || !response.data) {
        console.debug('[BROWSER_API] 🌐 getThreadBrowser: No data or failed', { threadId });
        return null;
    }

    const browserId = response.data.browser_id;
    console.debug('[BROWSER_API] 🌐 getThreadBrowser: SUCCESS', { threadId, browserId });
    return browserId;
}

/**
 * Delete a registered browser
 */
export async function deleteBrowser(browserId: string): Promise<void> {
    const response = await backendApi.delete(`/user/browsers/${browserId}`);

    if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete browser');
    }
}

/**
 * Update browser name
 */
export async function updateBrowserName(
    browserId: string,
    name: string
): Promise<UserBrowser> {
    const response = await backendApi.patch<{ browser: UserBrowser }>(
        `/user/browsers/${browserId}`,
        { name }
    );

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to update browser');
    }

    return response.data.browser;
}

/**
 * Fetch a live screenshot from a connected browser extension
 */
export async function getBrowserScreenshot(browserId: string): Promise<{
    screenshot_base64: string;
    url: string;
    title: string;
    image_url?: string;
}> {
    const response = await backendApi.get<{
        screenshot_base64: string;
        url: string;
        title: string;
        image_url?: string;
    }>(`/user/browsers/${browserId}/screenshot`);

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch screenshot');
    }

    return response.data;
}
