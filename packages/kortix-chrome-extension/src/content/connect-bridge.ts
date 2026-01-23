/**
 * Kortix Connect Bridge - Content Script
 * 
 * This content script runs on the Kortix /connect-browser page.
 * It receives the browser token from the page and sends it to the background script.
 * 
 * Flow:
 * 1. User opens /connect-browser in browser
 * 2. User logs in (if not already)
 * 3. Frontend generates browser token via API
 * 4. Frontend posts token via window.postMessage
 * 5. This script receives token and sends to background
 * 6. Background connects to WebSocket with token
 */

// ========== Inline Config (Content scripts can't use ES module imports) ==========

interface KortixConfig {
    apiUrl: string;
    wsUrl: string;
    frontendUrl: string;
}

function getConfig(): KortixConfig {
    // Development defaults - using suna.syhc.dev for self-hosted testing
    const isDev = !chrome.runtime.getManifest().update_url;

    if (isDev) {
        return {
            apiUrl: 'https://api.suna.syhc.dev',
            wsUrl: 'wss://api.suna.syhc.dev/v1/ws/extension',
            frontendUrl: 'https://suna.syhc.dev',
        };
    }

    // Production defaults
    return {
        apiUrl: 'https://api.kortix.com',
        wsUrl: 'wss://api.kortix.com/v1/ws/extension',
        frontendUrl: 'https://kortix.com',
    };
}

/**
 * Check if the extension context is still valid.
 * Returns false if the extension was reloaded and this content script is orphaned.
 */
function isExtensionContextValid(): boolean {
    try {
        // This will throw if context is invalidated
        chrome.runtime.getManifest();
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Notify the page that a refresh is required because the extension was reloaded.
 */
function notifyRefreshRequired(origin: string = '*'): void {
    window.postMessage({
        type: 'KORTIX_EXTENSION_REFRESH_REQUIRED',
        message: 'Extension was reloaded. Please refresh this page.',
    }, origin);

    console.warn('[Kortix Extension - Bridge] Extension context invalidated. Please refresh the page.');
}

// ========== Types ==========

interface KortixTokenMessage {
    type: 'KORTIX_BROWSER_TOKEN';
    token: string;
    browserInfo?: {
        name: string;
        browser: string;
        os: string;
    };
}

interface KortixStatusMessage {
    type: 'KORTIX_EXTENSION_STATUS';
    installed: boolean;
    connected: boolean;
    extensionId: string | null;
}

// ========== Token Listener ==========

/**
 * Listen for token messages from the Kortix frontend
 */
function setupTokenListener(): void {
    window.addEventListener('message', async (event) => {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
            notifyRefreshRequired(event.origin);
            return;
        }

        // Only accept messages from Kortix domains
        const config = getConfig();
        const allowedOrigins = [
            config.frontendUrl,
            'https://suna.syhc.dev',
            'http://localhost:3000',
            'https://kortix.com',
            'https://www.kortix.com',
        ];

        if (!allowedOrigins.includes(event.origin)) {
            return;
        }

        const data = event.data as KortixTokenMessage;

        if (data.type === 'KORTIX_BROWSER_TOKEN' && data.token) {
            console.log('[Kortix Extension - Bridge] Received browser token');

            try {
                // Send token to background script
                const response = await chrome.runtime.sendMessage({
                    type: 'connect',
                    token: data.token,
                });

                if (response.success) {
                    console.log('[Kortix Extension - Bridge] Token sent to background, connecting...');

                    // Notify page of success
                    window.postMessage({
                        type: 'KORTIX_EXTENSION_CONNECTED',
                        success: true,
                    }, event.origin);
                } else {
                    console.error('[Kortix Extension - Bridge] Connection failed:', response.error);

                    window.postMessage({
                        type: 'KORTIX_EXTENSION_CONNECTED',
                        success: false,
                        error: response.error,
                    }, event.origin);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';

                // Check for context invalidation
                if (errorMsg.includes('Extension context invalidated') || !isExtensionContextValid()) {
                    notifyRefreshRequired(event.origin);
                    return;
                }

                console.error('[Kortix Extension - Bridge] Error sending token:', error);

                window.postMessage({
                    type: 'KORTIX_EXTENSION_CONNECTED',
                    success: false,
                    error: errorMsg,
                }, event.origin);
            }
        }

        // Handle status request from page
        if ((event.data as { type?: string }).type === 'KORTIX_CHECK_EXTENSION') {
            const status = await getExtensionStatus();
            window.postMessage(status, event.origin);
        }

        // Handle disconnect request from page
        if ((event.data as { type?: string }).type === 'KORTIX_DISCONNECT_EXTENSION') {
            console.log('[Kortix Extension - Bridge] Received disconnect request');

            try {
                // Send disconnect command to background script
                const response = await chrome.runtime.sendMessage({ type: 'disconnect' });

                if (response.success) {
                    console.log('[Kortix Extension - Bridge] Disconnected successfully');

                    // Notify page of disconnection
                    window.postMessage({
                        type: 'KORTIX_EXTENSION_DISCONNECTED',
                        success: true,
                    }, event.origin);
                } else {
                    console.error('[Kortix Extension - Bridge] Disconnect failed:', response.error);

                    // Still notify page so it can proceed
                    window.postMessage({
                        type: 'KORTIX_EXTENSION_DISCONNECTED',
                        success: false,
                        error: response.error,
                    }, event.origin);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';

                // Check for context invalidation
                if (errorMsg.includes('Extension context invalidated') || !isExtensionContextValid()) {
                    notifyRefreshRequired(event.origin);
                    return;
                }

                console.error('[Kortix Extension - Bridge] Error disconnecting:', error);

                // Still notify page so it can proceed
                window.postMessage({
                    type: 'KORTIX_EXTENSION_DISCONNECTED',
                    success: false,
                    error: errorMsg,
                }, event.origin);
            }
        }
    });
}

/**
 * Get current extension status
 */
async function getExtensionStatus(): Promise<KortixStatusMessage> {
    // Check if extension context is still valid first
    if (!isExtensionContextValid()) {
        return {
            type: 'KORTIX_EXTENSION_STATUS',
            installed: true,
            connected: false,
            extensionId: null,
            needsRefresh: true,
        } as KortixStatusMessage & { needsRefresh: boolean };
    }

    try {
        const response = await chrome.runtime.sendMessage({ type: 'getStatus' });

        return {
            type: 'KORTIX_EXTENSION_STATUS',
            installed: true,
            connected: response.isConnected,
            extensionId: response.extensionId,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '';

        // Check for context invalidation
        if (errorMsg.includes('Extension context invalidated')) {
            return {
                type: 'KORTIX_EXTENSION_STATUS',
                installed: true,
                connected: false,
                extensionId: null,
                needsRefresh: true,
            } as KortixStatusMessage & { needsRefresh: boolean };
        }

        return {
            type: 'KORTIX_EXTENSION_STATUS',
            installed: true,
            connected: false,
            extensionId: null,
        };
    }
}

/**
 * Announce extension presence on page load
 */
function announcePresence(): void {
    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            sendPresenceAnnouncement();
        });
    } else {
        sendPresenceAnnouncement();
    }
}

async function sendPresenceAnnouncement(): Promise<void> {
    const status = await getExtensionStatus();

    // Post to page so it knows extension is installed
    window.postMessage(status, '*');

    console.log('[Kortix Extension - Bridge] Announced presence to page');
}

// ========== Initialize ==========

// Immediate debug log - this runs as soon as script loads
console.log('[Kortix Extension - Bridge] Content script loaded on:', window.location.href);

// Check if we're on a Kortix page
const config = getConfig();
const isKortixPage =
    window.location.hostname === 'localhost' ||
    window.location.hostname === 'suna.syhc.dev' ||
    window.location.hostname === 'kortix.com' ||
    window.location.hostname.endsWith('.kortix.com') ||
    window.location.hostname.endsWith('.syhc.dev');

console.log('[Kortix Extension - Bridge] isKortixPage:', isKortixPage, 'hostname:', window.location.hostname);

if (isKortixPage) {
    console.log('[Kortix Extension - Bridge] Running on Kortix page - setting up listeners');
    setupTokenListener();
    announcePresence();
} else {
    console.log('[Kortix Extension - Bridge] Not a Kortix page, skipping setup');
}

// No exports - content scripts can't use ES modules
