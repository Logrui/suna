# Research Findings: Knowledge Base Content Access Mechanisms

## Executive Summary

**Finding**: Suna has TWO distinct knowledge base systems, each with different purposes and content retrieval mechanisms.

**Key Discovery**: AI agents DO have methods to read file content:
1. **Automatic Context Injection** via RPC function (`get_agent_knowledge_base_context`)
2. **Manual File Access** via `global_kb_sync` tool

**Problem**: Slash commands use a THIRD system that's incomplete—it retrieves metadata (filename, summary) but not content.

**Solution**: Adapt slash commands to use the same pattern as agents (RPC function + database storage) instead of the incomplete metadata-only REST API.

---

## Part 1: Agent Knowledge Base System

### How Agents Read Files (Automatic)

**File**: `backend/supabase/migrations/20250916000000_new_knowledge_base.sql`

```plpgsql
CREATE FUNCTION get_agent_knowledge_base_context(
    p_agent_id UUID,
    p_max_tokens INTEGER DEFAULT 4000
) RETURNS TEXT
```

**What It Does**:
1. Queries database for all files assigned to this agent
2. Joins tables: `knowledge_base_entries` → `knowledge_base_folders` → `agent_knowledge_entry_assignments`
3. Filters for `enabled = TRUE` and `usage_context IN ('always', 'contextual')`
4. Returns formatted text with filename + summary (content not included in current version)
5. Respects token limits (stops when exceeding max_tokens)

**Return Format**:
```
# KNOWLEDGE BASE

The following files are available in your knowledge base:

## FolderName/file1.md
Summary of file1...

## FolderName/file2.pdf
Summary of file2...
```

**Called During**: Agent initialization (every run)
**Location**: `backend/core/run.py` lines 420-450

```python
kb_result = await client.rpc('get_agent_knowledge_base_context', {
    'p_agent_id': agent_config['agent_id']
}).execute()

system_content += f"""
=== AGENT KNOWLEDGE BASE ===
NOTICE: The following is your specialized knowledge base...
{kb_result.data}
=== END AGENT KNOWLEDGE BASE ===
"""
```

**Result**: Agents automatically know what files they have access to, plus a summary of each.

---

### How Agents Read File Content (Manual)

**File**: `backend/core/tools/sb_kb_tool.py` (259-350)

```python
async def global_kb_sync(self) -> ToolResult:
    """Sync all agent's knowledge base files to sandbox ~/knowledge-base-global"""
```

**What It Does**:
1. Agent calls tool: `await global_kb_sync()`
2. Queries `agent_knowledge_entry_assignments` to find all assigned files
3. For each assigned file:
   - Retrieves `file_path` from database (e.g., `knowledge-base/{folder_id}/{entry_id}/filename.md`)
   - Downloads file from Supabase storage: `client.storage.from_('file-uploads').download(file_path)`
   - Creates folder structure in sandbox: `~/knowledge-base-global/{folder_name}/`
   - Uploads file to sandbox
4. Creates README with file index
5. Returns summary with count of synced files

**Result**: Agent has local copy of all assigned files in sandbox sandbox filesystem:
```
~/knowledge-base-global/
├── API Documentation/
│   ├── api_reference.pdf
│   └── rest_endpoints.md
└── Configurations/
    └── system_config.json
```

**Usage**: Agent can then:
- Read entire files with `cat ~/knowledge-base-global/...`
- Extract specific information
- Process files with local tools
- Integrate content into responses

---

## Part 2: Storage Architecture

### Where Content Is Stored

**Database** (`knowledge_base_entries` table):
- Stores metadata: filename, file_path, file_size, mime_type, summary, usage_context
- Does NOT store full content (currently)
- ✅ Fast to query
- ✅ Suitable for metadata operations
- ✅ Can store token counts for optimization

**S3 Storage** (`file-uploads/` bucket):
- Path structure: `knowledge-base/{folder_id}/{entry_id}/{sanitized_filename}`
- Stores actual file content (raw bytes)
- ✅ Suitable for large files (PDFs, images, archives)
- ✅ Scalable for unlimited file sizes
- ⚠️ Requires separate download operation
- ⚠️ Higher latency for access

### Data Flow: File Upload

```
User selects file to upload
↓
frontend/src/hooks/useSlashCommands.ts
├─ Form submission with File object
├─ POST /knowledge-base/folders/{folder_id}/upload
│
↓
backend/core/knowledge_base/file_processor.py
├─ Receive multipart/form-data with file
├─ Sanitize filename (remove special chars)
├─ Create S3 path: knowledge-base/{folder_id}/{entry_id}/{sanitized_filename}
├─ Upload to Supabase storage
│  await client.storage.from_('file-uploads').upload(s3_path, file_content, ...)
├─ Insert metadata into database
│  INSERT INTO knowledge_base_entries
│  (entry_id, folder_id, filename, file_path, file_size, mime_type, summary, ...)
└─ Return entry_id to frontend

✓ File stored in both places
  - Metadata in database (for fast queries)
  - Content in S3 (for access when needed)
```

---

## Part 3: Slash Commands (Current Implementation)

### What Works
- ✅ Upload to folder
- ✅ List files with metadata
- ✅ Move files between folders
- ✅ Delete files
- ✅ Update file summaries

### What Doesn't Work
- ❌ Content is NOT available in API responses

### Why Content is Missing

**File**: `backend/core/knowledge_base/api.py` (lines 360-397)

```python
@router.get("/knowledge-base/folders/{folder_id}/entries")
async def get_folder_entries(folder_id: UUID, ...):
    result = await client.table('knowledge_base_entries').select(
        'entry_id, filename, summary, file_size, created_at'
        # ❌ NO 'content' FIELD!
    ).eq('folder_id', folder_id).execute()
    
    return [EntryResponse(**entry) for entry in result.data]
```

**EntryResponse Model**:
```python
class EntryResponse(BaseModel):
    entry_id: UUID
    filename: str
    summary: str
    file_size: int
    created_at: datetime
    # ❌ NO content: str FIELD!
```

**Result**: Frontend receives:
```json
{
  "entry_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "api_guide.md",
  "summary": "Complete REST API reference",
  "file_size": 50000,
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Frontend tries to access** (`useSlashCommands.ts` line 234):
```typescript
prompt: entry.content || ''  // ← undefined!
```

**Result**: Empty prompts, slash commands don't work.

---

## Part 4: Why This Happened

### Architectural Intent

**Agent KB** (for agents):
- Content stored IN DATABASE for agent access
- RPC functions for automatic context injection
- Designed for system-level operations

**User KB** (for users):
- Content stored IN S3 for file management
- REST API for CRUD operations on files
- Designed for manual upload/organization

**Slash Commands** (new feature):
- ??? (No clear pattern defined)
- Content NOT stored anywhere accessible
- Uses REST API (meant for metadata only)

### Why It Didn't Work

Slash commands were added to the User KB REST API, which was never designed to return content. It was designed for:
- Creating folders
- Uploading files
- Organizing files (move, delete)
- Viewing file lists

But NOT for retrieving content for injection into chat.

---

## Part 5: Two Solutions

### SOLUTION A: Use Agent KB Pattern (Recommended)

**Approach**: Store prompt content in database, use RPC function for retrieval

**Changes**:
1. **Schema**: Add `content TEXT` column to `knowledge_base_entries`
2. **Upload**: Store content in database during file upload
3. **Retrieval**: Create RPC function `get_slash_command_content(entry_ids)`
4. **Frontend**: Call RPC function instead of REST API

**Implementation**:

```sql
-- 1. Add content column
ALTER TABLE knowledge_base_entries
ADD COLUMN content TEXT;

-- 2. Create RPC function
CREATE FUNCTION get_slash_command_content(
    p_entry_ids UUID[],
    p_max_tokens INTEGER DEFAULT 2000
) RETURNS TEXT SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
    context_text TEXT := '';
    entry_record RECORD;
    current_tokens INTEGER := 0;
    estimated_tokens INTEGER;
BEGIN
    FOR entry_record IN
        SELECT filename, content, folder_name
        FROM knowledge_base_entries
        JOIN knowledge_base_folders ON ...
        WHERE entry_id = ANY(p_entry_ids)
        AND is_active = TRUE
        ORDER BY created_at DESC
    LOOP
        estimated_tokens := LENGTH(entry_record.content) / 4;
        IF current_tokens + estimated_tokens > p_max_tokens THEN
            EXIT;
        END IF;
        
        context_text := context_text || E'\n## ' || entry_record.filename || E'\n'
                        || entry_record.content;
        current_tokens := current_tokens + estimated_tokens;
    END LOOP;
    
    RETURN context_text;
END;
$$;
```

```python
# backend/core/knowledge_base/file_processor.py
async def process_file(file_content: bytes, filename: str, ...):
    # Extract text content (or read as-is if already text)
    text_content = file_content.decode('utf-8', errors='ignore')
    
    # Store in database
    entry_id = uuid4()
    await client.table('knowledge_base_entries').insert({
        'entry_id': entry_id,
        'folder_id': folder_id,
        'filename': filename,
        'file_path': s3_path,
        'content': text_content,  # ← NEW
        'file_size': len(file_content),
        'mime_type': mime_type,
        'summary': generate_summary(text_content),  # AI-generated
        'usage_context': 'always'
    }).execute()
    
    # Also upload to S3 for backup
    await client.storage.from_('file-uploads').upload(s3_path, file_content)
```

```typescript
// frontend/src/hooks/useSlashCommands.ts
async function useSlashCommands() {
    // Get list of entries
    const entries = await fetch(`/knowledge-base/folders/${folderId}/entries`);
    
    // Get full content for each entry
    const { data: fullContent } = await client
        .rpc('get_slash_command_content', {
            p_entry_ids: entries.map(e => e.entry_id)
        })
        .single();
    
    // Return commands with content
    return entries.map(entry => ({
        name: entry.filename.split('.')[0],
        description: entry.summary,
        prompt: contentMap[entry.id]  // ← NOW HAS CONTENT!
    }));
}
```

**Advantages**:
- ✅ **Consistent**: Same pattern as agent KB
- ✅ **Fast**: Direct database query
- ✅ **Scalable**: Token management built-in
- ✅ **Extensible**: Enables future features (search, versioning)

**Disadvantages**:
- ⚠️ Schema migration required
- ⚠️ Data stored in two places (DB + S3)

**Effort**: 2-3 hours

---

### SOLUTION B: Add REST Content Endpoint

**Approach**: Create new API endpoint to fetch content from S3

**Changes**:
1. **Backend**: Add endpoint `GET /knowledge-base/entries/{entry_id}/content`
2. **Backend**: Download from S3 on-demand
3. **Frontend**: Call new endpoint for each entry

**Implementation**:

```python
# backend/core/knowledge_base/api.py
@router.get("/entries/{entry_id}/content")
async def get_entry_content(
    entry_id: UUID,
    current_user = Depends(get_current_user)
):
    # Get entry metadata
    entry = await client.table('knowledge_base_entries').select(
        'file_path, filename'
    ).eq('entry_id', entry_id).single()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    # Download from S3
    file_content = await client.storage.from_('file-uploads').download(
        entry['file_path']
    )
    
    return {
        'content': file_content.decode('utf-8', errors='ignore'),
        'filename': entry['filename']
    }
```

```typescript
// frontend/src/hooks/useSlashCommands.ts
async function useSlashCommands() {
    const entries = await fetch(`/knowledge-base/folders/${folderId}/entries`);
    
    // Fetch content for each entry
    const entriesWithContent = await Promise.all(
        entries.map(async (entry) => {
            const contentRes = await fetch(
                `/knowledge-base/entries/${entry.entry_id}/content`
            );
            const { content } = await contentRes.json();
            return { ...entry, content };
        })
    );
    
    return entriesWithContent.map(entry => ({
        name: entry.filename.split('.')[0],
        description: entry.summary,
        prompt: entry.content  // ← NOW HAS CONTENT!
    }));
}
```

**Advantages**:
- ✅ Minimal schema changes
- ✅ No data duplication
- ✅ Uses existing S3 infrastructure

**Disadvantages**:
- ❌ Different pattern than agent KB
- ❌ Slower (S3 download per entry)
- ❌ No token management
- ❌ Creates architectural inconsistency

**Effort**: 1-2 hours

---

## Part 6: Recommendation

**USE SOLUTION A** (Adopt Agent KB Pattern)

### Why

1. **Architectural Consistency**: Same pattern as proven agent KB system
2. **Performance**: Database faster than S3 downloads
3. **Token Management**: Can implement smart truncation like agents
4. **Extensibility**: Foundation for search, analytics, A/B testing
5. **Scalability**: Works for large numbers of commands
6. **Maintenance**: Single code pattern to maintain

### Implementation Timeline

- **Database Schema** (15 min): Add content column
- **Upload Process** (30 min): Extract and store content
- **RPC Function** (30 min): Create content retrieval function
- **Frontend** (30 min): Update hooks to use RPC
- **Testing** (45 min): E2E verification
- **Total**: ~3 hours

### Next Steps

1. **Decision**: Confirm Solution A is preferred
2. **Schema Migration**: Add `content TEXT` to `knowledge_base_entries`
3. **Update Upload**: Modify file_processor.py
4. **Create RPC**: Add get_slash_command_content function
5. **Update Frontend**: Modify useSlashCommands hook
6. **Test**: E2E testing of slash commands
7. **Deploy**: Merge to main

---

## Reference Documents

Three detailed research documents have been created:

1. **KB-ARCHITECTURE-RESEARCH.md** (1000+ lines)
   - Complete technical reference
   - Database schema details
   - All RPC functions
   - Tool implementations
   - Comparison matrices

2. **KB-ARCHITECTURE-DISCOVERY-SUMMARY.md**
   - Quick reference guide
   - Code locations
   - Implementation roadmap
   - Decision matrix

3. **ARCHITECTURE-DIAGRAMS.md**
   - Visual system diagrams
   - Data flow illustrations
   - Component relationships
   - Timeline comparisons

All files located in: `/.docs/slash-commands/`

---

## Conclusion

The research reveals that **Suna's knowledge base system is sophisticated and production-proven for agent use**. Slash commands should adopt the same patterns for consistency and to unlock the full architectural benefits of the system.

**The decision point is clear**: Should slash commands follow the established agent KB pattern, or create a new REST-based pattern? **Recommendation: Follow the agent pattern** for a cohesive, scalable system.
