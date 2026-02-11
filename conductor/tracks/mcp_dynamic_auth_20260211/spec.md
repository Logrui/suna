# Specification: Dynamic MCP OAuth & Advanced Configuration

## 1. Overview
Enable Kortix to support advanced Model Context Protocol (MCP) servers that require authentication (OAuth 2.1) or custom configuration (Headers). This addresses the "No tools found" error when adding servers like Desktop Commander.

## 2. Requirements

### 2.1 Backend
- **Standardized OAuth Flow**: 
    - Implement `/v1/mcp/auth/start` and `/v1/mcp/auth/callback`.
    - Support **RFC 8414** for metadata discovery (`/.well-known/oauth-authorization-server`).
    - Support **RFC 7591** for Dynamic Client Registration (DCR) if supported by the server.
    - Default to standard OAuth 2.1 Proof Key for Code Exchange (PKCE) if possible, or fallback to provided Client Secret.
- **Custom Configuration Storage**:
    - Update database schema (or JSON config storage) to include:
        - `oauth_client_id` (optional)
        - `oauth_client_secret` (optional)
        - `custom_headers` (key-value pairs)
- **Request Interceptor**:
    - Ensure all outgoing requests to a specific MCP server include the configured custom headers and valid OAuth bearer tokens.

### 2.2 Frontend
- **Enhanced "Add MCP Server" Modal**:
    - Add a collapsed **"Advanced Settings"** dropdown.
    - **OAuth Configuration**:
        - Input for `OAuth Client ID (optional)`.
        - Input for `OAuth Client Secret (optional)`.
    - **Header Configuration**:
        - Dynamic list of input pairs for `Header Name` and `Header Value`.
        - `+ Add Custom Header` button to add new rows.
        - Delete icon for each row.
- **Connection Workflow**:
    - If a server requires auth (returns 401 or has OAuth config), show a **"Connect"** button after initial adding.
    - Clicking "Connect" initiates the redirection flow to the external server.

## 3. Technical Details

### 3.1 Handshake Flow (Desktop Commander Example)
1. User enters URL: `https://mcp.desktopcommander.app/mcp`.
2. Backend probes `/.well-known/oauth-authorization-server`.
3. Backend discovers `authorize`, `token`, and `register` endpoints.
4. If `register` exists and no Client ID is provided, backend performs DCR.
5. Frontend shows "Connect" button.
6. User clicks "Connect" -> Redirect to Backend `/auth/start` -> Redirect to Server `/authorize`.
7. User approves -> Redirect back to Suna `/auth/callback` -> Backend exchanges code for token.

## 4. Success Criteria
- [ ] Users can add Desktop Commander via the "Add MCP Server" modal.
- [ ] Users can manually configure custom headers for a server.
- [ ] Users can manually provide OAuth Client ID/Secret.
- [ ] Successful redirection and token exchange flow.
