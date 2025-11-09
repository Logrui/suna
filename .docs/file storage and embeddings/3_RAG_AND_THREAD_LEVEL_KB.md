# RAG System & Thread-Level Knowledge Base Guide

## Overview

Suna Kortix implements a sophisticated **RAG (Retrieval-Augmented Generation)** system that retrieves relevant knowledge base documents and injects them into agent prompts for context-aware responses. It supports both **persistent agent-level KB** and **temporary thread-level KB**.

---

## RAG Architecture

### How RAG Works in Suna

```
User Message
    │
    ▼
┌────────────────────────────────┐
│ RETRIEVE PHASE                 │
├────────────────────────────────┤
│ 1. Search knowledge base       │
│    (kb-fusion embeddings)      │
│ 2. Get top 18 relevant docs   │
│ 3. Rank by relevance          │
│ 4. Format as context          │
└────────┬───────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │ AUGMENT PHASE                  │
    ├────────────────────────────────┤
    │ Inject KB context into        │
    │ agent's system prompt         │
    └────┬───────────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │ GENERATE PHASE                 │
    ├────────────────────────────────┤
    │ LLM processes with KB context │
    │ Generates informed response   │
    └────────────────────────────────┘
```

---

## Two-Level KB Architecture

Suna supports **two types of knowledge base contexts**:

### Level 1: Agent-Level KB (Persistent)

```
Agent Configuration
├── Attached KB Folder ID
└── Shared across all threads for this agent

Storage:
├── Table: agent_kb_assignments
├── Columns: agent_id, version_id, kb_folder_id
└── Scope: All conversations using this agent
```

**Use Case:** General knowledge the agent always needs
- Product documentation
- Company policies
- API reference
- FAQ database

### Level 2: Thread-Level KB (Temporary)

```
Thread Metadata
├── attached_kb_folder_id: "kb_folder_temp_xyz"
└── Scope: Only this conversation thread

Storage:
├── Table: threads
├── Metadata: { attached_kb_folder_id: "..." }
└── Scope: Single conversation only
```

**Use Case:** Conversation-specific context
- Customer-specific documents
- Project requirements
- Session-specific research
- Contract being reviewed

---

## KB Search Flow

### Trigger Point

**File: `backend/core/agentpress/agent_executor.py`**

```python
async def execute_agent(
    self,
    agent_id: str,
    version_id: str,
    thread_id: str,
    message_content: str
):
    """Execute agent with KB search."""
    
    # 1. Search agent's permanent KB
    agent_kb_context = await self._get_agent_kb_context(
        agent_id, 
        version_id,
        message_content  # ← Query term
    )
    
    # 2. Search thread's temporary KB
    thread_kb_context = await self._get_thread_kb_context(
        thread_id,
        message_content  # ← Same query
    )
    
    # 3. Combine contexts (both are searched every time)
    combined_context = self._combine_kb_contexts(
        agent_kb_context,
        thread_kb_context
    )
    
    # 4. Execute with combined context
    result = await self._execute_with_context(
        agent_id,
        version_id,
        thread_id,
        message_content,
        kb_context=combined_context
    )
```

### Search Implementation

**File: `backend/core/tools/sb_kb_tool.py`**

```python
async def search_files(
    self, 
    path: str,                    # KB folder path
    queries: List[str]            # User query
) -> ToolResult:
    """Search KB using kb-fusion with embeddings."""
    
    # 1. Execute kb-fusion command
    search_command = f'kb search "{path}" {queries} -k 18 --json'
    #                                              └─ Top 18 results
    
    # 2. kb-fusion converts query to embeddings
    # 3. Searches SQLite FTS5 with RRF + MMR ranking
    # 4. Returns JSON results
    
    search_results = json.loads(result["output"])
    
    # 5. Format results
    formatted_results = []
    for idx, result_item in enumerate(search_results.get("results", [])[:18]):
        formatted_results.append({
            "rank": idx + 1,
            "file": result_item.get("metadata", {}).get("filename"),
            "snippet": result_item.get("snippet", "")[:500],  # 500 char limit
            "relevance_score": result_item.get("score", 0)
        })
    
    return self.success_response(formatted_results)
```

### Context Injection

**File: `backend/core/agentpress/agent_executor.py`**

```python
async def _build_system_prompt(
    self,
    agent_config: Dict,
    kb_context: str
) -> str:
    """Build system prompt with KB context."""
    
    if kb_context:
        system_prompt = f"""{kb_context}

---

## AGENT INSTRUCTIONS
{agent_config.get('system_prompt', '')}
"""
    else:
        system_prompt = agent_config.get('system_prompt', '')
    
    return system_prompt


async def _execute_with_context(
    self,
    agent_id: str,
    thread_id: str,
    message_content: str,
    kb_context: str
):
    """Execute agent with KB-enhanced system prompt."""
    
    # Build system prompt with KB
    system_prompt = await self._build_system_prompt(
        agent_config,
        kb_context
    )
    
    # Create messages
    messages = [
        {"role": "system", "content": system_prompt},  # ← KB injected here
        {"role": "user", "content": message_content}
    ]
    
    # Call LLM
    response = await make_llm_api_call(
        messages=messages,
        model_name="gpt-4o"
    )
    
    return response
```

### Example: Formatted KB Context

```
# KNOWLEDGE BASE CONTEXT
The following information from your knowledge base may be relevant:

## Document 1: api_authentication.md
**Relevance Score:** 0.92

To authenticate with the API, use Bearer tokens in the Authorization header:
Authorization: Bearer YOUR_TOKEN_HERE
Tokens expire after 24 hours...

## Document 2: error_codes.md
**Relevance Score:** 0.87

Error 401: Unauthorized - Check your API key...
Error 403: Forbidden - Check your permissions...

---

## AGENT INSTRUCTIONS
You are a helpful API support assistant...
```

---

## Thread-Level KB Management

### Creating a Thread with KB

```python
async def create_thread_with_kb(
    self,
    agent_id: str,
    kb_folder_id: str  # Attach KB immediately
):
    """Create thread and attach KB."""
    
    # 1. Create thread
    thread_id = await self.thread_manager.create_thread(
        agent_id=agent_id,
        metadata={
            'attached_kb_folder_id': kb_folder_id
        }
    )
    
    return thread_id
```

### Uploading Documents to Thread

**API Endpoint: `POST /api/threads/{thread_id}/documents`**

```python
async def upload_document_to_thread(
    thread_id: str,
    file: UploadFile
):
    """Upload document to thread's temporary KB."""
    
    client = await self.db.client
    
    # 1. Get thread
    thread = await client.table('threads').select(
        'metadata', 'account_id'
    ).eq('thread_id', thread_id).execute()
    
    account_id = thread.data[0]['account_id']
    metadata = thread.data[0]['metadata'] or {}
    
    # 2. Check if thread has KB
    kb_folder_id = metadata.get('attached_kb_folder_id')
    
    if not kb_folder_id:
        # Create temporary KB folder
        kb_folder_id = await self._create_thread_temp_kb_folder(
            account_id,
            thread_id
        )
        metadata['attached_kb_folder_id'] = kb_folder_id
        
        # Update thread
        await client.table('threads').update({
            'metadata': metadata
        }).eq('thread_id', thread_id).execute()
    
    # 3. Process file (SAME as global KB)
    file_processor = FileProcessor(self.db)
    
    file_content = await file.read()
    processed_doc = await file_processor.process_file(
        account_id=account_id,
        folder_id=kb_folder_id,  # ← Thread's temp folder
        file_content=file_content,
        filename=file.filename,
        mime_type=file.content_type
    )
    
    # 4. Mark as thread document
    entry_id = processed_doc['entry_id']
    
    await client.table('knowledge_base_entries').update({
        'metadata': {
            'thread_id': thread_id,
            'is_thread_temp': True
        }
    }).eq('entry_id', entry_id).execute()
    
    return processed_doc
```

---

## Thread KB Lifecycle

### Complete Flow

```
┌─────────────────────────────┐
│ 1. THREAD CREATED           │
│ Empty, no KB attached       │
│ metadata: {}                │
└──────────┬──────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ 2. DOCUMENT UPLOADED            │
    │ User uploads customer order     │
    │ Check: Thread has KB? No        │
    │ Create: Temp KB folder          │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ 3. DOCUMENT PROCESSED           │
    │ Extract text, summarize         │
    │ Upload original to S3           │
    │ Store metadata in DB            │
    │ Index with kb-fusion            │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ 4. USER SENDS MESSAGE           │
    │ "What's the order status?"      │
    │ Thread KB searched              │
    │ Document found: relevance 0.95  │
    │ Context injected into prompt    │
    │ Agent responds with context     │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ 5. MORE DOCUMENTS UPLOADED      │
    │ Additional research.pdf added   │
    │ All documents searchable        │
    │ Same temp KB folder             │
    └──────┬───────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ 6. THREAD ARCHIVED              │
    │ Conversation ends               │
    │ KB folder marked inactive       │
    │ Files retained for archival     │
    └─────────────────────────────────┘
```

### Data Storage During Thread KB Lifecycle

```
PostgreSQL Tables:
┌─ threads
│  ├─ thread_id: "abc123"
│  ├─ agent_id: "agent1"
│  └─ metadata:
│     └─ attached_kb_folder_id: "kb_folder_temp_xyz"
│
├─ knowledge_base_folders
│  ├─ folder_id: "kb_folder_temp_xyz"
│  ├─ folder_name: "Thread abc123 Temp"
│  └─ is_thread_temp: true
│
└─ knowledge_base_entries (multiple)
   ├─ entry_id: "e1"
   ├─ folder_id: "kb_folder_temp_xyz"
   ├─ filename: "customer_order.pdf"
   ├─ file_path: "s3://knowledge-base/kb_folder_temp_xyz/e1/order.pdf"
   ├─ summary: "Customer order for product #123..."
   └─ metadata:
      ├─ thread_id: "abc123"
      └─ is_thread_temp: true

S3 Storage:
└─ file-uploads/knowledge-base/kb_folder_temp_xyz/
   ├─ e1/customer_order.pdf        ← Original binary
   └─ e2/research_notes.pdf        ← Original binary
```

---

## Performance Optimization

### Top 18 Documents Limit

```python
-k 18  # ← Maximum results per search
```

**Why 18?**
- Balance between context quality and token usage
- Prevents exceeding LLM context window (~4K tokens)
- Reduces latency (fewer documents to process)
- Typical doc: ~300 tokens, so 18 docs ≈ 5.4K tokens

### Snippet Size Limit

```python
snippet: result.get("snippet", "")[:500]  # ← 500 chars max
```

**Why 500 chars?**
- Keeps token count manageable (~125-150 tokens per snippet)
- Forces kb-fusion to return most relevant excerpt
- Faster LLM processing

### Deduplication & Ranking

```
kb-fusion ranking:
1. RRF (Reciprocal Rank Fusion)
   └─ Combines BM25 + semantic scores
2. MMR (Maximal Marginal Relevance)
   └─ Removes similar documents
3. Jaccard Similarity
   └─ De-duplicates identical content
```

---

## Error Handling

### KB Search Failure

```python
async def _get_agent_kb_context(...):
    try:
        kb_results = await self._search_kb(kb_folder_id, query)
    except Exception as e:
        logger.warning(f"KB search failed: {str(e)}")
        return ""  # ← Graceful degradation
        
# Agent still executes without KB if search fails!
```

### Graceful Degradation

```
KB Search Successful
    ✅ Use KB context

KB Search Failed (e.g., OPENAI_API_KEY missing)
    ⚠️ Skip KB context
    ✅ Agent still executes
    ✅ Response quality reduced but functional
```

---

## Differences: Agent KB vs Thread KB

| Aspect | Agent KB | Thread KB |
|--------|----------|-----------|
| **Scope** | All threads using agent | Single thread only |
| **Lifetime** | Permanent | Lives with thread |
| **Created** | Via agent configuration | Auto-created on first upload |
| **Storage** | Persistent S3 folder | Temporary S3 folder |
| **Processing** | Same as KB | Same as KB (identical) |
| **Access** | All agents sharing same | Thread only |
| **Sharing** | Multiple agents | Thread only |
| **Cleanup** | Manual deletion | Can detach from thread |

---

## Combined KB Context Example

When an agent has both Agent KB and Thread KB:

```
User: "How should we proceed with this project?"

Search Agent KB:
├─ Found: company_policies.md (0.88)
├─ Found: project_guidelines.md (0.85)
└─ Found: faq.md (0.72)

Search Thread KB:
├─ Found: project_requirements.pdf (0.95)
├─ Found: budget_constraints.txt (0.91)
└─ Found: stakeholder_feedback.md (0.79)

Combined Context (8 docs total):
# KNOWLEDGE BASE CONTEXT
## Document 1: project_requirements.pdf (0.95)
Project scope includes...

## Document 2: budget_constraints.txt (0.91)
Approved budget is $500k...

## Document 3: company_policies.md (0.88)
All projects must follow...

[... 5 more documents ...]

---

## AGENT INSTRUCTIONS
You are a project manager...
```

---

## Key Takeaways

✅ **RAG** = Retrieve documents, Augment with context, Generate response

✅ **Two-level KB** = Agent-level (persistent) + Thread-level (temporary)

✅ **Same processing** = Thread docs go through identical pipeline as global KB

✅ **Same storage** = Both use S3 + PostgreSQL (just different folders)

✅ **Automatic combination** = Agent KB + Thread KB searched together

✅ **Top 18 results** = Balanced for context window + quality

✅ **Graceful degradation** = Works without KB if search fails

✅ **Thread isolation** = Each conversation has private temporary KB

✅ **Original preservation** = Thread docs stored in S3 as-is, just like global KB
