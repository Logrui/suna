# Quick Reference: Knowledge Base Mechanisms

## TL;DR

**Question**: How do AI agents read knowledge base files in Suna?

**Answer**: Two ways:
1. **Automatic**: RPC function injects file summaries into system prompt
2. **Manual**: Tool downloads all assigned files to sandbox

**Problem with Slash Commands**: Using REST API meant for metadata only, missing content

**Solution**: Use same RPC pattern as agents (store content in DB)

---

## Three Knowledge Base Systems

### 1. Agent Knowledge Base ✅
- **Storage**: Database (`agent_knowledge_base_entries.content`)
- **Access**: RPC function `get_agent_knowledge_base_context(agent_id)`
- **Pattern**: Automatic context injection
- **Status**: ✅ Working
- **File**: `backend/supabase/migrations/20250916000000_new_knowledge_base.sql`

### 2. File Access Tools ✅
- **Storage**: S3 (`file-uploads/knowledge-base/...`)
- **Access**: `global_kb_sync` tool (manual download)
- **Pattern**: Agent calls tool to sync files locally
- **Status**: ✅ Working
- **File**: `backend/core/tools/sb_kb_tool.py`

### 3. Slash Commands ❌
- **Storage**: S3 (`file-uploads/knowledge-base/...`)
- **Access**: REST API (metadata only)
- **Pattern**: ??? (Incomplete)
- **Status**: ❌ Content not available
- **File**: `backend/core/knowledge_base/api.py`

---

## The Missing Link: Content Retrieval

### Current REST API Response
```json
GET /knowledge-base/folders/{folder_id}/entries
→ [
  {
    "entry_id": "550e8400-...",
    "filename": "api_guide.md",
    "summary": "Complete REST API reference",
    "file_size": 50000,
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

### What's Missing
```json
{
  ...,
  "content": "# REST API Guide\n\n## Endpoints\n\n..."  ← NOT RETURNED!
}
```

### Why
```python
# backend/core/knowledge_base/api.py line 378
SELECT entry_id, filename, summary, file_size, created_at
# ↑ No 'content' field selected!
```

---

## Two Implementation Paths

### Path A: Database Content ⭐ Recommended
- Add `content` column to `knowledge_base_entries`
- Store content during upload
- Create RPC function to retrieve
- **Time**: 3 hours
- **Pattern**: Same as agent KB (consistent)
- **Performance**: Fast (DB query)

### Path B: REST Endpoint
- Create `GET /entries/{id}/content` endpoint
- Download from S3 on-demand
- **Time**: 2 hours
- **Pattern**: Different from agent KB (inconsistent)
- **Performance**: Slow (S3 download)

**Choose A** ✅

---

## Code Locations

| Component | Location | Lines |
|-----------|----------|-------|
| Agent KB RPC | migrations/20250916000000_new_knowledge_base.sql | 103-147 |
| Agent KB Injection | backend/core/run.py | 420-450 |
| File Sync Tool | backend/core/tools/sb_kb_tool.py | 260-350 |
| REST API (needs fix) | backend/core/knowledge_base/api.py | 360-397 |
| Upload Process | backend/core/knowledge_base/file_processor.py | ~50-150 |
| Frontend Hook | frontend/src/hooks/useSlashCommands.ts | 234 |

---

## Implementation Checklist for Path A

- [ ] **Schema** (15 min)
  ```sql
  ALTER TABLE knowledge_base_entries ADD COLUMN content TEXT;
  ```

- [ ] **Upload** (30 min)
  - Extract text from file
  - Store in database
  - Keep S3 upload for backup

- [ ] **RPC Function** (30 min)
  ```sql
  CREATE FUNCTION get_slash_command_content(
      p_entry_ids UUID[],
      p_max_tokens INTEGER DEFAULT 2000
  ) RETURNS TEXT ...
  ```

- [ ] **Frontend Hook** (30 min)
  ```typescript
  const { data } = await client
      .rpc('get_slash_command_content', { p_entry_ids: [...] })
      .single();
  ```

- [ ] **Testing** (45 min)
  - Verify content loads
  - Test prompt injection
  - E2E all 4 example commands

---

## Key Files to Understand

### Learn How Agents Access KB
1. Read: `backend/supabase/migrations/20250916000000_new_knowledge_base.sql`
   - Focus on: `get_agent_knowledge_base_context()` function
   - Lines 103-147

2. Read: `backend/core/run.py`
   - Focus on: How RPC is called during agent execution
   - Lines 420-450

3. Read: `backend/core/tools/sb_kb_tool.py`
   - Focus on: How `global_kb_sync` downloads files
   - Lines 260-350

### See Current Slash Commands Implementation
1. Read: `backend/core/knowledge_base/api.py`
   - Focus on: `get_folder_entries()` function
   - Lines 360-397

2. Read: `frontend/src/hooks/useSlashCommands.ts`
   - Focus on: How entries are mapped to commands
   - Line 234: `prompt: entry.content || ''`

---

## Architecture Principle

**One pattern, one system, one way to do things**

- Agents access KB content via: **Database + RPC**
- Agents access files via: **S3 + Tool**
- Slash commands should access content via: **Database + RPC** (same as agents)

Don't create a third pattern with REST API for different purpose.

---

## Next Decision

**Ready to implement?**

**IF YES**:
1. Decide: Use database + RPC (Path A) or REST endpoint (Path B)?
2. Start schema migration if Path A
3. Follow implementation checklist

**IF NO**:
1. Review research documents for more details
2. Discuss architectural implications
3. Decide later

**Recommended**: Path A (Database + RPC) ✅

---

## Research Documents

For detailed information, see:

1. **RESEARCH-FINDINGS.md** - Executive summary + rationale
2. **KB-ARCHITECTURE-RESEARCH.md** - Technical deep dive
3. **KB-ARCHITECTURE-DISCOVERY-SUMMARY.md** - Quick reference
4. **ARCHITECTURE-DIAGRAMS.md** - Visual explanations

All in: `/.docs/slash-commands/`
