# Specification: Dynamic MCP OAuth & Advanced Configuration

## 1. Overview
This feature enables Suna Kortix to integrate with **advanced Model Context Protocol (MCP) servers** that require authentication (OAuth 2.1) or custom configuration (User-Defined Headers). This specifically targets servers like "Desktop Commander" which use the standard MCP OAuth handshake.

## 2. Requirements

### 2.1 Backend Architecture

#### 2.1.1 Data Models & Configuration
*   **MCP Configuration Extension**:
    *   The backend's `mcp_module` must support new configuration fields within the existing flexible `config` JSON payload:
        *   `oauth_client_id` (Optional[str]): Manual override for OAuth Client ID.
        *   `oauth_client_secret` (Optional[str]): Manual override for OAuth Client Secret.
        *   `custom_headers` (Optional[Dict[str, str]]): User-defined key-value headers to be injected into every request.

#### 2.1.2 New API Endpoints (`/v1/mcp/`)
Two new endpoints will be added to `backend/core/mcp_module/api.py` to handle the OAuth handshake logic. This placement segregates the *dynamic protocol logic* from the static credential storage.

1.  **`GET /v1/mcp/auth/start`**
    *   **Purpose**: Initiates the OAuth handshake.
    *   **Parameters**: 
        *   `url`: The base URL of the MCP server (e.g., `https://mcp.desktopcommander.app`).
        *   `return_url`: The frontend URL to redirect the user back to upon completion.
    *   **Logic**:
        *   Discover metadata at `url/.well-known/oauth-authorization-server` (RFC 8414).
        *   Perform Dynamic Client Registration (DCR) if the server supports it and no manual `client_id` is provided.
        *   Generate a secure `state` parameter (binding the user session and return URL).
        *   Construct the Authorization URL.
    *   **Response**: `302 Redirect` to the MCP Server's authorization page.

2.  **`GET /v1/mcp/auth/callback`**
    *   **Purpose**: Handles the return redirect from the MCP Provider.
    *   **Parameters**: `code`, `state`.
    *   **Logic**:
        *   Validate the `state` parameter to prevent CSRF.
        *   Exchange the `code` for an `access_token` and `refresh_token` using the discovered Token Endpoint.
        *   **Secure Storage**: Encrypt and store these tokens in the `user_mcp_credentials` table via the `CredentialService`.
    *   **Response**: `302 Redirect` to the Frontend `return_url` (e.g., `https://suna.syhc.dev/settings/mcp?status=success`).

#### 2.1.3 Updates to Existing Logic
*   **Discovery (`POST /v1/mcp/discover-custom-tools`)**:
    *   Updated to parse and utilize `oauth_client_id`, `oauth_client_secret`, and `custom_headers` from the input config.
    *   If `custom_headers` are present, they must be injected into the discovery HTTP request.
*   **Connection Service (`MCPService`)**:
    *   **Interceptor**: When establishing a connection (HTTP/SSE), checks for stored OAuth tokens or custom headers.
    *   **Header Injection**: Injects `Authorization: Bearer <token>` or custom headers into the underlying transport client (`streamablehttp_client` or `httpx`).

### 2.2 Frontend UX

#### 2.2.1 "Add MCP Server" Modal
*   **Advanced Settings Dropdown**:
    *   A collapsed section titled "Advanced Settings".
*   **OAuth Fields**:
    *   Start empty (auto-discovery favored).
    *   Allow manual entry of "Client ID" and "Client Secret".
*   **Custom Headers Editor**:
    *   Dynamic list of Key-Value pairs.
    *   Rows can be added (`+`) or removed (`🗑️`).
    *   Validates non-empty keys.

#### 2.2.2 Connection Flow
*   When a user adds a server that requires authentication (detected via `401 Unauthorized` or specific metadata):
    *   The UI displays a **"Connect with [Provider]"** button.
    *   Clicking "Connect" triggers the browser navigation to `/v1/mcp/auth/start`.

## 3. Technical Constraints & Standards
*   **RFC 8414 (OAuth Metadata)**: Primary discovery mechanism.
*   **RFC 7591 (Dynamic Client Registration)**: Preferred client registration method.
*   **Security**:
    *   `client_secret` and access tokens **must** be encrypted at rest (`user_mcp_credentials`).
    *   State parameter **must** be cryptographically secure to prevent CSRF.
    *   Callback URL must be strictly validated against the backend's configured public URL.

## 4. Success Criteria
1.  **Manual Config**: User can manually add headers (e.g., `X-Custom-Auth: 123`) and have them sent to the MCP server.
2.  **OAuth Logic**: The backend correctly discovers endpoints from `/.well-known/oauth-authorization-server` and performs the code exchange.
3.  **End-to-End**: A user can successfully connect "Desktop Commander", authorize in the browser, and return to Suna with a working tool connection.
