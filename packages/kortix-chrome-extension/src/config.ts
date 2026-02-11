/**
 * Kortix Extension Configuration
 * 
 * Centralized configuration for WebSocket URLs and other settings.
 */

import { ENV, getApiUrl, getWsUrl } from './env';

export interface KortixConfig {
    apiUrl: string;
    wsUrl: string;
    frontendUrl: string;
}

/**
 * Get configuration based on environment
 */
export function getConfig(): KortixConfig {
    return {
        apiUrl: getApiUrl(),
        wsUrl: getWsUrl(),
        frontendUrl: ENV.FRONTEND_URL,
    };
}

/**
 * Get the connect-browser URL for authentication
 */
export function getConnectBrowserUrl(): string {
    const config = getConfig();
    return `${config.frontendUrl}/connect-browser`;
}
