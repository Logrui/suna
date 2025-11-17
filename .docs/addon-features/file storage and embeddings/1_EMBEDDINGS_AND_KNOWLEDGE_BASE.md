# Embeddings & Knowledge Base System in Suna Kortix

## Overview

Suna Kortix uses a **hybrid semantic search system** combining embeddings, full-text search, and ranking algorithms to retrieve relevant knowledge base documents for RAG (Retrieval-Augmented Generation).

---

## What is kb-fusion?

**kb-fusion** is a lightweight, open-source semantic search binary that powers Suna's knowledge base indexing and retrieval.

### Key Specifications

| Property | Value |
|----------|-------|
| **Version** | 0.1.1 |
| **License** | Apache 2.0 |
| **Repository** | github.com/kortix-ai/kb-fusion |
| **Embedding Model** | OpenAI text-embedding-3-small |
| **Embedding Dimensions** | 256 (configurable, max 1536) |
| **Index Type** | SQLite FTS5 (Full-Text Search 5) |
| **Chunk Size** | 220-word spans with ~200 stride |
| **Ranking Method** | RRF (Reciprocal Rank Fusion) + MMR (Maximal Marginal Relevance) |
| **De-duplication** | Jaccard similarity |
| **Caching** | LRU + persisted embedding cache |

### Architecture

```
Document Upload
       │
       ▼
┌──────────────────────────────────┐
│ Extract & chunk content          │
│ (220-word spans)                 │
└──────────┬───────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ OpenAI Embeddings API       │
    │ text-embedding-3-small      │
    │ Converts text → vectors     │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ SQLite FTS5 Indexing        │
    │ Stores embeddings + BM25    │
    │ De-duplicates (Jaccard)     │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Cache embeddings (LRU)      │
    │ For fast re-retrieval       │
    └──────────────────────────────┘

SEARCH FLOW:
User Query
       │
       ▼
Convert to embedding (OpenAI)
       │
       ▼
Search SQLite FTS5
       │
       ▼
Rank with RRF + MMR
       │
       ▼
Return top 18 results
```

---

## Embeddings vs LLM Models

**Critical Distinction:** Embeddings and LLM models use different providers in Suna.

### Embeddings (Knowledge Base)

| Aspect | Details |
|--------|---------|
| **Provider** | OpenAI ONLY (hardcoded in kb-fusion v0.1.1) |
| **Model** | text-embedding-3-small |
| **Purpose** | Convert documents → vectors for semantic search |
| **Configuration** | OPENAI_API_KEY required |
| **Fallback** | NONE - no alternative providers |
| **Use Case** | Finding relevant KB documents |

### LLM Models (Agent Reasoning)

| Aspect | Details |
|--------|---------|
| **Provider** | 7+ providers via LiteLLM |
| **Primary Model** | gpt-4o (OpenAI) |
| **Purpose** | Generate responses, reasoning, summaries |
| **Configuration** | Multiple provider keys available |
| **Fallback** | Yes - automatic router with fallbacks |
| **Use Case** | Agent reasoning, summary generation |

### Supported LLM Providers

```
✅ OpenAI (GPT-4o, GPT-4, GPT-3.5)
✅ Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
✅ Google (Gemini Pro, Gemini 2.5 Flash)
✅ AWS Bedrock (Claude, Llama, Mistral)
✅ OpenRouter (50+ models)
✅ xAI (Grok)
✅ Moonshot AI
✅ OpenAI-compatible (Ollama, LM Studio, vLLM)
```

---

## Self-Hosted Mode Without OPENAI_API_KEY

### Document Upload (Works ✅)

When you upload a document to the knowledge base **WITHOUT** OPENAI_API_KEY:

```
Document Upload
       │
       ▼
┌─────────────────────────────────┐
│ Extract text from file          │
│ (PDF/DOCX/TXT parsing)          │
│ ✅ SUCCESS                       │
└──────────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Generate LLM Summary        │
    │ 3-tier fallback:            │
    │ 1. Gemini 2.5 Flash         │
    │ 2. OpenRouter Gemini        │
    │ 3. GPT-5 Mini               │
    │ If all fail: Fallback text  │
    │ ✅ SUCCESS (with fallback)  │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Upload to S3                │
    │ ✅ SUCCESS                  │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Store metadata in DB        │
    │ ✅ SUCCESS                  │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Index with kb-fusion        │
    │ (on first search only)      │
    │ ❌ FAILS - needs OPENAI_KEY │
    └──────────────────────────────┘

RESULT: Document stored successfully
        KB search fails when attempted
```

### Knowledge Base Search (Fails ❌)

When searching the knowledge base **WITHOUT** OPENAI_API_KEY:

```
Search Query
       │
       ▼
┌─────────────────────────────────┐
│ kb-fusion: search command       │
│ kb search ~/kb "query" -k 18    │
└──────────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │ Need to embed query         │
    │ Call OpenAI API             │
    │ ❌ OPENAI_API_KEY missing   │
    └──────────────────────────────┘

ERROR: Cannot search without OPENAI_API_KEY
```

---

## FileProcessor Summarization Pipeline

When documents are uploaded, LLM summarization follows a 3-tier fallback system:

### Fallback Order

```python
models = [
    ("google/gemini-2.5-flash-lite", 1_000_000),      # 1st Priority
    ("openrouter/google/gemini-2.5-flash-lite", 1_000_000),  # 2nd Priority
    ("gpt-5-mini", 400_000)                            # 3rd Priority
]
```

### Process

```
Document Content
       │
       ▼
Try Gemini 2.5 Flash (Google API)
│ Success? ✅ Use summary
│ Fail? ↓
├─► Try Gemini 2.5 Flash (OpenRouter)
│   │ Success? ✅ Use summary
│   │ Fail? ↓
│   └─► Try GPT-5 Mini (OpenAI)
│       │ Success? ✅ Use summary
│       │ Fail? ↓
│       └─► Use Fallback Summary
               (File type + character count + preview)

All LLM models failed?
└─► Return intelligent fallback based on:
    • Document type (PDF, DOCX, TXT)
    • File size
    • Character preview
    • No API call needed
```

---

## LiteLLM: The Provider Router

**LiteLLM** is the abstraction layer that enables flexible LLM provider selection.

### How It Works

```
Your Code
    │
    ▼
┌──────────────────────────────┐
│ make_llm_api_call(           │
│   model="gpt-4o",            │
│   messages=[...]             │
│ )                            │
└──────────┬───────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ LiteLLM Router                  │
    │ • Detects "gpt-4o"              │
    │ • Routes to OpenAI API          │
    │ • Handles authentication        │
    │ • Manages retries/fallbacks     │
    └──────────┬─────────────────────┘
               │
    ┌──────────▼──────────────────────┐
    │ OpenAI API Call                 │
    │ Gets response                   │
    └──────────────────────────────────┘

Same code works for:
├─ "gpt-4o" → OpenAI
├─ "claude-3-5-sonnet" → Anthropic
├─ "gemini-2.5-flash" → Google
├─ "bedrock/anthropic.claude-3-sonnet" → AWS
└─ "openai/*" (custom endpoint) → Ollama/LM Studio
```

### Key Features

| Feature | Benefit |
|---------|---------|
| **Unified API** | Write once, call any provider |
| **Auto-routing** | Provider detected from model name |
| **Fallbacks** | Automatic retry with backup models |
| **Load Balancing** | Distribute calls across providers |
| **Cost Tracking** | Monitor spending per provider |
| **Error Handling** | Consistent error responses |
| **Caching** | Cache responses to save cost |
| **Retries** | Auto-retry with exponential backoff |

---

## KB Embedding Limitations

### Current Hardcoding

kb-fusion v0.1.1 is **hardcoded to OpenAI embeddings exclusively**:

```
✅ Supported:
  • OpenAI text-embedding-3-small (ONLY)
  • OpenAI API key required
  • Can configure dimensions (256-1536)

❌ NOT Supported:
  • Ollama embeddings
  • HuggingFace embeddings
  • Anthropic embeddings
  • Local embeddings
  • Alternative providers
```

### Why the Limitation?

```
LLM Models (Flexible):
└─ Use LiteLLM library
   └─ Abstracts multiple providers
   └─ Provider agnostic

KB Embeddings (Rigid):
└─ Use kb-fusion binary
   └─ Directly integrates OpenAI API
   └─ No abstraction layer
   └─ v0.1.1 hardcoded to OpenAI
```

### Solutions for Self-Hosted

**Option 1: Add OPENAI_API_KEY (Simplest)**
```bash
# In .env:
OPENAI_API_KEY=sk-...
# ✅ Full KB functionality enabled
```

**Option 2: Use Compatible LLM Provider**
```bash
# Use alternative LLM for agent reasoning
# KB search still requires OpenAI
# Partial workaround
```

**Option 3: Fork kb-fusion**
```bash
# Modify kb-fusion to support local embeddings
# Most complex, but fully self-hosted
```

**Option 4: Skip KB Semantic Search**
```bash
# Use full-text search only
# No embeddings required
# Reduced search quality
```

---

## Configuration Reference

### Environment Variables for Embeddings

```bash
# REQUIRED for KB search
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

# Optional: Embedding model config (hardcoded defaults)
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIM=256
```

### Environment Variables for LLM

```bash
# Primary
OPENAI_API_KEY=sk-...

# Alternatives
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...
XAI_API_KEY=...
MOONSHOTAI_API_KEY=...

# Self-hosted
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_API_BASE=http://localhost:11434/v1
```

---

## Key Takeaways

✅ **kb-fusion** = Semantic search binary using OpenAI embeddings

✅ **Embeddings** = Convert text → vectors (OpenAI only, hardcoded)

✅ **LLM Models** = Generate responses (7+ providers, flexible)

✅ **LiteLLM** = Router that enables provider flexibility for LLMs only

✅ **Self-hosted mode** = Works without OPENAI_API_KEY only for document upload/summarization

✅ **KB search fails** = Without OPENAI_API_KEY (can't generate embeddings)

✅ **Fallback summaries** = Available if all LLM models fail

✅ **Best practice** = Add OPENAI_API_KEY for full functionality
