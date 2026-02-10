# Phase 1 — Agentic Outline: Persistence, API, Agent Tools, & Prompt Injection

> This outline covers the FULL Phase 1 + Phase 2 + Phase 3 (backend only) implementation.
> Frontend UI (Phase 4) is deferred to a separate phase.

---

## Agent Assignments

### Agent 1: Database Migration
**File**: `backend/supabase/migrations/20260210_project_memories.sql`

Create migration modeled after `20251211102440_user_memories.sql`. Key differences:
- Table name: `user_project_memories`
- Extra column: `project_id UUID NOT NULL` with FK to `projects(project_id) ON DELETE CASCADE`
- Reuse `memory_type` enum (already exists: fact, preference, context, conversation_summary)
- `memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `account_id UUID NOT NULL` FK to `basejump.accounts(id) ON DELETE CASCADE`  
- `content TEXT NOT NULL`
- `memory_type memory_type NOT NULL DEFAULT 'fact'` (reuse existing enum)
- `embedding vector(1536)` 
- `source_thread_id UUID` FK to `threads(thread_id) ON DELETE SET NULL`
- `confidence_score FLOAT DEFAULT 1.0` (manual = high confidence)
- `metadata JSONB DEFAULT '{}'`
- `created_at/updated_at TIMESTAMPTZ`
- Indexes: account_id, project_id, embedding (ivfflat), created_at DESC
- `updated_at` trigger reusing `update_updated_at_column()` function
- RPC function: `search_project_memories_by_similarity(p_account_id, p_project_id, p_query_embedding, p_limit, p_similarity_threshold)`
- RPC function: `get_project_memory_stats(p_account_id, p_project_id)` 
- RLS policies mirroring `user_memories` patterns but also checking project ownership via account
- GRANT permissions for authenticated + service_role

### Agent 2: Models + Service
**File 1**: `backend/core/memory/models.py` — Add `ProjectMemoryItem` dataclass

```python
@dataclass
class ProjectMemoryItem:
    memory_id: str
    account_id: str
    project_id: str
    content: str
    memory_type: MemoryType
    embedding: Optional[List[float]] = None
    source_thread_id: Optional[str] = None
    confidence_score: float = 1.0
    metadata: Dict[str, Any] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if isinstance(self.memory_type, str):
            self.memory_type = MemoryType(self.memory_type)
        if isinstance(self.created_at, str):
            self.created_at = datetime.fromisoformat(self.created_at.replace('Z', '+00:00'))
        if isinstance(self.updated_at, str):
            self.updated_at = datetime.fromisoformat(self.updated_at.replace('Z', '+00:00'))
```

**File 2**: `backend/core/memory/project_memory_service.py` — New service class

This service handles all CRUD + search operations for project memories. Pattern follows `retrieval_service.py`.

```python
class ProjectMemoryService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.db = DBConnection()
        self.cache_ttl = 60
    
    async def create_memory(self, account_id, project_id, content, memory_type='fact', 
                           confidence_score=1.0, source_thread_id=None, metadata=None) -> ProjectMemoryItem
    async def get_memory(self, account_id, project_id, memory_id) -> Optional[ProjectMemoryItem]
    async def list_memories(self, account_id, project_id, limit=100, offset=0, memory_type=None) -> Tuple[List[ProjectMemoryItem], int]
    async def update_memory(self, account_id, project_id, memory_id, content=None, memory_type=None) -> ProjectMemoryItem
    async def delete_memory(self, account_id, project_id, memory_id) -> bool
    async def delete_all_memories(self, account_id, project_id) -> bool
    async def search_memories(self, account_id, project_id, query_text, limit=10, threshold=0.1) -> List[ProjectMemoryItem]
    async def get_stats(self, account_id, project_id) -> dict
    def format_memories_for_prompt(self, memories: List[ProjectMemoryItem]) -> str
    async def _invalidate_cache(self, account_id, project_id)

project_memory_service = ProjectMemoryService()
```

### Agent 3: API Endpoints
**File**: `backend/core/memory/project_memory_api.py` — New API router

Pattern follows `api.py` but with `/projects/{project_id}/memories` prefix.

Endpoints:
- `GET /projects/{project_id}/memories` — List project memories (paginated)
- `POST /projects/{project_id}/memories` — Create manual memory
- `GET /projects/{project_id}/memories/{memory_id}` — Get single memory
- `PUT /projects/{project_id}/memories/{memory_id}` — Update memory
- `DELETE /projects/{project_id}/memories/{memory_id}` — Delete memory
- `DELETE /projects/{project_id}/memories` — Delete all project memories
- `GET /projects/{project_id}/memories/stats` — Get stats

Each endpoint verifies:
1. JWT authentication via `verify_and_get_user_id_from_jwt`
2. Project ownership (user has role on account that owns project)

Must also register this router in the main app. Check where existing `memory` router is registered.

### Agent 4: Agent Tool
**File**: `backend/core/tools/project_memory_tool.py` — New tool class

Tool provides `save_project_memory` and `delete_project_memory` methods.

```python
from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase

@tool_metadata(
    display_name="Project Memory",
    description="Save and manage project-specific knowledge and context",
    icon="Brain",
    is_core=True,
    visible=True,
    usage_guide="""..."""
)
class ProjectMemoryTool(SandboxToolsBase):
    def __init__(self, project_id, thread_manager, thread_id, account_id):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self.account_id = account_id
    
    @openapi_schema({...})
    async def save_project_memory(self, content, memory_type='fact') -> ToolResult:
        ...
    
    @openapi_schema({...})
    async def delete_project_memory(self, memory_id) -> ToolResult:
        ...
```

### Agent 5: Tool Registration + Prompt Injection
**File 1**: `backend/core/run/tool_manager.py` — Register `ProjectMemoryTool` in `_register_core_tools()`

Add after TaskListTool registration:
```python
from core.tools.project_memory_tool import ProjectMemoryTool
self.thread_manager.add_tool(
    ProjectMemoryTool,
    project_id=self.project_id,
    thread_manager=self.thread_manager,
    thread_id=self.thread_id,
    account_id=self.account_id
)
```

**File 2**: `backend/core/run/prompt_manager.py` — Add project memory injection

Changes needed:
1. Add `project_id: Optional[str] = None` parameter to `build_system_prompt()`
2. Create `_fetch_project_memories(project_id, user_id, thread_id, client)` static method
3. In `build_system_prompt()`, add project memory fetch as concurrent task
4. In the context injection section (lines 126-134), add project memory block BEFORE user memory:
   ```python
   if project_memory_data:
       context_parts.append(f"[CONTEXT - Project Memory]\n{project_memory_data}\n[END CONTEXT]")
   ```
5. Pass `project_id` from `agent_runner.py` call site (`self.config.project_id`)

**File 3**: `backend/core/run/agent_runner.py` — Pass `project_id` to `build_system_prompt()`

Update both call sites (~line 489 and ~line 521) to include `project_id=self.config.project_id`.

---

## Execution Order

1. **Agent 1** (migration) — No dependencies
2. **Agent 2** (models + service) — No code dependencies (migration needed at runtime only)  
3. **Agent 3** (API) — Depends on Agent 2 (uses service)
4. **Agent 4** (tool) — Depends on Agent 2 (uses service)
5. **Agent 5** (registration + injection) — Depends on Agents 2, 4

**Parallel groups:**
- Group A: Agents 1, 2 (parallel)
- Group B: Agents 3, 4 (parallel, after 2)
- Group C: Agent 5 (after 3, 4)

---

## Verification Checklist

- [ ] Migration SQL is valid and follows existing patterns
- [ ] `ProjectMemoryItem` model matches DB schema
- [ ] Service handles all CRUD + embedding generation
- [ ] API endpoints follow existing auth/ownership patterns
- [ ] Tool uses `@openapi_schema` correctly for LLM function calling
- [ ] Tool registered as core tool in `_register_core_tools()`
- [ ] `prompt_manager.py` fetches and injects project memories
- [ ] `agent_runner.py` passes `project_id` to prompt builder
- [ ] No import cycles
- [ ] Plan.md updated with completed tasks
