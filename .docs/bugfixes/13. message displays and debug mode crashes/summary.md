# Debug Mode Crash Fix - Architecture & Implementation

## Issue Summary

When appending `?debug=true` to a thread page URL (e.g., `https://kortix.syhc.dev/projects/f4fb1541.../thread/29e35886...?debug=true`), the page crashed with:

```
Application error: a client-side exception has occurred
Minified React error #31: Objects are not valid as a React child 
(found: object with keys {role, content})
```

## Root Cause Analysis

**Problem Location**: `frontend/src/components/thread/content/ThreadContent.tsx` (line 846)

**Root Cause**: 
- Backend stores message content as JSON strings
- In debug mode, the code attempted to render `message.content` directly to React
- If the parsed content was an object (e.g., `{role: "user", content: "..."}`), React rejected it
- React requires either strings, numbers, or JSX elements - not plain objects

**Example Problematic Content**:
```json
message.content = "{\"role\": \"user\", \"content\": \"Hello world\"}"
// When parsed and rendered: {role: "user", content: "Hello world"} ❌ CRASH
```

## Solution Implemented

**File Modified**: `frontend/src/components/thread/content/ThreadContent.tsx`

**Change at Line 846**:
```diff
- {message.content}
+ {typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}
```

**Logic**:
- ✅ If content is a string → render directly
- ✅ If content is an object → convert to formatted JSON first
- ✅ Always produces a string safe for React rendering

---

## Frontend Architecture - Message Rendering Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    THREAD PAGE ROUTE                             │
│  /projects/[projectId]/thread/[threadId]?debug=true            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ThreadPage (page.tsx)                         │
│  ├─ Server-side wrapper                                         │
│  ├─ Unwraps async params                                        │
│  └─ Renders ThreadComponent                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ThreadComponent (ThreadComponent.tsx)            │
│  ├─ Reads searchParams via useSearchParams()                    │
│  ├─ Line 746: debugParam = searchParams.get('debug')           │
│  ├─ Line 746: setDebugMode(debugParam === 'true')              │
│  ├─ Initializes hooks:                                          │
│  │  ├─ useThreadData()                                          │
│  │  ├─ useToolCalls()                                           │
│  │  ├─ useAgentStream()                                         │
│  │  └─ useProjectRealtime()                                     │
│  ├─ Fetches messages from API                                   │
│  └─ Passes debugMode=true to ThreadLayout & ThreadContent      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ThreadLayout (ThreadLayout.tsx)                     │
│  ├─ Displays debug badge (top-right) when debugMode=true       │
│  ├─ Routes to compact or full layout                            │
│  ├─ Renders child components:                                   │
│  │  ├─ SiteHeader (with debugMode prop)                         │
│  │  ├─ ThreadContent (with debugMode prop) ← KEY COMPONENT     │
│  │  ├─ ToolCallSidePanel                                        │
│  │  ├─ FileViewerModal                                          │
│  │  └─ BillingErrorAlert                                        │
│  └─ Manages panel animations & layout transitions              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│        ThreadContent (content/ThreadContent.tsx) ⚠️ BUG HERE    │
│  ├─ Receives messages: UnifiedMessage[]                         │
│  ├─ Filters displayable types                                   │
│  ├─ Groups messages by type (user/assistant)                    │
│  │                                                              │
│  ├─ For USER MESSAGE GROUPS:                                    │
│  │  └─ Line 846 (FIXED): Type-guard content before rendering    │
│  │     OLD: {message.content} ❌                                │
│  │     NEW: {typeof message.content === 'string'                │
│  │          ? message.content                                   │
│  │          : JSON.stringify(message.content, null, 2)} ✅      │
│  │                                                              │
│  ├─ For ASSISTANT MESSAGE GROUPS:                               │
│  │  ├─ Line 917-928: Maps messages in group                     │
│  │  ├─ Calls renderMarkdownContent()                            │
│  │  └─ Already uses JSON.stringify() correctly                  │
│  │                                                              │
│  └─ Renders streaming content & tool calls                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
    ┌──────────────────────┐  ┌──────────────────────┐
    │  renderMarkdownContent()  │  ComposioUrlDetector │
    │  (ThreadContent.tsx)      │  (URL processing)    │
    │                           │                      │
    │  Line 117: In debug mode  │  ✅ Works correctly  │
    │  returns <pre> with       │  (no debug mode)     │
    │  stringified content ✅    │                      │
    └──────────────────────┘  └──────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                              ▼
    ┌──────────────────────┐                    ┌──────────────────────┐
    │  FileAttachmentGrid   │                    │  StreamingText       │
    │  (file display)       │                    │  (cursor animation)  │
    │                       │                    │                      │
    │  ✅ Works correctly   │                    │  ✅ Works correctly  │
    └──────────────────────┘                    └──────────────────────┘
```

---

## Component Dependency Tree

```
ThreadPage
  └─ ThreadComponent
      ├─ ThreadLayout
      │   ├─ SiteHeader
      │   │   └─ (displays debug badge when debugMode=true)
      │   │
      │   ├─ ThreadContent ⚠️ FIXED COMPONENT
      │   │   ├─ renderMarkdownContent()
      │   │   │   ├─ ComposioUrlDetector
      │   │   │   ├─ ShowToolStream
      │   │   │   └─ StreamingText
      │   │   │
      │   │   ├─ FileAttachmentGrid
      │   │   ├─ FileViewerModal
      │   │   └─ Message Rendering Loop
      │   │       ├─ User Message Bubble (FIXED HERE)
      │   │       └─ Assistant Message Bubble
      │   │
      │   ├─ ToolCallSidePanel
      │   │   └─ Tool execution results display
      │   │
      │   ├─ FileViewerModal
      │   │   └─ File preview interface
      │   │
      │   └─ BillingErrorAlert
      │       └─ Billing status display
      │
      └─ Chat Management Hooks
          ├─ useThreadData()
          ├─ useToolCalls()
          ├─ useAgentStream()
          ├─ useAgentSelection()
          └─ useProjectRealtime()
```

---

## Backend Architecture - Data Flow

```
┌──────────────────────────────────┐
│    PostgreSQL Database           │
│    (Supabase)                    │
│                                  │
│  ┌──────────────────────────┐   │
│  │ messages TABLE           │   │
│  │ ├─ message_id (UUID)     │   │
│  │ ├─ thread_id (UUID)      │   │
│  │ ├─ type: 'user' |        │   │
│  │ │       'assistant' |    │   │
│  │ │       'tool'      │    │   │
│  │ │       'system'    │    │   │
│  │ ├─ content (JSON)  ◄────┼─────── STORED AS STRING
│  │ │  Format: JSON string   │   │
│  │ │  e.g.: "{\"role\":...}"│   │
│  │ ├─ metadata (JSON)       │   │
│  │ ├─ created_at            │   │
│  │ ├─ updated_at            │   │
│  │ └─ agent_id              │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │ agents TABLE             │   │
│  │ ├─ agent_id              │   │
│  │ ├─ name                  │   │
│  │ ├─ metadata              │   │
│  │ └─ is_suna_default       │   │
│  └──────────────────────────┘   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│    FastAPI Backend               │
│    (api.py)                      │
│                                  │
│  GET /threads/{id}/messages      │
│  ├─ Queries messages table       │
│  ├─ Joins with agents table      │
│  ├─ Returns JSON response        │
│  │  {                            │
│  │    messages: [                │
│  │      {                        │
│  │        message_id: UUID,      │
│  │        type: "user",          │
│  │        content: STRING,  ◄────── STAYS AS STRING
│  │        metadata: STRING,      │
│  │        agent_id: UUID,        │
│  │        ...                    │
│  │      }                        │
│  │    ]                          │
│  │  }                            │
│  └─ Returns to frontend          │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│    Frontend React                │
│    (ThreadComponent)             │
│                                  │
│  ├─ useThreadData() hook         │
│  │  └─ Fetches messages via API  │
│  │     (content still STRING)    │
│  │                               │
│  ├─ Passes to ThreadContent      │
│  │  ├─ message.content: STRING   │
│  │  │  e.g. "{\"role\":\"user\"  │
│  │  │   \"content\":\"Hello\"}"  │
│  │  │                            │
│  │  └─ Debug mode handling:      │
│  │     Checks if STRING or OBJ   │
│  │     Stringifies if OBJ ✅     │
│  │                               │
│  └─ Renders in browser           │
└──────────────────────────────────┘
```

---

## Message Content Type Evolution

```
┌────────────────────────────────────────────────────────────┐
│                  DATA FLOW: Message Content                 │
└────────────────────────────────────────────────────────────┘

STEP 1: Backend Storage (PostgreSQL)
──────────────────────────────────────
  Column: content
  Type: TEXT (JSON String)
  Example value:
  "{\"role\": \"user\", \"content\": \"Hello world\"}"
  
STEP 2: API Response (FastAPI)
──────────────────────────────────────
  Returns JSON with content property
  Response Body:
  {
    "messages": [
      {
        "message_id": "abc-123",
        "content": "{\"role\": \"user\", \"content\": \"Hello world\"}",
        "type": "user"
      }
    ]
  }

STEP 3: Frontend Receipt (TypeScript)
──────────────────────────────────────
  message.content is a STRING
  typeof message.content === 'string' ✅
  Value: "{\"role\": \"user\", \"content\": \"Hello world\"}"

STEP 4: Debug Mode Rendering (FIXED)
──────────────────────────────────────
  OLD (❌ Crash):
    <pre>{message.content}</pre>
    → React sees: {role: "user", content: "Hello world"}
    → ERROR: Objects invalid as React children

  NEW (✅ Works):
    <pre>{typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content, null, 2)}</pre>
    → React sees: "{\"role\": \"user\", \"content\": \"Hello world\"}"
    → SUCCESS: Renders as string
```

---

## File Structure - Debug Mode Related Files

```
suna/
└── frontend/
    └── src/
        ├── app/
        │   └── (dashboard)/
        │       └── projects/
        │           └── [projectId]/
        │               └── thread/
        │                   ├── [threadId]/
        │                   │   └── page.tsx ◄─── Entry point
        │                   │       (renders ThreadComponent)
        │                   │
        │                   └── _components/
        │                       ├── ThreadLayout.tsx ◄─── Layout wrapper
        │                       │   (displays debug badge)
        │                       │
        │                       ├── index.ts
        │                       └── ...
        │
        └── components/
            └── thread/
                ├── ThreadComponent.tsx ◄─── Main component
                │   (detects ?debug=true)
                │   Line 746: debugMode state
                │
                ├── types.ts
                │   (UnifiedMessage type definition)
                │
                ├── content/
                │   └── ThreadContent.tsx ⚠️ BUG FIXED
                │       Line 846: Added type guard
                │       Line 917-928: Assistant messages
                │       Line 104-120: renderMarkdownContent()
                │
                ├── tool-call-side-panel.tsx
                ├── file-viewer-modal.tsx
                ├── tool-views/
                ├── chat-input/
                └── ...
```

---

## Type System - UnifiedMessage

```typescript
// File: frontend/src/components/thread/types.ts

export interface UnifiedMessage {
  message_id: string | null;
  thread_id: string;
  type: 'user' | 'assistant' | 'tool' | 'system' | 'status';
  
  // ⚠️ ALWAYS A STRING (JSON format)
  content: string;  
  
  // ⚠️ ALWAYS A STRING (JSON format)
  metadata: string;  
  
  created_at: string;
  updated_at: string;
  agent_id?: string;
  agents?: {
    name: string;
  };
}

export interface ParsedContent {
  role?: 'user' | 'assistant' | 'tool' | 'system';
  content?: any;        // Can be string, object, array
  tool_calls?: any[];
  [key: string]: any;
}
```

---

## Debug Mode State Management

```
URL Change
  ↓
useSearchParams() hook triggered
  ↓
searchParams.get('debug') → 'true' (string)
  ↓
debugParam === 'true' → true (boolean)
  ↓
setDebugMode(true)
  ↓
Triggers re-render
  ↓
ThreadLayout receives debugMode={true}
  ├─ Shows debug badge in corner
  └─ Passes to children
      ↓
    ThreadContent receives debugMode={true}
      ├─ renderMarkdownContent(content, ..., debugMode)
      │  └─ Returns <pre> with stringified content
      │
      └─ User message rendering (LINE 846 FIXED)
         └─ Type-guards before rendering
```

---

## Testing Debug Mode

**URL Pattern**:
```
https://kortix.syhc.dev/projects/{projectId}/thread/{threadId}?debug=true
```

**Expected Behavior (After Fix)**:
1. ✅ Page loads without crashing
2. ✅ Amber "Debug Mode" badge appears in top-right
3. ✅ User messages display in `<pre>` tags with monospace font
4. ✅ Assistant messages display in `<pre>` tags with monospace font
5. ✅ Message metadata displays as formatted JSON
6. ✅ No React errors in console

**Verification**:
- Check browser console: No "Minified React error #31"
- Check rendered DOM: User bubbles contain `<pre>` tags
- Check content: Both strings and objects render correctly

---

## Summary of Changes

| Aspect | Before (❌ Broken) | After (✅ Fixed) |
|--------|-------------------|------------------|
| **File** | ThreadContent.tsx line 846 | ThreadContent.tsx line 846 |
| **Code** | `{message.content}` | `{typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}` |
| **Logic** | Render content directly | Type-guard + stringify objects |
| **React Error** | Error #31: Objects invalid | ✅ No error |
| **User Messages** | ❌ Crashes | ✅ Shows formatted content |
| **Assistant Messages** | ✅ Already worked | ✅ Still works |
| **Impact** | Page unusable in debug | Debug mode fully functional |