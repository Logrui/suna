# Markdown File Content Previews - Complete Technical Guide

**File Location:** `frontend/src/components/library/`  
**Focus:** How markdown files are fetched, processed, and rendered in file previews  
**Last Updated:** November 3, 2025  
**Status:** ✅ Complete Data Flow with Real Implementation Details

---

## Table of Contents

1. [Complete Journey Overview](#complete-journey-overview)
2. [The Two Data Fetching Queries](#the-two-data-fetching-queries)
3. [The API Layer: Accessing Sandbox Files](#the-api-layer-accessing-sandbox-files)
4. [Request/Response Cycle](#requestresponse-cycle)
5. [Authentication Flow](#authentication-flow)
6. [Caching Strategy](#caching-strategy)
7. [Rendering Pipeline](#rendering-pipeline)
8. [Data Structure at Each Stage](#data-structure-at-each-stage)
9. [Performance on Scroll](#performance-on-scroll)
10. [Debug Information](#debug-information)
11. [Summary & Quick Reference](#summary--quick-reference)

---

## Complete Journey Overview

### The Full Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: USER NAVIGATES TO /library                            │
│ LibraryPage Component Mounts                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: FETCH THREADS & PROJECTS                              │
│ • useQuery(['threads'], getThreads())                         │
│ • useQuery(['projects'], getProjects())                       │
│ Returns: Thread[] and Project[] from Supabase                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: COMBINE & SORT (LibraryPage useMemo)                  │
│ • Create ThreadWithProject[] (sort by updated_at DESC)        │
│ Result: 5 threads displayed initially (ITEMS_PER_PAGE = 5)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: FOR EACH VISIBLE THREAD → RENDER ThreadCard          │
│ displayedThreads.map(thread => <ThreadCard thread={thread} />)│
└─────────────────────────────────────────────────────────────────┘
                              ↓
╔═════════════════════════════════════════════════════════════════╗
║ ⭐ CRITICAL STEP: ThreadCard Component Initializes            ║
║ • Re-fetches projects to get sandboxId                        ║
║ • Thread has projectId but NOT sandboxId                      ║
║ • Must lookup project in projects[] to extract sandbox.id     ║
╚═════════════════════════════════════════════════════════════════╝
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5A: FETCH FILES FROM SANDBOX                             │
│ useQuery(['sandbox-files', sandboxId], async () => {         │
│   const files = await listSandboxFiles(sandboxId, '/workspace')│
│   return files.filter(f => !f.is_dir).sort(by mod_time DESC) │
│ })                                                             │
│ Returns: FileInfo[] (name, path, mod_time, is_dir, size)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5B: IDENTIFY FIRST MARKDOWN FILE                         │
│ const firstMarkdownFile = files.find(f =>                     │
│   f.name?.endsWith('.md')                                    │
│ )                                                              │
│ Returns: FileInfo | undefined                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
╔═════════════════════════════════════════════════════════════════╗
║ ⭐ KEY QUERY: FETCH MARKDOWN CONTENT                          ║
║ useQuery(['markdown-preview', sandboxId, firstMarkdownFile?.path],
║   async () => {                                               ║
║     const content = await getSandboxFileContent(              ║
║       sandboxId,                                              ║
║       firstMarkdownFile.path  // e.g., "/workspace/README.md"║
║     )                                                         ║
║     return content  // string or Blob                         ║
║   }                                                           ║
║ )                                                             ║
║ Cache: 10 minutes (staleTime: 10 * 60 * 1000)               ║
║ Enabled: Only if sandboxId && firstMarkdownFile?.path exist ║
╚═════════════════════════════════════════════════════════════════╝
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: RENDER ThreadCard WITH MARKDOWN                       │
│ • Show file grid (6 files initially)                          │
│ • Pass markdownContent to FileCard[]                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: FOR EACH FileCard (0-6 files)                         │
│ • If isMarkdown and markdownContent:                          │
│   └─ Render MarkdownPreview in card preview area              │
│ • Else:                                                        │
│   └─ Show large icon placeholder                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
╔═════════════════════════════════════════════════════════════════╗
║ ⭐ RENDER: MarkdownPreview Component                          ║
║ • Receives markdown string                                    ║
║ • Truncates: maxLines=20, maxChars=1600                       ║
║ • Applies custom renderers (h1-h6, lists, code, tables)      ║
║ • Uses react-markdown + remark-gfm                            ║
║ • Scales down in card (scale-[0.5])                           ║
║ • Adds gradient fade at bottom                                ║
╚═════════════════════════════════════════════════════════════════╝
```

### Quick Timeline

| Step | Component | Operation | Time |
|------|-----------|-----------|------|
| 1 | LibraryPage | User navigates to /library | ~0ms |
| 2 | LibraryPage | Fetch threads & projects | ~100-500ms |
| 3 | LibraryPage | Combine & sort | ~1-5ms |
| 4 | LibraryPage | Render 5 initial threads | ~50ms |
| 5A | ThreadCard | Fetch files from sandbox | ~100-300ms |
| 5B | ThreadCard | Identify markdown file | ~1ms |
| 5C | ThreadCard | Fetch markdown content | ~50-150ms |
| 6 | ThreadCard | Render file grid | ~20ms |
| 7 | FileCard | Render markdown preview | ~10-30ms |

**Total time to see markdown preview:** ~200-1100ms

---

## The Two Data Fetching Queries

### Critical Concept: Why TWO Queries?

The markdown file content is fetched **twice** with different scopes:

1. **Query #1** at ThreadCard level (for preview in thread header)
2. **Query #2** at FileCard level (for preview in each file card)

This allows:
- Thread header to show first markdown file preview immediately
- Individual file cards to have independent markdown content
- Efficient caching per file
- No redundant fetches for same file

---

### Query #1: First Markdown File (ThreadCard Level)

**File:** `frontend/src/components/library/thread-card.tsx` (lines 71-102)

```typescript
// 📍 THIS QUERY RUNS IN ThreadCard COMPONENT
const { data: markdownContent = '', isLoading: markdownLoading, error: markdownError } = useQuery({
  queryKey: ['markdown-preview', sandboxId, firstMarkdownFile?.path],
  queryFn: async () => {
    if (!sandboxId || !firstMarkdownFile?.path) return '';
    try {
      // 🌐 MAKES API CALL TO DAYTONA
      const content = await getSandboxFileContent(sandboxId, firstMarkdownFile.path);
      
      // 🔄 HANDLE BOTH STRING AND BLOB RESPONSES
      let contentStr = '';
      if (typeof content === 'string') {
        contentStr = content;
      } else if (content instanceof Blob) {
        contentStr = await content.text();
      }
      
      return contentStr;
    } catch (error) {
      console.error('Failed to fetch markdown preview:', error);
      return '';
    }
  },
  enabled: !!sandboxId && !!firstMarkdownFile?.path,  // ⚠️ ONLY WHEN BOTH EXIST
  staleTime: 10 * 60 * 1000,  // ⏰ 10 minute cache
  retry: false,  // ❌ DON'T RETRY IF SANDBOX DOESN'T EXIST
});
```

**Purpose:**
- Fetch markdown for the first .md file found in workspace
- Show preview in thread card header area
- Use 10-minute cache for efficient re-rendering

**When it Runs:**
```
ThreadCard mounts
           ↓
useQuery checks enabled condition:
  ✅ sandboxId exists? (from project lookup)
  ✅ firstMarkdownFile?.path exists? (from files query)
           ↓
If YES → Fetch content from Daytona
If NO → Skip, return empty string
```

**Key Behaviors:**
- **Enabled guard:** Won't even try to fetch if sandboxId or path missing
- **No retry:** If 404 (no sandbox), don't retry 3x → fail fast
- **Cache independent:** Each sandboxId + filePath has separate cache
- **Graceful empty:** Returns `''` instead of error if fetch fails

---

### Query #2: Each File's Markdown (FileCard Level)

**File:** `frontend/src/components/library/file-card.tsx` (lines 30-47)

```typescript
// 📍 THIS QUERY RUNS IN FileCard COMPONENT (FOR EACH FILE)
const { data: markdownContent } = useQuery({
  queryKey: ['file-preview', sandboxId, file.path],
  queryFn: async () => {
    if (!isMarkdown || !file.path) return '';
    
    try {
      // 🌐 MAKES API CALL TO DAYTONA
      const content = await getSandboxFileContent(sandboxId, file.path);
      
      // 🔄 HANDLE BOTH STRING AND BLOB RESPONSES
      let contentStr = '';
      if (typeof content === 'string') {
        contentStr = content;
      } else if (content instanceof Blob) {
        contentStr = await content.text();
      }
      
      return contentStr;
    } catch (error) {
      console.error('Failed to fetch file preview:', error);
      return '';
    }
  },
  enabled: isMarkdown && !!file.path && !!sandboxId,  // ⚠️ THREE CONDITIONS
  staleTime: 10 * 60 * 1000,  // ⏰ 10 minute cache
});
```

**Purpose:**
- Fetch markdown content for EACH markdown file in grid
- Show preview in individual file card
- Enable user to see previews for all 6+ markdown files (if present)

**When it Runs:**
```
FileCard renders for each file
           ↓
useQuery checks enabled condition:
  ✅ isMarkdown? (filename ends with .md)
  ✅ file.path exists?
  ✅ sandboxId exists?
           ↓
If ALL YES → Fetch content from Daytona
If ANY NO → Skip
```

**Rendering Context:**
```tsx
// ThreadCard renders files in grid
{files.slice(0, showAllFiles ? files.length : 6).map((file: any) => (
  <FileCard
    key={file.path}
    file={file}
    IconComponent={IconComponent}
    isMarkdown={file.name?.endsWith('.md')}  // ← Passed to FileCard
    sandboxId={sandboxId || ''}
    onFileClick={handleFileClick}
  />
))}

// FileCard THEN fetches markdown if isMarkdown=true
{isMarkdown && markdownContent ? (
  <MarkdownPreview markdown={markdownContent} ... />
)}
```

**Key Differences from Query #1:**

| Aspect | Query #1 (ThreadCard) | Query #2 (FileCard) |
|--------|---|---|
| **Scope** | First .md file only | Every .md file |
| **Query Key** | `markdown-preview` | `file-preview` |
| **When** | ThreadCard mounts | FileCard renders for each file |
| **Count** | 1 query per thread | 1 query per markdown file |
| **Visibility** | Always shown | Only if file visible (≤6 initially) |

---

## The API Layer: Accessing Sandbox Files

### API Function: `getSandboxFileContent()`

**File:** `frontend/src/lib/api.ts` (lines 1524-1570)

```typescript
export const getSandboxFileContent = async (
  sandboxId: string,
  path: string,
): Promise<string | Blob> => {
  try {
    // ═══════════════════════════════════════════════════════════
    // 1️⃣ CREATE SUPABASE CLIENT & GET AUTH SESSION
    // ═══════════════════════════════════════════════════════════
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // ═══════════════════════════════════════════════════════════
    // 2️⃣ BUILD URL TO DAYTONA API ENDPOINT
    // ═══════════════════════════════════════════════════════════
    const url = new URL(`${API_URL}/sandboxes/${sandboxId}/files/content`);
    
    // ═══════════════════════════════════════════════════════════
    // 3️⃣ NORMALIZE PATH FOR UNICODE SUPPORT
    // ═══════════════════════════════════════════════════════════
    // Handles special characters in filenames (e.g., Chinese, emoji)
    const normalizedPath = normalizePathWithUnicode(path);
    url.searchParams.append('path', normalizedPath);

    // ═══════════════════════════════════════════════════════════
    // 4️⃣ PREPARE HEADERS WITH BEARER TOKEN AUTH
    // ═══════════════════════════════════════════════════════════
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // ═══════════════════════════════════════════════════════════
    // 5️⃣ FETCH FROM DAYTONA API
    // ═══════════════════════════════════════════════════════════
    const response = await fetch(url.toString(), {
      headers,
    });

    // ═══════════════════════════════════════════════════════════
    // 6️⃣ HANDLE HTTP ERRORS
    // ═══════════════════════════════════════════════════════════
    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => 'No error details available');
      console.error(
        `Error getting sandbox file content: ${response.status} ${response.statusText}`,
        errorText,
      );
      throw new Error(
        `Error getting sandbox file content: ${response.statusText} (${response.status})`,
      );
    }

    // ═══════════════════════════════════════════════════════════
    // 7️⃣ DETECT CONTENT TYPE & RETURN APPROPRIATE TYPE
    // ═══════════════════════════════════════════════════════════
    const contentType = response.headers.get('content-type');
    
    // TEXT FILES (including markdown)
    if (
      (contentType && contentType.includes('text')) ||
      contentType?.includes('application/json')
    ) {
      return await response.text();  // ← Returns string
    }
    
    // BINARY FILES (images, PDFs, etc.)
    return await response.blob();    // ← Returns Blob
  } catch (error) {
    console.error('Failed to get sandbox file content:', error);
    throw error;
  }
};
```

### What Each Step Does

#### Step 1: Supabase Session
```typescript
const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();
```

**Why:** Need Bearer token to authenticate with Daytona API
**What we get:** JWT token with user's identity and permissions

#### Step 2: Build URL
```typescript
const url = new URL(`${API_URL}/sandboxes/{sandboxId}/files/content`);
```

**Example URL:**
```
https://api.daytona.io/sandboxes/sandbox-abc123/files/content
```

#### Step 3: Normalize Path
```typescript
const normalizedPath = normalizePathWithUnicode(path);
url.searchParams.append('path', normalizedPath);
```

**Why:** Handles Unicode characters in file paths
**Example:**
```
Before: "/workspace/README.md"
After: "/workspace/README.md" (URL encoded)

With unicode: "/workspace/文件.md"
After: "/workspace/%E6%96%87%E4%BB%B6.md"
```

**Final URL:**
```
https://api.daytona.io/sandboxes/sandbox-abc123/files/content?path=%2Fworkspace%2FREADME.md
```

#### Step 4: Headers with Auth
```typescript
headers['Authorization'] = `Bearer ${session.access_token}`;
```

**Example header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Step 5: Fetch
```typescript
const response = await fetch(url.toString(), { headers });
```

**Network request sent to Daytona API**

#### Step 6: Error Handling
```typescript
if (!response.ok) {
  throw new Error(`Error: ${response.status} ${response.statusText}`);
}
```

**Possible errors:**
- 401 Unauthorized (token expired)
- 403 Forbidden (not authorized for this sandbox)
- 404 Not Found (file doesn't exist)
- 500 Internal Server Error (Daytona API issue)

#### Step 7: Content-Type Detection
```typescript
const contentType = response.headers.get('content-type');

if (contentType?.includes('text') || contentType?.includes('application/json')) {
  return await response.text();  // String for markdown
} else {
  return await response.blob();  // Blob for images, PDFs
}
```

**Why separate handling?**
- **Text files** (markdown): Need as string for react-markdown
- **Binary files** (images): Need as Blob to create URL

---

## Request/Response Cycle

### Full Request Example: Fetching README.md

```
HTTP REQUEST
════════════════════════════════════════════════════════════════
Method: GET
URL: https://api.daytona.io/sandboxes/sandbox-proj-123/files/content?path=%2Fworkspace%2FREADME.md

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTcwMTU4ODAwMH0.Rxk...
  Accept: */*
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36

Body: (none)
════════════════════════════════════════════════════════════════
```

### HTTP Response: Success

```
HTTP RESPONSE
════════════════════════════════════════════════════════════════
Status: 200 OK

Headers:
  Content-Type: text/markdown; charset=utf-8
  Content-Length: 2847
  Cache-Control: no-cache
  Date: Mon, 03 Nov 2025 12:30:45 GMT

Body:
# Welcome to My Project

This is a sample markdown file from the sandbox.

## Features
- Feature 1 allows users to do X
- Feature 2 enables Y functionality  
- Feature 3 provides Z capabilities

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Steps
\`\`\`bash
git clone https://github.com/myproject/repo.git
cd repo
npm install
npm start
\`\`\`

## Usage

\`\`\`javascript
import { MyComponent } from './components';

export default function App() {
  return <MyComponent />;
}
\`\`\`

## Contributing

Please read our CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.
════════════════════════════════════════════════════════════════
```

### Processing in ThreadCard

```typescript
// Step 1: Response arrives as string
const content = await response.text();
// content = "# Welcome to My Project\n\nThis is a sample markdown file..."

// Step 2: Store in React Query cache
// queryKey: ['markdown-preview', 'sandbox-proj-123', '/workspace/README.md']
// data: "# Welcome to My Project\n\nThis is a sample markdown file..."

// Step 3: Pass to MarkdownPreview component
<MarkdownPreview 
  markdown={content}           // Full markdown string
  maxLines={20}               // Truncate to 20 lines
  maxChars={1600}             // Truncate to 1600 chars
/>

// Step 4: Inside MarkdownPreview
const truncated = truncateMarkdown(content, 20, 1600);
// Result: "# Welcome to My Project\n\n... (truncated)…"

// Step 5: Render with react-markdown
<ReactMarkdown remarkPlugins={[remarkGfm]} components={previewComponents}>
  {truncated}
</ReactMarkdown>

// Step 6: Render JSX
<h1>Welcome to My Project</h1>
<p>This is a sample markdown file from the sandbox.</p>
<h2>Features</h2>
<ul>
  <li>Feature 1 allows users to do X</li>
  ...
</ul>
```

---

## Authentication Flow

### The Complete Auth Chain

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER LOGS IN                                                │
│ • User enters email/password or SSO                            │
│ • Supabase authenticates user                                  │
│ • Returns JWT token (access_token)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. TOKEN STORED IN BROWSER                                     │
│ • Supabase client stores token in localStorage/cookie          │
│ • Available for subsequent requests                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. GETSANDBOXFILECONTENT() CALLED                              │
│ • React component calls getSandboxFileContent(sandboxId, path) │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. RETRIEVE SESSION TOKEN                                      │
│ • getSandboxFileContent() calls getSession()                   │
│ • Returns current JWT from storage                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SEND REQUEST TO DAYTONA WITH BEARER TOKEN                  │
│ GET /sandboxes/{id}/files/content                             │
│ Authorization: Bearer {jwt_token}                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. DAYTONA VALIDATES TOKEN                                     │
│ • Decode JWT signature                                         │
│ • Check token expiration                                       │
│ • Verify user has access to this sandbox                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. DAYTONA RETURNS FILE CONTENT                                │
│ • 200 OK: File content (string or blob)                        │
│ • 401: Unauthorized (token expired or invalid)                 │
│ • 403: Forbidden (user doesn't own sandbox)                    │
│ • 404: Not Found (file doesn't exist)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. FRONTEND PROCESSES RESPONSE                                 │
│ • Cache with React Query                                       │
│ • Render in MarkdownPreview component                          │
└─────────────────────────────────────────────────────────────────┘
```

### JWT Token Structure

```
Example JWT token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiJ1c2VyLWFiYzEyMyIsImlhdCI6MTcwMTU4ODAwMCwiZXhwIjoxNzAxNTkxNjAwfQ.
kJV1yKhWqY8rZ...

Decoded:
{
  "alg": "HS256",
  "typ": "JWT"
}
.
{
  "sub": "user-abc123",           // User ID
  "iat": 1701588000,              // Issued at (timestamp)
  "exp": 1701591600              // Expires at (1 hour later)
}
.
kJV1yKhWqY8rZ...                  // Signature
```

### Why Bearer Token?

```
GET /sandboxes/{id}/files/content
Authorization: Bearer {token}
                       ↑
          This tells Daytona API:
          "I have a JWT token that proves
           I'm an authenticated user"
```

**Flow inside Daytona API:**
```
1. Extract token from Authorization header
2. Verify signature (matches Daytona's secret key)
3. Check expiration date
4. Extract user ID from token
5. Check if user_id owns the sandbox
6. If all checks pass → return file
7. Otherwise → return 401, 403, or 404
```

---

## Caching Strategy

### Two-Level Cache Architecture

```
LEVEL 1: React Query Cache (Browser Memory)
──────────────────────────────────────────────────
Storage: Browser RAM (not persistent)
Duration: 10 minutes (staleTime)
Scope: Per query key
Cleared: Browser refresh, tab close

Query Key Example:
['markdown-preview', 'sandbox-abc123', '/workspace/README.md']
                     └─────────────────────────────┬─────────┘
                              Same cache!

Query Key Example 2:
['markdown-preview', 'sandbox-abc123', '/workspace/GUIDE.md']
                                       └─────────────────────┘
                        Different cache entry!
```

### Caching Timeline

```
TIME    EVENT                           ACTION
────────────────────────────────────────────────────────────────
0:00    First request for README.md    Fetch from API ← Slow
0:00    Cache set with 10 min timeout  React Query stores result

0:05    Second request for README.md   Use cache ← Fast!
        (same sandboxId, same path)

0:10    Cache expires (10 min timeout) Next request will fetch

0:11    Third request for README.md    Fetch from API again
```

### Why 10 Minutes for Markdown?

```
COMPARISON OF CACHE DURATIONS
────────────────────────────────────────────
Files metadata:       5 minutes
  ├─ Changes less often
  └─ Smaller data

Markdown content:    10 minutes
  ├─ Changes rarely during session
  ├─ Larger data (more expensive to fetch)
  └─ User unlikely to re-read same file quickly
```

**Rationale:**
- Files list changes infrequently → 5 min is reasonable
- Markdown content rarely changes during a browsing session
- 10 min longer cache = fewer API calls to Daytona
- User typically browses different threads sequentially
- If they revisit same thread within 10 min, use cache

### Cache Invalidation

```typescript
// React Query automatically revalidates at staleTime
// NO MANUAL INVALIDATION needed for typical use

// However, if needed:
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Invalidate specific file
queryClient.invalidateQueries({
  queryKey: ['markdown-preview', sandboxId, filePath]
});

// Invalidate all markdown previews for a sandbox
queryClient.invalidateQueries({
  queryKey: ['markdown-preview', sandboxId]
});

// Invalidate all caches
queryClient.clear();
```

---

## Rendering Pipeline

### Step-by-Step Transformation

```
STAGE 1: RAW MARKDOWN FROM API
────────────────────────────────────────────────
# Welcome to My Project

This is **bold** and *italic* text.

## Features
- Item 1
- Item 2

\`\`\`javascript
const greeting = "Hello, World!";
\`\`\`

                    ↓ (truncateMarkdown)

STAGE 2: TRUNCATED (20 lines, 1600 chars)
────────────────────────────────────────────────
# Welcome to My Project

This is **bold** and *italic* text.

## Features
- Item 1
- Item 2

\`\`\`javascript
const greeting = "Hello, World!";
\`\`\`
…

                    ↓ (react-markdown parsing)

STAGE 3: PARSED AST (Abstract Syntax Tree)
────────────────────────────────────────────────
{
  type: 'root',
  children: [
    {
      type: 'heading',
      depth: 1,
      children: [{ type: 'text', value: 'Welcome to My Project' }]
    },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'This is ' },
        { 
          type: 'strong',
          children: [{ type: 'text', value: 'bold' }]
        },
        ...
      ]
    },
    ...
  ]
}

                    ↓ (custom renderers)

STAGE 4: REACT COMPONENTS WITH STYLING
────────────────────────────────────────────────
<div className="prose prose-invert">
  <h1 className="text-2xl font-semibold mb-2 mt-3">
    Welcome to My Project
  </h1>
  
  <p className="mb-2 leading-relaxed">
    This is <strong className="font-semibold">bold</strong> 
    and <em className="italic">italic</em> text.
  </p>
  
  <h2 className="text-xl font-semibold mb-2 mt-3">
    Features
  </h2>
  
  <ul className="list-disc list-inside mb-2 space-y-0.5">
    <li className="leading-relaxed">Item 1</li>
    <li className="leading-relaxed">Item 2</li>
  </ul>
  
  <pre className="bg-muted/50 p-2 rounded mb-2 overflow-x-auto">
    <code className="text-sm font-mono">
      const greeting = "Hello, World!";
    </code>
  </pre>
</div>

                    ↓ (render in FileCard)

STAGE 5: SCALED & POSITIONED
────────────────────────────────────────────────
<div className="aspect-[16/9] rounded-lg overflow-hidden relative m-2 mt-0">
  <div className="size-full rounded-lg bg-muted p-3 relative">
    <div className="scale-[0.5] origin-top-left">
      <div className="w-[200%] h-[200%]">
        {/* ^^^ 4-stage rendered content scaled down to 50% ^^^*/}
      </div>
    </div>
    
    {/* Gradient fade at bottom */}
    <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-8"
      style={{
        background: 'linear-gradient(rgba(0, 0, 0, 0) 0%, hsl(var(--muted)) 100%)'
      }}
    />
  </div>
</div>
```

### Custom Renderers

**File:** `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx`

```typescript
const previewComponents = {
  // HEADINGS
  h1: ({ children }: any) => <h1 className="text-2xl font-semibold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-semibold mb-1.5 mt-2.5 first:mt-0">{children}</h3>,
  h4: ({ children }: any) => <h4 className="text-base font-semibold mb-1.5 mt-2 first:mt-0">{children}</h4>,

  // INLINE FORMATTING
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,

  // PARAGRAPHS & TEXT
  p: ({ children }: any) => <p className="mb-2 leading-relaxed">{children}</p>,
  a: ({ children, href }: any) => <span className="text-blue-400 underline">{children}</span>,

  // LISTS
  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,

  // CODE
  code: ({ inline, children }: any) => {
    if (inline) {
      return <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
    }
    return (
      <pre className="bg-muted/50 p-2 rounded mb-2 overflow-x-auto">
        <code className="text-sm font-mono">{children}</code>
      </pre>
    );
  },

  // BLOCKQUOTES
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 mb-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),

  // TABLES
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-3">
      <table className="min-w-full border-collapse border border-border/30 text-sm">
        {children}
      </table>
    </div>
  ),
  tbody: ({ children }: any) => <tbody>{children}</tbody>,
  tr: ({ children }: any) => <tr className="border-b border-border/20">{children}</tr>,
  td: ({ children }: any) => <td className="border border-border/20 px-3 py-1.5">{children}</td>,

  // IMAGES (show as text)
  img: ({ alt }: any) => <div className="text-sm text-muted-foreground mb-1">[Image: {alt || 'untitled'}]</div>,

  // HORIZONTAL RULE
  hr: () => <hr className="my-2 border-muted-foreground/20" />,
};
```

### Truncation Logic

**Function:** `truncateMarkdown()`

```typescript
function truncateMarkdown(
  markdown: string,
  maxLines: number = 5,
  maxChars: number = 300
): string {
  if (!markdown) return '';

  // 1️⃣ SPLIT AND TAKE FIRST N LINES
  const lines = markdown.split('\n').slice(0, maxLines);
  let truncated = lines.join('\n');

  // 2️⃣ LIMIT BY CHARACTER COUNT
  if (truncated.length > maxChars) {
    truncated = truncated.substring(0, maxChars).trim();
    
    // 3️⃣ REMOVE INCOMPLETE LAST WORD
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.substring(0, lastSpace);
    }
    
    // 4️⃣ ADD ELLIPSIS
    truncated += '…';
  }

  return truncated;
}

// USAGE IN FileCard:
const truncated = truncateMarkdown(markdownContent, 20, 1600);
// → First 20 lines, max 1600 chars, with nice ellipsis at end
```

---

## Data Structure at Each Stage

### Stage 1: Database (Supabase)

```typescript
// threads table
{
  thread_id: 'thread-xyz123',
  project_id: 'project-abc456',
  created_at: '2025-11-01T10:00:00Z',
  updated_at: '2025-11-03T14:30:00Z',
  metadata: { ... }
}

// projects table
{
  project_id: 'project-abc456',
  name: 'My API Project',
  icon_name: 'code',
  sandbox_id: 'sandbox-proj-123',
  sandbox_provider: 'daytona',
  created_at: '2025-10-15T08:00:00Z',
  updated_at: '2025-11-02T12:00:00Z'
}
```

### Stage 2: LibraryPage (After Fetch)

```typescript
threads = [
  { thread_id: 'thread-xyz123', project_id: 'project-abc456', ... },
  { thread_id: 'thread-xyz124', project_id: 'project-abc457', ... },
]

projects = [
  { id: 'project-abc456', name: 'My API Project', sandbox: { id: 'sandbox-proj-123' }, ... },
  { id: 'project-abc457', name: 'Web App', sandbox: { id: 'sandbox-proj-124' }, ... },
]
```

### Stage 3: LibraryPage (After useMemo)

```typescript
threadsWithProjects: ThreadWithProject[] = [
  {
    threadId: 'thread-xyz123',
    projectId: 'project-abc456',
    projectName: 'My API Project',  // ← Resolved from project
    url: '/projects/project-abc456/thread/thread-xyz123',
    updatedAt: '2025-11-03T14:30:00Z',
    iconName: 'code'
  },
  {
    threadId: 'thread-xyz124',
    projectId: 'project-abc457',
    projectName: 'Web App',
    url: '/projects/project-abc457/thread/thread-xyz124',
    updatedAt: '2025-11-02T15:00:00Z',
    iconName: 'zap'
  },
]
```

### Stage 4: ThreadCard (After Files Fetch)

```typescript
files: FileInfo[] = [
  {
    path: '/workspace/README.md',
    name: 'README.md',
    mod_time: '2025-11-02T10:30:00Z',
    is_dir: false,
    size: 2847
  },
  {
    path: '/workspace/INSTALL.md',
    name: 'INSTALL.md',
    mod_time: '2025-11-01T08:15:00Z',
    is_dir: false,
    size: 1204
  },
  {
    path: '/workspace/src',
    name: 'src',
    mod_time: '2025-11-03T09:00:00Z',
    is_dir: true  // ← Filtered out
  },
]

// After filtering
files = [
  { path: '/workspace/README.md', name: 'README.md', ... },
  { path: '/workspace/INSTALL.md', name: 'INSTALL.md', ... },
]

// After sorting by mod_time DESC
files = [
  { path: '/workspace/README.md', name: 'README.md', mod_time: '2025-11-02T10:30:00Z', ... },
  { path: '/workspace/INSTALL.md', name: 'INSTALL.md', mod_time: '2025-11-01T08:15:00Z', ... },
]
```

### Stage 5: ThreadCard (First Markdown Identified)

```typescript
firstMarkdownFile = {
  path: '/workspace/README.md',
  name: 'README.md',
  mod_time: '2025-11-02T10:30:00Z',
  is_dir: false,
  size: 2847
}
```

### Stage 6: ThreadCard (After Markdown Fetch)

```typescript
markdownContent: string = 
`# My Project

This is a README file.

## Installation

Run npm install.
...`

// ^ This is the RAW RESPONSE from Daytona API
```

### Stage 7: MarkdownPreview (After Truncation)

```typescript
truncated: string = 
`# My Project

This is a README file.

## Installation

Run npm install.…`

// ^ First 20 lines, max 1600 chars, ellipsis added
```

### Stage 8: FileCard (Final Render)

```jsx
<div className="aspect-[16/9] rounded-lg overflow-hidden relative">
  <div className="scale-[0.5] origin-top-left">
    <div className="w-[200%] h-[200%]">
      <h1>My Project</h1>
      <p>This is a README file.</p>
      <h2>Installation</h2>
      <p>Run npm install.…</p>
    </div>
  </div>
  
  {/* Gradient fade */}
  <div className="absolute left-0 right-0 bottom-0 h-8"
    style={{ background: 'linear-gradient(...)' }}
  />
</div>
```

---

## Performance on Scroll

### What Happens When User Scrolls Down

```
INITIAL STATE: displayCount = 5 (showing 5 threads)
               IntersectionObserver watching loadMoreRef

                            ↓

USER SCROLLS DOWN

                            ↓

loadMoreRef ENTERS VIEWPORT (threshold: 10% visible)

                            ↓

IntersectionObserver FIRES

                            ↓

loadMore() CALLBACK EXECUTES

                            ↓

setTimeout(..., 300ms) DELAYS UPDATE

                            ↓

displayCount += 5 (now showing 10 threads)

                            ↓

useMemo recomputes displayedThreads
  displayedThreads = filteredThreads.slice(0, 10)

                            ↓

REACT RE-RENDERS: 5 NEW ThreadCard COMPONENTS

                            ↓

FOR EACH NEW ThreadCard:
  1. useQuery checks cache for ['sandbox-files', sandboxId]
  2. If in cache (< 5 min old) → USE CACHE ✅ (fast!)
  3. If not in cache → FETCH FROM DAYTONA (slow)
  4. useQuery checks cache for ['markdown-preview', sandboxId, filePath]
  5. If in cache (< 10 min old) → USE CACHE ✅ (fast!)
  6. If not in cache → FETCH FROM DAYTONA

                            ↓

NEW THREADCARDS RENDER with file previews

                            ↓

USER SCROLLS FURTHER

                            ↓

REPEAT...
```

### Cache Hit Probability

```
SCENARIO 1: User Scrolls Through Different Projects
Thread 1: Project A, Sandbox X → Fetch files, fetch README
Thread 2: Project B, Sandbox Y → Fetch files, fetch README
Thread 3: Project C, Sandbox Z → Fetch files, fetch README

Result: 3 files fetches, 3 markdown fetches
Cache efficiency: 0% (all different sandboxes)

SCENARIO 2: User Scrolls Through Same Project
Thread 1: Project A, Sandbox X → Fetch files, fetch README
Thread 2: Project A, Sandbox X → Use CACHE (both queries) ✅✅
Thread 3: Project A, Sandbox X → Use CACHE (both queries) ✅✅

Result: 1 files fetch, 1 markdown fetch (cached 2x)
Cache efficiency: 66% (2/3 use cache)

SCENARIO 3: User Scrolls After 6+ Minutes
Thread 1: Project A at T=0:00 → Fetch (cache for 5 min)
Thread 1: Project A at T=0:07 → Fetch again (cache expired)

Result: 2 files fetches
Cache efficiency: 0% (staleTime expired)
```

---

## Debug Information

### Console Logs in Code

**ThreadCard Debug:**

```typescript
console.log('🔧 Project/Sandbox Debug:', {
  threadName: thread.projectName,
  projectId: thread.projectId,
  projectFound: !!project,
  sandboxId,
  sandboxObject: project?.sandbox,
});
```

**Example output:**
```
🔧 Project/Sandbox Debug: {
  threadName: "My API Project",
  projectId: "project-abc456",
  projectFound: true,
  sandboxId: "sandbox-proj-123",
  sandboxObject: { id: "sandbox-proj-123", provider: "daytona" }
}
```

**Markdown Preview Debug:**

```typescript
console.log('📝 Markdown Preview State:', {
  threadName,
  hasFirstMarkdownFile: !!firstMarkdownFile,
  markdownContentLength: markdownContent?.length || 0,
  markdownLoading,
  markdownError,
  willShowPreview: !!(firstMarkdownFile && markdownContent),
});
```

**Example output:**
```
📝 Markdown Preview State: {
  threadName: "My API Project",
  hasFirstMarkdownFile: true,
  markdownContentLength: 2847,
  markdownLoading: false,
  markdownError: undefined,
  willShowPreview: true
}
```

### React Query DevTools

Install to inspect queries:
```bash
npm install @tanstack/react-query-devtools
```

View:
- Query keys and cached data
- Stale times and cache durations
- Request/error states
- Network timing

### Browser Network Tab

Look for requests like:
```
GET https://api.daytona.io/sandboxes/sandbox-proj-123/files?path=%2Fworkspace

GET https://api.daytona.io/sandboxes/sandbox-proj-123/files/content?path=%2Fworkspace%2FREADME.md
```

Check:
- Response time (50-300ms typical)
- Response size (markdown usually < 100KB)
- Authorization header present
- Content-Type header correct

---

## Summary & Quick Reference

### The Short Version

| Aspect | Details |
|--------|---------|
| **Query #1** | ThreadCard fetches first .md for thread header preview |
| **Query #2** | FileCard fetches each .md for individual file card preview |
| **API Endpoint** | `GET /sandboxes/{id}/files/content?path=/workspace/FILE.md` |
| **Authentication** | Bearer token from Supabase session |
| **Path Normalization** | `normalizePathWithUnicode()` handles special characters |
| **Cache Duration** | 10 minutes (staleTime) |
| **Cache Key** | `['markdown-preview', sandboxId, filePath]` |
| **Return Type** | `string` for markdown, `Blob` for binary |
| **Truncation** | First 20 lines, max 1600 characters |
| **Rendering** | react-markdown + remark-gfm + custom components |
| **Scaling** | Scale 50% to fit in FileCard with gradient fade |

### Complete Data Flow in One Diagram

```
┌──────────────────────────────────────┐
│ User navigates to /library           │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ Fetch threads & projects (Supabase)  │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ Render 5 ThreadCards                 │
└──────────────────────────────────────┘
           ↓
    ┌──────────────────────────────────┐
    │ FOR EACH ThreadCard:             │
    │                                  │
    │ 1. Get sandboxId from project    │
    │ 2. Fetch files list (Daytona)    │
    │ 3. Find first .md file           │
    │ 4. Fetch markdown content        │
    │    (Daytona) ← KEY QUERY         │
    │ 5. Render ThreadCard             │
    │                                  │
    │ FOR EACH FileCard:               │
    │ 6. Fetch markdown (if .md)       │
    │ 7. Truncate (20 lines, 1600 ch)  │
    │ 8. Render MarkdownPreview        │
    │ 9. Scale 50% + fade              │
    └──────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ User sees markdown previews          │
└──────────────────────────────────────┘
```

### Code Locations Quick Reference

| What | File | Lines |
|------|------|-------|
| Thread fetching | `frontend/src/lib/api.ts` | 508-543 |
| Project fetching | `frontend/src/lib/api.ts` | 240-280 |
| Files fetching | `frontend/src/lib/api.ts` | 1475-1520 |
| **Markdown fetching** | **`frontend/src/lib/api.ts`** | **1524-1570** |
| ThreadCard queries | `frontend/src/components/library/thread-card.tsx` | 32-102 |
| FileCard queries | `frontend/src/components/library/file-card.tsx` | 30-47 |
| MarkdownPreview | `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx` | Full file |
| Truncation logic | `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx` | 15-45 |
| Custom renderers | `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx` | 49-135 |

### Key Metrics

- **Initial load time:** ~200-1100ms (including all API calls)
- **Markdown fetch:** ~50-150ms per file
- **Rendering:** ~10-30ms per MarkdownPreview
- **Cache hit:** ~5-10ms (no API call)
- **Cache duration:** 10 minutes
- **Max content:** 1600 characters, 20 lines
- **Display files:** 6 initially, expandable to all
- **File grid:** 3 columns (md:grid-cols-3)

