---
description: Research target/existing repo and create a standalone codemap.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1.  **Parse Input**: Identify Target Directory/Feature.
2.  **Analysis Tooling**:
    *   **Run Script**: `uv run scripts/python/map-dependencies-py.py --target [Target]` (if available).
    *   **Alt**: Use `find` and `grep` if script unavailable.

3.  **Draft Codemap**:
    *   Create `codemap.md`.
    *   **Section 1: File Tree**: `tree [Target] --depth 2`.
    *   **Section 2: Component Architecture**:
        *   Identify Entry Points (`page.tsx`, `main.py`).
        *   Identify Core Services.
    *   **Section 3: Data Flow**:
        *   Create Mermaid Sequence Diagram describing the primary happy path.

4.  **Completion**: output path to `codemap.md`.
