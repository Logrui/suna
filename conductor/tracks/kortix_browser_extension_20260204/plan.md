# Implementation Plan: Kortix Browser Operator Chrome Extension

## Overview

This track formalizes the Kortix Browser Extension feature, which is **substantially complete** based on source code review. The remaining work focuses on polish, testing, and deployment preparation.

---

## Phase 1: Documentation & Track Setup ✅
- [x] Task: Review existing documentation in `.docs/chrome-extension/`
    - Reviewed: `plan.md`, `extension-codemap.md`, `streaming_refactor.md`
- [x] Task: Review source code to verify implementation status
    - Backend: `browser_extension.py`, `browser_tool.py`, `browser_ai.py`
    - Extension: `background.ts`, `websocket-client.ts`, `streaming-manager.ts`, etc.
    - Frontend: `browser-selector.tsx`, `my-browser-modal.tsx`, `ExtensionVncView.tsx`
- [x] Task: Create Conductor track with accurate status
    - Created: `conductor/tracks/kortix_browser_extension_20260204/spec.md`
    - Created: This plan file

---

## Phase 2: Extension Popup UI Polish
- [ ] Task: Redesign popup UI with premium aesthetic matching frontend guidelines
    - File: `packages/kortix-chrome-extension/src/popup/popup.ts`
    - File: `packages/kortix-chrome-extension/public/popup.html`
    - Acceptance: Glassmorphism, gradient header, OKLCH colors
- [ ] Task: Add connection status indicator (green/red dot)
- [ ] Task: Add backend URL configuration option
- [ ] Task: Show extension version and linked account info

---

## Phase 3: Testing & Validation
- [ ] Task: Create manual test checklist
    - Test 1: Extension registration flow
    - Test 2: WebSocket connection/reconnection
    - Test 3: Browser command execution (navigate, click, type)
    - Test 4: VNC streaming quality and latency
    - Test 5: Click/type passthrough
    - Test 6: Fallback to sandbox when extension offline
    - Test 7: Multi-tab management
- [ ] Task: Verify backend WebSocket endpoints work with Railway deployment
- [ ] Task: Test Redis pub/sub relay for multi-worker scenarios

---

## Phase 4: Known Issues Resolution
- [ ] Task: Document workaround for background tab throttling
    - Current: `chrome.debugger` captures stale frames when tab is backgrounded
    - Solution: Advise users to keep Kortix window visible OR implement Offscreen Document
- [ ] Task: Add user guidance for "Debugging started" banner
    - This is Chrome's expected behavior for `chrome.debugger` API
    - Document that it's normal and won't affect functionality

---

## Phase 5: Deployment Preparation
- [ ] Task: Update `manifest.json` version for release
    - File: `packages/kortix-chrome-extension/public/manifest.json`
- [ ] Task: Generate production assets
    - Run: `pnpm build` in extension directory
    - Package: Create `.zip` for Chrome Web Store
- [ ] Task: Prepare store listing content
    - Description, screenshots, categories
- [ ] Task: Submit to Chrome Web Store (optional - user decision)

---

## Phase 6: Browser Tool Parity (🔴 CRITICAL - BLOCKING)

> **Priority: CRITICAL** - `browser_act` and `browser_extract_content` are NOT FUNCTIONAL for the extension path. These are the two most-used agent tools and must be fixed before the extension is usable.

### 6.0 Critical Syntax Bug Fix ✅
- [x] Task: Fix critical syntax error in `browser_ai.py` <!-- id: 6.0 commit: ba2a408a -->
    - **Root Cause**: File used `{{` double braces for Python dict literals, which creates sets not dicts
    - **Fix**: Rewrote entire file with proper Python syntax (single `{` for dicts)
    - **Also added**: Debug logging for AI responses

### 6.1 Variables Substitution ✅
- [x] Task: Implement `%variable%` substitution in `browser_ai.py` <!-- id: 6.1 commit: ba2a408a -->
    - File: `backend/core/tools/browser_ai.py`
    - Added: `_substitute_variables()` method using regex
    - Updated: `browser_tool.py` to pass `variables` param to `interpret_act()`
    - Example: `"fill email with %email%"` + `{"email": "test@example.com"}` → `"fill email with test@example.com"`
    - **Status: COMPLETE**

### 6.2 iframe Support ✅
- [x] Task: Add iframe context to AI prompt in `browser_ai.py`
    - No need: AI uses vision only.
- [x] Task: Add frame detection and switching in extension
    - File: `packages/kortix-chrome-extension/src/background/background.ts`
    - Implemented `findTargetFrame` using `executeInAllFrames`
    - Updated: `handleClick`, `handleType`, `handleHover` to target specific frameId
    - **Status: COMPLETE**

### 6.3 DOM Extraction ✅
- [x] Task: Add content script extraction endpoint
    - File: `packages/kortix-chrome-extension/src/content/content.ts` (Already existed)
    - Updated: `background.ts` to expose `extractContent` command
- [x] Task: Add `extract_dom` action to backend command routing
    - File: `backend/core/tools/browser_tool.py`
    - Algo: `extract` command now fetches extension DOM, then takes screenshot, then calls AI
    - Updated `browser_ai.py` to use `dom_text` in prompt
    - **Status: COMPLETE**

### 6.4 Multi-Step Action Loop ✅
- [x] Task: Implement iteration loop in `browser_tool.py`
    - File: `backend/core/tools/browser_tool.py`
    - Change: `act` now loops up to 10 times until AI returns `complete`
    - Added: `previous_actions` context to AI prompt
    - **Status: COMPLETE**

### 6.5 Selector Accuracy Improvement (🟡 Medium Priority)
- [ ] Task: Add coordinate clicking as fallback
    - Note: Extension already supports `x, y` inputs for click/type.
    - AI currently returns `selector`.
    - Future: AI can return `point: [x, y]` if selector fails.
    - **Status: Pending**


---

## Implementation Status Summary

| Component | Files | Status |
|-----------|-------|--------|
| **Backend Service** | `browser_extension.py` | ✅ Complete (1305 lines) |
| **Backend Tool Integration** | `browser_tool.py` | ✅ Complete |
| **AI Interpretation** | `browser_ai.py` | ✅ Complete |
| **Database Schema** | `20260120000000_user_browsers.sql` | ✅ Complete |
| **Extension Core** | `background.ts`, `websocket-client.ts` | ✅ Complete |
| **Extension Streaming** | `streaming-manager.ts`, `debugger-capture.ts` | ✅ Complete |
| **Extension Input** | `input-manager.ts` | ✅ Complete |
| **Extension Tab Mgmt** | `tab-group-manager.ts` | ✅ Complete |
| **Frontend API** | `browsers.ts`, hooks | ✅ Complete |
| **Frontend UI** | `browser-selector.tsx`, `my-browser-modal.tsx` | ✅ Complete |
| **VNC Canvas** | `ExtensionVncView.tsx` | ✅ Complete |
| **Registration Page** | `connect-browser/page.tsx` | ✅ Complete |
| **Extension Popup** | `popup.ts`, `popup.html` | 🟡 Needs Polish |
| **Variables Support** | `browser_ai.py` | 🔴 Missing |
| **iframe Support** | `background.ts`, `browser_ai.py` | 🔴 Missing |
| **DOM Extraction** | `content.ts` | 🔴 Missing |
| **Multi-step Actions** | `browser_tool.py` | 🟡 Single-step only |
| **E2E Testing** | -- | 🔴 Not Started |
| **Store Deployment** | -- | 🔴 Not Started |

---

## Notes

- The core implementation is **feature-complete** based on the original plan
- **NEW**: Browser Tool Parity gaps identified (see Phase 6 and `spec.md`)
  - `navigate` and `screenshot`: ✅ Full parity
  - `act` and `extract`: ⚠️ Functional but missing variables, iframes, DOM access
- Primary remaining work: parity fixes, polish, testing, deployment
- The extension has been manually tested during development
- No blocking issues prevent **basic** agent usage of the extension

