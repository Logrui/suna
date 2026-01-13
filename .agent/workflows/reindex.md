---
description: Supabase-only reindex — sync memory to cloud without full refactor
---

# /reindex — Supabase Memory Sync

> **Latency Profile**: LOW (~30s)  
> **Philosophy**: Refresh the cloud memory index without touching content.

---

## Execution

// turbo

```bash
# Reference: python3 scripts/supabase_sync.py
```

---

## When to Use

- After adding many new protocols/case studies
- After bulk imports
- When semantic search feels stale
- After archiving or moving files

---

## Verification

```bash
# Reference: python3 scripts/supabase_search.py "test query" --limit 3
```

Should return relevant results from recently added content.

---

## Legacy (Deprecated)

> **Note**: GraphRAG local indexing was deprecated in Session 14 (2025-12-21).
> If you ever need to rebuild local GraphRAG:
>
> 1. `python -m venv .agent/graphrag_env`
> 2. `pip install -r .agent/requirements.txt`
> 3. `# Reference: python3 scripts/build_graph.py`

---

## Tagging

# workflow #automation #supabase #reindex
