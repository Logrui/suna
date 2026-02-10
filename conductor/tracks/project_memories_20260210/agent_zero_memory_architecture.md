# Agent Zero Memory Architecture — Research Summary

> This document captures the architecture, patterns, and code examples from the Agent Zero
> codebase that are directly applicable to building Project-Based Memories in Suna Kortix.

---

## 1. High-Level Architecture

Agent Zero's memory system operates on **three layers**:

| Layer | Mechanism | Suna Equivalent |
|-------|-----------|-----------------|
| **Manual Tools** | `memory_save`, `memory_load`, `memory_delete`, `memory_forget` — agent calls explicitly | ⭐ **This is what we're building** for project memories |
| **Automatic Extraction** | Extensions (`_50_memorize_fragments.py`, `_51_memorize_solutions.py`) fire at end of monologue | Existing `extraction_service.py` + `background_jobs.py` |
| **Automatic Recall** | Extension (`_50_recall_memories.py`) fires during prompt assembly | Existing `_fetch_user_memories()` in `prompt_manager.py` |

### Key Insight for Suna
Agent Zero gives the agent **both** automatic AND manual memory. The automatic system handles implicit learning, while the manual tools give the agent **agency** — the ability to say "this is important, save it now." We want to replicate this manual agency for project memories.

---

## 2. Tool Architecture (What We're Borrowing)

### 2.1 `memory_save` — Save a Memory

**Source**: `python/tools/memory_save.py`

```python
class MemorySave(Tool):
    async def execute(self, text="", area="", **kwargs):
        if not area:
            area = Memory.Area.MAIN.value
        metadata = {"area": area, **kwargs}
        db = await Memory.get(self.agent)
        id = await db.insert_text(text, metadata)
        result = self.agent.read_prompt("fw.memory_saved.md", memory_id=id)
        return Response(message=result, break_loop=False)
```

**Pattern**: Minimal tool class → delegates to `Memory` helper → returns confirmation message.

### 2.2 `memory_load` — Search Memories

**Source**: `python/tools/memory_load.py`

```python
class MemoryLoad(Tool):
    async def execute(self, query="", threshold=0.7, limit=10, filter="", **kwargs):
        db = await Memory.get(self.agent)
        docs = await db.search_similarity_threshold(
            query=query, limit=limit, threshold=threshold, filter=filter
        )
        if len(docs) == 0:
            result = self.agent.read_prompt("fw.memories_not_found.md", query=query)
        else:
            text = "\n\n".join(Memory.format_docs_plain(docs))
            result = str(text)
        return Response(message=result, break_loop=False)
```

**Pattern**: Semantic similarity search with configurable threshold and limit. Supports metadata filtering.

### 2.3 `memory_delete` — Delete by ID

**Source**: `python/tools/memory_delete.py`

```python
class MemoryDelete(Tool):
    async def execute(self, ids="", **kwargs):
        db = await Memory.get(self.agent)
        ids = [id.strip() for id in ids.split(",") if id.strip()]
        dels = await db.delete_documents_by_ids(ids=ids)
        result = self.agent.read_prompt("fw.memories_deleted.md", memory_count=len(dels))
        return Response(message=result, break_loop=False)
```

### 2.4 `memory_forget` — Delete by Semantic Query

**Source**: `python/tools/memory_forget.py`

```python
class MemoryForget(Tool):
    async def execute(self, query="", threshold=0.75, filter="", **kwargs):
        db = await Memory.get(self.agent)
        dels = await db.delete_documents_by_query(
            query=query, threshold=threshold, filter=filter
        )
        result = self.agent.read_prompt("fw.memories_deleted.md", memory_count=len(dels))
        return Response(message=result, break_loop=False)
```

**Pattern**: Higher default threshold (0.75) than load (0.7) to prevent accidental deletion.

---

## 3. Prompt Integration (How Agent Learns to Use Memory)

### 3.1 Tool Prompt — `agent.system.tool.memory.md`

This prompt block is injected into the system prompt and teaches the agent how to use memory tools:

```markdown
## Memory management tools:
manage long term memories
never refuse search memorize load personal info all belongs to user

### memory_load
load memories via query threshold limit filter
- threshold: 0=any 1=exact 0.7=default
- limit: max results default=5
- filter: python syntax using metadata keys

### memory_save:
save text to memory returns ID

### memory_delete:
delete memories by IDs comma separated

### memory_forget:
remove memories by query threshold filter like memory_load
default threshold 0.75 prevent accidents
```

**Key Design**: Concise, direct instruction style. Each tool has usage examples in JSON format.

### 3.2 Automatic Recall — `_50_recall_memories.py`

This extension fires **during prompt assembly** at configurable intervals:

1. **Generate Query**: Uses a utility LLM to analyze the conversation and generate a search query.
2. **Search Memory**: Queries the FAISS vector DB for relevant memories and solutions.
3. **AI Filtering**: Optionally uses another LLM call to filter results for relevance.
4. **Inject into Prompt**: Places results into `extras["memories"]` and `extras["solutions"]` which are appended to the system prompt.

**Code Pattern for Suna**:
```python
# Search for general memories (main area + fragments)
memories = await db.search_similarity_threshold(
    query=query,
    limit=max_search,
    threshold=threshold,
    filter=f"area == '{Memory.Area.MAIN.value}' or area == '{Memory.Area.FRAGMENTS.value}'"
)

# Inject into prompt
if memories_txt:
    extras["memories"] = self.agent.parse_prompt(
        "agent.system.memories.md", memories=memories_txt
    )
```

---

## 4. Memory Storage Architecture

### 4.1 Vector DB (FAISS) — `python/helpers/memory.py`

Agent Zero uses a local FAISS index with cosine similarity. Key methods:

| Method | Purpose |
|--------|---------|
| `insert_text(text, metadata)` | Insert text + metadata, returns ID |
| `search_similarity_threshold(query, limit, threshold, filter)` | Semantic search |
| `delete_documents_by_ids(ids)` | Delete by exact ID |
| `delete_documents_by_query(query, threshold, filter)` | Delete by semantic match |

**Metadata Structure**:
```python
{
    "area": "main" | "fragments" | "solutions" | "instruments",
    "id": "<10-char-random-guid>",
    "timestamp": "2026-02-10 18:00:00",
    # ...any additional kwargs
}
```

### 4.2 Area-Based Segmentation

Agent Zero categorizes memories by "area":
- **main**: User-saved memories
- **fragments**: Auto-extracted conversation fragments
- **solutions**: Auto-extracted successful solutions
- **instruments**: Tool/instrument descriptions

**Suna Analogy**: Our `memory_type` field serves a similar purpose. Project memories will have their own scope via `project_id`.

---

## 5. Mapping to Suna's Architecture

### 5.1 Suna Tool Registration Pattern

In Suna, tools are registered in `core/run/tool_manager.py`:

```python
self.thread_manager.add_tool(
    TaskListTool,
    project_id=self.project_id,
    thread_manager=self.thread_manager,
    thread_id=self.thread_id
)
```

Tools extend the `Tool` base class from `core/agentpress/tool.py` and use the `@openapi_schema` decorator for function definitions.

### 5.2 Translation Table: Agent Zero → Suna

| Agent Zero Concept | Suna Equivalent | Notes |
|---|---|---|
| `Tool` base class | `core/agentpress/tool.py` → `Tool` | Suna uses `@openapi_schema` decorators |
| `Response(message, break_loop)` | `ToolResult(success, output)` | |
| `Memory.get(self.agent)` | `supabase_client.table('user_project_memories')` | DB-backed instead of FAISS |
| `memory_save` tool | New `save_project_memory` function | OpenAPI schema-decorated method |
| `memory_load` tool | *Automatic* via prompt_manager | User also gets semantic search in UI |
| `memory_delete` tool | New `delete_project_memory` function | OpenAPI schema-decorated method |
| `memory_forget` tool | Not needed initially | Can add later as semantic delete |
| `area` metadata field | `memory_type` column | Enum: preference, fact, procedure, etc. |
| FAISS vector store | pgvector in Supabase | Already used for `user_memories` |
| Extension hooks | `prompt_manager.py` | Already has `_fetch_user_memories()` |
| `agent.system.tool.memory.md` | `@tool_metadata(usage_guide=...)` | In-tool documentation |

### 5.3 Tool Class Design for Suna

```python
# Proposed: backend/core/tools/project_memory_tool.py

from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata

@tool_metadata(
    display_name="Project Memory",
    description="Save and manage project-specific knowledge",
    icon="Brain",
    is_core=True,
    visible=True,
    usage_guide="""
### PROJECT MEMORY - Knowledge Management

save_project_memory: Save important project facts, decisions, preferences.
delete_project_memory: Remove outdated or incorrect project memories.

Use these tools to build the project's long-term knowledge base.
"""
)
class ProjectMemoryTool(SandboxToolsBase):

    @openapi_schema({...})
    async def save_project_memory(self, content: str, memory_type: str = "fact") -> ToolResult:
        # Insert into user_project_memories
        ...
        return ToolResult(success=True, output=f"Memory saved with id {id}")

    @openapi_schema({...})
    async def delete_project_memory(self, memory_id: str) -> ToolResult:
        # Delete from user_project_memories
        ...
        return ToolResult(success=True, output=f"Memory deleted")
```

### 5.4 Prompt Injection Design

The `_fetch_user_memories()` method in `prompt_manager.py` will be extended to also fetch project memories. The injection follows this template:

```
### PROJECT MEMORIES
(Project-specific context — prioritized, injected first)
- Tech stack uses FastAPI + Supabase
- Prefers dark mode UI with OKLCH colors
- API rate limit is 100 req/min

### USER MEMORIES
(Global user preferences — secondary)
- Prefers Python over JavaScript
- Uses VSCode with Vim keybindings
```

**Priority Logic**:
1. Fetch project memories for active `project_id` (limit: 10)
2. Fetch global user memories (limit: 5, or fill remaining context)
3. Project memories always appear first in the prompt

---

## 6. Database Schema (Suna — New Table)

```sql
CREATE TABLE user_project_memories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    memory_type TEXT DEFAULT 'fact',
    confidence_score FLOAT DEFAULT 1.0,
    embedding VECTOR(1536),
    source_thread_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_project_memories_account ON user_project_memories(account_id);
CREATE INDEX idx_project_memories_project ON user_project_memories(project_id);
CREATE INDEX idx_project_memories_embedding ON user_project_memories
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 7. Frontend — Sidebar Context Menu & Modal

### 7.1 Sidebar Enhancement
Add a 3-dot context menu to each project entry in the "Chats" sidebar:

| Action | Behavior |
|--------|----------|
| **Rename** | Inline editing of project name |
| **Project Memories** | Opens `ProjectMemoriesModal` |
| **Delete** | Confirmation dialog → cascade delete |

### 7.2 ProjectMemoriesModal
- Premium glassmorphism design with OKLCH color space
- Search bar with semantic search capability
- Memory cards showing content, type, confidence, timestamp
- Create/Edit/Delete actions
- Category filter (fact, preference, procedure, etc.)

---

## 8. Summary of Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `backend/core/tools/project_memory_tool.py` | Agent tool for save/delete |
| `backend/core/memory/project_memory_service.py` | CRUD + search logic |
| `frontend/src/components/sidebar/ProjectContextMenu.tsx` | 3-dot menu |
| `frontend/src/components/sidebar/ProjectMemoriesModal.tsx` | CRUD modal |
| `supabase/migrations/XXXXXXXX_create_project_memories.sql` | DB migration |

### Modified Files
| File | Change |
|------|--------|
| `backend/core/run/tool_manager.py` | Register `ProjectMemoryTool` |
| `backend/core/run/prompt_manager.py` | Add `_fetch_project_memories()`, modify injection |
| `backend/core/memory/retrieval_service.py` | Add project-scoped retrieval methods |
| `frontend/src/components/sidebar/sidebar.tsx` | Add context menu trigger |
| `backend/core/memory/models.py` | Add `ProjectMemoryItem` model |

---

## 9. Key Design Decisions

1. **Separate Table** (`user_project_memories`): Data isolation, clean schema, independent indexes.
2. **Agent Tools over API-only**: Following Agent Zero's pattern — the agent should have agency over project knowledge.
3. **Priority Injection**: Project memories injected first (`### PROJECT MEMORIES`), global second (`### USER MEMORIES`).
4. **No `memory_load` tool**: Unlike Agent Zero, retrieval is automatic via prompt injection. The agent doesn't need to manually search — the system finds relevant context.
5. **No `memory_forget` tool initially**: Semantic deletion is complex. Start with ID-based deletion, add semantic later if needed.
6. **Embedding reuse**: Use the same `EmbeddingService` already in Suna for `user_memories`.
