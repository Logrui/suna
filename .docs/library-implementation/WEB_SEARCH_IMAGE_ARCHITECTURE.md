# Web Search & Image Search Architecture: URLs-Only Storage Pattern

## Overview

When users perform web searches or image searches in Suna's Computer, the resulting images are **NOT downloaded and stored persistently**. Instead, **image URLs are stored as references** in the message content. This is fundamentally different from other image pipelines (browser screenshots, user-loaded images, design tool outputs).

---

## 1. Backend Image Sources

### 1.1 Web Search Tool (`web_search_tool.py`)

**Location:** `backend/core/tools/web_search_tool.py`

```python
# Line 65-125: web_search() method

search_response = await self.tavily_client.search(
    query=query,
    max_results=num_results,
    include_images=True,  # ← KEY: Enables image URLs in response
    include_answer="advanced",
    search_depth="advanced",
)

# Returns complete search_response with structure:
return ToolResult(
    success=True,
    output=json.dumps(search_response, ensure_ascii=False)
)
```

**Response Structure from Tavily API:**
```json
{
  "results": [
    {
      "title": "...",
      "url": "...",
      "content": "...",
      "publish_date": "..."
    }
  ],
  "answer": "Advanced synthesized answer",
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg",
    ...
  ]
}
```

**Key Characteristics:**
- `images` array contains **external URLs only** (strings)
- No image download process
- No conversion to blob URLs
- URLs point to external domains (not Supabase, not sandbox)
- Returned as JSON string in `ToolResult.output`

### 1.2 Image Search Tool (`image_search_tool.py`)

**Location:** `backend/core/tools/image_search_tool.py`

```python
# Line 70-220: image_search() method

# Single search response:
result = {
    "query": queries[0],
    "total_found": len(image_urls),
    "images": image_urls  # ← Array of image URLs from SERPER API
}

# Batch search response:
result = {
    "batch_results": [
        {
            "query": q,
            "total_found": len(image_urls),
            "images": image_urls
        }
        for q, image_urls in zip(queries, data)
    ],
    "total_queries": len(queries)
}

return ToolResult(
    success=True,
    output=json.dumps(result, ensure_ascii=False)
)
```

**Response Structure from SERPER API:**
```json
{
  "query": "cats",
  "total_found": 12,
  "images": [
    "https://cdn.example.com/cat1.jpg",
    "https://cdn.example.com/cat2.jpg",
    ...
  ]
}
```

**Key Characteristics:**
- Images extracted from SERPER API response
- Only `imageUrl` fields extracted (line 195-197)
- URLs are external references (SERPER CDN or source domain)
- No download or persistence logic
- Supports batch queries (multiple search terms at once)

---

## 2. Message Storage Architecture

### 2.1 Tool Result Storage Process

**Location:** `backend/core/agentpress/response_processor.py` (lines 1880-1950)

```python
# Line 1889-1895: Tool message storage

message_obj = await self.add_message(
    thread_id=thread_id,
    type="tool",  # ← Message type for all tool results
    content=tool_message,  # ← Contains ToolResult.output as JSON
    is_llm_message=True,
    metadata=metadata
)
```

### 2.2 Database Schema

**Location:** `backend/core/agentpress/thread_manager.py` (lines 76-110)

```python
# Supabase messages table structure

data_to_insert = {
    'thread_id': thread_id,           # UUID of conversation
    'type': type,                     # "tool" for search results
    'content': content,               # JSON: tool result data
    'is_llm_message': is_llm_message, # True for tool results
    'metadata': metadata or {},       # Optional metadata
    'agent_id': agent_id,            # Optional: which agent executed
    'agent_version_id': agent_version_id,  # Optional: agent version
}

# Inserted via:
result = await client.table('messages').insert(data_to_insert).execute()
```

### 2.3 Message Content Format

For web search tool result, `content` stored in database:

```json
{
  "role": "assistant",
  "content": {
    "tool_execution": {
      "tool_name": "web_search",
      "tool_call_id": "call_xyz",
      "arguments": {
        "query": "artificial intelligence trends 2024"
      },
      "result": {
        "success": true,
        "output": "{\"results\": [...], \"answer\": \"...\", \"images\": [\"url1\", \"url2\", ...]}"
      },
      "execution_details": {
        "timestamp": "2024-01-15T10:30:00Z"
      }
    }
  }
}
```

**Critical Point:** 
- The `images` array contains **URL strings only**
- No image data is stored in database
- Images remain external references
- URLs are preserved as-is from Tavily/SERPER APIs

---

## 3. Frontend Rendering Pipeline

### 3.1 Data Extraction

**Location:** `frontend/src/components/thread/tool-views/web-search-tool/_utils.ts` (lines 1-100)

```typescript
const extractFromNewFormat = (content: any): WebSearchData => {
  // Parse tool_execution structure
  const toolExecution = parsedContent.tool_execution;
  const args = toolExecution.arguments || {};
  
  let parsedOutput = toolExecution.result?.output;
  if (typeof parsedOutput === 'string') {
    try {
      parsedOutput = JSON.parse(parsedOutput);  // ← Parse JSON string
    } catch (e) {}
  }
  
  // Extract images array
  let images: string[] = [];
  
  if (parsedOutput?.batch_results && Array.isArray(parsedOutput.batch_results)) {
    // Batch: flatten images from all queries
    images = parsedOutput.batch_results.reduce((acc: string[], result: any) => {
      return acc.concat(result.images || []);
    }, []);
  } else {
    // Single: direct access
    images = parsedOutput?.images || [];
  }
  
  return {
    query: args.query,
    results: parsedOutput?.results?.map(...) || [],
    answer: parsedOutput?.answer || null,
    images,  // ← Array of image URLs
    success: toolExecution.result?.success,
    timestamp: toolExecution.execution_details?.timestamp
  };
};
```

### 3.2 Image Rendering Component

**Location:** `frontend/src/components/thread/tool-views/web-search-tool/WebSearchToolView.tsx` (lines 128-165)

```tsx
{images.length > 0 && (
  <div className="mb-6">
    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
      <ImageIcon className="h-4 w-4 mr-2 opacity-70" />
      Images {name === 'image-search' && `(${images.length})`}
    </h3>
    <div className={`grid gap-3 ${name === 'image-search' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {(name === 'image-search' ? images : images.slice(0, 6)).map((image, idx) => {
        const imageUrl = typeof image === 'string' ? image : (image as any).imageUrl;
        
        return (
          <a
            key={idx}
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-lg"
          >
            <img
              src={imageUrl}  // ← Direct URL from search response
              alt={`Search result ${idx + 1}`}
              className="object-cover w-full h-32"
              onError={(e) => {
                // Fallback SVG if image fails to load
                const target = e.target as HTMLImageElement;
                target.src = "data:image/svg+xml,%3Csvg...%3E";
              }}
            />
          </a>
        );
      })}
    </div>
  </div>
)}
```

**Key Rendering Features:**
- Web search: Shows first 6 images (with "View X more" button)
- Image search: Shows all images in grid (adjusts columns for device)
- Direct `<img src={imageUrl}>` with no transformation
- External links open in new tab (`target="_blank"`)
- Graceful fallback for broken images (SVG placeholder)
- No caching mechanism on frontend (browser cache only)

---

## 4. URL Storage Comparison: Search vs Other Images

| Aspect | Web Search Images | Browser Screenshots | User-Loaded Images | Design Tool Output |
|--------|-------------------|-------------------|-------------------|-------------------|
| **Source** | Tavily/SERPER API | Browser.screenshot() tool | User upload | Image generation tool |
| **Storage** | URL reference only | Uploaded to Supabase | Uploaded to Supabase | File saved to sandbox |
| **URL Type** | External (cdn.example.com) | Supabase public URL | Supabase public URL | Sandbox path |
| **Download Step** | ❌ No | ✅ Yes (base64 → upload) | ✅ Yes (compress → upload) | ❌ No |
| **Persistence** | ✅ In message.content | ✅ In Supabase Storage | ✅ In Supabase Storage | ✅ In sandbox /workspace |
| **Reference Type** | URL string | URL string | URL string | Path string |
| **Bandwidth Used** | Only for display | On upload + CDN | On upload + CDN | Local only |
| **Message Size** | Small (~100 chars/URL) | Large (base64) | Large (compressed) | Small (path string) |
| **Cache Control** | Browser cache only | Supabase CDN + browser | Supabase CDN + browser | Sandbox file cache |

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ACTION                               │
│            "Search for cats on the internet"                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Agent calls web_search │
        │ with query="cats"      │
        └────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Tavily API receives request    │
        │ include_images=True            │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Tavily returns:                │
        │ - results: [...]               │
        │ - answer: "..."                │
        │ - images: ["url1", "url2", ...] │
        │                                │
        │ NO IMAGE DOWNLOADS             │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ ToolResult wraps response      │
        │ output=json_string with URLs   │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ response_processor stores       │
        │ type="tool" message in DB       │
        │ content includes URL array      │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Frontend retrieves message     │
        │ Extracts images URL array      │
        │ Renders <img src={url}>        │
        │                                │
        │ URLs loaded directly from      │
        │ external sources (Tavily CDN,  │
        │ source domains, etc.)          │
        └────────────────────────────────┘
```

---

## 6. Why URLs-Only Storage?

### 6.1 Design Rationale

1. **Ephemeral Content:** Search results are time-sensitive. URLs may become outdated or broken.
2. **Storage Efficiency:** Storing references instead of duplicates saves space (100 bytes vs 1MB per image).
3. **Attribution:** Original source URLs preserved for user traceability.
4. **External Responsibility:** Search results "belong" to external services; Suna acts as a proxy/aggregator.
5. **Performance:** No upload overhead, instant display, no compression processing.
6. **Legal:** External URLs provide clear attribution to sources; storing copies could raise copyright issues.

### 6.2 When to Download (Counter-pattern)

Other tools download and persist images when:
- **Browser screenshots:** User explicitly wants to preserve rendered page state
- **User uploads:** User explicitly saves/shares file
- **Design generation:** Tool output is derivative work (Suna's intellectual output)
- **Long-term reference:** Data needs to outlive source availability

---

## 7. Edge Cases & Handling

### 7.1 Broken Image Links

**Scenario:** External URL becomes unavailable after search

**Frontend Handling:**
```tsx
<img
  src={imageUrl}
  onError={(e) => {
    const target = e.target as HTMLImageElement;
    // Replace with SVG placeholder
    target.src = "data:image/svg+xml,%3Csvg...%3E";
    target.classList.add("p-4");
  }}
/>
```

**Result:** Broken image icon shown instead of error

### 7.2 Mixed Response Types

**Scenario:** Batch image search with multiple queries

**Handling:** (`_utils.ts` lines 45-58)
```typescript
if (parsedOutput?.batch_results && Array.isArray(parsedOutput.batch_results)) {
  // Flatten all images from all queries
  images = parsedOutput.batch_results.reduce((acc: string[], result: any) => {
    return acc.concat(result.images || []);
  }, []);
}
```

**Result:** All images displayed in single grid

### 7.3 CORS & Cross-Origin Issues

**Scenario:** Image hosted on external domain with CORS restrictions

**Current Behavior:** Browser blocks load (CORS policy)

**Potential Solutions:**
1. Proxy through backend `/api/image-proxy?url=...`
2. Store URLs with CORS header modifications
3. Implement server-side image caching (trade-off)

---

## 8. Contrast with Screenshot Pipeline

### Browser Tool Screenshot (Line 279, `browser_tool.py`)

```python
# Different approach: Downloads and uploads

if screenshot_successful:
    added_message = await self.thread_manager.add_message(
        type="tool",
        content={
            "image": screenshot_base64,  # ← Base64 encoded binary
            "timestamp": datetime.now(),
        }
    )
    # Later: upload_to_supabase(base64_data)
    # Store URL in message for retrieval
```

**vs Web Search Images:**

```python
# URLs-only approach: Stores references only

search_response = await self.tavily_client.search(...)
# search_response['images'] = ["url1", "url2", ...]

added_message = await self.thread_manager.add_message(
    type="tool",
    content={
        "images": search_response['images'],  # ← URLs only
        "timestamp": datetime.now(),
    }
)
# No upload process
# URLs stored as-is
```

---

## 9. API Response Examples

### 9.1 Tavily Web Search Response

```json
{
  "results": [
    {
      "title": "AI Trends 2024",
      "url": "https://example.com/article",
      "content": "In 2024, artificial intelligence...",
      "publish_date": "2024-01-15"
    }
  ],
  "answer": "Key AI trends in 2024 include...",
  "images": [
    "https://cdn.tavily.com/search/img1.jpg",
    "https://images.example.com/trend1.png",
    "https://s3.amazonaws.com/data/ai-chart.jpg"
  ]
}
```

### 9.2 SERPER Image Search Response (Single)

```json
{
  "searchParameters": {
    "q": "cats",
    "type": "images",
    "engine": "google"
  },
  "images": [
    {
      "imageUrl": "https://example.com/cat1.jpg",
      "link": "https://catsite.com/page1",
      "source": "cat.com"
    },
    {
      "imageUrl": "https://cdn.example.com/cat2.jpg",
      "link": "https://animalsite.com",
      "source": "animals.net"
    }
  ]
}
```

### 9.3 SERPER Image Search Response (Batch)

```json
[
  {
    "images": [
      {"imageUrl": "https://cdn.ex.com/cats1.jpg"},
      {"imageUrl": "https://cdn.ex.com/cats2.jpg"}
    ]
  },
  {
    "images": [
      {"imageUrl": "https://cdn.ex.com/dogs1.jpg"},
      {"imageUrl": "https://cdn.ex.com/dogs2.jpg"}
    ]
  }
]
```

---

## 10. Message Type Taxonomy

All search results stored with `type="tool"` in messages table:

```typescript
// Message types in thread
type MessageType = 
  | "user"              // User input
  | "assistant"         // LLM response
  | "tool"              // Tool result (web_search, image_search, browser, etc.)
  | "browser_state"     // Browser screenshot
  | "image_context"     // User-uploaded image
  | "system"            // System messages
  | "llm_response_end"  // LLM response complete
  | "tool_call_chunk"   // Streaming tool call data
```

For web/image search specifically:
- `type: "tool"`
- `content.tool_execution.tool_name: "web_search" | "image_search"`
- `content.tool_execution.result.output: "{...images: [\"url1\", \"url2\"]...}"`

---

## 11. Performance Implications

### Storage
- **Per search:** ~500 bytes - 5 KB (12 URLs × ~50-100 chars each)
- **Annual (1000 searches):** ~2.5-5 MB per user
- **Savings vs download:** 100-1000X (images would be 100 KB - 10 MB per search)

### Display Performance
- **Load time:** Instant (no processing, stored URLs)
- **Rendering:** Lazy load images on scroll
- **Bandwidth:** Only when images viewed (user-driven, not automatic)

### CORS Overhead
- **Current:** Browser handles CORS with external domains
- **Potential issue:** Some images may fail to load
- **Solution impact:** Proxy would add ~50-200ms latency per image

---

## 12. Future Enhancement Opportunities

### 12.1 Image Caching Layer

```typescript
// Could implement persistent caching

interface CachedSearchImage {
  original_url: string;
  cached_url: string;  // Supabase URL
  search_id: string;
  timestamp: Date;
  expiry: Date;
}
```

**Trade-off:** Better persistence vs increased storage costs

### 12.2 Gallery View Integration

Could display recent search images in `/library` gallery:
- Extract images from recent search messages
- Show with search query context
- Re-execute search to refresh

### 12.3 Thumbnail Caching

```typescript
// On first display, generate thumbnail

function getCachedThumbnail(imageUrl: string) {
  // Cache at Supabase with TTL
  // Prevents CORS issues on first display
  // Client loads cached version instead
}
```

---

## Summary

**Web Search Images Architecture:**
- ✅ URLs stored as references in `message.content.images[]`
- ✅ No download or upload process
- ✅ External URLs from Tavily/SERPER APIs
- ✅ Rendered directly via `<img src={url}>`
- ✅ Storage efficient (~500 bytes per search vs 10+ MB)
- ✅ Attribution preserved to sources
- ⚠️ CORS issues possible but handled gracefully
- ⚠️ Links may break if source URL becomes unavailable

This contrasts with browser screenshots (uploaded to Supabase) and user-loaded images (compressed + uploaded), demonstrating Suna's pragmatic approach: **store references for ephemeral content, persist copies only for permanent artifacts**.
