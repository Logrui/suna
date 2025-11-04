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
6. [Security & Row Level Security](#security--row-level-security)
7. [Complete Data Flow Diagram](#complete-data-flow-diagram)
8. [Performance Considerations](#performance-considerations)

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

6️⃣ APPLY FILTERS (useMemo)
   ├─ Filter by favorites (if filterMode === 'favorites')
   ├─ Filter by search query (projectName contains searchQuery)
   └─ Return: filteredThreads[]

7️⃣ PAGINATE (useMemo)
   ├─ Calculate totalPages = Math.ceil(filteredThreads.length / 20)
   ├─ Slice: filteredThreads[(page-1)*20 : page*20]
   └─ Return: paginatedThreads[]

8️⃣ RENDER
   ├─ Display LibraryPageHeader
   ├─ Display Toolbar (search, filters, view toggle)
   ├─ Render ThreadCard[] for paginatedThreads
   │  └─ Grid layout (responsive 1→4 columns)
   │  └─ Or List layout (horizontal rows)
   └─ Display pagination controls
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
- ✅ `iconName` from sandbox settings used for display
- ✅ Available for future features (file preview, etc.)

**Potential Future Uses:**
- Display file count in card
- Show language/technology badges
- File browser preview in modal
- Environment variable display

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

