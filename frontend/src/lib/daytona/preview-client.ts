/**
 * Daytona Preview Client
 *
 * Provides direct URLs to Daytona preview services (VNC, web apps)
 * Bypasses Next.js HTTP proxy for WebSocket connections
 *
 * Pattern: Similar to realtime-client.ts
 * - Connects directly to Daytona preview URLs
 * - Bypasses Next.js rewrites (which don't support WebSocket)
 * - Uses Daytona's native authentication (token + password)
 */

export interface DaytonaSandbox {
  id: string;
  pass: string;
  token?: string;
}

/**
 * Get direct Daytona VNC URL (port 6080)
 *
 * Returns: https://6080-{sandbox-id}.proxy.daytona.works/
 *
 * This URL bypasses the backend proxy and Next.js rewrites entirely,
 * connecting directly to Daytona's VNC service.
 *
 * @param sandbox - Sandbox object with id, pass, and optional token
 * @returns Direct Daytona VNC base URL
 */
export function getDaytonaVncUrl(sandbox: DaytonaSandbox): string {
  return `https://6080-${sandbox.id}.proxy.daytona.works/`;
}

/**
 * Get direct Daytona web preview URL (port 8080)
 *
 * Returns: https://8080-{sandbox-id}.proxy.daytona.works/
 *
 * @param sandbox - Sandbox object with id
 * @returns Direct Daytona web preview base URL
 */
export function getDaytonaWebUrl(sandbox: DaytonaSandbox): string {
  return `https://8080-${sandbox.id}.proxy.daytona.works/`;
}

/**
 * Get direct Daytona URL for any port
 *
 * Returns: https://{port}-{sandbox-id}.proxy.daytona.works/
 *
 * @param sandbox - Sandbox object with id
 * @param port - Port number (e.g., 3000, 5000, 8080)
 * @returns Direct Daytona URL for specified port
 */
export function getDaytonaPortUrl(sandbox: DaytonaSandbox, port: number): string {
  return `https://${port}-${sandbox.id}.proxy.daytona.works/`;
}

/**
 * Construct complete VNC URL with noVNC parameters
 *
 * This is the full URL to load in the iframe. It includes:
 * - VNC password for authentication
 * - Daytona token (if available)
 * - noVNC configuration (autoconnect, scale)
 * - WebSocket path (relative, so noVNC connects to same origin)
 *
 * WebSocket connection will be:
 * wss://6080-{sandbox-id}.proxy.daytona.works/websockify
 *
 * @param sandbox - Sandbox object with id, pass, and optional token
 * @returns Complete vnc_lite.html URL with query parameters
 *
 * @example
 * const vncUrl = getVncLiteUrl({ id: '123', pass: 'abc', token: 'xyz' });
 * // Returns: https://6080-123.proxy.daytona.works/vnc_lite.html?password=abc&autoconnect=true&scale=local&path=websockify&token=xyz
 */
export function getVncLiteUrl(sandbox: DaytonaSandbox): string {
  const baseUrl = getDaytonaVncUrl(sandbox);

  const params = new URLSearchParams({
    password: sandbox.pass,
    autoconnect: 'true',
    scale: 'local',
    path: 'websockify', // Relative path - noVNC will connect to same-origin WebSocket
  });

  // Add Daytona token if available (for authentication)
  if (sandbox.token) {
    params.set('token', sandbox.token);
  }

  return `${baseUrl}vnc_lite.html?${params.toString()}`;
}

/**
 * Get WebSocket URL that noVNC will connect to
 *
 * This is for logging/debugging purposes only.
 * The actual WebSocket connection is established by noVNC client.
 *
 * @param sandbox - Sandbox object with id
 * @returns WebSocket URL for VNC connection
 *
 * @example
 * const wsUrl = getVncWebSocketUrl({ id: '123', pass: 'abc' });
 * // Returns: wss://6080-123.proxy.daytona.works/websockify
 */
export function getVncWebSocketUrl(sandbox: DaytonaSandbox): string {
  return `wss://6080-${sandbox.id}.proxy.daytona.works/websockify`;
}
