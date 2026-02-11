# Implementation Plan: Dynamic MCP OAuth & Advanced Configuration

## Phase 1: Infrastructure & Data Model
- [ ] **Task 1.1**: Update MCP configuration models (Database or Pydantic) in the backend to store `oauth_client_id`, `oauth_client_secret`, and `custom_headers`.
- [ ] **Task 1.2**: Update `CustomMCPConnectionResult` and related schemas to propagate these fields.
- [ ] **Task 1.3**: Add logic to `MCPService` to inject custom headers into outgoing `streamablehttp_client` requests.

## Phase 2: OAuth Backend Implementation
- [ ] **Task 2.1**: Implement metadata discovery service for `/.well-known/oauth-authorization-server`.
- [ ] **Task 2.2**: Implement Dynamic Client Registration (DCR) helper.
- [ ] **Task 2.3**: Create FastAPI endpoints:
    - `POST /mcp/auth/start`: Initiates the OAuth flow.
    - `GET /mcp/auth/callback`: Handles the redirect and token exchange.
- [ ] **Task 2.4**: Implement Token Management (Secure storage of access/refresh tokens pinned to the MCP server configuration).

## Phase 3: Frontend UI Enhancements
- [ ] **Task 3.1**: Modify `CustomMCPDialog.tsx` to include the "Advanced Settings" accordion.
- [ ] **Task 3.2**: Implement the custom header list component (dynamic rows).
- [ ] **Task 3.3**: Add inputs for OAuth Client ID and Secret.
- [ ] **Task 3.4**: Integrate the "Connect" button logic and handle the redirect state.

## Phase 4: Integration & Refinement
- [ ] **Task 4.1**: Test the end-to-end flow with Desktop Commander.
- [ ] **Task 4.2**: Verify that static headers are correctly applied during discovery and execution.
- [ ] **Task 4.3**: Polishing: Improved error messages for failed handshakes.

## Phase 5: Documentation & Cleanup
- [ ] **Task 5.1**: Add a technical guide for adding custom MCP servers with auth.
- [ ] **Task 5.2**: Update the project README if necessary.
