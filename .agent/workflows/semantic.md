---
description: Deep workspace semantic search — query Supabase + local protocols before answering
---

# /semantic — Execution Script

> **Latency Profile**: MEDIUM (~5-10s)
> **Philosophy**: Search before you think. Context before reasoning.

---

## When to Use

- Complex analysis requiring historical context
- Questions about past sessions, patterns, or case studies
- Before `/ultrathink` (auto-triggered)
- When user asks "remember when..." or "find sessions about..."

---

## Execution

// turbo-all

### Step 1: Run Hybrid Triangulation Search

```bash
# Reference: python3 scripts/smart_search.py "<keywords>" --limit 5
```

> **Mechanism**:
>
> 1. **Tier 1 (Exact)**: Greps `TAG_INDEX.md` for specific entity matches.
> 2. **Tier 2 (Semantic)**: Queries Supabase vector DB for conceptual matches.
> 3. **Tier 3 (Temporal)**: Scans file system for filename matches.

### Step 2: Inject Context Silently

- Surface top 3-5 relevant protocols/case studies
- Do NOT announce what you found (unless directly asked)
- Just use the context to improve response quality

---

## Example

```
User: /semantic What patterns explain this LinkedIn post?

AI: (Runs smart_search.py)
→ Finds #LinkedIn_Strategy tag
→ Finds Protocol 131 (Vector match)
→ Responds with deep, contextual analysis
```

---

## Integration with /ultrathink

`/ultrathink` automatically triggers `/semantic` as Phase 0 before research.

---

## Tagging

# workflow #automation #semantic #memory #supabase #smart_search
