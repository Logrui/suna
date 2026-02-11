# Track Index: Kortix Browser Operator Chrome Extension

**Track ID**: `kortix_browser_extension_20260204`  
**Created**: 2026-02-04  
**Status**: ~75% Complete (Core implementation done, polish/testing remaining)

## Purpose

Enable AI agents to control the user's local Chrome browser via a WebSocket-connected extension, providing access to logged-in sessions and real-time visual feedback.

## Files

| File | Description |
|------|-------------|
| `spec.md` | Feature specification with architecture, status, and success criteria |
| `plan.md` | Implementation tasks organized by phase |
| `index.md` | This file - track overview and navigation |

## Quick Links

### Backend
- `backend/core/services/browser_extension.py` - WebSocket service & session management
- `backend/core/tools/browser_tool.py` - Agent tool with extension routing
- `backend/core/tools/browser_ai.py` - AI interpretation for natural language actions
- `backend/supabase/migrations/20260120000000_user_browsers.sql` - Database schema

### Extension
- `packages/kortix-chrome-extension/src/background/` - Background service worker
- `packages/kortix-chrome-extension/src/content/` - Content scripts
- `packages/kortix-chrome-extension/src/popup/` - Popup UI

### Frontend
- `frontend/src/components/browser/` - Browser selector UI
- `frontend/src/components/thread/ExtensionVncView.tsx` - VNC canvas
- `frontend/src/app/connect-browser/page.tsx` - Registration page
- `frontend/src/hooks/browser/use-user-browsers.ts` - React Query hooks

### Documentation
- `.docs/chrome-extension/plan.md` - Original detailed plan
- `.docs/chrome-extension/extension-codemap.md` - Architecture reference
- `.docs/chrome-extension/streaming_refactor.md` - VNC streaming implementation
- `packages/kortix-chrome-extension/PROJECT_SUMMARY.md` - Extension overview
