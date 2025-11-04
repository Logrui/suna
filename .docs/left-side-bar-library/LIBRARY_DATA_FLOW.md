# Library Page Data Flow Architecture

**File Location:** `.docs/left-side-bar-library/`  
**Date:** November 3, 2025  
**Related Files:** `frontend/src/lib/api.ts`, `frontend/src/components/library/library-page.tsx`

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Frontend API Layer](#frontend-api-layer)
4. [Data Flow Pipeline](#data-flow-pipeline)
5. [Sandbox Data Integration](#sandbox-data-integration)
6. [File Preview Data Flow](#file-preview-data-flow)
7. [Security & Row Level Security](#security--row-level-security)
8. [Complete Data Flow Diagram](#complete-data-flow-diagram)
9. [Performance Considerations](#performance-considerations)

---

## Overview

The Library page retrieves user data through a **client-side Supabase query pattern** rather than traditional backend REST APIs. This provides:

- ✅ Direct database access with automatic security filtering
- ✅ No backend API server latency
- ✅ Type-safe queries via Supabase client library
- ✅ Automatic Row Level Security (RLS) enforcement
- ✅ Real-time subscription capabilities (future)

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌──────────────────┐
│   ACCOUNTS      │         │    PROJECTS     │         │     THREADS      │
│   (Basejump)    │         │                 │         │                  │
├─────────────────┤         ├─────────────────┤         ├──────────────────┤
│ id (PK)         │◄────────│ account_id (FK) │◄────────│ account_id (FK)  │
│ created_at      │  1:M    │ project_id (PK) │  1:M    │ thread_id (PK)   │
│ updated_at      │         │ name            │         │ project_id (FK)  │
└─────────────────┘         │ description     │         │ is_public        │
                            │ sandbox (JSONB) │◄────────│ created_at       │
                            │ is_public       │  1:1    │ updated_at       │
                            │ created_at      │         └──────────────────┘
                            │ updated_at      │                   │
                            └─────────────────┘                   │
                                                                  │ 1:M
                                                          ┌───────▼──────────┐
                                                          │    MESSAGES      │
                                                          ├──────────────────┤
                                                          │ message_id (PK)  │
                                                          │ thread_id (FK)   │
                                                          │ type             │
                                                          │ content (JSONB)  │
                                                          │ metadata (JSONB) │
                                                          │ created_at       │
                                                          │ updated_at       │
                                                          └──────────────────┘
```

---

## Database Tables

### 1. Projects Table

```sql
CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    sandbox JSONB DEFAULT '{}'::jsonb,              -- ⭐ SANDBOX DATA HERE
    is_public BOOLEAN DEFAULT FALSE,
    icon_name TEXT,                                 -- Project icon identifier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for query performance
CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_projects_created_at ON projects(created_at);
```

**Key Fields:**
- `sandbox` (JSONB) - Stores configuration, metadata, and file information for the project
- `account_id` - Foreign key to accounts table (Basejump multi-tenancy)
- `icon_name` - Used for display in Library page

---

### 2. Threads Table

```sql
CREATE TABLE threads (
    thread_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for query performance
CREATE INDEX idx_threads_account_id ON threads(account_id);
CREATE INDEX idx_threads_project_id ON threads(project_id);
CREATE INDEX idx_threads_created_at ON threads(created_at);
```

**Key Fields:**
- `project_id` - Links to projects table (Foreign Key)
- `account_id` - Denormalized for security queries
- `updated_at` - Used for relative date display in Library page

---

### 3. Messages Table

```sql
CREATE TABLE messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    is_llm_message BOOLEAN NOT NULL DEFAULT TRUE,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
```

**Note:** Messages table is not directly queried by the Library page, but contains the conversation data for individual threads.

---

## Frontend API Layer

### Location
`frontend/src/lib/api.ts` - Contains all Supabase data fetching functions

### Connection Method

```typescript
import { createClient } from '@/utils/supabase/client';

// Creates authenticated Supabase client with current user's session
const supabase = createClient();

// All queries automatically include user's auth context
// Row Level Security policies are enforced at database level
```

---

## Frontend API Functions

### Function 1: `getProjects()`

**Purpose:** Fetch all projects for the current user (including sandbox data)

**Location:** `frontend/src/lib/api.ts` (lines 240-280+)

**Implementation:**

```typescript
export const getProjects = async (): Promise<Project[]> => {
  try {
    const supabase = createClient();

    // Step 1: Get authenticated user ID
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error getting current user:', userError);
      return [];
    }

    // Step 2: Ensure user is logged in
    if (!userData.user) {
      return [];
    }

    // Step 3: Query projects table
    // ✅ SELECT * includes sandbox JSONB column
    const { data, error } = await supabase
      .from('projects')                                    // Table name
      .select('*')                                         // All columns (including sandbox!)
      .eq('account_id', userData.user.id)                  // Security filter: only user's projects
      .order('created_at', { ascending: false });          // Most recent first

    // Step 4: Handle errors
    if (error) {
      // Graceful handling of permission errors
      if (error.code === '42501' && error.message.includes('has_role_on_account')) {
        console.error('Permission error: User does not have proper account access');
        return [];
      }
      throw error;
    }

    // Step 5: Map database fields to TypeScript types
    const mappedProjects: Project[] = (data || []).map((project) => ({
      id: project.project_id,
      name: project.name || '',
      description: project.description,
      created_at: project.created_at,
      updated_at: project.updated_at,
      sandbox: project.sandbox,              // ⭐ SANDBOX DATA INCLUDED
      icon_name: project.icon_name,
      is_public: project.is_public,
    }));

    return mappedProjects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
};
```

**Query Breakdown:**
| Step | Query Method | Result |
|------|--------------|--------|
| `from('projects')` | Specify table | Reference to `projects` table |
| `.select('*')` | Select all columns | Returns all fields including `sandbox` JSONB |
| `.eq('account_id', user.id)` | WHERE clause | Only user's own projects (RLS enforced) |
| `.order('created_at', desc)` | ORDER BY clause | Most recent projects first |

**Return Type:**
```typescript
type Project = {
  id: string;                      // project_id
  name: string;
  description: string | null;
  created_at: string;              // ISO 8601 timestamp
  updated_at: string;              // ISO 8601 timestamp
  sandbox: Record<string, any>;    // ⭐ JSONB sandbox data
  icon_name?: string | null;
  is_public: boolean;
};
```

**Example Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My AI Agent",
    "description": "Python-based AI agent for automation",
    "created_at": "2024-11-01T10:30:00Z",
    "updated_at": "2024-11-03T14:22:00Z",
    "sandbox": {
      "files": [
        { "name": "config.py", "type": "python", "path": "/config" },
        { "name": "main.py", "type": "python", "path": "/main" }
      ],
      "environment": "python3.9",
      "settings": { "timeout": 30 }
    },
    "icon_name": "python",
    "is_public": false
  }
]
```

---

### Function 2: `getThreads(projectId?)`

**Purpose:** Fetch conversation threads, optionally filtered by project

**Location:** `frontend/src/lib/api.ts` (lines 508-550)

**Implementation:**

```typescript
export const getThreads = async (projectId?: string): Promise<Thread[]> => {
  const supabase = createClient();

  // Step 1: Get authenticated user ID
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('Error getting current user:', userError);
    return [];
  }

  // Step 2: Ensure user is logged in
  if (!userData.user) {
    return [];
  }

  // Step 3: Build query
  let query = supabase.from('threads').select('*');

  // Step 4: Always filter by current user's account ID (security)
  query = query.eq('account_id', userData.user.id);

  // Step 5: Optional: filter by specific project
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  // Step 6: Execute query
  const { data, error } = await query;

  // Step 7: Handle errors
  if (error) {
    handleApiError(error, {
      operation: 'load threads',
      resource: projectId ? `threads for project ${projectId}` : 'threads'
    });
    throw error;
  }

  // Step 8: Map database fields to TypeScript types
  const mappedThreads: Thread[] = (data || []).map((thread) => ({
    thread_id: thread.thread_id,
    project_id: thread.project_id,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
    metadata: thread.metadata,
  }));

  return mappedThreads;
};
```

**Query Breakdown:**
| Condition | Query Method | Filter |
|-----------|--------------|--------|
| Base query | `.from('threads').select('*')` | All thread columns |
| User security | `.eq('account_id', user.id)` | Only user's threads |
| Project filter (optional) | `.eq('project_id', projectId)` | Threads in specific project only |

**Return Type:**
```typescript
type Thread = {
  thread_id: string;
  project_id: string;
  created_at: string;              // ISO 8601 timestamp
  updated_at: string;              // ISO 8601 timestamp (used for display)
  metadata?: Record<string, any>;
};
```

**Example Response:**
```json
[
  {
    "thread_id": "abc12345-1234-1234-1234-abcdef123456",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2024-11-01T11:00:00Z",
    "updated_at": "2024-11-03T14:22:00Z",
    "metadata": { "title": "Configuration Help" }
  },
  {
    "thread_id": "def67890-5678-5678-5678-fedcba987654",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2024-11-02T09:15:00Z",
    "updated_at": "2024-11-03T10:45:00Z",
    "metadata": { "title": "Debugging Session" }
  }
]
```

---

## Data Flow Pipeline

### Step-by-Step Execution in LibraryPage Component

```
┌────────────────────────────────────────────────────────────────────────┐
│                    LIBRARY PAGE DATA FLOW                               │
└────────────────────────────────────────────────────────────────────────┘

1️⃣ COMPONENT MOUNT
   └─ LibraryPage component mounts
   └─ Load favorites from localStorage
   └─ Initialize state: viewMode, filterMode, searchQuery, currentPage

2️⃣ INITIALIZE QUERIES
   └─ React Query hook: useQuery({ queryKey: ['projects'], queryFn: getProjects })
   └─ React Query hook: useQuery({ queryKey: ['threads'], queryFn: getThreads })

3️⃣ EXECUTE GETPROJECTS()
   ├─ Supabase client: createClient()
   ├─ Get user ID: supabase.auth.getUser()
   ├─ Query database:
   │  └─ SELECT * FROM projects WHERE account_id = user_id ORDER BY created_at DESC
   └─ Return: Project[] with sandbox JSONB data

4️⃣ EXECUTE GETTHREADS()
   ├─ Supabase client: createClient()
   ├─ Get user ID: supabase.auth.getUser()
   ├─ Query database:
   │  └─ SELECT * FROM threads WHERE account_id = user_id
   └─ Return: Thread[]

5️⃣ COMBINE DATA (useMemo)
   ├─ Map projects by project_id → projectsById Map
   ├─ For each thread:
   │  └─ Find matching project
   │  └─ Create ThreadWithProject object:
   │     {
   │       threadId: thread.thread_id,
   │       projectId: thread.project_id,
   │       projectName: project.name,
   │       url: `/projects/${projectId}/thread/${threadId}`,
   │       updatedAt: thread.updated_at,
   │       iconName: project.icon_name,
   │       sandbox: project.sandbox  ⭐
   │     }
   └─ Return: ThreadWithProject[]

7️⃣ APPLY FILTERS (useMemo)
   ├─ Filter by favorites (if filterMode === 'favorites')
   ├─ Filter by search query (projectName contains searchQuery)
   ├─ Sort by updated_at descending (newest first)
   └─ Return: filteredThreads[]

8️⃣ PROGRESSIVE LOADING (Infinite Scroll)
   ├─ displayCount = initial 5 threads
   ├─ displayedThreads = slice(0, displayCount)
   ├─ hasMore = filteredThreads.length > displayCount
   ├─ IntersectionObserver watches loadMoreRef element
   ├─ When element visible:
   │  └─ loadMore() → displayCount += 5
   │  └─ UI re-renders with more threads
   └─ Repeat until all threads shown

9️⃣ RENDER THREAD CARDS
   ├─ Display LibraryPageHeader
   ├─ Display Sticky Toolbar (search, filters)
   ├─ Render ThreadCard[] for displayedThreads (not paginatedThreads!)
   │  ├─ Project info (name, updated date, star button)
   │  └─ 🆕 FILE PREVIEW CARDS
   │     └─ Query sandbox files for each thread
   │     └─ Render FileCard components
   │     └─ Show markdown previews
   └─ Display infinite scroll trigger at bottom
```

---

## Sandbox Data Integration

### Where Sandbox Data Originates

```
┌──────────────────────────────────────────┐
│     PROJECT CREATION / UPDATE            │
│  (Happens in different feature area)     │
└──────────────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ projects table         │
        │ sandbox (JSONB) column │
        └────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────────┐
        │ getProjects() query            │
        │ SELECT * FROM projects         │
        └────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────────┐
        │ LibraryPage component          │
        │ data: Project[]                │
        │ - includes sandbox JSONB       │
        └────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────────┐
        │ useMemo: threadsWithProjects   │
        │ Join threads + projects        │
        │ - Include sandbox from project │
        │ - ThreadWithProject type       │
        └────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────────┐
        │ ThreadCard rendering           │
        │ Optional: Display sandbox info │
        └────────────────────────────────┘
```

### Sandbox Data Structure (Example)

```json
{
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "My AI Agent",
  "sandbox": {
    "files": [
      {
        "name": "config.py",
        "type": "python",
        "path": "/config",
        "content": "..."
      },
      {
        "name": "main.py",
        "type": "python",
        "path": "/main",
        "content": "..."
      }
    ],
    "dependencies": ["requests", "pydantic", "aiohttp"],
    "environment": {
      "python_version": "3.9",
      "timezone": "UTC"
    },
    "settings": {
      "timeout": 30,
      "max_retries": 3,
      "memory_limit": "512MB"
    }
  }
}
```

### How Library Page Uses Sandbox

**Current Usage:**
- ✅ `sandbox.id` used to fetch files from Daytona servers
- ✅ File previews rendered inline in ThreadCard
- ✅ Markdown content fetched and displayed with syntax highlighting
- ✅ File type icons determined from file extensions

**Data Flow:**
```
Project.sandbox.id
    ↓
listSandboxFiles(sandboxId, '/workspace')  [API call to Daytona]
    ↓
files: Array<{name, path, type, size}>
    ↓
ThreadCard renders FileCard[] components
    ↓
For each file:
  ├─ if markdown: getSandboxFileContent(sandboxId, path) [API call]
  ├─ Fetch markdown content
  ├─ Pass to MarkdownPreview component
  └─ Render with syntax highlighting
```

---

## File Preview Data Flow

### Overview

The Library page now includes **inline file previews** from Daytona sandboxes. This involves additional API calls beyond the initial data fetch:

```
1. Initial Load: Supabase queries (threads + projects)
   ↓
2. In ThreadCard: Fetch sandbox files from Daytona
   ↓
3. For markdown files: Fetch file content from Daytona
   ↓
4. Render FileCard with MarkdownPreview
```

### API Functions for File Preview

#### Function: `listSandboxFiles(sandboxId, path)`

**Purpose:** List files in a Daytona sandbox directory

**Location:** `frontend/src/lib/api.ts` (lines 1475-1523)

**Implementation:**
```typescript
export const listSandboxFiles = async (
  sandboxId: string,
  path: string,
): Promise<FileInfo[]> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    const url = new URL(`${API_URL}/sandboxes/${sandboxId}/files`);
    
    // Normalize the path to handle Unicode escape sequences
    const normalizedPath = normalizePathWithUnicode(path);
    
    // Properly encode the path parameter for UTF-8 support
    url.searchParams.append('path', normalizedPath);

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      throw new Error(
        `Error listing sandbox files: ${response.statusText} (${response.status})`
      );
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Failed to list sandbox files:', error);
    throw error;
  }
};
```

**Key Details:**
- ✅ Uses Supabase session token for authentication (not hardcoded token)
- ✅ Normalizes path with Unicode support via `normalizePathWithUnicode()`
- ✅ Uses URL.searchParams to properly encode path parameter
- ✅ Returns `FileInfo[]` type (not generic SandboxFile)
- ✅ Throws error on failure (doesn't silently return empty array)

**Return Type:**
```typescript
type FileInfo = {
  name: string;              // e.g., "main.py"
  path: string;              // e.g., "/workspace/main.py"
  is_dir: boolean;           // ⭐ CORRECT: is_dir not type
  mod_time: string;          // ISO timestamp
  size?: number;             // bytes (optional)
};
```

**Usage in ThreadCard:**
```typescript
// In ThreadCard component - filters out directories and sorts by mod_time
const filtered = fileList
  .filter((file: any) => !file.is_dir)  // ⭐ Filters directories
  .sort((a: any, b: any) => {
    const aTime = new Date(a.mod_time).getTime();
    const bTime = new Date(b.mod_time).getTime();
    return bTime - aTime; // Newest first
  });
```

**When Called:**
- In `ThreadCard` component via `useQuery` hook
- Triggered when `sandboxId` exists and component mounts
- Results cached by React Query with key: `['sandbox-files', sandboxId, path]`

#### Function: `getSandboxFileContent(sandboxId, path)`

**Purpose:** Fetch content of a specific file from Daytona

**Location:** `frontend/src/lib/api.ts` (lines 1524-1570)

**Implementation:**
```typescript
export const getSandboxFileContent = async (
  sandboxId: string,
  path: string,
): Promise<string | Blob> => {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    const url = new URL(`${API_URL}/sandboxes/${sandboxId}/files/content`);
    
    // Normalize the path to handle Unicode escape sequences
    const normalizedPath = normalizePathWithUnicode(path);
    
    // Properly encode the path parameter for UTF-8 support
    url.searchParams.append('path', normalizedPath);

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      throw new Error(
        `Error getting sandbox file content: ${response.statusText} (${response.status})`
      );
    }

    // Check if it's a text file or binary file based on content-type
    const contentType = response.headers.get('content-type');
    if (
      (contentType && contentType.includes('text')) ||
      contentType?.includes('application/json')
    ) {
      return await response.text();
    } else {
      return await response.blob();
    }
  } catch (error) {
    console.error('Error fetching file content:', error);
    throw error;
  }
};
```

**Key Details:**
- ✅ Uses Supabase session token for authentication
- ✅ Normalizes path with Unicode support
- ✅ Returns **either `string` OR `Blob`** depending on content-type
- ✅ For text/json: returns as string
- ✅ For binary files: returns as Blob
- ✅ Throws error on failure

**Return Type:**
```typescript
Promise<string | Blob>  // Text files → string, Binary → Blob
```

**When Called:**
- In `FileCard` component via `useQuery` hook
- Only for markdown files (`.md` extension)
- Results cached by React Query with key: `['file-preview', sandboxId, path]`

### ThreadCard File Preview Flow

**Purpose:** Display thread with inline file previews

**Location:** `frontend/src/components/library/thread-card.tsx`

```typescript
// In ThreadCard component

// 1. Fetch projects to get sandbox ID
const { data: projects = [] } = useQuery({
  queryKey: ['projects'],
  queryFn: listProjects,
});

// 2. Find project for this thread
const project = projects.find(p => p.id === thread.projectId);
const sandboxId = project?.sandbox?.id;

// 3. Fetch ALL files from /workspace directory
const { data: allFiles = [] } = useQuery({
  queryKey: ['sandbox-files', sandboxId, '/workspace'],
  queryFn: () => listSandboxFiles(sandboxId!, '/workspace'),
  enabled: !!sandboxId && !!project,
});

// 4. Process files: filter directories, sort by modified time
const fileList = allFiles
  .filter((file) => !file.is_dir)  // Remove directories
  .sort((a, b) => {
    // Sort by mod_time descending (newest first)
    const timeA = new Date(a.mod_time).getTime();
    const timeB = new Date(b.mod_time).getTime();
    return timeB - timeA;
  });

// 5. Display first 6 files in responsive grid
const displayedFiles = fileList.slice(0, 6);
const hasMoreFiles = fileList.length > 6;

// 6. Render FileCard for each displayed file
<div className="grid grid-cols-2 gap-3">
  {displayedFiles.map((file) => (
    <FileCard
      key={file.path}
      file={file}
      IconComponent={getFileType(file.name).icon}
      isMarkdown={getFileType(file.name).type === 'markdown'}
      sandboxId={sandboxId!}
      onFileClick={handleFileClick}
    />
  ))}
</div>

// 7. Show "Show More" button if more files exist
{hasMoreFiles && (
  <button onClick={handleShowMore}>
    Show {fileList.length - 6} more files...
  </button>
)}
```

**Key Details:**
- ✅ Fetches all files from `/workspace` directory
- ✅ Filters out directories (`.filter((file) => !file.is_dir)`)
- ✅ Sorts by modification time descending (newest first)
- ✅ Displays first 6 files in a 2-column grid
- ✅ Shows "Show More" button if files.length > 6
- ✅ Each FileCard receives file metadata + sandbox context

### FileCard Component Flow

**Purpose:** Display a single file preview card with markdown content or file icon

**Location:** `frontend/src/components/library/file-card.tsx`

```typescript
// In FileCard component

interface FileCardProps {
  file: FileInfo;  // {name, path, is_dir, mod_time, size}
  IconComponent: React.ComponentType;
  isMarkdown: boolean;
  sandboxId: string;
  onFileClick?: (path: string) => void;
}

export function FileCard({
  file,
  IconComponent,
  isMarkdown,
  sandboxId,
  onFileClick,
}: FileCardProps) {
  // 1. For markdown files: fetch content via API
  const { data: content } = useQuery({
    queryKey: ['file-preview', sandboxId, file.path],
    queryFn: () => getSandboxFileContent(sandboxId, file.path),
    enabled: isMarkdown,  // Only fetch if file is markdown
    staleTime: 5 * 60 * 1000,  // 5 minute cache
  });

  return (
    <div 
      className="border rounded p-3 cursor-pointer hover:bg-accent"
      onClick={() => onFileClick?.(file.path)}
    >
      {/* File header with icon and name */}
      <div className="flex items-center gap-2 mb-2">
        <IconComponent className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate">{file.name}</span>
      </div>

      {/* Markdown preview for .md files */}
      {isMarkdown && content && (
        <MarkdownPreview 
          content={content} 
          maxLines={3}
          maxChars={200}
        />
      )}

      {/* File type icon fallback for non-markdown files */}
      {!isMarkdown && (
        <div className="flex items-center justify-center py-4">
          <IconComponent className="w-8 h-8 opacity-50" />
        </div>
      )}

      {/* File metadata */}
      <div className="text-xs text-muted-foreground mt-2 flex justify-between">
        <span>
          {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
        </span>
        <span>
          {new Date(file.mod_time).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
```

**Key Details:**
- ✅ Receives `FileInfo` object with metadata
- ✅ For markdown files: fetches content with `getSandboxFileContent()`
- ✅ Content cached by React Query with 5-minute TTL
- ✅ Displays `MarkdownPreview` for markdown with truncation
- ✅ Shows file icon for non-markdown files
- ✅ Displays file size and modification date

### MarkdownPreview Component

**Purpose:** Render markdown content with syntax highlighting and preview truncation

**Location:** `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx`

**Props:**
```typescript
interface MarkdownPreviewProps {
  markdown: string;           // Raw markdown content to preview
  maxLines?: number;          // Maximum number of lines (default: 20)
  maxChars?: number;          // Maximum number of characters (default: 1600)
  className?: string;         // Optional CSS class
}
```

**Implementation Details:**
```typescript
function truncateMarkdown(
  markdown: string,
  maxLines: number = 5,
  maxChars: number = 300
): string {
  // 1. Split markdown by lines and take first N
  const lines = markdown.split('\n').slice(0, maxLines);
  let truncated = lines.join('\n');

  // 2. Limit total character count
  if (truncated.length > maxChars) {
    truncated = truncated.substring(0, maxChars).trim();
    // Remove incomplete last word for clean cutoff
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.substring(0, lastSpace);
    }
    truncated += '…';  // Add ellipsis
  }

  return truncated;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  markdown,
  maxLines = 20,
  maxChars = 1600,
  className,
}) => {
  if (!markdown) return null;

  const truncated = truncateMarkdown(markdown, maxLines, maxChars);

  return (
    <div className="...prose formatting...">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}  // GitHub Flavored Markdown support
        components={previewComponents}  // Custom renderers
      >
        {truncated}
      </ReactMarkdown>
    </div>
  );
};
```

**Custom Renderers Support:**
- ✅ Headings (h1-h6) with responsive sizing
- ✅ **Bold**, _italic_, links formatting
- ✅ Code blocks with monospace font (inline and block)
- ✅ Lists (ordered/unordered) with proper spacing
- ✅ Tables with borders and proper alignment
- ✅ Blockquotes with left border styling
- ✅ Horizontal rules
- ✅ Images shown as placeholders (no rendering)

**Example Usage in FileCard:**
```typescript
<MarkdownPreview 
  markdown={content}      // String returned from getSandboxFileContent()
  maxLines={3}            // Show first 3 lines max
  maxChars={200}          // Limit to 200 characters
  className="custom-class"
/>
```

**Default Behavior in FileCard:**
- Truncated to 3 lines or 200 characters (whichever comes first)
- Shows cleaned markdown with formatting preserved
- Adds ellipsis if truncated

### Path Normalization Utility

**Purpose:** Handle Unicode and path normalization for cross-platform compatibility

**Location:** `frontend/src/lib/api.ts` (line 1463)

**Function:**
```typescript
function normalizePathWithUnicode(path: string): string {
  if (!path) return '';
  
  // Normalize Unicode characters and escape sequences
  // Converts escape sequences like \u0000 to actual Unicode characters
  return path.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
}
```

**Why It's Needed:**
- ✅ File paths may contain Unicode escape sequences from backend
- ✅ Proper handling of non-ASCII characters in file names
- ✅ Safe URL parameter encoding for path transmission
- ✅ Cross-platform compatibility (Windows/Linux/macOS)

**Used In:**
- `listSandboxFiles()` - normalizes path parameter before API call
- `getSandboxFileContent()` - normalizes path before fetching content

**Example:**
```typescript
// Input with escape sequence
const escapedPath = '/workspace/docs/\\u00e9file.md';  // é character

// After normalization
const normalized = normalizePathWithUnicode(escapedPath);
// Result: '/workspace/docs/éfile.md'

// Safe to use in URL
url.searchParams.append('path', normalized);
```

### File Type Detection

**Purpose:** Map file extensions to icon components for visual identification

**Location:** `frontend/src/lib/utils/fileTypeDetector.ts`

**File Type Enum:**
```typescript
type FileType = 
  | 'document'      // Text & documents
  | 'spreadsheet'   // Data files
  | 'code'          // Source code
  | 'pdf'           // PDF documents
  | 'archive'       // Compressed files
  | 'default'       // Unknown types
```

**Icon Component Map:**
```typescript
export const FILE_ICONS = {
  document: DocumentIcon,      // Used for .md, .txt, .doc, .docx, etc.
  spreadsheet: SpreadsheetIcon, // Used for .csv, .xlsx, .xls, etc.
  code: CodeIcon,              // Used for .js, .ts, .py, .java, etc.
  pdf: PdfIcon,                // Used for .pdf
  archive: ArchiveIcon,        // Used for .zip, .tar, .gz, etc.
  default: DefaultIcon,        // Used for unknown types
} as const;
```

**Extension Mappings:**

| File Type | Extensions | Examples |
|-----------|-----------|----------|
| **document** | md, txt, doc, docx, rtf, odt, pages, tex, log | README.md, notes.txt |
| **spreadsheet** | csv, xlsx, xls, tsv, ods, numbers, xlsm, xlsb | data.csv, budget.xlsx |
| **code** | js, ts, tsx, jsx, py, java, cpp, c, h, hpp, go, rs, json, yaml, yml, html, css, scss, sass, less, xml, sql, sh, bash, perl, rb, php, swift, kt, scala, groovy, gradle, maven, dockerfile, makefile, cmake, lua, vim, toml, ini, conf, vue, graphql, gql, prisma | app.ts, styles.css, script.py |
| **pdf** | pdf | document.pdf |
| **archive** | zip, rar, 7z, tar, gz, bz2, xz, iso, dmg, exe, msi | project.zip, backup.tar.gz |
| **default** | any other extension | file.xyz |

**Core Functions:**

```typescript
// Get file type from filename
export function getFileType(filename: string): FileType {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Search FILE_TYPE_MAP for matching extension
  for (const [fileType, config] of Object.entries(FILE_TYPE_MAP)) {
    if (config.extensions.includes(extension)) {
      return fileType as FileType;
    }
  }
  
  return 'default';
}

// Get all extensions for a file type
export function getExtensionsForType(fileType: FileType): string[]

// Get human-readable description
export function getTypeDescription(fileType: FileType): string
```

**Usage in ThreadCard:**
```typescript
const fileType = getFileType(file.name);  // e.g., 'code', 'document', 'default'
const IconComponent = FILE_ICONS[fileType];  // Get icon component

<FileCard
  file={file}
  IconComponent={IconComponent}
  isMarkdown={fileType === 'document' && file.name.endsWith('.md')}
  sandboxId={sandboxId}
/>
```

**Supported File Types:** 70+ extensions across 6 categories
- **Default:** Any other type

### Caching Strategy

React Query caches file preview data:

```typescript
// Cache keys:
['sandbox-files', 'sandbox-123', '/workspace']  // File list - cached
['file-preview', 'sandbox-123', '/workspace/main.py']  // File content - cached

// Cache duration: 5 minutes (default React Query behavior)
// Manual invalidation available if files change
```

**Benefits:**
- ✅ Reduces API calls to Daytona servers
- ✅ Faster UI re-renders
- ✅ Smooth scrolling experience
- ✅ Can be cleared manually if files updated

---

## Potential Future Enhancements

**File Preview Features:**
1. File browser modal - full directory tree navigation
2. Diff viewer - compare file versions
3. Search within files - full-text search in sandbox files
4. File download - download files directly
5. Real-time file sync - WebSocket updates when files change

---

## Security & Row Level Security

### Row Level Security (RLS) Policies

Supabase enforces security at the database level through PostgreSQL policies:

#### Policy 1: Projects Table

```sql
CREATE POLICY "Users can view their own projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = account_id);

CREATE POLICY "Users can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = account_id);

CREATE POLICY "Users can update their own projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = account_id)
  WITH CHECK (auth.uid() = account_id);
```

#### Policy 2: Threads Table

```sql
CREATE POLICY "Users can view their own threads"
  ON threads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = account_id);

CREATE POLICY "Users can create threads"
  ON threads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = account_id);
```

### Security Flow

```
1. User authenticates → Supabase creates auth session
   └─ Session includes auth.uid() (user ID)

2. Frontend calls getProjects()
   └─ Supabase client includes session in request

3. Supabase evaluates RLS policy
   └─ SELECT * FROM projects WHERE auth.uid() = account_id
   └─ Even if query has no WHERE clause, RLS adds it automatically

4. Only matching rows returned
   └─ User can ONLY see projects where account_id = their user ID
   └─ Database level enforcement (no application logic needed)

5. Result sent to frontend
   └─ Guaranteed to only contain user's own data
```

### Why This Is Secure

- ✅ **Database-level enforcement** - Can't be bypassed by JavaScript
- ✅ **Automatic filtering** - RLS applies to every query
- ✅ **No secrets needed** - Uses authentication token
- ✅ **Sandbox data safe** - Users only see their own project sandboxes

---

## Complete Data Flow Diagram

### End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BROWSER / FRONTEND                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ LibraryPage Component (React)                                        │   │
│  │ ┌────────────────────────────────────────────────────────────────┐   │   │
│  │ │ State:                                                          │   │   │
│  │ │ • viewMode: 'grid' | 'list'                                   │   │   │
│  │ │ • filterMode: 'all' | 'favorites'                             │   │   │
│  │ │ • searchQuery: string                                          │   │   │
│  │ │ • favorites: Set<string> (from localStorage)                  │   │   │
│  │ │ • currentPage: number                                          │   │   │
│  │ └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │ ┌─ useQuery: getProjects() ──────────────────────────────────────┐   │   │
│  │ │ API Call #1                                                   │   │   │
│  │ └─ Returns: Project[] (with sandbox JSONB) ───────────────────┬─┘   │   │
│  │                                                                │     │   │
│  │ ┌─ useQuery: getThreads() ───────────────────────────────────┼────┐│   │
│  │ │ API Call #2                                               │    ││   │
│  │ └─ Returns: Thread[] ────────────────────────────────────────┼─┬──┘│   │
│  │                                                               │ │   │   │
│  │ ┌─ useMemo: threadsWithProjects ◄─────────────────────────────┼─┘   │   │
│  │ │ Join threads with projects by project_id                   │     │   │
│  │ │ Result: ThreadWithProject[] (includes sandbox via join)   │     │   │
│  │ └──────────────────────────────────────────────────────────────┐   │   │
│  │                                                                │   │   │
│  │ ┌─ useMemo: filteredThreads ◄──────────────────────────────────┘   │   │
│  │ │ Apply filters:                                                  │   │
│  │ │ • Filter by favorites (if selected)                           │   │
│  │ │ • Filter by search query (projectName matching)               │   │
│  │ │ Result: ThreadWithProject[] (filtered)                        │   │
│  │ └──────────────────────────────────────────────────────────────┐   │   │
│  │                                                                │   │   │
│  │ ┌─ useMemo: paginatedThreads ◄──────────────────────────────────┘   │   │
│  │ │ Slice by ITEMS_PER_PAGE (20)                                      │   │
│  │ │ Result: ThreadWithProject[] (20 or fewer items)                   │   │
│  │ └──────────────────────────────────────────────────────────────┐   │   │
│  │                                                                │   │   │
│  │ ┌─ Render View ◄────────────────────────────────────────────────┘   │   │
│  │ │                                                                  │   │
│  │ │ ┌─ LibraryPageHeader                                           │   │
│  │ │ │ • BookOpen icon + "Library" title                          │   │
│  │ │ └──────────────────────────────────────────────────────────┐  │   │
│  │ │                                                            │  │   │
│  │ │ ┌─ Toolbar ◄────────────────────────────────────────────────┘  │   │
│  │ │ │ • Search input (filters by projectName)                 │   │   │
│  │ │ │ • Filter buttons (All / Favorites)                     │   │   │
│  │ │ │ • View toggle (Grid / List icons)                      │   │   │
│  │ │ └──────────────────────────────────────────────────────────┐  │   │
│  │ │                                                            │  │   │
│  │ │ ┌─ Content ◄─────────────────────────────────────────────────┘  │   │
│  │ │ │ If loading: "Loading threads..."                       │   │   │
│  │ │ │ Else if empty: "No threads found" message              │   │   │
│  │ │ │ Else:                                                  │   │   │
│  │ │ │   Grid Layout (viewMode=grid):                        │   │   │
│  │ │ │   ┌─────┬─────┬─────┬─────┐                            │   │   │
│  │ │ │   │Card │Card │Card │Card │ (responsive 1-4 cols)    │   │   │
│  │ │ │   ├─────┼─────┼─────┼─────┤                            │   │   │
│  │ │ │   │Card │Card │Card │Card │                           │   │   │
│  │ │ │   └─────┴─────┴─────┴─────┘                            │   │   │
│  │ │ │                                                        │   │   │
│  │ │ │   List Layout (viewMode=list):                        │   │   │
│  │ │ │   📄 Thread 1  |  Jun 15  | ⭐ | →                      │   │   │
│  │ │ │   📄 Thread 2  |  Jun 14  | ☆  | →                      │   │   │
│  │ │ │   📄 Thread 3  |  Jun 13  | ☆  | →                      │   │   │
│  │ │ │                                                        │   │   │
│  │ │ │   Each Card renders ThreadCard component with:        │   │   │
│  │ │ │   • thread data                                       │   │   │
│  │ │ │   • isFavorite flag                                   │   │   │
│  │ │ │   • onToggleFavorite callback                         │   │   │
│  │ │ │   • viewMode (grid/list)                              │   │   │
│  │ │ │                                                        │   │   │
│  │ │ └──────────────────────────────────────────────────────┐ │   │   │
│  │ │                                                        │ │   │   │
│  │ │ ┌─ Pagination ◄───────────────────────────────────────┘ │   │   │
│  │ │ │ [Previous] Page 1 of 5 [Next]                      │   │   │
│  │ │ └────────────────────────────────────────────────────┘   │   │
│  │ │                                                            │   │   │
│  │ └────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Supabase Client (JavaScript SDK)                               │   │
│  │ • Authentication token (session)                               │   │
│  │ • Automatic RLS enforcement                                   │   │
│  │ • Direct database query builder                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (encrypted)
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL Database)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │ projects table       │  │ threads table        │  │ messages table   │   │
│  ├──────────────────────┤  ├──────────────────────┤  ├──────────────────┤   │
│  │ project_id (PK)      │  │ thread_id (PK)       │  │ message_id (PK)  │   │
│  │ account_id (RLS) ⭐  │  │ account_id (RLS) ⭐  │  │ thread_id (FK)   │   │
│  │ name                 │  │ project_id (FK)      │  │ type             │   │
│  │ description          │  │ is_public            │  │ content (JSONB)  │   │
│  │ sandbox (JSONB) ⭐   │  │ created_at           │  │ created_at       │   │
│  │ icon_name            │  │ updated_at ⭐        │  │ updated_at       │   │
│  │ is_public            │  │                      │  │                  │   │
│  │ created_at           │  │ RLS Policy:          │  │                  │   │
│  │ updated_at           │  │ auth.uid() =         │  │ (Not queried by  │   │
│  │                      │  │ account_id           │  │  Library page)   │   │
│  │ RLS Policy:          │  │                      │  │                  │   │
│  │ auth.uid() =         │  │ Index:               │  │                  │   │
│  │ account_id           │  │ account_id           │  │                  │   │
│  │                      │  │ project_id           │  │                  │   │
│  │ Indexes:             │  │ created_at           │  │                  │   │
│  │ account_id           │  │                      │  │                  │   │
│  │ created_at           │  │ Query:               │  │                  │   │
│  │                      │  │ SELECT * FROM threads │  │                  │   │
│  │ Query:               │  │ WHERE account_id =   │  │                  │   │
│  │ SELECT * FROM        │  │ auth.uid()           │  │                  │   │
│  │ projects WHERE       │  │ ORDER BY created_at  │  │                  │   │
│  │ account_id =         │  │                      │  │                  │   │
│  │ auth.uid()           │  │                      │  │                  │   │
│  │ ORDER BY created_at  │  │                      │  │                  │   │
│  │                      │  │                      │  │                  │   │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Performance Considerations

### Query Optimization

#### 1. Indexes

All security-critical columns have indexes for fast filtering:

```sql
CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_threads_account_id ON threads(account_id);
CREATE INDEX idx_threads_project_id ON threads(project_id);
CREATE INDEX idx_threads_created_at ON threads(created_at);
CREATE INDEX idx_projects_created_at ON projects(created_at);
```

**Impact:**
- `WHERE account_id = user_id` - O(log n) via index
- `WHERE project_id = X` - O(log n) via index
- `ORDER BY created_at` - O(n log n) but index helps with sorting

#### 2. React Query Caching

```typescript
const { data: threads = [] } = useQuery({
  queryKey: ['threads'],
  queryFn: () => getThreads(),
  // Caching: Data cached for 5 minutes by default
  // Stale time: After 5 min, marked stale but still used
  // Refetch: On window focus or manual trigger
});
```

**Benefits:**
- ✅ Subsequent views don't re-fetch
- ✅ Component remounts use cached data
- ✅ Manual refetch available on demand

#### 3. Frontend Memoization

```typescript
// Threads with projects: Only recalculates when threads or projects change
const threadsWithProjects = useMemo(() => { ... }, [threads, projects]);

// Filtered threads: Only recalculates when filters change
const filteredThreads = useMemo(() => { ... }, [threadsWithProjects, filterMode, favorites, searchQuery]);

// Paginated threads: Only recalculates when pagination changes
const paginatedThreads = useMemo(() => { ... }, [filteredThreads, currentPage]);
```

**Benefits:**
- ✅ Expensive calculations don't re-run unnecessarily
- ✅ Child components only re-render when data actually changes
- ✅ Smooth user interactions (no lag)

### Data Size Considerations

| Metric | Typical Value | Impact |
|--------|---------------|--------|
| Projects per user | 5-50 | Small - one query ~50-200 KB |
| Threads per user | 50-500 | Medium - one query ~200 KB - 1 MB |
| Threads per page | 20 | Manageable - renders ~20 cards |
| Sandbox JSONB size | 5-50 KB per project | Included in project query |

---

## Troubleshooting Guide

### Common Issues

#### Issue: "No threads found" but threads exist

**Causes:**
1. User not authenticated - `getUser()` returns no user
2. Threads belong to different account_id (multi-tenant issue)
3. RLS policy not applied correctly

**Solution:**
```typescript
// Debug: Check authentication
const user = await supabase.auth.getUser();
console.log('Current user:', user);

// Debug: Check RLS policies
const { data, error } = await supabase.from('threads').select('*');
console.log('Raw query (no filters):', data, error);
```

#### Issue: Sandbox data is null/undefined

**Causes:**
1. Old projects without sandbox data (null in DB)
2. Project query didn't include sandbox column (shouldn't happen with `select('*')`)

**Solution:**
```typescript
// Safely access sandbox
const sandbox = project.sandbox || {};

// Or provide default
const files = project.sandbox?.files || [];
```

#### Issue: Performance lag when viewing Library

**Causes:**
1. Too many threads (>1000)
2. Large sandbox JSONB objects
3. Missing database indexes

**Solution:**
1. Implement server-side pagination
2. Compress or move sandbox data to separate table
3. Verify indexes exist with: `SELECT * FROM pg_indexes WHERE tablename = 'threads'`

---

## Related Files

- **Main Component:** `frontend/src/components/library/library-page.tsx`
- **API Layer:** `frontend/src/lib/api.ts`
- **Type Definitions:** `frontend/src/hooks/react-query/sidebar/use-sidebar.ts`
- **Database Schema:** `ALL_MIGRATIONS.sql` (lines 1619-1700)
- **Technical Analysis:** `LIBRARY_PAGE_TECHNICAL_ANALYSIS.md`

