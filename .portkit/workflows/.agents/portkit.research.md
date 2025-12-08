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

## Outline
1.  **Parse Input**: Identify Feature Name/Spec from `$ARGUMENTS`.
2.  **Verify Context**: Ensure `specs/[feature]/spec.md` exists.

3.  **Phase 1: Hard Tooling (Script Execution)**:
    *   **Fetch**: `uv run scripts/python/fetch-upstream.py --ref [TargetRef]`
        *   (If Ref unknown, ask user or infer from spec).
    *   **Map Dependencies**: `uv run scripts/python/map-dependencies-py.py --target [UpstreamEntryFile]`
    *   **Diff Analysis**: `uv run scripts/python/smart-diff.py [UpstreamEntry] [LocalEntry]`
    *   **Registry Scan**: `uv run scripts/python/scan-registry.py` (To see what we already have).
    *   *Action*: Parse the JSON outputs from these scripts.

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

6.  **Completion**: Output summary and handoff to `/portkit.plan`.
