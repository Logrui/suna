# Specification: 2-Stage Custom MCP Integration & OAuth Refinement

## 1. Overview
This track aims to refine the "Custom MCP Server" integration flow by splitting it into two distinct stages: **Registration** and **Configuration**. This minimizes the complexity of the initial "Add Server" step and provides a more robust, agent-centric management experience.

## 2. Problem Statement
- **Tight Coupling**: The current "Add MCP Server" dialog tries to handle discovery, authentication (OAuth), and tool selection in one go. If any part fails (common with OAuth timeouts or state loss), the entire process must be restarted.
- **Agent ID Loss**: The `agent_id` is frequently lost during the OAuth handshake, resulting in "No agent_id provided or found for association" errors.
- **UI Inconsistency**: Custom MCP servers lack a premium, dedicated management card similar to the Composio app cards.
- **Worker Configuration Sync**: Saving linked MCPs directly to the worker configuration requires a structured, multi-step persistence logic that handles unconfigured states.

## 3. Scope & Requirements

### A. Stage 1: Registration (The "Add" Phase)
- **Modal Simplification**: The `CustomMCPDialog` will now only be responsible for capturing the **Server URL** and **Display Name**.
- **Agent-Specific Persistence**: The server configuration is saved directly into the `config` blob of the current agent version. It is **not** global (Registry Model B).
- **Optimistic Discovery**: Upon adding the URL, the backend will attempt a proactive tool discovery (Proactive Discovery B).
    - If successful (public tools), they are cached.
    - If 401/Unauthorized, the server is saved with 0 tools and marked as `requires_config: true`.

### B. Stage 2: Configuration (The "Configure" Phase)
- **Inline "Configure" Button**: A new `CustomMCPCard` will display a prominent "Configure" button if the server requires OAuth or credentials (Inline Placement A).
- **Confirmation Flow**: Clicking "Configure" opens a summary dialog explaining the upcoming redirect (Confirmation B), preventing jarring automatic redirects.
- **OAuth Resilience**: High-priority fix for the `agent_id` state passing to ensure auto-linking works 100% of the time.

### C. Components to Build
- **`CustomMCPCard.tsx`**: A premium card component (modeled after `ComposioAppCard`) showing the server name, URL, and status (Connected vs. Configuration Required).
- **`CustomMCPToolsSelector.tsx`**: A specialized tool selection interface for custom servers (modeled after `ComposioToolsSelector`).
- **`CustomMCPToolsManager.tsx`**: A wrapper dialog for the selector.

## 4. Technical Constraints
- **State Management**: Use the OAuth `state` parameter and URL fallbacks to ensure `agent_id` persistence.
- **Design System**: Follow OKLCH color system and "Premium Card" patterns defined in `GEMINI.md`.
- **Backend API**: The `mcp/auth/callback` must be updated to handle the `requires_config` state and trigger cache invalidation for the correct agent.

## 5. Success Criteria
1. User can add a Custom MCP server (URL/Name) without immediate redirect.
2. The server appears on the Integrations screen as "Configuration Required".
3. Clicking "Configure" successfully completes the OAuth flow and returns the user to the dashboard/config page with a success toast.
4. The `agent_id` is correctly identified and the new server tools are auto-linked to the agent.
