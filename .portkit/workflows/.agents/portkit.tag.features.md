---
description: Retroactively add `// feature-start` tags to existing code.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1.  **Parse Input**: Identify Feature Name and Target Files (or directory scope).
2.  **Context**: Read `spec.md` or `research.md` if available to understand file scope.

3.  **Tagging Logic**:
    *   **Goal**: Wrap specific code blocks or whole files with Portkit tracking tags.
    *   **Format**: `// feature-start: [name]` ... `// feature-end: [name]`.
    *   **Action**:
        *   For **Whole Files**: Add tags at top/bottom of file.
        *   For **Partial Blocks**:
            *   Ask user to identify line ranges or functions.
            *   *OR* Use `grep` to find specific function definitions mentioned in input.
        *   Apply the edits.

4.  **Registry Sync**:
    *   After tagging, auto-trigger `/portkit.update.registry` to index the new tags.

5.  **Completion**: Output list of tagged files.
