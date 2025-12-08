/**
 * Daytona Preview Client
 *
 * Provides URLs to Daytona preview services (VNC, web apps)
 * routing via the Suna Backend Proxy to inject the skip-warning header.
 *
 * Architecture: Frontend -> Backend Proxy (Direct) -> Daytona
 * Reason: Direct connection shows warning. Next.js proxying fails for WebSocket.
 */

export interface DaytonaSandbox {
    id: string;
    pass: string;
    token?: string;
    // Fallback for legacy types
    vnc_preview?: string;
}

/**
 * Get Suna Backend URL directly (bypassing Next.js)
 */
function getDirectBackendBaseUrl(): string {
    if (typeof window === 'undefined') return 'http://localhost:8000';

    const hostname = window.location.hostname;
    return `${window.location.protocol}//${hostname}:8000`;
}

/**
 * Get Backend Proxy VNC URL (port 6080)
 * Returns: {BACKEND_URL}/api/sandboxes/{id}/proxy/6080/
 */
export function getDaytonaVncUrl(sandbox: DaytonaSandbox): string {
    const backend = getDirectBackendBaseUrl();
    return `${backend}/api/sandboxes/${sandbox.id}/proxy/6080/`;
}

/**
 * Get Backend Proxy web preview URL (port 8080)
 */
export function getDaytonaWebUrl(sandbox: DaytonaSandbox): string {
    const backend = getDirectBackendBaseUrl();
    return `${backend}/api/sandboxes/${sandbox.id}/proxy/8080/`;
}

/**
 * Get Backend Proxy URL for any port
 */
export function getDaytonaPortUrl(sandbox: DaytonaSandbox, port: number): string {
    const backend = getDirectBackendBaseUrl();
    return `${backend}/api/sandboxes/${sandbox.id}/proxy/${port}/`;
}

/**
 * Construct complete VNC URL with noVNC parameters
 * This is the full URL to load in the iframe
 */
export function getVncLiteUrl(sandbox: DaytonaSandbox): string {
    const baseUrl = getDaytonaVncUrl(sandbox);

    const params = new URLSearchParams({
        password: sandbox.pass,
        autoconnect: 'true',
        scale: 'local',
        path: 'websockify',  // Relative path that api.py will see and forward
    });

    // Add token if available (Backend Proxy authentication & Daytona token)
    if (sandbox.token) {
        params.set('token', sandbox.token);
    }

    return `${baseUrl}vnc_lite.html?${params.toString()}`;
}

/**
 * Get WebSocket URL that noVNC will connect to
 * (For logging/debugging purposes)
 */
export function getVncWebSocketUrl(sandbox: DaytonaSandbox): string {
    const backend = getDirectBackendBaseUrl();
    // Replace http/https with ws/wss
    const wsBase = backend.replace(/^http/, 'ws');
    return `${wsBase}/api/sandboxes/${sandbox.id}/proxy/6080/websockify`;
}
