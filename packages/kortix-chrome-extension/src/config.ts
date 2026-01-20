/**
 * Kortix Extension Configuration
 * 
 * Centralized configuration for WebSocket URLs and other settings.
 */

export interface KortixConfig {
    apiUrl: string;
    wsUrl: string;
    frontendUrl: string;
}

/**
 * Get configuration based on environment
 */
export function getConfig(): KortixConfig {
    // Check for stored custom config first
    // This would be set during extension setup/login

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
 * Get the connect-browser URL for authentication
 */
export function getConnectBrowserUrl(): string {
    const config = getConfig();
    return `${config.frontendUrl}/connect-browser`;
}
