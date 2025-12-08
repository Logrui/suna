# Portkit - Feature Specification: Kortix Computer v2 from Remote Repository Upstream PRODUCTION

**Feature Branch**: `kortix-computer-v2`  
**Created**: 2025-12-08  
**Status**: Draft  
**Input**: User description: "I want to port and continue porting the new Kortix Computer feature from upstream/PRODUCTION. I dont want any billing features to be ported, translation features, or anything that overrides my current slash commands features or any existing ported features"

## 1. Port Scope (The "Target")
**What are we pulling?**
*   **Upstream Entry Points**: `[NEEDS CLARIFICATION]` (Likely `backend/core/sandbox/*`, `frontend/src/components/Sandbox/*` - to be confirmed in Research phase)
*   **Feature Description**: Port the latest "computer use" / sandbox capabilities from the upstream PRODUCTION branch, enabling the agent to interact with a virtual desktop/environment.

## 2. Adaptation Strategy (The "Bridge")
We are not just copying files; we are adapting them to our **Local Architecture**.

### A. Core Logic (Keep 1:1)
*   Sandbox orchestration logic.
*   Computer interaction tools (screenshot, mouse, keyboard).
*   Live stream viewing components.

### B. Bridge Adapters (Morph/Replace)
**Upstream Dependency** -> **Local Replacement**
*   `Upstream Billing/Credits` -> `[Omitted/Mocked]` (Strict Requirement: No Billing)
*   `Upstream Auth` -> `Local Auth (Supabase/Basejump)`
*   `Translations (next-intl)` -> `[Omitted]` (Use raw strings)

### C. Omissions (Nuke)
**Intentionally excluded components:**
*   **Billing Features**: Any code charging for computer use minutes.
*   **Translations**: `next-intl` or similar localization overhead.
*   **Slash Commands Overwrites**: Explicitly identifying and PRESERVING local slash command implementations if upstream attempts to modify `Thread` or `CommandParser` logic.

## 3. Verification Scenarios (The "Proof")
After the port is complete, these scenarios must pass locally.

### Scenario 1: Launch Computer
*   **Given**: User is in a "Computer Use" enabled agent thread.
*   **When**: User asks "Open the browser".
*   **Then**: The agent successfully launches a Daytona sandbox (or equivalent) and connects.

### Scenario 2: Visual Feedback
*   **Given**: Sandbox is running.
*   **When**: Agent performs an action (click/type).
*   **Then**: The frontend displays the live view/screenshot of the action.

### Scenario 3: No Regressions
*   **Given**: User runs a slash command (e.g., `/help` or custom).
*   **When**: The command executes.
*   **Then**: It behaves exactly as it did locally before the port (no upstream override).

## 4. Success Criteria
*   [ ] Feature compiles with `npm run build` / `uv run verify-project`.
*   [ ] Kortix Computer capabilities function in the local sandbox.
*   [ ] No billing code is present.
*   [ ] Existing Slash Commands function without regression.
*   [ ] No "Poison Imports" (e.g. `next-intl`) remain.
