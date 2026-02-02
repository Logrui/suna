# Specification: Kortix Browser Operator Chrome Extension

## Overview

The **Kortix Browser Operator** Chrome Extension allows AI agents to control the user's local browser instead of (or in addition to) cloud sandboxed browsers. This provides access to logged-in sessions, local extensions, and real-time visual feedback via a VNC-like streaming interface.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Kortix Backend                                   │
│                                                                             │
│  ┌─────────────────┐      ┌────────────────────────┐     ┌──────────────┐  │
│  │    AgentRunner  │ ──── │    ToolManager         │ ──→ │ BrowserTool  │  │
│  └─────────────────┘      └────────────────────────┘     └───────┬──────┘  │
│                                                                   │         │
│                         ┌─────────────────────────────────────────┼─────┐   │
│                         │         browser_extension.py            │     │   │
│                         │  ┌────────────────────────────────┐     │     │   │
│                         │  │   ExtensionSessionManager      │◄────┘     │   │
│                         │  │   - WebSocket connections      │           │   │
│                         │  │   - Command routing (via Redis)│           │   │
│                         │  │   - Stream relay               │           │   │
│                         │  └─────────────┬──────────────────┘           │   │
│                         └────────────────┼──────────────────────────────┘   │
│                                          │                                   │
└──────────────────────────────────────────┼───────────────────────────────────┘
                                           │ WebSocket
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Chrome Extension                                   │
│                                                                             │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ WebSocket      │  │ Tab Group       │  │ Streaming Manager            │  │
│  │ Client         │──│ Manager         │──│ - 10 FPS WEBP capture        │  │
│  │ (Reconnecting) │  │ (Kortix tabs)   │  │ - chrome.debugger API        │  │
│  └────────────────┘  └─────────────────┘  └──────────────────────────────┘  │
│                              │                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Input Manager (chrome.debugger)                   │ │
│  │  - Mouse events (click, hover, scroll)                                 │ │
│  │  - Keyboard events (type, press_key)                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                        │
│                                                                             │
│  ┌─────────────────┐  ┌───────────────────┐  ┌───────────────────────────┐  │
│  │ BrowserSelector │  │ MyBrowserModal    │  │ ExtensionVncView          │  │
│  │ (per-thread)    │──│ (browser list)    │  │ (interactive canvas)      │  │
│  └─────────────────┘  └───────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Functional Requirements

### 1. Extension Registration & Authentication
- One-time setup via `/connect-browser` page
- Token-based authentication (JWT signed by backend)
- Extension stores token in `chrome.storage.local`
- Token hash stored in `user_browsers` table for validation

### 2. WebSocket Connection
- Persistent connection from extension to backend (`/ws/extension`)
- Automatic reconnection with exponential backoff
- Heartbeat every 30 seconds to maintain presence
- Session ID assigned on `welcome` message

### 3. Per-Thread Browser Selection
- User selects browser in chat input "Integrations" dropdown
- Selection stored in `threads.metadata.browser_id`
- Agent fetches `browser_id` during run initialization
- Null selection = use sandbox (fallback)

### 4. Command Execution
- `BrowserTool` checks extension availability first
- Routes to extension if online, falls back to sandbox
- Commands include: `navigate`, `act`, `extract`, `screenshot`
- AI interpretation layer (`browser_ai.py`) for natural language actions

### 5. Real-time VNC Streaming
- 10 FPS WEBP screenshot capture (via `chrome.debugger` API)
- Stream relayed through backend WebSocket
- Frontend canvas renders frames + handles click/type passthrough
- Interactive overlay for user takeover

### 6. Tab Group Management
- All agent-controlled tabs grouped under "Kortix" tab group (purple)
- Prevents interference with user's personal tabs
- Background tab capture without activation

## Browser Tool Parity Analysis

The agent interacts with the browser via **4 core tools** in `browser_tool.py`. Here is the parity status between Sandbox (Stagehand) and Extension (Backend AI) execution paths:

### Tool Summary

| Tool | Sandbox | Extension | Status |
|------|---------|-----------|--------|
| `browser_navigate_to(url)` | ✅ Full | ✅ Full | **✅ PARITY** |
| `browser_screenshot(name)` | ✅ Full | ✅ Full | **✅ PARITY** |
| `browser_act(action, ...)` | ✅ Full (Stagehand AI) | ❌ Broken | **🔴 NOT FUNCTIONAL** |
| `browser_extract_content(instruction)` | ✅ Full (Stagehand AI) | ❌ Broken | **🔴 NOT FUNCTIONAL** |

### Detailed Analysis

#### 1. ✅ `browser_navigate_to(url)` - FULL PARITY
- **Extension Path:** `navigate` command → `tabGroupManager.navigateToUrl(url)`
- Returns: `{success, url, title, image_url, message_id}`
- Works identically to sandbox.

#### 2. ✅ `browser_screenshot(name)` - FULL PARITY
- **Extension Path:** `chrome.debugger` + `Page.captureScreenshot` (CDP)
- Returns: `{screenshot_base64, url, title}` → uploaded to S3
- Works identically to sandbox.

#### 3. 🔴 `browser_act(action, variables, iframes, filePath)` - NOT FUNCTIONAL

**Intended Flow:**
1. Extension has NO local AI → backend handles interpretation
2. Backend calls `browser_interpreter.interpret_act(instruction, screenshot, url)`
3. Backend AI (Gemini 2.5 Flash) converts instruction → primitive action
4. Supported primitives: `click`, `type`, `navigate`, `scroll_down`, `scroll_up`, `set_file_input_files`, `press_key`, `hover`
5. Backend sends primitive command to extension → extension executes

**Current Blockers:**
- 🔴 Backend AI interpretation layer not fully integrated
- 🔴 Extension primitive handlers may be incomplete
- 🔴 `variables` dict not substituted into instruction
- 🔴 `iframes` flag sent but extension has no frame switching logic
- 🔴 Error handling/fallback path needs validation

**Feature Parity (Target):**
| Feature | Sandbox | Extension | Status |
|---------|---------|-----------|--------|
| Click element | ✅ | ❌ Broken | **🔴 NEEDS FIX** |
| Type text | ✅ | ❌ Broken | **🔴 NEEDS FIX** |
| Scroll | ✅ | ❌ Untested | **🔴 NEEDS FIX** |
| Press key | ✅ | ❌ Untested | **🔴 NEEDS FIX** |
| File upload | ✅ | ❌ Untested | **🔴 NEEDS FIX** |
| Hover | ✅ | ❌ Untested | **🔴 NEEDS FIX** |
| **Variables** (`%email%`) | ✅ Secure | ❌ Not implemented | **🔴 MISSING** |
| **iframes** | ✅ Native | ❌ Not implemented | **🔴 MISSING** |

#### 4. 🔴 `browser_extract_content(instruction, iframes)` - NOT FUNCTIONAL

**Intended Flow:**
1. Backend takes screenshot of current page
2. Calls `browser_interpreter.interpret_extract(instruction, screenshot, url)`
3. Backend AI extracts data from screenshot (vision-only, no DOM access)
4. Returns extracted JSON

**Current Blockers:**
- 🔴 Backend AI extraction not returning data correctly
- 🔴 No DOM extraction fallback for hidden text
- 🔴 `iframes` not implemented

**Feature Parity (Target):**
| Feature | Sandbox | Extension | Status |
|---------|---------|-----------|--------|
| Visual extraction | ✅ | ❌ Broken | **🔴 NEEDS FIX** |
| DOM access | ✅ Full | ❌ None | **🔴 MISSING** |
| iframes | ✅ | ❌ | **🔴 MISSING** |
| Hidden text | ✅ | ❌ (visible only) | **🟡 LIMITATION** |

### Parity Gap Summary

| Gap | Severity | Fix Complexity | Files to Modify |
|-----|----------|----------------|------------------|
| Variables substitution | 🔴 High | Low | `browser_ai.py` |
| iframe support | 🔴 High | Medium | `background.ts`, `browser_ai.py` |
| DOM extraction | 🔴 High | Medium | `content.ts` (new extractor) |
| Selector accuracy | 🟡 Medium | High | Consider coordinate-based clicks |
| Multi-step actions | 🟡 Medium | Medium | Add iteration loop in `browser_tool.py` |

---

## Non-Functional Requirements

### Performance
- Command latency < 200ms (excluding network)
- Stream latency < 300ms end-to-end
- 10 FPS minimum sustained streaming

### Reliability
- Auto-reconnect on WebSocket disconnect
- Graceful fallback to sandbox on extension failure
- Multi-worker support via Redis pub/sub relay

### Security
- Token-based auth (no session cookies)
- RLS policies on `user_browsers` table
- Token revocation on browser deletion

## Current Implementation Status

### ✅ COMPLETE (Backend)
- [x] `backend/core/services/browser_extension.py` (1305 lines)
  - ExtensionSession, ExtensionSessionManager classes
  - WebSocket handlers (`extension_websocket`, `browser_stream_websocket`)
  - Token verification and session management
  - Redis pub/sub relay for multi-worker
  - REST endpoints for browser management
- [x] `backend/core/tools/browser_tool.py` - Extension routing integrated
- [x] `backend/core/tools/browser_ai.py` - AI interpretation layer
- [x] `backend/core/run/agent_runner.py` - Fetches `browser_id` from thread
- [x] `backend/supabase/migrations/20260120000000_user_browsers.sql` - DB schema

### ✅ COMPLETE (Extension)
- [x] `packages/kortix-chrome-extension/src/background/websocket-client.ts`
- [x] `packages/kortix-chrome-extension/src/background/background.ts`
- [x] `packages/kortix-chrome-extension/src/background/tab-group-manager.ts`
- [x] `packages/kortix-chrome-extension/src/background/streaming-manager.ts`
- [x] `packages/kortix-chrome-extension/src/background/input-manager.ts`
- [x] `packages/kortix-chrome-extension/src/background/debugger-capture.ts`
- [x] `packages/kortix-chrome-extension/src/content/connect-bridge.ts`
- [x] `packages/kortix-chrome-extension/src/content/overlay-manager.ts`
- [x] `packages/kortix-chrome-extension/src/config.ts`

### ✅ COMPLETE (Frontend)
- [x] `frontend/src/lib/api/browsers.ts` - REST client
- [x] `frontend/src/hooks/browser/use-user-browsers.ts` - React Query hooks
- [x] `frontend/src/components/browser/browser-selector.tsx` - Dropdown trigger
- [x] `frontend/src/components/browser/my-browser-modal.tsx` - Browser list + selection
- [x] `frontend/src/components/browser/browser-card.tsx` - Browser display
- [x] `frontend/src/components/thread/ExtensionVncView.tsx` - VNC canvas
- [x] `frontend/src/app/connect-browser/page.tsx` - Registration page

### 🔴 KNOWN ISSUES (To Resolve)
1. **Background Tab Throttling**: Chrome throttles inactive tabs, causing stale frames
   - Documented workaround: Use separate window or tabCapture API
   - Long-term: Offscreen document + MediaStream
2. **Debugger Banner**: "Debugging started" banner cannot be hidden
   - Expected UX limitation of `chrome.debugger` API
3. **Extension Popup UI**: Minimal placeholder, needs polish
4. **End-to-end Testing**: No automated tests for full flow

## Documentation

- `.docs/chrome-extension/plan.md` - Original implementation plan
- `.docs/chrome-extension/extension-codemap.md` - Architecture reference
- `.docs/chrome-extension/streaming_refactor.md` - VNC streaming details
- `packages/kortix-chrome-extension/PROJECT_SUMMARY.md` - Extension overview
- `packages/kortix-chrome-extension/QUICKSTART.md` - Setup guide
- `packages/kortix-chrome-extension/DEPLOYMENT.md` - Chrome Web Store deployment

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Extension connects to backend WebSocket | ✅ Verified |
| Commands execute in user's browser | ✅ Verified |
| Results returned to agent (same format as sandbox) | ✅ Verified |
| Fallback to sandbox when extension unavailable | ✅ Verified |
| Per-thread browser selection | ✅ Verified |
| Real-time VNC streaming (10 FPS) | ✅ Verified |
| Interactive canvas (click/type passthrough) | ✅ Verified |
| Auto-reconnection on disconnect | ✅ Verified |
| Multi-worker relay via Redis | ✅ Verified |

## Remaining Work

See `plan.md` for detailed task breakdown. Key areas:
1. Polish extension popup UI
2. Add E2E testing
3. Investigate advanced streaming (Offscreen Document + MediaStream)
4. Chrome Web Store submission preparation
