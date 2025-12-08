---
description: Research upstream feature structure and dependencies. Generates `research.md`.
handoffs:
  - label: Plan Implementation
    agent: portkit.plan
    prompt: Research complete. Blast radius defined in `specs/[feature]/research.md`. Start planning.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal
Perform deep technical analysis of the upstream feature and its dependencies ("Blast Radius") to inform creation of the implementation plan at later stages.

## Note
Use the provided scripts to handle large files. Avoid manual reading of massive upstream directories to conserve context.

## Outline
1.  **Parse Input**: Identify Feature Name/Spec from `$ARGUMENTS`.
2.  **Verify Context**: Ensure `specs/[feature]/spec.md` exists.

3.  **Phase 1: Tooling Selection (Context Management)**:
    *   **Principle**: Use scripts to process large files outside of the context window.
    *   **Available Tools** (Located in `.portkit/scripts/`):
        *   `fetch-upstream.py`: Clone/Fetch remote repo to `.portkit-cache`.
        *   `map-dependencies`: Analyze file imports/exports (Choose TS or PY version).
        *   `smart-diff`: Semantic comparison of Upstream vs Local.
    *   **Recommended Action**:
        *   Run `fetch-upstream` to get source code.
        *   Use `map-dependencies` on the entry file to build a blast radius graph efficiently.
        *   Use `smart-diff` only if checking against existing local files.

4.  **Phase 2: Semantic Analysis (The "Codemap")**:
    *   **Goal**: Create a deep technical map of the feature *before* we touch it.
    *   **Analyze**:
        *   **File Structure**: Tree of upstream files involved.
        *   **Critical Paths**: Identify "Load Bearing" components (Auth, Database, State).
        *   **Data Flow**: How does data move? (Mermaid Diagram required).
    *   **Blast Radius**: Identify local files that will be touched/broken.

5.  **Phase 3: Synthesize Report**:
    *   Read template: `.portkit/templates/research.md`.
    *   **Populate Sections**:
        *   `## Codemap`: The detailed tree and Mermaid flow.
        *   `## Semantic Diff`: Summary of script output (e.g. "Signature changed for `User`").
        *   `## Specifications & Limitations`:
            *   "Upstream uses `NextAuth`. We use `Supabase`. (Conflict)"
            *   "Upstream uses `Tailwind v4`. We use `v3`. (Shim needed)."
    *   Write to: `.portkit/specs/[feature]/research.md`.

6.  **Completion**:
    *   Output summary of the Research.
    *   **Recommendation**: Suggest the user runs `/portkit.plan` to proceed with the implementation strategy.
