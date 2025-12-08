---
description: Research upstream feature structure and dependencies. Generates `research.md`.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To produce a comprehensive technical map (`research.md`) of the upstream feature, identifying all dependencies ("Blast Radius") and potential collisions with the local repository.

## Operating Constraints
*   **ReadOnly**: Do not modify code during research.
*   **Tooling**: Use `script/fetch-upstream.ts` and `map-dependencies` if available.
*   **Format**: Output must be strict Markdown.

## Execution Steps
1.  **Phase 1: Hard Tooling**:
    *   Find the upstream reference (Ref/Tag).
    *   Run `uv run scripts/python/fetch-upstream.py`.
    *   Run `uv run scripts/python/map-dependencies-py.py` on the target entry file.

2.  **Phase 2: Semantic Analysis**:
    *   **Codemap**: Build a file tree of the feature.
    *   **Data Flow**: Create a Mermaid diagram showing data movement.
    *   **Blast Radius**: Explicitly listing 3rd party libs (e.g. `next-auth`) that conflict with local stack (`supabase`).

3.  **Phase 3: Synthesize**:
    *   Load template `.portkit/templates/research.md`.
    *   Fill all sections.
    *   Save to `.portkit/specs/[feature]/research.md`.

4.  **Report**:
    *   Summarize the "Blast Radius".
    *   Handoff to `/portkit.plan`.
