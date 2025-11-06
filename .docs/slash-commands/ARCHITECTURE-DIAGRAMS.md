# Architecture Diagram: Suna Knowledge Base Systems

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUNA KNOWLEDGE BASE ECOSYSTEM                │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────┐  ┌──────────────────────────────────┐ │
│  │ knowledge_base_folders  │  │ knowledge_base_entries           │ │
│  ├─────────────────────────┤  ├──────────────────────────────────┤ │
│  │ folder_id (PK)          │  │ entry_id (PK)                    │ │
│  │ account_id (FK)         │  │ folder_id (FK)                   │ │
│  │ name                    │  │ filename                         │ │
│  │ description             │  │ file_path (S3 location)          │ │
│  │ created_at              │  │ file_size                        │ │
│  │ updated_at              │  │ mime_type                        │ │
│  └─────────────────────────┘  │ summary (LLM-generated)          │ │
│          ▲                     │ usage_context (always/contextual)
│          │                     │ [SOON: content TEXT]             │ ← Option A
│          │                     │ is_active                        │ │
│          │                     │ created_at, updated_at           │ │
│          └──────────────────────────┤                              │ │
│                                     └──────────────────────────────┘ │
│                                                │                     │
│  ┌──────────────────────────────────────────────┘                    │
│  │                                                                   │
│  │  ┌──────────────────────────────────────────────────────────┐   │
│  │  │ agent_knowledge_entry_assignments                        │   │
│  │  ├──────────────────────────────────────────────────────────┤   │
│  │  │ assignment_id (PK)                                       │   │
│  │  │ agent_id (FK) ─┐                                         │   │
│  │  │ entry_id (FK) ─┼──→ Links agents to specific KB files   │   │
│  │  │ account_id (FK)│                                         │   │
│  │  │ enabled (BOOL) │                                         │   │
│  │  │ assigned_at    │                                         │   │
│  │  └──────────────────────────────────────────────────────────┘   │
│  │                                                                   │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER (S3)                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  file-uploads/                                                       │
│  └── knowledge-base/                                                 │
│      ├── {folder_id_1}/                                             │
│      │   ├── {entry_id_1}/                                          │
│      │   │   ├── prompt_setup.md                                    │
│      │   │   ├── api_reference.pdf                                  │
│      │   │   └── config.json                                        │
│      │   └── {entry_id_2}/                                          │
│      │       └── user_guide.docx                                    │
│      └── {folder_id_2}/                                             │
│          └── {entry_id_3}/                                          │
│              └── docs.txt                                            │
│                                                                      │
│  Storage accessed via:                                               │
│  - client.storage.from_('file-uploads').download(file_path)         │
│  - client.storage.from_('file-uploads').upload(s3_path, content)    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│          HOW AI AGENTS USE KNOWLEDGE BASE (CURRENT)              │
└─────────────────────────────────────────────────────────────────┘

PATTERN 1: AUTOMATIC CONTEXT INJECTION
─────────────────────────────────────

    Agent Start
         │
         ▼
    backend/core/run.py:425
    ├─ Call RPC function: get_agent_knowledge_base_context(agent_id)
    │
    ├─ SQL Query (executed in Supabase):
    │  ├─ JOIN knowledge_base_entries
    │  ├─ JOIN knowledge_base_folders
    │  ├─ JOIN agent_knowledge_entry_assignments
    │  ├─ WHERE agent_id = p_agent_id AND enabled = TRUE
    │  └─ SELECT filename + summary (NOT content currently)
    │
    ├─ Return formatted text:
    │  "# KNOWLEDGE BASE\n
    │   ## FolderName/file1.md\n
    │   Summary of file1...\n
    │   ## FolderName/file2.pdf\n
    │   Summary of file2..."
    │
    ├─ Format into system prompt section:
    │  "=== AGENT KNOWLEDGE BASE ===\n
    │   {kb_result}\n
    │   === END AGENT KNOWLEDGE BASE ==="
    │
    ├─ Add to system_content
    │
    └─ Agent LLM receives context automatically ✓


PATTERN 2: MANUAL FILE ACCESS
──────────────────────────────

    Agent Code
    ├─ Agent.call_tool("global_kb_sync", {})
    │
    └─ SandboxKbTool.global_kb_sync()
       ├─ Query agent_knowledge_entry_assignments
       │  └─ Get all enabled=TRUE entries for this agent
       │
       ├─ For each entry:
       │  ├─ Retrieve file_path from DB
       │  │  (format: knowledge-base/{folder_id}/{entry_id}/{filename})
       │  │
       │  ├─ Download from S3:
       │  │  client.storage.from_('file-uploads').download(file_path)
       │  │
       │  ├─ Create folder in sandbox: ~/knowledge-base-global/{folder_name}/
       │  │
       │  └─ Upload file to sandbox
       │
       ├─ Create README with file index
       │
       └─ Return: { synced_files: N, kb_directory: "~/knowledge-base-global" }
    
    Agent can now:
    ├─ Read files from ~/knowledge-base-global/
    ├─ Process with local tools
    ├─ Extract specific information
    └─ Integrate into responses


┌──────────────────────────────────────────────────────────────────────┐
│     HOW SLASH COMMANDS CURRENTLY WORK (INCOMPLETE - NO CONTENT)       │
└──────────────────────────────────────────────────────────────────────┘

    User Types in Chat
         │
         ├─ Detects "/" character
         │
         ├─ Calls frontend hook: useSlashCommands()
         │
         └─ Makes API call: GET /knowledge-base/folders/{folder_id}/entries
            │
            ├─ backend/core/knowledge_base/api.py:360-397
            │
            ├─ SQL Query:
            │  SELECT entry_id, filename, summary, file_size, created_at
            │  FROM knowledge_base_entries
            │  WHERE folder_id = ? AND is_active = TRUE
            │  ❌ NO CONTENT SELECTED!
            │
            ├─ Returns: EntryResponse[]
            │  {
            │    entry_id: "...",
            │    filename: "api_guide.md",
            │    summary: "Complete API reference",
            │    file_size: 50000,
            │    created_at: "2025-01-01T00:00:00Z"
            │  }
            │  ❌ NO content FIELD!
            │
            └─ Frontend maps to SlashCommand[]:
               {
                 name: "api_guide",
                 description: "Complete API reference",
                 prompt: entry.content || ''  ← GETS NULL/EMPTY! ❌
               }
    
    Result: Autocomplete shows commands but prompts are empty


┌──────────────────────────────────────────────────────────────────────┐
│           TWO SOLUTIONS FOR SLASH COMMANDS                           │
└──────────────────────────────────────────────────────────────────────┘

OPTION A: ADOPT AGENT KB PATTERN (RECOMMENDED)
──────────────────────────────────────────────

    Step 1: Extend Database Schema
    └─ ALTER TABLE knowledge_base_entries
       ADD COLUMN content TEXT;

    Step 2: Update Upload Process
    └─ backend/core/knowledge_base/file_processor.py
       ├─ Store file content in DB
       │  INSERT INTO knowledge_base_entries
       │  (filename, content, summary, file_path, ...)
       │
       └─ Also upload to S3 for backup/download

    Step 3: Create RPC Function
    └─ Similar to get_agent_knowledge_base_context()
       But for user-selected slash commands:
       
       CREATE FUNCTION get_slash_command_content(
           p_entry_ids UUID[],
           p_max_tokens INTEGER DEFAULT 2000
       )
       ├─ SELECT filename, content
       │  FROM knowledge_base_entries
       │  WHERE entry_id = ANY(p_entry_ids)
       │  AND is_active = TRUE
       │
       └─ Return formatted content with token limits

    Step 4: Update Frontend Hook
    └─ frontend/src/hooks/useSlashCommands.ts
       ├─ Call RPC function: get_slash_command_content([entry_ids])
       │
       └─ Map to SlashCommand[] with full content

    ✅ Pros:
       • Consistent with agent KB architecture
       • Fast (direct database)
       • Token-aware
       • Enables search, analytics
       • Proven pattern

    ⚠️  Cons:
       • Schema migration required
       • Data duplication (DB + S3)

    ⏱️  Time: 2-3 hours


OPTION B: ADD REST CONTENT ENDPOINT
────────────────────────────────────

    Step 1: Add Backend Endpoint
    └─ backend/core/knowledge_base/api.py
       
       @router.get("/entries/{entry_id}/content")
       async def get_entry_content(entry_id: UUID):
           ├─ Query DB for file_path
           │  SELECT file_path FROM knowledge_base_entries
           │  WHERE entry_id = ?
           │
           ├─ Download from S3
           │  file = await client.storage
           │          .from_('file-uploads')
           │          .download(file_path)
           │
           └─ Return: { content: "...", filename: "..." }

    Step 2: Update Frontend Hook
    └─ frontend/src/hooks/useSlashCommands.ts
       ├─ For each entry:
       │  └─ Fetch GET /knowledge-base/entries/{entry_id}/content
       │
       └─ Map to SlashCommand[] with full content

    ✅ Pros:
       • Minimal schema changes
       • No data duplication
       • Faster to implement

    ⚠️  Cons:
       • Different pattern than agents
       • Higher latency (S3 download per entry)
       • No token management
       • Separate architecture

    ⏱️  Time: 1-2 hours


┌──────────────────────────────────────────────────────────────────────┐
│                    COMPARISON MATRIX                                 │
└──────────────────────────────────────────────────────────────────────┘

│ Aspect                 │ Agent KB         │ Current User KB  │ Slash Commands   │
├────────────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Storage                │ Database         │ S3               │ ? (Needs fix)    │
│ Content Retrieval      │ RPC function     │ Tool (S3 download│ ❌ No endpoint   │
│ When Loaded            │ Always (auto)    │ On-demand (tool) │ On-user-select   │
│ Token Management       │ ✅ Smart limit   │ Manual           │ ? (TBD)          │
│ Performance            │ ⚡ Fast (DB)      │ 🐢 Slow (S3)      │ ? (TBD)          │
│ Data Format            │ Full content     │ Full files       │ Text prompts     │
│ Usage Logging          │ ✅ Automatic     │ Implicit         │ ? (TBD)          │
│ Future Features        │ ✅ Search ready  │ ⚠️ Limited        │ ? (TBD)          │

Recommendation: Option A (Adopt Agent KB Pattern)
Reason: Consistent architecture, better performance, enables features
```

---

## Data Flow Diagram: Option A (Recommended)

```
┌─────────────────┐
│  User Types     │
│   "/" in Chat   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ Chat Input Component                        │
│ - Detects "/" character                     │
│ - Shows SlashCommandAutocomplete             │
│ - Lets user select command                   │
└────────┬────────────────────────────────────┘
         │ User selects /api_guide
         ▼
┌─────────────────────────────────────────────────────────────┐
│ useSlashCommands Hook (Frontend)                            │
│ - Already fetches list from API                             │
│ - NEW: Also calls RPC get_slash_command_content({entry_id})│
│ - Returns SlashCommand[] with full prompts                  │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────┐
│ Supabase RPC Execution                                             │
│ - Function: get_slash_command_content(entry_ids, max_tokens=2000)│
│ - Query: SELECT filename, content                                  │
│          FROM knowledge_base_entries                               │
│          WHERE entry_id = ANY(entry_ids) AND is_active = TRUE      │
│ - Token calculation: LENGTH(content) / 4                           │
│ - Returns: Text formatted with filename + content                  │
└────────┬────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Chat Input Component                                   │
│ - Receives prompt content                              │
│ - User types follow-up text (e.g., "for Node.js")    │
│ - Injects prompt + user text                           │
│ - Sends combined message to agent                      │
└────────┬───────────────────────────────────────────────┘
         │ Message: "{api_guide_prompt}\n\nfor Node.js"
         ▼
┌────────────────────────────────────────────────────────┐
│ Agent Receives & Processes                             │
│ ✅ Prompt content available                             │
│ ✅ Injected automatically                               │
│ ✅ Within token limits                                  │
│ ✅ Same pattern as agent KB context                     │
└────────────────────────────────────────────────────────┘
```

---

## File Reference Guide

### Database Schema
- **Current**: `backend/supabase/migrations/20250916000000_new_knowledge_base.sql`
- **Modification needed**: Add `content TEXT` column to `knowledge_base_entries`

### Agent KB (Reference Pattern)
- **RPC Definition**: `backend/supabase/migrations/20250916000000_new_knowledge_base.sql` lines 103-147
- **Agent Execution**: `backend/core/run.py` lines 420-450
- **Tool Definition**: `backend/core/tools/sb_kb_tool.py` lines 260-350

### Slash Commands (Needs Fix)
- **Frontend Hook**: `frontend/src/hooks/useSlashCommands.ts`
- **UI Component**: `frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx`
- **Chat Integration**: `frontend/src/components/thread/chat-input/chat-input.tsx`
- **Backend API**: `backend/core/knowledge_base/api.py`
- **Upload Process**: `backend/core/knowledge_base/file_processor.py`

---

## Key Insight

**The system already has a production-proven pattern for agents to access knowledge base content.** Slash commands should follow the same pattern for consistency, performance, and extensibility.

The only question is: should slash commands **follow the agent KB architecture** (recommended) or create a **new REST endpoint** (quicker but inconsistent)?
