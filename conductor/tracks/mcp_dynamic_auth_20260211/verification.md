# Manual Verification Plan: Custom MCP OAuth & Advanced Config

## Prerequisites
- Suna Kortix running (`backend` and `frontend`).
- Access to a Custom MCP Server implementation that supports OAuth (or a mock).
- Alternatively, use a service like `httpbin.org` (limited) or a simple local python script to simulate the OAuth endpoints.

## Test Case 1: Manual Header Injection
1. Navigate to **Connectors** (previously App Integrations).
2. Click **Add Custom MCP**.
3. Expand **Advanced Settings**.
4. Add a custom header: `X-Custom-Test: Verified`.
5. Enter a valid MCP SSE URL (e.g., a local debug server).
6. Click **Connect**.
7. **Verify Backend Logs**: Ensure the `X-Custom-Test` header is present in the outgoing request from Suna to the MCP Server.

## Test Case 2: OAuth Flow Initiation (Smart Detection)
1. Navigate to **Connectors** > **Add Custom MCP**.
2. Enter the URL of an MCP server that returns `401 Unauthorized` or `{ "message": "authentication required" }` on the initial discovery endpoint.
3. Click **Connect**.
4. **Expected Behavior**:
    - The UI should log "Discovery failed with Auth error...".
    - The browser should automatically redirect to `/v1/mcp/auth/start?url=...`.
    - The backend should initiate the OAuth flow (discover metadata, generate state).
    - You should be redirected to the OAuth Provider's login page (if configured correctly).

## Test Case 3: Manual OAuth Configuration
1. Navigate to **Connectors** > **Add Custom MCP**.
2. Expand **Advanced Settings**.
3. Enter `Client ID` and `Client Secret`.
4. (Optional) Provide the Token Endpoint in metadata or rely on auto-discovery if implemented.
5. Click **Connect**.
6. **Verify**:
    - The discovery request includes `oauth_client_id` in the payload (if relevant to your custom probing logic).
    - If you initiate the OAuth flow manually (via a future UI enhancement or by triggering the error condition), these credentials should be used.

## Test Case 4: Custom MCP List
1. Successfully add a Custom MCP server (even a dummy one).
2. Close the dialog.
3. Verify that the **Custom MCP Servers** section appears in the **Connectors** page.
4. Verify your new server lists its name (or URL) and enabled tools count.
