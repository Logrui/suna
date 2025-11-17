# Suna Kortix Documentation - File Storage, Embeddings & RAG

## 📚 Documentation Index

This directory contains comprehensive guides about Suna Kortix's file storage, embedding systems, and RAG (Retrieval-Augmented Generation) architecture.

---

## 📄 Documents Overview

### 1. [Embeddings & Knowledge Base System](./1_EMBEDDINGS_AND_KNOWLEDGE_BASE.md)

**Topics Covered:**
- What is kb-fusion and how it works
- Embedding architecture (text-embedding-3-small, SQLite FTS5, RRF+MMR ranking)
- Differences between embeddings and LLM models
- Embeddings hardcoded to OpenAI (v0.1.1 limitation)
- LiteLLM provider routing (7+ LLM providers supported)
- Self-hosted mode behavior with/without OPENAI_API_KEY
- FileProcessor summarization pipeline (3-tier fallback)
- Configuration reference for embeddings and LLM providers
- Solutions for self-hosted deployments

**Key Takeaway:** kb-fusion embeddings are OpenAI-only and require OPENAI_API_KEY for KB search, while LLM models support 7+ providers via LiteLLM.

---

### 2. [File Storage & S3 Architecture](./2_FILE_STORAGE_AND_S3_ARCHITECTURE.md)

**Topics Covered:**
- S3 = Supabase Storage (S3-compatible object storage)
- Binary file processing: preserved or processed?
- File processing pipeline from upload to storage
- S3 storage structure and organization
- Bucket naming and path components
- Database linkage: PostgreSQL references S3 via file paths
- S3 operations (upload, download, delete, list)
- Binary preservation: original files stored unchanged
- Thread-level KB storage (same infrastructure, scoped access)
- Storage comparison: S3 vs PostgreSQL
- Access control and account isolation
- Cost-efficiency analysis

**Key Takeaway:** Binary files are preserved exactly in S3, while metadata and summaries are stored in PostgreSQL. This separation provides optimal performance and cost efficiency.

---

### 3. [RAG & Thread-Level Knowledge Base](./3_RAG_AND_THREAD_LEVEL_KB.md)

**Topics Covered:**
- RAG (Retrieval-Augmented Generation) architecture
- How RAG works: Retrieve → Augment → Generate
- Two-level KB architecture:
  - Agent-level KB (persistent, shared)
  - Thread-level KB (temporary, conversation-specific)
- KB search flow and trigger points
- Context injection into system prompts
- Thread KB management and lifecycle
- Document upload to threads
- Thread KB document processing (same as global KB)
- Thread KB data storage locations
- Performance optimization (top 18 docs, 500 char snippets)
- Error handling and graceful degradation
- Combined KB context (agent + thread)
- Differences between agent KB and thread KB
- Use cases for each KB type

**Key Takeaway:** Suna supports persistent agent-level KB and temporary thread-level KB that work together seamlessly, with identical processing and storage but different scopes.

---

## 🎯 Quick Reference

### File Storage Flow

```
Upload → Extract (temporary) → Generate Summary → Upload Binary to S3 → Store Metadata in DB
```

### Embeddings Pipeline

```
Document → Text Extraction → OpenAI Embeddings (required) → SQLite FTS5 Index → RRF+MMR Ranking
```

### RAG Execution

```
User Message → Search Agent KB + Thread KB → Format Context → Inject into Prompt → LLM Generates Response
```

---

## 💡 Key Concepts

### S3 Storage
- **What:** Cloud object storage via Supabase
- **Stores:** Binary files (PDFs, images, documents)
- **Why:** Cost-effective, scalable, preserves originals

### Embeddings
- **What:** Vector representations of text for semantic search
- **Provider:** OpenAI text-embedding-3-small (hardcoded)
- **Dependency:** OPENAI_API_KEY required for KB search

### LLM Models
- **What:** Large language models for reasoning and generation
- **Providers:** 7+ supported (OpenAI, Anthropic, Google, AWS, etc.)
- **Router:** LiteLLM abstracts provider differences

### RAG
- **What:** Retrieval-Augmented Generation pipeline
- **How:** Retrieves KB docs → Injects as context → LLM generates response
- **Benefit:** Grounds responses in knowledge base

### Thread KB
- **What:** Temporary knowledge base for single conversation
- **Storage:** Same S3/DB infrastructure as global KB
- **Scope:** Only accessible in that thread

---

## 🔧 Configuration

### Required for Full Functionality

```bash
# Required for KB search (embeddings)
OPENAI_API_KEY=sk-...

# Required for uploads/storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-key

# Recommended for LLM redundancy
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
```

### Optional for Self-Hosted

```bash
# For local LLM models (Ollama, LM Studio)
OPENAI_COMPATIBLE_API_BASE=http://localhost:11434/v1
OPENAI_COMPATIBLE_API_KEY=...

# For alternative LLM providers
OPENROUTER_API_KEY=...
```

---

## 📊 Architecture Diagram

```
Suna Kortix Application
│
├─── PostgreSQL Database
│    ├─ User data & auth
│    ├─ File metadata
│    ├─ KB folder structure
│    ├─ Thread information
│    ├─ KB indexes
│    └─ Embeddings (SQLite FTS5)
│
├─── S3 Storage (Supabase)
│    ├─ knowledge-base/
│    │  ├─ {account_id}/{kb_folder_id}/ (global KB)
│    │  └─ {account_id}/{thread_temp_kb}/ (thread KB)
│    ├─ avatars/
│    ├─ images/
│    └─ other-uploads/
│
├─── kb-fusion Binary
│    ├─ Embeddings: OpenAI API
│    ├─ Indexing: SQLite FTS5
│    ├─ Ranking: RRF + MMR
│    └─ Caching: LRU
│
└─── LLM Providers (via LiteLLM)
     ├─ OpenAI (default: gpt-4o)
     ├─ Anthropic (Claude)
     ├─ Google (Gemini)
     ├─ AWS Bedrock
     ├─ OpenRouter
     ├─ xAI
     ├─ Moonshot AI
     └─ OpenAI-compatible (Ollama, LM Studio)
```

---

## 🚀 Quick Start Scenarios

### Scenario 1: Full Self-Hosted with Cloud Supabase

```bash
# Required
OPENAI_API_KEY=sk-...           # For embeddings & default LLM
SUPABASE_URL=https://...        # For S3 & database
SUPABASE_KEY=...

# Optional (for LLM redundancy)
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...

Result: ✅ Full functionality
```

### Scenario 2: Self-Hosted without OpenAI

```bash
# Have
SUPABASE_URL=https://...
SUPABASE_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...

# Missing
OPENAI_API_KEY=❌

Result: 
  ✅ Documents upload & store
  ✅ LLM summarization works (falls back to Anthropic/Google)
  ❌ KB search fails (needs embeddings)
```

### Scenario 3: Local LLM Models Only

```bash
# Have
SUPABASE_URL=https://...
SUPABASE_KEY=...
OPENAI_COMPATIBLE_API_BASE=http://localhost:11434

# Missing
OPENAI_API_KEY=❌ (for embeddings)

Result:
  ✅ Can use Ollama for LLM
  ✅ Documents upload & store
  ❌ KB search fails
  ❌ Summarization needs fallback providers
```

---

## 📖 How to Use These Docs

1. **New to Suna?** Start with document 1 (Embeddings & KB)
2. **Understanding storage?** Read document 2 (File Storage & S3)
3. **Learning RAG?** Read document 3 (RAG & Thread KB)
4. **Troubleshooting?** Check all three for your specific issue

---

## ❓ Common Questions

**Q: Do I need OPENAI_API_KEY to use Suna?**
A: No. You can upload documents and use agents without it. However, KB semantic search won't work. See document 1 for details.

**Q: Where are my uploaded files stored?**
A: Original binary files → S3. Metadata & summaries → PostgreSQL. See document 2.

**Q: Can I have knowledge base documents specific to one conversation?**
A: Yes! Use Thread-Level KB. See document 3 for details.

**Q: Can I use Ollama instead of OpenAI?**
A: For LLM models yes (via LiteLLM). For embeddings no (kb-fusion hardcoded). See document 1.

**Q: What happens if embedding or LLM API fails?**
A: Graceful degradation with fallbacks. See document 1 for LLM fallbacks and document 3 for KB search failure handling.

---

## 🔗 Related Documentation

- Backend API: `/backend/README.md`
- Frontend Guide: `/frontend/README.md`
- Setup Instructions: `/SUNA_SETUP_COMPLETE.md`
- SDK Documentation: `/sdk/README.md`

---

## 📝 Document Metadata

| Document | Created | Topics | Size |
|----------|---------|--------|------|
| 1_EMBEDDINGS_AND_KNOWLEDGE_BASE.md | Oct 2025 | kb-fusion, embeddings, LiteLLM, providers | ~12KB |
| 2_FILE_STORAGE_AND_S3_ARCHITECTURE.md | Oct 2025 | S3, Supabase, binary storage, DB linkage | ~14KB |
| 3_RAG_AND_THREAD_LEVEL_KB.md | Oct 2025 | RAG, thread KB, context injection | ~16KB |

---

## 🎓 Learning Path

```
Beginner:
1. Read: What is S3? (doc 2, intro)
2. Read: What is embeddings? (doc 1, intro)
3. Read: What is RAG? (doc 3, intro)

Intermediate:
1. Understand: File processing pipeline (doc 2)
2. Understand: KB search flow (doc 3)
3. Understand: Provider architecture (doc 1)

Advanced:
1. Study: kb-fusion architecture (doc 1, detailed)
2. Study: Thread KB lifecycle (doc 3, detailed)
3. Study: Graceful degradation patterns (all docs)
```

---

## 📞 Questions or Updates?

These documents are based on Suna Kortix codebase analysis. For current information:
- Check: `backend/core/` source code
- Reference: kb-fusion GitHub (github.com/kortix-ai/kb-fusion)
- Review: LiteLLM documentation (litellm.vercel.app)

---

**Last Updated:** October 29, 2025
**Suna Kortix Version:** Latest on main branch
**Status:** Complete technical documentation
