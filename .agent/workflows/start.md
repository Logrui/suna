---
description: Activate Zero-Point Codex framework for strategic analysis
---

# /start — Execution Script

> **Latency Profile**: ULTRA-LOW (<2K tokens boot)  
> **Philosophy**: Boot fast. Load later.

## Phase 1: Instant Boot (~2K tokens)

// turbo

- [ ] Load `.framework/v7.0/modules/Core_Identity.md` — Laws #0-#4, Identity, RSI (~2K tokens)
- [ ] **Living Spec**: Load `.context/project_state.md` — Active constraints, tech stack, patterns (Protocol 168)
- [ ] **Boot Orchestrator**: Run `# Reference: python3 scripts/boot.py` — recalls last session, creates new session, captures context, primes semantic memory (single call)

**Confirm**: "⚡ Ready. (Core Identity loaded. Session XX started. Semantic primed.)"

### ⚠️ Autonomic Reminders (Internalize at Boot)

These behaviors MUST run throughout the session. Non-negotiable:

| Protocol | Trigger | Action |
|----------|---------|--------|
| **Semantic Context** (§0.7.1) | **EVERY query** (mandatory) | **Dual-path**: (1) `supabase_search.py "<keywords>"` AND (2) `grep -i "<entity>" TAG_INDEX.md` for named entities |
| **Quicksave** (§0.6) | After EVERY user exchange *(exempt: `/start` boot response)* | `# Reference: python3 scripts/quicksave.py "<summary>"` |
| **Latency Indicator** (§0.5.1) | Every response | Append `[Λ+XX]` |
| **Response Enrichment** | Every response | Append `#tags` footer + embed `[Protocol XX](file://...)` links inline |
| **Citation Protocol** (Law #5) | External claim made | Inline cite `(Author, Year)` or `[URL]`. No orphan stats. |
| **Auto-Documentation** (§0.7) | New pattern/insight detected | File to appropriate location |

**Mental check**: "Did I run semantic search? Did I quicksave? Did I tag Λ? Did I enrich (tags + links)? Did I cite external claims?"

> [!CAUTION]
> **ENFORCEMENT**: Semantic Search is a **mandatory opener**. The execution order is:
>
> 1. Read user message
> 2. **FIRST TOOL CALL**: Run `smart_search.py "<keywords>"` with extracted entities/concepts
> 3. Use retrieved context to inform response
>
> **Semantic search MUST be the first tool call in your response turn.** This ensures context-aware responses.
>
> **Failure to run semantic search = Protocol Violation.** No exceptions. No "the query was simple."
>
> ```
> ┌─────────────────────────────────────────────────┐
> │  STEP 0: smart_search.py "<keywords>"          │
> │  STEP 1: Compose response using context        │
> │  STEP 2: quicksave.py "summary of response"    │
> │                                                 │
> │  ⛔ Search FIRST → Respond → Quicksave LAST   │
> └─────────────────────────────────────────────────┘
> ```

> [!CAUTION]
> **ENFORCEMENT**: Quicksave is a **mandatory closer**. The execution order is:
>
> 1. Read user message
> 2. Compose and output your response text
> 3. **LAST TOOL CALL**: Run `quicksave.py` with summary of what you just said
>
> **Quicksave MUST be the last tool call in your response turn.** This keeps UX clean (response first, confirmation last).
>
> **Failure to quicksave = Protocol Violation.** No exceptions. No "I'll do it next time."

> [!WARNING]
>
> ## 🚨 MANDATORY QUICKSAVE — LAST TOOL CALL
>
> **Execution Pattern:**
>
> ```
> ┌─────────────────────────────────────────────────┐
> │  STEP 1: Output response text                   │
> │  STEP 2: quicksave.py "summary of response"    │
> │                                                 │
> │  ⛔ NEVER forget to quicksave after responding │
> └─────────────────────────────────────────────────┘
> ```
>
> **This is not optional.** Respond FIRST, quicksave LAST.

---

## Phase 2: Adaptive Loading (On-Demand)

> **Rule**: Load only when triggered.

| Trigger | File | Tokens |
|---------|------|--------|
| Tag lookup, "find files about" | `TAG_INDEX.md` | 5,500 |
| Protocol/skill request | `SKILL_INDEX.md` | 4,500 |
| Bio, typology, "who am I" | `User_Profile_Core.md` | 1,500 |
| L1-L5, trauma, therapy, fantasy | `Psychology_L1L5.md` | 3,000 |
| Decision frameworks, strategy | `Operating_Principles.md` | 3,500 |
| Marketing, SEO, SWOT, pricing | `Business_Frameworks.md` | 2,500 |
| Calibration references, cases | `Session_Observations.md` | 2,500 |
| `/think`, `/ultrathink` | `Output_Standards.md` | 700 |
| Ethics, "should I" | `Constraints_Master.md` | 800 |
| Architecture query | `System_Manifest.md` | 1,900 |

## Phase 3: Contextual Skill Weaving (Auto-Injection)

> **Philosophy**: Don't wait for a command. If the conversational context *matches* a skill domain, load it silently to upgrade capability.

**Heuristic**: "If I were a specialized agent for [Topic], what file would I need?"

| Context / Topic | Skill to Inject |
|-----------------|-----------------|
| Frontend, UI, Design, CSS, "Make it pretty" | `Skill_Frontend_Design.md` |
| Deep Research, Rabbit Hole, "Find out everything" | `Protocol 52: Deep Research Loop` |
| Trading, ZenithFX, Risk, "Is this a scam?" | `Protocol 46 + Constraints_Master.md` |
| Communication, Interpersonal, Negotiation | `Playbook_Communication.md` |
| Complex Reasoning, "Analyze this", Strategy | `Protocol 75: Synthetic Parallel Reasoning` |

**Execution**:

1. Detect topic drift.
2. Check `SKILL_INDEX.md` (which covers 80+ skills).
3. Call `read_file` on the relevant protocol.
4. *Do not announce it.* Just become smarter.

---

## Quick Reference

| Command | Effect | Tokens |
|---------|--------|--------|
| `/start` | Core Identity + **Adaptive Latency** (default — scales reasoning to query) | ~2K |
| `/fullload` | Force-load all context | ~28K |
| `/think` | **Escalation** — Force L4 depth + Output_Standards | +2K |
| `/ultrathink` | Maximum depth + Full stack | +28K |

> **Default Mode**: Adaptive Latency ([Protocol 77]()). Reasoning scales to query complexity. `/think` and `/ultrathink` are manual overrides to force higher depth.

---

## References

- [Protocol 77: Adaptive Latency]()
- [WORKFLOW_INDEX.md]()
- [Session 2025-12-13-04]()

---

## Tagging

# workflow #automation #start
