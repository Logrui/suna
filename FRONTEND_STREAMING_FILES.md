# Frontend Streaming & Chat Architecture - File Inventory

## Overview
This document lists all frontend files critical to the agent streaming, chat, and messaging system that may be causing the 5-second timeout issue.

---

## 🔴 CRITICAL STREAMING FILES

### Streaming API Layer
- `frontend/src/lib/api/streaming.ts` - **PRIMARY STREAMING HANDLER**
- `frontend/src/hooks/useAgentStream.ts` - Core streaming hook
- `frontend/src/hooks/agents/useAgentStream.ts` - Agent-specific streaming

### Message Handling
- `frontend/src/hooks/threads/use-messages.ts` - Message state management
- `frontend/src/hooks/react-query/threads/use-messages.ts` - React Query messages hook
- `frontend/src/lib/api/threads.ts` - Thread API calls

### Agent Run Management
- `frontend/src/hooks/threads/use-agent-run.ts` - Agent run hook
- `frontend/src/hooks/react-query/threads/use-agent-run.ts` - React Query agent run

### Real-time Updates
- `frontend/src/hooks/threads/useProjectRealtime.ts` - Real-time Supabase connection
- `frontend/src/hooks/useProjectRealtime.ts` - Alternative realtime hook
- `frontend/src/hooks/useVapiCallRealtime.ts` - VAPI call realtime updates

---

## 📱 CHAT/THREAD UI COMPONENTS

### Main Thread Component
- `frontend/src/components/thread/ThreadComponent.tsx` - **Main chat UI**
- `frontend/src/components/thread/content/ThreadContent.tsx` - Content renderer

### Streaming Display
- `frontend/src/components/thread/content/StreamingText.tsx` - **STREAMING TEXT DISPLAY**
- `frontend/src/components/thread/content/ShowToolStream.tsx` - Tool output streaming
- `frontend/src/components/thread/content/PlaybackControls.tsx` - Playback controls

### Tool Call Display
- `frontend/src/components/thread/tool-call-side-panel.tsx` - Tool execution panel
- `frontend/src/components/thread/tool-views/wrapper/ToolViewWrapper.tsx` - Tool wrapper

### Message Composition
- `frontend/src/components/thread/chat-input/chat-input.tsx` - **CHAT INPUT**
- `frontend/src/components/thread/chat-input/file-upload-handler.tsx` - File handling
- `frontend/src/components/thread/chat-input/voice-recorder.tsx` - Voice input

### Content Rendering
- `frontend/src/components/thread/content/loader.tsx` - Loading states
- `frontend/src/components/thread/content/ThreadSkeleton.tsx` - Skeleton UI
- `frontend/src/components/thread/content/agent-avatar.tsx` - Agent display

---

## 🎯 PAGE-LEVEL THREAD HOOKS

### Thread Data Management
- `frontend/src/hooks/threads/page/use-thread-data.ts` - **MAIN THREAD DATA HOOK**
- `frontend/src/hooks/threads/page/use-thread-keyboard-shortcuts.ts` - Keyboard handling
- `frontend/src/hooks/threads/page/use-thread-tool-calls.ts` - Tool call handling

### Project & Thread Queries
- `frontend/src/hooks/threads/use-thread-queries.ts` - Thread queries
- `frontend/src/hooks/threads/use-thread-mutations.ts` - Thread mutations
- `frontend/src/hooks/react-query/threads/use-thread-queries.ts` - React Query thread queries

---

## 🌐 HTTP CLIENT & CONFIG

### API Client
- `frontend/src/lib/api-client.ts` - HTTP client configuration
- `frontend/src/lib/api.ts` - Main API module
- `frontend/src/lib/get-api-url.ts` - API URL construction

### Error Handling
- `frontend/src/lib/error-handler.ts` - Error handling
- `frontend/src/lib/api/errors.ts` - API error types

---

## ⚡ KEY PAGES

### Thread Page
- `frontend/src/app/(dashboard)/projects/[projectId]/thread/[threadId]/page.tsx` - **MAIN THREAD PAGE**
- `frontend/src/app/(dashboard)/projects/[projectId]/thread/[threadId]/layout.tsx` - Thread layout

### Agent Chat Page
- `frontend/src/app/(dashboard)/agents/[threadId]/page.tsx` - Agent chat page

### Shared Thread
- `frontend/src/app/share/[threadId]/page.tsx` - Shared thread view

---

## 📊 STATE MANAGEMENT

### Zustand Stores
- `frontend/src/stores/context-usage-store.ts` - Context tracking
- `frontend/src/stores/model-store.ts` - Model selection
- `frontend/src/stores/agent-selection-store.ts` - Agent selection

### Custom Hooks Stores
- `frontend/src/hooks/use-model-selection.ts` - Model selector
- `frontend/src/hooks/useModelLoading.ts` - Model loading state

---

## 🔧 UTILITIES & HELPERS

### Tool Utilities
- `frontend/src/lib/utils/tool-parser.ts` - Tool response parsing
- `frontend/src/components/thread/tool-views/tool-result-parser.ts` - Result parsing
- `frontend/src/components/thread/tool-views/mcp-format-detector.ts` - MCP format detection

### Message Utilities
- `frontend/src/components/thread/utils.ts` - Thread utilities
- `frontend/src/hooks/threads/utils.ts` - Thread hook utilities

---

## 🎨 STREAMING-RELATED UI

### Markdown & Content
- `frontend/src/components/ui/markdown.tsx` - Markdown rendering
- `frontend/src/components/home/ui/response-stream.tsx` - Response streaming UI

### File Renderers
- `frontend/src/components/thread/preview-renderers/` - File preview rendering
- `frontend/src/components/file-renderers/` - File rendering components

---

## 🔌 WEBSOCKET & REALTIME

### Supabase Realtime
- `frontend/src/lib/supabase/client.ts` - Supabase client config
- `frontend/src/hooks/threads/useProjectRealtime.ts` - Realtime connection
- `frontend/src/hooks/useProjectRealtime.ts` - Alternative realtime

### EventSource/SSE
- Check `frontend/src/lib/api/streaming.ts` for EventSource usage

---

## 📋 RELEVANT TYPES & INTERFACES

### Thread Types
- `frontend/src/app/(dashboard)/projects/[projectId]/thread/_types/index.ts` - Thread types
- `frontend/src/components/thread/types.ts` - UI thread types

### Tool Types
- `frontend/src/components/thread/tool-views/types.ts` - Tool view types

---

## ⏰ POTENTIAL TIMEOUT LOCATIONS

Files to check for timeout configurations:

1. **Streaming API Handler** - `frontend/src/lib/api/streaming.ts`
   - EventSource timeout? Network request timeout?
   
2. **Agent Run Hook** - `frontend/src/hooks/threads/use-agent-run.ts`
   - Polling logic? Interval timer?
   
3. **Streaming Text Component** - `frontend/src/components/thread/content/StreamingText.tsx`
   - Chunk processing timeout?
   
4. **Thread Data Hook** - `frontend/src/hooks/threads/page/use-thread-data.ts`
   - Data fetching timeout?

5. **Real-time Connection** - `frontend/src/hooks/threads/useProjectRealtime.ts`
   - Subscription timeout? Connection handling?

---

## 📌 INVESTIGATION CHECKLIST

- [ ] Check `streaming.ts` for EventSource timeout handlers
- [ ] Look for setTimeout/setInterval in streaming hooks
- [ ] Check React Query configuration for request timeouts
- [ ] Look for keepalive pings or heartbeat logic
- [ ] Check Supabase realtime subscription timeout
- [ ] Verify message buffer/queue handling
- [ ] Check for race conditions in cleanup logic
- [ ] Look for connection close events

---

## 🔍 NEXT STEPS

1. Compare these files between `dev` branch and `main` branch
2. Look for recent changes to timeout values
3. Check for added/removed keepalive mechanisms
4. Verify streaming response handling logic
5. Check for async/await issues causing early cleanup
