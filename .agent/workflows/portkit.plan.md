---
description: Create component morphing strategy and implementation plan. Generates `implementation_plan.md`.
handoffs:
  - label: Decompose Tasks
    agent: portkit.tasks
    prompt: Plan approved at `specs/[feature]/implementation_plan.md`. Decompose into tasks.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1.  **Parse Input**: Identify Feature Name.
2.  **Verify Context**: Ensure `research.md` (and `spec.md`) exists.
3.  **Constitution Check**:
    *   Review `research.md` against project constraints.
    *   *Rule*: "No Direct Upstream Overwrites without `sanitize-upstream`."
    *   *Rule*: "All Custom Logic must be preserved via `extract-region`."

4.  **Strategy Formulation (The Core)**:
    *   **Component Morphing**: For each UI component in the Blast Radius:
        *   Define: **Source** (Upstream File) -> **Diff** (What changed) -> **Strategy** (Extract -> Nuke -> Paste -> Inject).
    *   **Bridge Adapters** (Shims):
        *   Identify "Poison" imports (Billing, Auth, Analytics).
        *   Define replacement: `import { auth } from 'upstream'` -> `import { auth } from '@/lib/auth-shim'`.

5.  **Draft Implementation Plan**:
    *   Read template: `.portkit/templates/implementation_plan.md`.
    *   **Fill Sections**:
        *   `## Strategy`: The high-level approach.
        *   `## Component Morphing`: The specific per-file table.
        *   `## Bridge Adapters`: List of shims to build.
        *   `## Checklist`:
            *   Generate "Unit Tests for Requirements" (adapted from Speckit).
            *   Example: "- [ ] Auth Shim handles 'Guest' user correctly."
            *   Example: "- [ ] Styling matches Local Theme (Dark Mode)."
    *   Write to: `.portkit/specs/[feature]/implementation_plan.md`.

6.  **Review & Refine**:
    *   Ask user to review the Morph Strategy.
    *   *Critical*: If a "Complex Merge" is identified, confirm the strategy is feasible.

7.  **Completion**: Output plan location and handoff to `/portkit.tasks`.
