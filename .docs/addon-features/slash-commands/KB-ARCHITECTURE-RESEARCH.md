# Knowledge Base Architecture Research

## Overview

The Suna system has **two separate but complementary** knowledge base systems:

1. **Agent Knowledge Base**: Full content stored in database, automatically injected into agent prompts
2. **User Knowledge Base**: File-based storage with metadata, designed for manual access by agents via tools

The user's request for slash commands requires understanding how agents access knowledge base information.

---

## 1. Agent Knowledge Base System (Primary Pattern)

### Architecture

**Database Tables** (`backend/supabase/migrations/20250916000000_new_knowledge_base.sql`):

```sql
-- User-level knowledge base entries (NEW architecture)
knowledge_base_entries (
    entry_id UUID PK,
    folder_id UUID FK,
    account_id UUID FK,
    filename VARCHAR(255),
    file_path TEXT,           -- S3 path: knowledge-base/{folder_id}/{entry_id}/{filename}
    file_size BIGINT,
    mime_type VARCHAR(255),
    summary TEXT,             -- LLM-generated summary
    usage_context VARCHAR(100), -- 'always', 'on_request', 'contextual'
    is_active BOOLEAN,
    created_at, updated_at
)

knowledge_base_folders (
    folder_id UUID PK,
    account_id UUID FK,
    name VARCHAR(255),
    description TEXT,
    created_at, updated_at
)

-- Agent-specific assignments
agent_knowledge_entry_assignments (
    assignment_id UUID PK,
    agent_id UUID FK,
    entry_id UUID FK,
    account_id UUID FK,
    enabled BOOLEAN,
    assigned_at TIMESTAMPTZ
)
```

### Content Retrieval Mechanism

**RPC Function**: `get_agent_knowledge_base_context(p_agent_id UUID, p_max_tokens INTEGER DEFAULT 4000)`

**Location**: `backend/supabase/migrations/20250916000000_new_knowledge_base.sql` lines 103-147

**How It Works**:
```sql
-- Joins: knowledge_base_entries -> knowledge_base_folders -> agent_knowledge_entry_assignments
-- Filters: WHERE agent_id = p_agent_id AND enabled = TRUE AND is_active = TRUE
-- Returns: SUMMARY + FILENAME (NOT full content)
-- Format: "# KNOWLEDGE BASE\n\n## FolderName/filename.txt\nSummary text..."
```

**Key Characteristics**:
- ✅ **Summaries only**, not full content
- ✅ **Intelligent filtering** by `usage_context` ('always' or 'contextual')
- ✅ **Token-aware** - stops when hitting p_max_tokens limit
- ✅ **Automatically injected** into agent system prompt during execution
- ✅ **Usage logging** via implicit insert in RPC function

### How Agents Call It

**Backend File**: `backend/core/run.py` lines 420-450

```python
# During agent execution setup:
kb_result = await client.rpc('get_agent_knowledge_base_context', {
    'p_agent_id': agent_config['agent_id']
}).execute()

# Result is formatted and added to system prompt:
system_content += f"""
=== AGENT KNOWLEDGE BASE ===
NOTICE: The following is your specialized knowledge base...
{kb_result.data}
=== END AGENT KNOWLEDGE BASE ===
"""
```

---

## 2. File Access Tool System (Secondary Pattern)

### Global KB Sync Tool

**Purpose**: Allow agents to manually download and work with files from knowledge base

**Tool Location**: `backend/core/tools/sb_kb_tool.py` lines 260-350 (SandboxKbTool class)

**How It Works**:

```python
async def global_kb_sync(self) -> ToolResult:
    """Sync all agent's knowledge base files to sandbox ~/knowledge-base-global"""
    
    # 1. Query agent's assigned knowledge base entries
    result = await client.from_("agent_knowledge_entry_assignments").select("""
        entry_id, enabled,
        knowledge_base_entries (
            filename, file_path, file_size, mime_type,
            knowledge_base_folders (name)
        )
    """).eq("agent_id", agent_id).eq("enabled", True)
    
    # 2. For each file:
    for assignment in result.data:
        entry = assignment['knowledge_base_entries']
        file_path = entry['file_path']  # e.g., "knowledge-base/{folder_id}/{entry_id}/file.pdf"
        
        # 3. Download from Supabase storage
        file_response = await client.storage.from_('file-uploads').download(file_path)
        
        # 4. Create folder structure: ~/knowledge-base-global/{folder_name}/
        await sandbox.process.exec(f"mkdir -p ~/{kb_dir}/{folder_name}")
        
        # 5. Upload file to sandbox
        await sandbox.fs.upload_file(file_response, f"{kb_dir}/{folder_name}/{filename}")
    
    # 6. Create README with file index
    return self.success_response({
        "message": "Knowledge base synced",
        "synced_files": count,
        "kb_directory": "~/knowledge-base-global"
    })
```

**Result**: Agent has local copy of all assigned files in sandbox for:
- Text processing
- Code analysis
- File format conversion
- Manual integration into responses

### File Storage Details

**S3/Supabase Storage Path Pattern**:
```
file-uploads/knowledge-base/{folder_id}/{entry_id}/{sanitized_filename}
```

**Example**:
```
file-uploads/knowledge-base/
  ├── 550e8400-e29b-41d4-a716-446655440000/  (folder_id)
  │   └── 660e8400-e29b-41d4-a716-446655440001/  (entry_id)
  │       ├── user_guide.pdf
  │       ├── api_reference.md
  │       └── config.json
  └── 550e8400-e29b-41d4-a716-446655440002/
      └── 660e8400-e29b-41d4-a716-446655440011/
          └── product_spec.docx
```

---

## 3. Current Slash Commands Implementation

### Problem Identified

**File**: `frontend/src/hooks/useSlashCommands.ts` line 234

```typescript
prompt: entry.content || ''  // ← GETS NULL/EMPTY
```

**Why It's Empty**:

1. **Frontend fetches** via `GET /knowledge-base/folders/{id}/entries`
2. **Backend API** (`backend/core/knowledge_base/api.py` lines 360-397) returns:
   ```python
   query = """entry_id, filename, summary, file_size, created_at"""
   # NO CONTENT FIELD!
   ```
3. **Result**: EntryResponse model doesn't have content
4. **Root Cause**: Slash commands were designed for a different pattern than agent KB

---

## 4. Comparison Table

| Aspect | Agent KB | User KB (Current) | Slash Commands (Needs Fix) |
|--------|----------|------------------|--------------------------|
| **Content Storage** | Database (`agent_knowledge_base_entries.content`) | S3 (`file-uploads/...`) | S3 but not retrievable |
| **Content Access** | RPC function `get_agent_knowledge_base_context()` | `global_kb_sync` tool + download | ❌ No endpoint |
| **Injection Point** | Auto-injected into system prompt | Manual via tool | Manual user selection |
| **Data Format** | Full content in database | Full content in storage | Metadata only |
| **Token Management** | Smart truncation in RPC | Manual agent handling | Not applicable (frontend) |
| **Usage Pattern** | Always available context | On-demand file access | User triggers via `/cmd` |

---

## 5. Two Solutions for Slash Commands

### Solution A: Adopt Agent KB Pattern (Recommended)

**Changes Required**:
1. Store prompt content in database table (similar to `agent_knowledge_base_entries`)
2. Add `content TEXT NOT NULL` column to `knowledge_base_entries`
3. Update upload process to store content in database instead of S3-only
4. Create RPC function for retrieving slash command content with token limits
5. Update frontend hook to call RPC function instead of REST API

**Pros**:
- ✅ Consistent with agent KB architecture
- ✅ Automatic token management
- ✅ Better performance (direct database access)
- ✅ Enables future features (search, analytics)

**Cons**:
- ⚠️ Requires database schema migration
- ⚠️ Data duplication (content in DB + S3)

**Implementation Time**: 2-3 hours

---

### Solution B: Add REST API Endpoint

**Changes Required**:
1. Add `GET /knowledge-base/entries/{entry_id}/content` endpoint
2. Fetch file from S3 storage
3. Return full content in response
4. Update frontend hook to fetch content for each entry

**Pros**:
- ✅ Minimal changes to existing schema
- ✅ Reuses existing file upload infrastructure
- ✅ No data duplication

**Cons**:
- ⚠️ Higher latency (S3 download per entry)
- ⚠️ No token management
- ⚠️ Separate from agent KB pattern

**Implementation Time**: 1-2 hours

---

## 6. Recommended Approach

**Solution A is recommended** because:

1. **Alignment**: Slash commands and agent KB serve similar purposes
2. **Architecture**: Keeps both systems using same patterns
3. **Performance**: Database queries faster than S3 downloads
4. **Future-Proof**: Enables search, tagging, versioning
5. **Consistency**: Token limits, usage logging, UI patterns all benefit

### Implementation Plan

**Phase 1: Database Schema** (15 min)
```sql
ALTER TABLE knowledge_base_entries ADD COLUMN content TEXT;
```

**Phase 2: Upload Process** (30 min)
- Update `backend/core/knowledge_base/file_processor.py` to store content in DB
- Keep S3 upload for files (backward compatibility)

**Phase 3: Content Retrieval** (30 min)
- Create RPC function for retrieving content with context filtering
- Similar to `get_agent_knowledge_base_context()` but for user-selected entries

**Phase 4: Frontend** (30 min)
- Update `useSlashCommands` hook to call new RPC function
- Cache results with React Query

**Phase 5: Testing** (45 min)
- Verify prompts populate correctly
- Test prompt injection in chat input
- E2E test all 4 example commands

**Total Time**: ~3 hours

---

## 7. Key Files Reference

### Backend Architecture
- **Agent KB Setup**: `backend/supabase/migrations/20250916000000_new_knowledge_base.sql`
- **Agent KB Injection**: `backend/core/run.py` lines 420-450
- **File Upload**: `backend/core/knowledge_base/file_processor.py`
- **REST API**: `backend/core/knowledge_base/api.py`
- **File Access Tool**: `backend/core/tools/sb_kb_tool.py`

### Frontend Implementation
- **Hook**: `frontend/src/hooks/useSlashCommands.ts`
- **UI Component**: `frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx`
- **Chat Integration**: `frontend/src/components/thread/chat-input/chat-input.tsx`

### Database Schema
- **Migrations**: `backend/supabase/migrations/`
  - `20250916000000_new_knowledge_base.sql` (Latest - User KB)
  - `20250701082739_agent_knowledge_base.sql` (Agent KB)
  - `20250624093857_knowledge_base.sql` (Thread KB - deprecated)

---

## 8. Token Management Strategy

Both systems use token estimation:

```sql
-- Rough calculation: 4 characters ≈ 1 token
estimated_tokens := LENGTH(content) / 4;

-- Stop injecting when max_tokens reached
IF current_tokens + estimated_tokens > p_max_tokens THEN
    EXIT;
END IF;
```

For slash commands, we could implement similar logic:
- Set default max_tokens to 2000 (reasonable for prompt injection)
- Track actual token count as prompts are injected
- Warn user if prompt exceeds limit

---

## 9. Key Insights

### Why Agent KB Uses Databases

1. **Content always needed**: Agents operate on context, so content must be loaded
2. **Token awareness**: System needs to manage prompt size before API call
3. **Consistency**: All knowledge is loaded together, ensures completeness
4. **Performance**: Direct DB query faster than S3 for multiple files

### Why File Access Uses S3

1. **Large files**: Could be PDFs, images, archives (not practical in database)
2. **Manual access**: Agent chooses what to read via tool
3. **Efficiency**: Only download what's needed
4. **Flexibility**: Easy to add new storage providers

### For Slash Commands

- Should follow **Agent KB pattern** because prompts are typically text
- Small files (< 1MB typically)
- Always needed when user selects command
- Benefits from token management

---

## 10. Future Enhancements

Once content mechanism is in place, these features become possible:

1. **Search**: Full-text search across all prompts
2. **Versioning**: Track prompt changes over time
3. **A/B Testing**: Test multiple versions of same prompt
4. **Analytics**: Track which prompts are used most
5. **Suggestions**: AI-powered prompt recommendations
6. **Tags**: Organize commands by category
7. **Sharing**: Share command templates between users
8. **Import/Export**: Backup and share prompt collections

---

## Conclusion

The research reveals that **Suna already has a mature knowledge base architecture designed for AI agents**. The slash commands feature should adopt the same patterns:

**Primary Pattern** (Agent KB):
- Content in database
- RPC function for context injection
- Token-aware truncation
- Automatic system prompt inclusion

**Secondary Pattern** (File Access):
- Content in S3
- Manual tool-based download
- For large files or manual processing

**Recommendation**: Modify slash commands to use the Agent KB pattern (store content in database, use RPC function) for consistency and performance. This is a 3-hour implementation that aligns with Suna's architecture.
