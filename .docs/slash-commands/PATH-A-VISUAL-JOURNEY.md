# Path A: Visual Journey of a Slash Command

## The Complete Flow

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                  USER EXPERIENCE                                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

1. User opens chat:
   ┌─────────────────────────────────────┐
   │ Chat Input: "Write a summary of..."  │
   │                                      │
   │ [Cursor blinking]                    │
   └─────────────────────────────────────┘

2. User types "/":
   ┌──────────────────────────────────────────────────┐
   │ Chat Input: "Write a summary of/ ..."            │
   │                                                   │
   │ ✓ Autocomplete Opens:                            │
   │   ┌────────────────────────────────────┐         │
   │   │ /summarize                         │         │
   │   │ Create a concise summary           │         │
   │   │                                    │         │
   │   │ /draft-email                       │         │
   │   │ Write a professional email         │         │
   │   │                                    │         │
   │   │ /brainstorm                        │         │
   │   │ Generate creative ideas            │         │
   │   │                                    │         │
   │   │ /explain-simple                    │         │
   │   │ Explain in simple terms            │         │
   │   └────────────────────────────────────┘         │
   └──────────────────────────────────────────────────┘
   
   Behind the scenes:
   ├─ Frontend calls: GET /knowledge-base/folders/{id}/entries
   ├─ Backend returns: [summarize, draft-email, brainstorm, explain-simple]
   ├─ Frontend shows autocomplete (metadata only - FAST ⚡)
   └─ User sees list immediately

3. User hovers over "summarize" / selects it:
   ┌──────────────────────────────────────────────────┐
   │ Chat Input: "/summarize "                        │
   │                                                   │
   │ ✓ Autocomplete Closes                            │
   │ ✓ Command name appears in input                  │
   │ ✓ Visual highlight shows: "/summarize"          │
   └──────────────────────────────────────────────────┘
   
   Behind the scenes:
   ├─ Frontend needs content for selected command
   ├─ Frontend calls: GET /api/knowledge-base/entries/{entry_id}/content
   │  (This is the NEW endpoint we're adding!)
   ├─ Backend fetches from S3 (in memory, not disk)
   ├─ Backend returns JSON: {"content": "# Summarize\n...", "filename": "..."}
   ├─ Frontend receives and stores in state
   └─ Frontend is ready to inject

4. User types follow-up text:
   ┌──────────────────────────────────────────────────┐
   │ Chat Input: "/summarize for my meeting notes"    │
   │                                                   │
   │ Visual:                                           │
   │ ┌─────────────────────┐                          │
   │ │/summarize           │ (highlighted blue)       │
   │ │                     │                          │
   │ │for my meeting notes │ (normal text)            │
   │ └─────────────────────┘                          │
   └──────────────────────────────────────────────────┘
   
   Behind the scenes:
   ├─ Frontend tracks: activeSlashCommand = { name: "summarize", ... }
   └─ userText = "for my meeting notes"

5. User presses Enter (sends message):
   ┌──────────────────────────────────────────────────┐
   │ Chat Input: "/summarize for my meeting notes"    │
   │ → User presses ENTER                             │
   └──────────────────────────────────────────────────┘
   
   Message Processing:
   ├─ Extract activeSlashCommand.prompt:
   │  "# Summarize\n\nYou are a world-class..."
   │
   ├─ Extract userText:
   │  "for my meeting notes"
   │
   ├─ Combine:
   │  finalMessage = `${prompt}\n\n${userText}`
   │
   └─ Result:
      "# Summarize
      
       You are a world-class summarizer...
       
       for my meeting notes"

6. Message sent to agent:
   ┌──────────────────────────────────────────────────┐
   │ Agent receives in chat:                          │
   │                                                   │
   │ [User] # Summarize                               │
   │                                                   │
   │ You are a world-class summarizer...              │
   │                                                   │
   │ for my meeting notes                             │
   │                                                   │
   │ [Agent] I'll create a concise summary...         │
   └──────────────────────────────────────────────────┘


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃              BACKEND PROCESSING (The New Endpoint)                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

When: Frontend calls GET /api/knowledge-base/entries/{entry_id}/content

Timeline:
T=0ms    Request arrives at backend
         ├─ URL: /api/knowledge-base/entries/550e8400-.../content
         ├─ Method: GET
         ├─ Headers: Authorization: Bearer {token}
         └─ Body: (empty)

T=1ms    Authentication check
         └─ Extract user from token
         └─ User is valid ✓

T=2ms    Database Query (SYNCHRONOUS)
         ├─ Query: SELECT file_path FROM knowledge_base_entries
         │          WHERE entry_id = '550e8400-...'
         └─ Result: file_path = 'knowledge-base/a1b2c3d4/550e8400-/summarize.md'

T=5ms    S3 Download (ASYNCHRONOUS)
         ├─ Request: GET file-uploads/knowledge-base/a1b2c3d4/550e8400-/summarize.md
         ├─ Network: ~50ms (actual S3 latency)
         │
         │ S3 Server:
         │ ├─ Retrieves: summarize.md from S3 bucket
         │ ├─ Reads file content
         │ └─ Sends bytes over network
         │
         └─ Backend receives: file_bytes = b'# Summarize\n\nYou are...'

T=55ms   Decode bytes to text (IN MEMORY)
         ├─ file_bytes = b'# Summarize\n\nYou are...'
         │  ↓ (decode UTF-8, with error handling)
         ├─ content_text = "# Summarize\n\nYou are..."
         │
         └─ Memory state:
            ┌──────────────────────┐
            │ content_text: string │
            │ "# Summarize..."     │
            │ (in RAM)             │
            └──────────────────────┘

T=60ms   Build JSON response
         ├─ response = {
         │   "content": "# Summarize\n\nYou are...",
         │   "filename": "summarize.md",
         │   "length": 287,
         │   "entry_id": "550e8400-..."
         │ }
         └─ JSON stringified

T=70ms   Send to frontend
         ├─ HTTP Response 200 OK
         ├─ Content-Type: application/json
         ├─ Body: {serialized JSON}
         ├─ Network: ~50ms (send to browser)
         │
         └─ Frontend receives response

T=120ms  Memory cleanup
         ├─ Variables go out of scope
         ├─ Garbage collector frees memory
         │
         └─ Memory state:
            ┌──────────────────────┐
            │ (empty)              │
            │ All freed!           │
            └──────────────────────┘

Total Backend Time: ~120ms
Network Time: ~100ms
Total Perceived Time: ~200-300ms (still very fast!)


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃              FRONTEND PROCESSING (Data Handling)                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Request Flow:

Browser (Frontend)
        │
        │ fetch('/api/knowledge-base/entries/550e8400-.../content')
        │ + headers: { Authorization: 'Bearer ...', }
        │
        ▼
Network                 (Internet)
        │
        │ HTTP GET request
        │ ~50ms latency
        │
        ▼
Backend Server
        │
        ├─ Check auth ✓
        ├─ Query DB: file_path
        ├─ Download from S3
        ├─ Decode bytes
        ├─ Build JSON
        └─ Send response
        │
        │ HTTP 200 Response
        │ {"content": "# Summarize\n...", "filename": "..."}
        │ ~50ms latency
        │
        ▼
Network                 (Internet)
        │
        ▼
Browser (Frontend)

Response Handling:

const response = await fetch(...)
         ↓
if (!response.ok) {
    // Error: fallback to summary
    return { ...entry, content: entry.summary };
}
         ↓
const { content, filename } = await response.json()
         ↓
// Store in React Query cache
return { ...entry, content };  // ← Content now available!
         ↓
activeSlashCommand.prompt = content  // ← Ready to inject!


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    MEMORY DIAGRAM                                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Backend Server RAM:

Time: 0-50ms
┌─────────────────────┐
│ (empty)             │  No request being processed
└─────────────────────┘

Time: 50-55ms (Request + Query)
┌─────────────────────┐
│ file_path: string   │  "knowledge-base/a1b2.../summarize.md"
└─────────────────────┘

Time: 55-70ms (S3 Download + Decode)
┌──────────────────────────┐
│ file_bytes: bytes        │  b'# Summarize\n...'
│ content_text: string     │  "# Summarize\n..."
└──────────────────────────┘

Time: 70-80ms (Build Response)
┌──────────────────────────┐
│ file_bytes: bytes        │
│ content_text: string     │
│ response: dict           │  {"content": "...", ...}
└──────────────────────────┘

Time: 80-90ms (Send + Cleanup)
┌──────────────────────────┐
│ response: dict           │  Still serializing...
└──────────────────────────┘

Time: 90ms+ (Garbage Collection)
┌─────────────────────┐
│ (empty)             │  All variables freed
└─────────────────────┘

Key Point: NOTHING saved to disk
           EVERYTHING in RAM
           ALL freed after response


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                 WHAT ABOUT LARGE FILES?                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Typical Prompt File:     5-50 KB
Practical Limit:        100-200 KB (token limits in LLM)
Current Upload Limit:   100 GB (but won't use it for text prompts)

Memory Impact:
Small (5 KB):      ≈16 KB in RAM    → negligible
Medium (50 KB):    ≈160 KB in RAM   → negligible
Large (500 KB):    ≈1.6 MB in RAM   → minimal
                   (freed after 100ms)


┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    CACHING BEHAVIOR                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

First Time:
User A opens chat
├─ Type "/" → Lists commands (metadata cached)
├─ Select "summarize" → Fetches from S3 (~500ms) → Caches in React Query
└─ Uses prompt

Second Time (same user, same session, within 5 min):
User A opens chat again
├─ Type "/" → Lists commands (uses cached metadata)
├─ Select "summarize" → Uses React Query cache (instant! ⚡)
└─ Uses cached prompt

Next Day:
Same user:
├─ React Query cache expired (5-minute TTL)
├─ Fetches from S3 again
├─ Caches again for 5 minutes

Different User (same 5-min window):
User B in same browser session:
├─ Can't see User A's cache (different React Query instances)
├─ Fetches from S3
├─ Caches in their own session
```

---

## Key Takeaways

### Answer #1: "Where would the file be downloaded to?"
✅ **In memory (RAM) on the backend server**
- S3 download → bytes in RAM
- Decode → string in RAM
- Send response → freed from RAM
- Nothing saved to disk
- Nothing on user's computer

### Answer #2: "How is content returned to frontend?"
✅ **As JSON in HTTP response**
```json
{
  "content": "# Summarize\n\nYou are a world-class...",
  "filename": "summarize.md",
  "length": 287,
  "entry_id": "550e8400-..."
}
```

### Answer #3: "How do we get the actual prompt?"
✅ **The file content IS the prompt**
- Text file: `summarize.md` containing `"# Summarize\n\n..."`
- Frontend receives content string
- Content string directly used as prompt
- Injected with user text: `${content}\n\n${userText}`

---

## Time Breakdown

| Phase | Time | What Happens |
|-------|------|------------|
| **User types "/"** | 0ms | Frontend calls GET /entries (metadata) |
| **Autocomplete shows** | ~50ms | Frontend displays list (cached metadata) |
| **User selects command** | 0ms | Frontend needs content |
| **Request sent** | ~50ms | Network latency to backend |
| **Backend processes** | ~50ms | Query DB + S3 download + decode |
| **Response sent** | ~50ms | Network latency to frontend |
| **Content available** | ~200-300ms | Frontend ready to inject |
| **User sees prompt** | 0ms | Content in input field |
| **User sends message** | 0ms | Injected prompt + user text sent |

**Total perceived time: ~200-300ms** (acceptable, users won't notice)

---

## The Secret: Nothing Special Happens

This is not magic. It's simple:

1. Store file in S3 (already done) ✓
2. Read file from S3 (add endpoint)
3. Return as JSON (add endpoint)
4. Fetch in frontend (update hook)
5. Inject into message (already works)

**That's it!**
