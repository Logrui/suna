# Overview: MCP Dynamic Auth & Advanced Configuration

This track implements robust support for **Model Context Protocol (MCP)** servers that require authentication (OAuth 2.1) or custom configuration (User-Defined Headers). This specifically targets servers like "Desktop Commander" which use the standard MCP OAuth handshake.

## 1. Core Features

### 1.1 Backend Authentication Flow (`backend/core/mcp_module`)
*   **Discovery**: The system will automatically probe `/.well-known/oauth-authorization-server` to discover endpoints.
*   **Dynamic Client Registration (DCR)**: Attempts to register itself as a client if supported.
*   **Standard OAuth 2.1**: Supports Authorization Code Grant with PKCE.
*   **Secure Token Storage**: Encrypts and stores access/refresh tokens in the `user_mcp_credentials` database table.

### 1.2 Frontend Configuration (`apps/frontend/src/components/agents/mcp`)
*   **Advanced Settings Dropdown**:
    *   **Manual OAuth Config**: Optional fields for `Client ID` and `Client Secret`.
    *   **Custom Headers**: Dynamic list of Key-Value pairs for custom headers (e.g., `X-Api-Key`).
*   **"Connect" Workflow**:
    *   Servers requiring auth display a "Connect" button that initiates the OAuth redirect flow.

## 2. Architecture

### 2.1 Endpoints
*   `GET /v1/mcp/auth/start`: Initiates the OAuth handshake.
*   `GET /v1/mcp/auth/callback`: Handles the redirect from the provider, exchanges code for tokens, and stores them securely.
*   `POST /v1/mcp/discover-custom-tools`: Updated to utilize stored OAuth tokens or injected custom headers.

### 2.2 Data Flow
1.  **Frontend**: User provides MCP URL (e.g., `https://mcp.desktopcommander.app`) + Optional Config.
2.  **Backend**: Probes metadata. If auth is needed, returns a specialized response or prompt.
3.  **Frontend**: User clicks "Connect". Browser navigates to `/v1/mcp/auth/start`.
4.  **Backend**: Redirects to Provider (`/authorize`).
5.  **Provider**: User approves. Redirects back to `/v1/mcp/auth/callback`.
6.  **Backend**: Exchanges code → token. Encrypts token.redirects user back to Frontend.
7.  **Backend**: Subsequent tool calls automatically inject `Authorization: Bearer <token>`.

## 3. Implementation Status
*   **Phase 1 (Backend Infrastructure)**: [ ]
*   **Phase 2 (OAuth Handshake)**: [ ]
*   **Phase 3 (Frontend UI)**: [ ]
*   **Phase 4 (Integration)**: [ ]

## 4. References
*   [Model Context Protocol (MCP) Website](https://modelcontextprotocol.io)
*   [RFC 8414 (OAuth 2.0 Authorization Server Metadata)](https://datatracker.ietf.org/doc/html/rfc8414)
*   [RFC 7591 (OAuth 2.0 Dynamic Client Registration)](https://datatracker.ietf.org/doc/html/rfc7591)
