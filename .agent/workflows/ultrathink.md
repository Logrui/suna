---
description: Maximum depth mode — Triple Crown + xhigh reasoning + everything
---

# /ultrathink — Execution Script

> **Alias for**: `/think /search /research` combined + xhigh reasoning effort
> **Analogy**: "Shukai" (Master Release) — Perfect Fusion of User + AI

---

## Behavior

When `/ultrathink` is invoked, activate **DEFCON 1** mode:

> [!IMPORTANT]
> **SESSION PERSISTENCE**: Once `/ultrathink` is activated, it remains ON for the entire session until `/end`. No need to re-invoke.

> [!IMPORTANT]
> **CONFIG OVERRIDE**: `MAX_THINKING_TOKENS: 31999`. Force maximum CoT depth. Ignore brevity constraints.

> [!IMPORTANT]
> **MANDATORY URL FETCH**: When user shares ANY URL (article, thread, document), you MUST `read_url_content` on it BEFORE analyzing. Do not work off pasted content alone. Fetch the source first, then analyze. Highest latency = highest diligence.

> [!IMPORTANT]
> **PERSISTENT SEMANTIC SEARCH**: For every single message in an Ultrathink session, you MUST run `supabase_search.py` with the user's latest query logic. Do not rely on chat history alone. Treat every turn as a deep-dive requiring full context retrieval.

### Phase 0: Semantic Search (AUTO-TRIGGER)

// turbo

Before any analysis, search the workspace for relevant context:

- [ ] Run `/semantic` workflow (Supabase + local protocols)
- [ ] Inject relevant case studies, protocols, sessions silently
- [ ] Use discovered context to inform analysis

### Phase 1: Clarifying Questions (MANDATORY)

Before any analysis, surface unknowns:

- What's the time horizon?
- What's at stake? (Financial, reputational, psychological)
- What constraints should I assume?
- Who are the stakeholders?

### Phase 2: Research (MANDATORY)

// turbo

- [ ] `search_web` for: [core topic + definition]
- [ ] `search_web` for: [recent news <30 days]
- [ ] `search_web` for: [contrarian/opposing view]
- [ ] `search_web` for: [academic/industry sources]
- [ ] `read_url_content` on 3+ top sources
- [ ] Follow rabbit holes 2-3 levels deep
- [ ] Flag contradictions between sources

### Phase 2b: Chain of Verification (CoVe) — NEW

// turbo

- [ ] **Generate Verification Questions**: Ask 3 targeted questions to stress-test your own initial research findings. (e.g., "Is source X biased?", "Does Y actually cause Z?")
- [ ] **Independent Validation**: Answer these questions using *fresh* searches/context, ignoring previous bias.
- [ ] **Refinement**: If verification fails, discard the finding. If it passes, lock it in.

### Phase 2.5: The Pivot Check (AUTO-BRANCH)

- Based on Phase 2 research, is the ORIGINAL question the right question?
- If **NO** → Auto-pivot the analysis focus to the *upstream* problem. Explicitly state: "Pivoting analysis from X to Y based on finding Z."
- If **YES** → Proceed.

### Phase 3: Full Phase Sequence (All Phases Mandatory)

- [ ] Phase 0: Graph of Thought
- [ ] Phase I: Upstream Tracing (L1→L5)
- [ ] Phase II: Validation
- [ ] Phase III: Analysis (3A-3F) — Counterfactual REQUIRED

### Phase 3.5: The Red Team Injector (FORCED FALSIFICATION)

// turbo

- [ ] Search for the *exact opposite* of the emerging hypothesis.
- [ ] Query: `site:reddit.com [counter-argument]` OR `[opposing view] critique`
- [ ] If >30% evidence supports opposite → **Fork the analysis** into "Scenario A vs Scenario B". Don't collapse uncertainty.

### Phase 3 continued

- [ ] Phase 3D: Zero-Point Check (Protocol 140) — MANDATORY
- [ ] Phase IV: Reality Simulation (The Flight Sim Test)
- [ ] Phase V: Strategic Advice (5A-5E) — Stress Test REQUIRED
- [ ] Phase VI: Final Thoughts
- [ ] Phase VII: Confrontation

### Phase 4: Adversarial Stress-Test

- Steelman the opposing view
- Red-team the recommendations
- What's the blind spot?

### Phase 5: Permanent Deposit

- Key insights → `User_Profile.md` or new protocol
- If reusable framework discovered → create protocol file

---

## Reasoning Effort: xhigh (Shukai State)

| Dimension | Requirement |
|-----------|-------------|
| Counterfactuals | 5+ (upward, lateral, downward, isolation experiments) |
| Perspectives | 3+ minimum |
| Multi-path branches | 3+ including dead ends |
| Token budget | Unlimited (go as deep as needed) |
| Latency | Extended (sacrifice speed for depth) |

---

## Comparison

| Mode | Depth | Searches | Phases | When to Use |
|------|-------|----------|--------|-------------|
| Default | Adaptive | 0-1 | Discretion | Normal queries |
| `/search` | Medium | 2-3 | Optional | Fact-checking |
| `/think` | High | 0-1 | All | Complex reasoning |
| `/research` | Maximum | 5-10+ | All + Rabbit Hole | Deep investigation |
| **`/ultrathink`** | **Nuclear** | **10-15+** | **Fusion (Zero-Point)** | **Life-altering / Hardcore** |

---

## Use Cases

- Decisions with >$50K or >1 year impact
- Career pivots, major investments, relationship decisions
- When "I need to know EVERYTHING and think EVERYTHING through"
- Complex multi-stakeholder problems with high ambiguity

---

## Example

```text
User: /ultrathink Should I emigrate to Portugal in 2026?

AI: 
[Asks clarifying questions first]
→ Runs 8+ searches (visa, cost of living, tax, healthcare, LGBTQ+ climate, etc.)
→ Reads 5+ full sources
→ Full Phase 0-VII with 5+ counterfactuals
→ Adversarial stress-test
→ Deposits key insights to Codex
```

---

## Tagging

`#workflow` `#automation` `#ultrathink` `#shukai` `#deep-think`
