# Library Data Flow Documentation (V2)

**File Location:** `frontend/src/components/library/`  
**Focus:** Complete data lifecycle from API to UI rendering  
**Last Updated:** November 3, 2025  
**Status:** ✅ Verified Against Source Code

---

## Table of Contents

1. [Overview](#overview)
2. [Thread Loading Data Flow](#thread-loading-data-flow)
3. [Project Resolution Data Flow](#project-resolution-data-flow)
4. [File Fetching & Preview Data Flow](#file-fetching--preview-data-flow)
5. [Markdown Content Data Flow](#markdown-content-data-flow)
6. [Search & Filter Data Flow](#search--filter-data-flow)
7. [Favorites Persistence](#favorites-persistence)
8. [API Function Reference](#api-function-reference)

---

## Overview

The Library Page implements a multi-layer data flow with progressive loading and caching:

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: THREAD & PROJECT DATA (LibraryPage)            │
│ Fetch threads & projects via React Query                │
│ Combine, sort, filter, progressive load                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: DISPLAY (ThreadCard × N)                       │
│ Render each thread with header, star, date              │
│ Resolve project to get sandboxId                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: FILE METADATA (ThreadCard)                     │
│ Fetch files from sandbox, filter & sort                 │
│ Identify markdown files                                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: FILE RENDERING (FileCard × 6)                 │
│ Render file icons, names, show first 6 files            │
│ Fetch markdown content for preview                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 5: MARKDOWN PREVIEW (MarkdownPreview)            │
│ Render markdown with truncation (20 lines, 1600 chars)  │
│ Apply custom renderers, scale to fit card               │
└─────────────────────────────────────────────────────────┘
```

---

## Thread Loading Data Flow

### Component: LibraryPage
**File:** `frontend/src/components/library/library-page.tsx` (lines 44-50)

### Initial Data Fetch

```typescript
// Query 1: Fetch all threads for current user
const { data: threads = [], isLoading: threadsLoading } = useQuery({
  queryKey: ['threads'],
  queryFn: () => getThreads(),
});

// Query 2: Fetch all projects for current user
const { data: projects = [], isLoading: projectsLoading } = useQuery({
  queryKey: ['projects'],
  queryFn: () => getProjects(),
});

const isLoading = threadsLoading || projectsLoading;
```

### API Function: getThreads()
**File:** `frontend/src/lib/api.ts` (lines 508-543)

```typescript
export const getThreads = async (projectId?: string): Promise<Thread[]> => {
  const supabase = createClient();

  // 1. Get current user session
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('Error getting current user:', userError);
    return [];
  }

  // 2. Verify user is authenticated
  if (!userData.user) {
    return [];
  }

  // 3. Build query - always filter by account_id (current user)
  let query = supabase.from('threads').select('*');
  query = query.eq('account_id', userData.user.id);

  // 4. Optional: Filter by projectId if provided
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  // 5. Execute query
  const { data, error } = await query;

  // 6. Handle errors
  if (error) {
    handleApiError(error, { operation: 'load threads', ... });
    throw error;
  }

  // 7. Map database fields to Thread type
  const mappedThreads: Thread[] = (data || [])
    .map((thread) => ({
      thread_id: thread.thread_id,
      project_id: thread.project_id,
      created_at: thread.created_at,
      updated_at: thread.updated_at,
      metadata: thread.metadata,
    }));
  
  return mappedThreads;
};
```

### Return Type: Thread
```typescript
interface Thread {
  thread_id: string;           // UUID
  project_id: string;          // UUID of associated project
  created_at: string;          // ISO 8601 timestamp
  updated_at: string;          // ISO 8601 timestamp (for sorting)
  metadata: Record<string, any>; // Additional metadata
}
```

### Caching Details
- **queryKey:** `['threads']` - unique key
- **staleTime:** Default (immediate refetch on focus)
- **Cache Duration:** Until page refresh or manual refetch
- **Retry:** Default 3 retries
- **Error Handling:** Returns `[]` on auth error, throws on data error

---

## Project Resolution Data Flow

### Component: LibraryPage → ThreadCard
**File:** `frontend/src/components/library/library-page.tsx` (lines 56-79)

### Step 1: Combine Threads with Projects

```typescript
const threadsWithProjects: ThreadWithProject[] = useMemo(() => {
  // Guard: Wait for both data sources
  if (!threads.length || !projects.length) return [];

  // Create lookup map for O(1) access
  const projectsById = new Map(projects.map(p => [p.id, p]));
  
  // Transform each thread
  return threads
    // Filter threads that have a project_id
    .filter(thread => thread.project_id)
    .map(thread => {
      // Look up project
      const project = projectsById.get(thread.project_id!);
      
      return {
        threadId: thread.thread_id,
        projectId: thread.project_id!,
        projectName: project?.name || 'Unnamed Project',  // Fallback if project missing
        url: `/projects/${thread.project_id}/thread/${thread.thread_id}`,
        updatedAt: thread.updated_at,
        iconName: project?.icon_name,  // For project icon display
      };
    })
    // Sort by update date (newest first)
    .sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}, [threads, projects]);  // Recompute if either changes
```

### Output Type: ThreadWithProject
```typescript
type ThreadWithProject = {
  threadId: string;           // From thread table
  projectId: string;          // From thread table
  projectName: string;        // From projects table
  url: string;                // Generated navigation URL
  updatedAt: string;          // From thread table
  iconName?: string | null;   // From projects table
};
```

### API Function: getProjects()
**File:** `frontend/src/lib/api.ts` (lines 240-280)

```typescript
export const getProjects = async (): Promise<Project[]> => {
  try {
    const supabase = createClient();

    // 1. Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error getting current user:', userError);
      return [];
    }

    // 2. Verify user is authenticated
    if (!userData.user) {
      return [];
    }

    // 3. Query projects for current user
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('account_id', userData.user.id)
      .order('created_at', { ascending: false });

    // 4. Handle permission errors gracefully
    if (error) {
      if (
        error.code === '42501' &&
        error.message.includes('has_role_on_account')
      ) {
        console.error('Permission error: User does not have proper account access');
        return [];
      }
      throw error;
    }

    // 5. Map database fields to Project type
    const mappedProjects: Project[] = (data || []).map((project) => ({
      id: project.project_id,
      name: project.name || '',
      icon_name: project.icon_name,
      sandbox: {
        id: project.sandbox_id,
        provider: project.sandbox_provider,
      },
      // ... other fields
    }));
    
    return mappedProjects;
  } catch (error) {
    handleApiError(error, { operation: 'load projects' });
    throw error;
  }
};
```

### Return Type: Project
```typescript
interface Project {
  id: string;                 // project_id
  name: string;               // Project display name
  icon_name?: string | null;  // Icon identifier
  sandbox: {
    id: string;               // Daytona sandbox ID (KEY!)
    provider: string;         // e.g., "daytona"
  };
  // ... other fields
}
```

### Performance: O(n) but cached
- Map creation: O(n) where n = projects
- Thread transformation: O(n) where n = threads  
- Sort: O(n log n)
- **Total:** O(n log n) but only runs when `threads` or `projects` changes
- Result cached via `useMemo` dependency array

---

## File Fetching & Preview Data Flow

### Component: ThreadCard
**File:** `frontend/src/components/library/thread-card.tsx` (lines 32-68)

### Step 1: Resolve SandboxId from Project

```typescript
// Fetch projects (same query as LibraryPage)
const { data: projects = [] } = useQuery({
  queryKey: ['projects'],
  queryFn: () => getProjects(),
});

// Find project for this thread
const project = projects.find(p => p.id === thread.projectId);
const sandboxId = project?.sandbox?.id;  // KEY: Extract sandbox ID
```

### Step 2: Fetch Files from Sandbox

```typescript
const { data: files = [], isLoading: filesLoading, error: filesError } = useQuery({
  queryKey: ['sandbox-files', sandboxId],
  queryFn: async () => {
    if (!sandboxId) {
      return [];
    }
    try {
      // Call API to fetch files
      const fileList = await listSandboxFiles(sandboxId, '/workspace');
      
      // Filter and sort
      const filtered = fileList
        .filter((file: any) => !file.is_dir)      // Remove directories
        .sort((a: any, b: any) => {
          // Sort by mod_time descending (newest first)
          const aTime = new Date(a.mod_time).getTime();
          const bTime = new Date(b.mod_time).getTime();
          return bTime - aTime;
        });
      
      return filtered;
    } catch (error: any) {
      // Sandbox might not exist (404/500) - normal for new threads
      console.error('Failed to fetch files:', error);
      return [];
    }
  },
  enabled: !!sandboxId,              // Only fetch when sandboxId available
  staleTime: 5 * 60 * 1000,          // Cache for 5 minutes
  retry: false,                       // Don't retry if sandbox doesn't exist
});
```

### API Function: listSandboxFiles()
**File:** `frontend/src/lib/api.ts` (lines 1475-1520)

```typescript
export const listSandboxFiles = async (
  sandboxId: string,
  path: string,
): Promise<FileInfo[]> => {
  try {
    const supabase = createClient();
    
    // 1. Get session token (Daytona API auth)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // 2. Build API URL
    const url = new URL(`${API_URL}/sandboxes/${sandboxId}/files`);
    
    // 3. Normalize path for Unicode support
    const normalizedPath = normalizePathWithUnicode(path);
    url.searchParams.append('path', normalizedPath);

    // 4. Prepare headers with auth token
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // 5. Fetch from Daytona API
    const response = await fetch(url.toString(), {
      headers,
    });

    // 6. Handle HTTP errors
    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => 'No error details available');
      console.error(
        `Error listing sandbox files: ${response.status} ${response.statusText}`,
        errorText,
      );
      throw new Error(
        `Error listing sandbox files: ${response.statusText} (${response.status})`,
      );
    }

    // 7. Parse and return file list
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Failed to list sandbox files:', error);
    throw error;
  }
};
```

### Return Type: FileInfo
```typescript
interface FileInfo {
  path: string;              // Full file path (e.g., "/workspace/README.md")
  name: string;              // File name (e.g., "README.md")
  mod_time: string;          // ISO 8601 timestamp
  is_dir: boolean;           // True if directory (filtered out)
  size?: number;             // File size in bytes (optional)
}
```

### Caching Details
- **queryKey:** `['sandbox-files', sandboxId]` - per-sandbox key
- **staleTime:** 5 minutes
- **Enabled:** Only when `sandboxId` is available
- **Retry:** Disabled (404 indicates no sandbox)
- **Error:** Silently returns `[]` on error

---

## Markdown Content Data Flow

### Component: ThreadCard
**File:** `frontend/src/components/library/thread-card.tsx` (lines 71-102)

### Step 1: Identify First Markdown File

```typescript
const firstMarkdownFile = files.find((file: any) => file.name?.endsWith('.md'));
```

### Step 2: Fetch Markdown Content

```typescript
const { data: markdownContent = '', isLoading: markdownLoading, error: markdownError } = useQuery({
  queryKey: ['markdown-preview', sandboxId, firstMarkdownFile?.path],
  queryFn: async () => {
    if (!sandboxId || !firstMarkdownFile?.path) return '';
    try {
      // Fetch file content
      const content = await getSandboxFileContent(sandboxId, firstMarkdownFile.path);
      
      // Handle both string and Blob responses
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
  enabled: !!sandboxId && !!firstMarkdownFile?.path,  // Both required
  staleTime: 10 * 60 * 1000,                          // Cache for 10 minutes
  retry: false,
});
```

### API Function: getSandboxFileContent()
**File:** `frontend/src/lib/api.ts` (lines 1524-1570)

```typescript
export const getSandboxFileContent = async (
  sandboxId: string,
  path: string,
): Promise<string | Blob> => {
  try {
    const supabase = createClient();
    
    // 1. Get session token
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // 2. Build API URL
    const url = new URL(`${API_URL}/sandboxes/${sandboxId}/files/content`);
    
    // 3. Normalize path for Unicode
    const normalizedPath = normalizePathWithUnicode(path);
    url.searchParams.append('path', normalizedPath);

    // 4. Prepare headers with auth token
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // 5. Fetch from Daytona API
    const response = await fetch(url.toString(), {
      headers,
    });

    // 6. Handle HTTP errors
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

    // 7. Return content based on type
    const contentType = response.headers.get('content-type');
    
    // Text content
    if (
      (contentType && contentType.includes('text')) ||
      contentType?.includes('application/json')
    ) {
      return await response.text();
    }
    
    // Binary content (images, PDFs, etc.)
    return await response.blob();
  } catch (error) {
    console.error('Failed to get sandbox file content:', error);
    throw error;
  }
};
```

### Return Type

```typescript
type FileContent = string | Blob;

// String: Text files, JSON, markdown, code
// Blob: Binary files (images, PDFs, etc.)
```

### Content-Type Handling

| Content-Type | Return Type | Usage |
|---|---|---|
| `text/*` | string | Rendered directly |
| `application/json` | string | Parsed/rendered |
| `image/*` | Blob | Converted to URL |
| `application/pdf` | Blob | Displayed in viewer |
| Other binary | Blob | Passed to handler |

### Caching Details
- **queryKey:** `['markdown-preview', sandboxId, firstMarkdownFile?.path]`
- **staleTime:** 10 minutes (longer than files cache)
- **Enabled:** Only when both `sandboxId` AND `firstMarkdownFile?.path` exist
- **Retry:** Disabled

---

## Markdown Content Data Flow

### Component: FileCard → MarkdownPreview
**Files:** 
- `frontend/src/components/library/file-card.tsx` (lines 50-99)
- `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx` (full file)

### Step 1: FileCard Fetches Markdown for All Files

```typescript
// FileCard fetches content for EACH file if markdown
const { data: markdownContent } = useQuery({
  queryKey: ['file-preview', sandboxId, file.path],
  queryFn: async () => {
    if (!isMarkdown || !file.path) return '';
    
    try {
      const content = await getSandboxFileContent(sandboxId, file.path);
      
      // Handle Blob or string
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
  enabled: isMarkdown && !!file.path && !!sandboxId,
  staleTime: 10 * 60 * 1000,
});
```

### Step 2: MarkdownPreview Truncates Content

```typescript
function truncateMarkdown(
  markdown: string,
  maxLines: number = 5,
  maxChars: number = 300
): string {
  if (!markdown) return '';

  // 1. Split and take first N lines
  const lines = markdown.split('\n').slice(0, maxLines);
  let truncated = lines.join('\n');

  // 2. Limit by character count
  if (truncated.length > maxChars) {
    truncated = truncated.substring(0, maxChars).trim();
    
    // 3. Remove incomplete last word
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.substring(0, lastSpace);
    }
    
    // 4. Add ellipsis
    truncated += '…';
  }

  return truncated;
}
```

### FileCard Usage in Preview

```tsx
{isMarkdown && markdownContent ? (
  <>
    {/* Render markdown scaled down to fit in card */}
    <div className="scale-[0.5] origin-top-left">
      <div className="w-[200%] h-[200%]">
        <MarkdownPreview 
          markdown={markdownContent} 
          maxLines={20}           // ThreadCard: 20 lines
          maxChars={1600}         // ThreadCard: 1600 chars
        />
      </div>
    </div>
    
    {/* Gradient fade at bottom */}
    <div 
      className="pointer-events-none absolute left-0 right-0 bottom-0 h-8"
      style={{
        background: 'linear-gradient(rgba(0, 0, 0, 0) 0%, hsl(var(--muted)) 100%)'
      }}
    />
  </>
) : (
  /* Large icon for non-markdown files */
  <div className="flex items-center justify-center h-full">
    <IconComponent className="w-24 h-24 opacity-40" />
  </div>
)}
```

### Step 3: MarkdownPreview Renders with Custom Renderers

**File:** `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx`

```typescript
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  markdown,
  maxLines = 20,
  maxChars = 1600,
  className,
}) => {
  if (!markdown) {
    return null;
  }

  // 1. Truncate content
  const truncated = truncateMarkdown(markdown, maxLines, maxChars);

  // 2. Render with custom renderers
  return (
    <div
      className={cn(
        'text-lg leading-relaxed text-foreground prose prose-invert max-w-none',
        'break-words overflow-hidden',
        '[&>*:first-child]:mt-0',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}  // GitHub flavored markdown
        components={previewComponents}
      >
        {truncated}
      </ReactMarkdown>
    </div>
  );
};
```

### Custom Renderers

```typescript
const previewComponents = {
  // Headings
  h1: ({ children }: any) => <h1 className="text-2xl font-semibold mb-2 mt-3">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-semibold mb-2 mt-3">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-semibold mb-1.5 mt-2.5">{children}</h3>,

  // Inline elements
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,

  // Paragraphs
  p: ({ children }: any) => <p className="mb-2 leading-relaxed">{children}</p>,

  // Lists
  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,

  // Code
  code: ({ inline, children, ...props }: any) => {
    if (inline) {
      return <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
    }
    return (
      <pre className="bg-muted/50 p-2 rounded mb-2 overflow-x-auto">
        <code className="text-sm font-mono">{children}</code>
      </pre>
    );
  },

  // Blockquotes
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 mb-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),

  // Tables
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-3">
      <table className="min-w-full border-collapse border border-border/30 text-sm">
        {children}
      </table>
    </div>
  ),

  // Images
  img: ({ alt }: any) => <div className="text-sm text-muted-foreground mb-1">[Image: {alt || 'untitled'}]</div>,

  // HR
  hr: () => <hr className="my-2 border-muted-foreground/20" />,
};
```

### Caching Details
- **Per-file query:** Separate React Query for each markdown file
- **staleTime:** 10 minutes
- **Truncation Parameters:**
  - **Default:** 20 lines, 1600 characters
  - **Rationale:** Fits ~5-6 lines of rendered markdown in card after scaling

---

## Search & Filter Data Flow

### Component: LibraryPage
**File:** `frontend/src/components/library/library-page.tsx` (lines 95-115)

### Step 1: Capture User Input

```typescript
// Search input state
const [searchQuery, setSearchQuery] = useState('');

// Filter mode state
const [filterMode, setFilterMode] = useState<FilterMode>('all');  // 'all' | 'favorites'

// User interaction handlers
<Input
  placeholder="Search threads..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}  // Update state
/>

<Button onClick={() => setFilterMode('all')}>All</Button>
<Button onClick={() => setFilterMode('favorites')}>Favorites</Button>
```

### Step 2: Apply Filters (Memoized)

```typescript
const filteredThreads = useMemo(() => {
  let result = threadsWithProjects;  // Start with all threads (sorted, combined)

  // 1. Apply favorites filter (if enabled)
  if (filterMode === 'favorites') {
    result = result.filter((thread) => favorites.has(thread.threadId));
  }

  // 2. Apply search filter (case-insensitive, partial match)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter((thread) => {
      // Search ONLY on projectName
      return thread.projectName.toLowerCase().includes(query);
    });
  }

  return result;
}, [threadsWithProjects, filterMode, favorites, searchQuery]);  // Recompute if any changes
```

### Search Behavior

| Search Input | Filter | Result |
|---|---|---|
| "" (empty) | "all" | All threads, sorted by date |
| "" (empty) | "favorites" | Only favorited threads, sorted by date |
| "api" | "all" | All threads with "api" in projectName |
| "api" | "favorites" | Favorited threads with "api" in projectName |

### Search Examples

```
Projects: [
  "API Configuration",
  "REST API Testing",
  "Data Processing",
  "User Management",
]

Search "api" → matches: ["API Configuration", "REST API Testing"]
Search "data" → matches: ["Data Processing"]
Search "user" → matches: ["User Management"]
Search "Config" → matches: ["API Configuration"]
Search "TESTING" → matches: ["REST API Testing"]
```

### Reset on Filter Change

```typescript
useEffect(() => {
  setDisplayCount(ITEMS_PER_PAGE);  // Reset to 5 threads
}, [filterMode, searchQuery]);  // Runs when either changes
```

**Reason:** When user changes filter or search, reset infinite scroll position to top.

---

## Favorites Persistence

### Component: LibraryPage
**File:** `frontend/src/components/library/library-page.tsx` (lines 27-41)

### State Management

```typescript
// Initialize from localStorage on mount
const [favorites, setFavorites] = useState<Set<string>>(new Set());

useEffect(() => {
  const stored = localStorage.getItem(FAVORITES_KEY);  // 'library-favorites'
  if (stored) {
    try {
      // Parse JSON array to Set
      const parsed = JSON.parse(stored);
      setFavorites(new Set(parsed));
    } catch (e) {
      console.error('Failed to parse favorites:', e);
      // Silently continue with empty set
    }
  }
}, []);  // Runs only once on mount
```

### Toggle Favorite

```typescript
const toggleFavorite = (threadId: string) => {
  setFavorites((prev) => {
    const next = new Set(prev);  // Clone current set
    
    if (next.has(threadId)) {
      next.delete(threadId);    // Remove from favorites
    } else {
      next.add(threadId);       // Add to favorites
    }
    
    // Persist to localStorage
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
    
    return next;  // Update state
  });
};
```

### Pass to ThreadCard

```typescript
<ThreadCard
  key={thread.threadId}
  thread={thread}
  isFavorite={favorites.has(thread.threadId)}  // Check if favorited
  onToggleFavorite={toggleFavorite}            // Pass callback
  viewMode={viewMode}
/>
```

### ThreadCard UI

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={handleFavoriteClick}
  className="h-8 w-8"
>
  <Star
    className={cn(
      'w-4 h-4',
      isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
    )}
  />
</Button>
```

### Storage Format

**Key:** `library-favorites`

**Value:**
```json
["thread-uuid-1", "thread-uuid-2", "thread-uuid-3"]
```

**Scope:** Per-browser, domain-scoped localStorage

**Persistence:** Survives browser restart, only cleared when localStorage is manually deleted

---

## API Function Reference

### Authentication Pattern

All three API functions follow the same authentication pattern:

```typescript
// 1. Create Supabase client
const supabase = createClient();

// 2. Get current user
const { data: userData, error: userError } = await supabase.auth.getUser();
if (userError || !userData.user) {
  return [];  // Return empty array if not authenticated
}

// 3. Query with user filter
query = query.eq('account_id', userData.user.id);
```

**Rationale:** Ensures users only see their own data, enforced at query level

---

### Query Pattern for Library Data

| API Function | Query Type | Filter | Return |
|---|---|---|---|
| `getThreads()` | Supabase `.select()` | `account_id = current_user.id` | Thread[] |
| `getProjects()` | Supabase `.select()` | `account_id = current_user.id` | Project[] |
| `listSandboxFiles()` | Daytona REST API | Bearer token in header | FileInfo[] |
| `getSandboxFileContent()` | Daytona REST API | Bearer token in header | string \| Blob |

---

## End-to-End Flow Summary

```
┌─ User opens /library
│
├─ LibraryPage mounts
│  └─ Load favorites from localStorage
│
├─ React Query fetches
│  ├─ getThreads() → Thread[]
│  └─ getProjects() → Project[]
│
├─ useMemo combines data
│  ├─ Create projectsById map
│  ├─ Filter + map threads
│  └─ Sort by updated_at descending
│  → ThreadWithProject[] (sorted, newest first)
│
├─ User sees:
│  ├─ Search input
│  ├─ All / Favorites filter buttons
│  └─ 5 initial threads displayed
│
├─ For EACH visible thread → ThreadCard:
│  ├─ Find project by projectId
│  └─ Get sandboxId from project.sandbox.id
│
├─ ThreadCard fetches:
│  └─ listSandboxFiles(sandboxId, '/workspace')
│     ├─ Authenticate with Bearer token
│     ├─ Filter !is_dir
│     ├─ Sort by mod_time descending
│     → FileInfo[] (6 shown, rest with "Show More")
│
├─ For EACH markdown file:
│  └─ FileCard fetches:
│     └─ getSandboxFileContent(sandboxId, file.path)
│        ├─ Authenticate with Bearer token
│        ├─ Return string or Blob
│        → Pass to MarkdownPreview
│
├─ MarkdownPreview renders:
│  ├─ Truncate (20 lines, 1600 chars)
│  ├─ Apply custom renderers
│  ├─ Scale to fit card
│  └─ Add gradient fade
│
├─ User scrolls
│  ├─ IntersectionObserver detects loadMoreRef
│  ├─ Calls loadMore() with 300ms delay
│  ├─ displayCount += 5 (now 10 visible)
│  └─ Repeats until all filtered threads shown
│
└─ User searches or filters:
   └─ Search: filter by projectName (case-insensitive)
   └─ Filter: show only favorites from Set
   └─ displayCount resets to 5
   └─ useMemo recomputes filteredThreads
```

---

## Performance Optimizations

### React Query Caching
- **Threads:** Cached indefinitely (until focus loss)
- **Projects:** Cached indefinitely (until focus loss)
- **Files per sandbox:** 5-minute cache
- **Markdown per file:** 10-minute cache

### Memoization
- `threadsWithProjects` - recomputed only when threads or projects change
- `filteredThreads` - recomputed only when filter/search changes
- `displayedThreads` - recomputed only when displayCount changes

### Rendering Optimization
- Only 5 threads rendered initially
- Only 6 files per thread rendered initially
- Markdown preview scaled and truncated
- IntersectionObserver for lazy loading
- Markdown preview in separate queries (no fetch until needed)

---

## Error Handling

### Auth Errors
```typescript
if (!userData.user) {
  return [];  // Return empty array instead of error
}
```

### Network Errors
```typescript
if (!response.ok) {
  console.error(`Error: ${response.status} ${response.statusText}`);
  throw new Error(`Error: ${response.statusText} (${response.status})`);
}
```

### Missing Sandbox
```typescript
try {
  const fileList = await listSandboxFiles(sandboxId, '/workspace');
  return fileList.filter(!is_dir).sort(...);
} catch (error) {
  console.error('Failed to fetch files:', error);
  return [];  // Silently return empty array
}
```

### Invalid Markdown
```typescript
if (!markdown) {
  return null;  // Don't render anything
}
```

---

## Debugging Helpers

### Console Logging

**ThreadCard debug logs:**
```typescript
console.log('🔧 Project/Sandbox Debug:', {
  threadName: thread.projectName,
  projectId: thread.projectId,
  projectFound: !!project,
  sandboxId,
  sandboxObject: project?.sandbox,
});

console.log('📝 Markdown Preview State:', {
  threadName,
  hasFirstMarkdownFile: !!firstMarkdownFile,
  markdownContentLength: markdownContent?.length || 0,
  markdownLoading,
  markdownError,
  willShowPreview: !!(firstMarkdownFile && markdownContent),
});
```

### React Query DevTools
Install `@tanstack/react-query-devtools` to inspect:
- Query keys and data
- Stale times and cache times
- Request/error states
- Network timing

