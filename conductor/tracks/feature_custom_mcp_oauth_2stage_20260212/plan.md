# Implementation Plan: 2-Stage Custom MCP Integration

## Phase 1: Registration UI & Component Scaffolding ✅
Focus on simplifying the addition process and creating the new card architecture.

- [x] **Task 1: Scuffold `CustomMCPCard.tsx`**
    - Created native premium card component.
- [x] **Task 2: Simplify `CustomMCPDialog.tsx`**
    - Removed the multi-step "Select Tools" flow from the initial addition dialog.
    - Updated to capture Name and URL.
    - Triggers `save` action adding the server with `requires_config: true` if auth needed.
- [x] **Task 3: Create `CustomMCPToolsSelector.tsx`**
    - Ported logic from `ComposioToolsSelector.tsx` for custom MCP tool lists.
- [x] **Task 4: Create `CustomMCPToolsManager.tsx`**
    - Implemented the dialog wrapper for the selector.
    - Added logic to fetch tools from backend for already-connected custom server.

## Phase 2: Auth Resilience & Backend Probing ✅
Ensure the `agent_id` is never lost and the backend proactively identifies tools.

- [x] **Task 5: Robust `agent_id` Persistence**
    - Updated `mcp_auth_service.py` to handle `agent_id` in state.
    - Updated `mcp_auth_callback` in `api.py` to prioritize `agent_id` from state and fallback to URL parsing.
- [x] **Task 6: Optimistic Discovery API**
    - Added `requires_auth` flag to tool discovery response.
    - If discovery returns 401, returns success response with `requires_auth: true`.
- [ ] **Task 7: Confirmation Flow UI**
    - [ ] Create a small confirmation modal `CustomMCPAuthConfirmation` that alerts the user about the upcoming redirect.

## Phase 3: Integration & Wiring ✅
Bring all components together in the main Integrations screen.

- [x] **Task 8: Update `MCPConfigurationNew.tsx`**
    - Uses `ConfiguredMcpList` in the list of configured MCPs.
    - Wired "Configure" button to trigger OAuth start flow.
    - Wired "Manage Tools" button to `CustomMCPToolsManager`.
- [x] **Task 9: Success Redirect Handler**
    - Redirects back to agent config page and triggers success toast.

## Phase 4: Verification & Polish
- [ ] **Verification 1: Manual E2E Walkthrough**
    - Add DesktopCommander (URL/Name).
    - Verify card appears with "Configure".
    - Click "Configure" -> Confirm -> OAuth Complete.
    - Verify redirect back to config page and successful tool association.
- [ ] **Verification 2: UI Polish**
    - Ensure OKLCH colors and premium animations are consistent.
    - Check mobile responsiveness of the new card.
