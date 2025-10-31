/**
 * Get the correct API URL based on execution context
 *
 * Browser (client-side):
 *   - Uses window.location.origin + '/api'
 *   - Results in relative URLs like: /api/agents
 *   - Next.js middleware rewrites these to backend
 *
 * Server (SSR/middleware/API routes):
 *   - Uses environment variable for Docker internal communication
 *   - Direct Docker communication: http://backend:8000/api
 *
 * This ensures:
 * 1. Browser never tries to access Docker internal hostnames
 * 2. Server-side code can communicate with backend via Docker network
 * 3. Works on both localhost and Cloudflare Tunnel deployments
 */

declare const process: {
  env: {
    NEXT_PUBLIC_BACKEND_URL?: string;
  };
};

export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser context: use relative URL
    // Next.js will proxy /api requests to the backend
    return `${window.location.origin}/api`;
  }

  // Server context: use environment variable for Docker internal communication
  // This is used for SSR, API routes, and server-side logic
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return process.env.NEXT_PUBLIC_BACKEND_URL! || 'http://backend:8000/api';
};
