---
description: Pre-prompt fact-finding and scope clarification before executing complex tasks
---

# /brief v2.1 — Pre-Prompt Clarification Protocol

**Trigger:** User invokes `/brief <task description>` before a complex or underspecified request.

**Philosophy:** Measure twice, cut once. Clarify requirements before wasting tokens on wrong output.

---

## Quick Reference

| Variant | When to Use | Expand? |
|---------|-------------|---------|
| Core Brief | Default — most tasks | No |
| `/brief ++` | Complex multi-step work | Yes |
| `/brief build` | Technical "Build X" tasks | Build Extension |
| `/brief research` | Investigate/analyze tasks | Research Extension |

---

## Phase 1: Router (One Line)

When `/brief` is invoked, first identify the type:

```
Brief Type: [ ] Build  [ ] Research  [ ] Hybrid  [ ] Multi-stakeholder

Hybrid Flow (if selected): [ ] Research → Build  [ ] Build → Research  [ ] Interleaved
```

---

## Phase 2: Core Brief (Default — 7 Fields)

> **Design Principle:** Progressive Disclosure. This is the *minimum viable brief*. Expand only when complexity demands it.

```
+-------------------------------------------+
|       /brief: [TASK TITLE]                |
+-------------------------------------------+
|                                           |
|  1. OUTCOME                               |
|     What will be true when successful?    |
|     _________________________________     |
|                                           |
|  2. AUDIENCE + CONTEXT                    |
|     Who uses it, where, and why?          |
|     _________________________________     |
|                                           |
|  3. CONSTRAINTS & BOUNDARIES              |
|     Must-haves:                           |
|     Must-nots:                            |
|     Scope boundaries:                     |
|     Canonical source of truth:            |
|                                           |
|  4. DEFINITION OF DONE                    |
|     Acceptance criteria (testable):       |
|     Non-goals (explicit exclusions):      |
|     Quality bar (what "good" means):      |
|                                           |
|  5. DELIVERY                              |
|     Format:        _______________        |
|     Length/Depth:  _______________        |
|     Tone:          _______________        |
|     Data sensitivity: [ ] Public  [ ] Internal  [ ] Confidential/PII  |
|                                           |
|  6. TIMELINE                              |
|     Ship date:     _______________        |
|     Confidence:    [ ] 70%  [✓] 85%  [ ] 95%   |
|     Tradeoff priority: (1)___ (2)___ (3)___    |
|       ↳ Options: Speed / Quality / Scope  |
|                                           |
|  7. BUDGET                                |
|     [ ] 5 min  [ ] 20 min  [ ] 1 hr  [ ] Deep dive  |
|                                           |
+-------------------------------------------+
```

> **Rule:** If `Mode: Ship` is selected, DoD fields become **mandatory**. If `Mode: Explore`, DoD can be loose.

---

## Phase 3: Expanded Fields (`/brief ++`)

> **Trigger:** High-effort request (>3 steps), multiple stakeholders, or significant unknowns.

Add these to Core Brief:

```
+-------------------------------------------+
|  8. INPUTS                                |
|     References (good examples):           |
|     Anti-examples (what to avoid):        |
|     Source material (docs, repos):        |
|     Canonical source of truth:            |
|                                           |
|  9. EXECUTION MODE                        |
|     Mode: [ ] Explore  [ ] Draft  [ ] Revise  [ ] Ship  |
|     Review path:                          |
|       Reviewers: _______________          |
|       Rounds: _______________             |
|       Approval rule: _______________      |
|                                           |
|  10. DEPENDENCIES & UNKNOWNS              |
|     Blockers (outside my control):        |
|     Assumptions (things taken as true):   |
|     Open decisions (needs decider):       |
|     Decision maker: _______________       |
|     Veto holders: _______________         |
|     Approval criterion:                   |
|       [ ] Unanimous  [ ] Single-decider   |
|       [ ] Majority   [ ] Client final     |
|                                           |
+-------------------------------------------+
```

---

## Build Extension (`/brief build`)

> **Trigger:** "Build X", "Code Y", or any technical implementation task.

```
+-------------------------------------------+
|  BUILD EXTENSION                          |
+-------------------------------------------+
|                                           |
|  A. SYSTEM CONTEXT                        |
|     Tech stack:                           |
|     Environment (dev/staging/prod):       |
|     Hosting/runtime constraints:          |
|     Tech debt acceptance:                 |
|       [ ] Quick & dirty OK                |
|       [ ] Pattern-matched enterprise      |
|                                           |
|  B. INTERFACES                            |
|     APIs / data contracts:                |
|     I/O shapes:                           |
|     Permissions required:                 |
|                                           |
|  C. RUIN VECTORS (Law #1 Check)           |
|     [ ] Security leak (auth, secrets)     |
|     [ ] Privacy/PII exposure              |
|     [ ] Data loss/corruption              |
|     [ ] Prod outage risk                  |
|     [ ] Cost blowup (APIs, infra)         |
|     [ ] Compliance/licensing issue        |
|                                           |
|  D. OBSERVABILITY + ROLLBACK              |
|     Logging/metrics plan:                 |
|     Known failure modes:                  |
|     Rollback strategy:                    |
|                                           |
|  E. TEST PLAN                             |
|     Unit/integration/e2e expectations:    |
|     Acceptance test → DoD mapping:        |
|                                           |
|  F. SEMANTIC PRE-LOAD (Optional)          |
|     ⏱️ Time-box: 5 min                   |
|     Prior art (3 max):                    |
|     Constraints extracted (5 max):        |
|     Known pitfalls (5 max):               |
|     Brief deltas:                         |
|       - New constraints found:            |
|       - New risks:                        |
|       - Recommended scope cuts:           |
|                                           |
+-------------------------------------------+
```

---

## Research Extension (`/brief research`)

> **Trigger:** "Find out about X", "Analyze Y", "What is the best Z"

> **Special Flow:** For research, AI can run Semantic Pre-Load FIRST, then draft the brief for user approval.

```
+-------------------------------------------+
|  RESEARCH EXTENSION                       |
+-------------------------------------------+
|                                           |
|  A. RESEARCH QUESTION(S)                  |
|     What must be answered?                |
|     _________________________________     |
|                                           |
|  B. DECISION IT SUPPORTS                  |
|     What choice will be made from this?   |
|     _________________________________     |
|                                           |
|  C. EVALUATION CRITERIA                   |
|     What does "best" mean?                |
|     (cost, accuracy, time, risk, etc.)    |
|     _________________________________     |
|     Lens/Persona:                         |
|       [ ] Neutral  [ ] Skeptic  [ ] Advocate  |
|       [ ] Specific: _______________       |
|                                           |
|  D. METHOD                                |
|     Sources to include:                   |
|     Sources to exclude:                   |
|     Recency requirement (e.g., <2 years): |
|     Source quality bar:                   |
|       [ ] Primary docs  [ ] Peer-reviewed |
|       [ ] Reputable journalism  [ ] Any   |
|     Citation required: [ ] Yes  [ ] No    |
|                                           |
|  E. OUTPUT FORMAT                         |
|     [ ] Recommendation                    |
|     [ ] Options matrix                    |
|     [ ] Annotated bibliography            |
|     [ ] Detailed report                   |
|     [ ] Bulleted summary                  |
|                                           |
|  F. STOPPING RULE                         |
|     When is research "enough"?            |
|     [ ] Time-box: ___ minutes             |
|     [ ] Coverage: ___ sources             |
|     [ ] Confidence: ___% certainty        |
|                                           |
+-------------------------------------------+
```

---

## Semantic Pre-Load Integration

> **Philosophy:** Active grounding, not passive templating.

**Standard Execution Order (Build/General):**

```
┌─────────────────────────────────────────────────┐
│  1. User fills Core Brief                       │
│  2. AI runs: smart_search.py "<brief keywords>" │
│  3. AI populates Pre-Load section:              │
│     - 3 prior art references                    │
│     - 5 key constraints extracted               │
│     - 5 known pitfalls                          │
│  4. AI outputs "Brief Deltas":                  │
│     - New constraints found                     │
│     - New risks                                 │
│     - Recommended scope cuts                    │
│  5. User reviews/approves refined brief         │
│  6. Execute task                                │
└─────────────────────────────────────────────────┘
```

**Research Flow (Inverted):**

```
┌─────────────────────────────────────────────────┐
│  1. User gives topic/question                   │
│  2. AI runs: smart_search.py "<topic>"          │
│  3. AI drafts Research Brief (auto-filled)      │
│  4. User reviews/approves brief                 │
│  5. Execute research                            │
└─────────────────────────────────────────────────┘
```

**Rules:**

- Time-boxed: Max 5 minutes of search
- Skippable: For low-stakes tasks, add `--skip-preload`
- Output-limited: Don't overwhelm with 20 references
- Delta required: Pre-load must output "what changed in the brief"

---

## When to Suggest /brief

If user gives a high-effort request (n > 3 items) that is underspecified:

> "This is a big ask. Want me to `/brief` it first?"

If complexity is extreme:

> "This is complex. Want me to `/brief ++` with full dependency mapping?"

Do not auto-trigger. User controls the gate.

---

## Quick Heuristics

| Situation | Recommended Variant |
|-----------|---------------------|
| Simple content task | Core Brief only |
| Multi-step project | `/brief ++` |
| New feature/code | `/brief build` |
| Investigation/analysis | `/brief research` |
| Client work | Add "Veto holders" field |

---

## Changelog

| Version | Changes |
|---------|---------|
| v2.1 | Fixed confidence default (85%), forced tradeoff priority, hybrid direction, budget field, veto holders, semantic pre-load delta, tech debt acceptance, lens/persona, source quality policy, data sensitivity |
| v2.0 | Progressive disclosure, brief types router, build/research extensions, semantic pre-load |
| v1.0 | Basic ASCII box template |

---

## Tagging

# workflow #clarification #brief #scope #v2.1
