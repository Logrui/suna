# Implementation Plan: Dynamic MCP OAuth & Advanced Configuration

This plan outlines the steps to implement the "Dynamic MCP OAuth & Advanced Configuration" feature in Suna Kortix.

## Phase 1: Backend Infrastructure & Discovery Services
- [x] **Task 1.1**: Update `CustomMCPConnectionRequest` in `backend/core/mcp_module/api.py` to include `oauth_client_id`, `oauth_client_secret`, and `custom_headers`.
- [x] **Task 1.2**: Implement strict header validation in `CustomMCPDiscoverRequest`.
- [x] **Task 1.3**: Extend `MCPService` (`mcp_service.py`) and `_connect_server_internal` to parse and store custom headers from the `config` dictionary.

## Phase 2: OAuth Handshake (New Endpoints)
- [x] **Task 2.1**: Implement `GET /v1/mcp/auth/start` endpoint in `backend/core/mcp_module/api.py`.
    - [x] Create `MCPAuthService.py` or modify `MCPService.py` for metadata discovery (`/.well-known/oauth-authorization-server`) and state generation.
    - [x] Implement Dynamic Client Registration logic (optional fallback if configured).
- [x] **Task 2.2**: Implement `GET /v1/mcp/auth/callback` endpoint in `backend/core/mcp_module/api.py`.
    - [x] Handle code exchange with the detected token endpoint.
    - [x] Call `CredentialService.store_credential` to securely encrypt and save the token/headers.

## Phase 3: Frontend Integration
- [ ] **Task 3.1**: Modify `apps/frontend/src/components/agents/mcp/custom-mcp-dialog.tsx`:
    - [ ] Add the "Advanced Settings" collapsed panel.
    - [ ] Add Form Inputs for `oauth_client_id` and `oauth_client_secret`.
    - [ ] Implement a dynamic list component for Custom Headers (`Key` + `Value` + `Delete` button).
    - [ ] Validate non-empty keys before submission.
- [ ] **Task 3.2**: Implement the "Connect" button flow.
    - [ ] Update `useCustomMCPTools` hook to detect authorization-required states (e.g., failed discovery with 401).
    - [ ] Create a handler to trigger `window.location.href = backendUrl + '/v1/mcp/auth/start?url=' + mcpUrl + '&return_url=' + window.location.href`.

## Phase 4: Integration Testing & Docs
- [ ] **Task 4.1**: Create a local test MCP server (or mock) that requires specific headers.
    - [ ] Verify manual header injection works.
- [ ] **Task 4.2**: Test with "Desktop Commander" (production environment).
    - [ ] Verify the OAuth redirect loop completes successfully.
    - [ ] Verify tokens are stored encrypted in DB.
- [ ] **Task 4.3**: Add backend documentation (OpenAPI updates) and user guide.

## Phase 5: Refinement
- [ ] **Task 5.1**: Ensure error handling for timeouts or unreachable OAuth metadata endpoints is user-friendly.
- [ ] **Task 5.2**: Clean up logging (remove sensitive tokens from logs).
