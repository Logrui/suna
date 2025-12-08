---
description: Retroactively add `// feature-start` tags to existing code.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To apply "Region Mapping" tags (`// feature-start: [name]`) to legacy code to bring it under Portkit management.

## Execution Steps
1.  **Analyze**: Identify file scope from input.
2.  **Edit**:
    *   Find start/end of feature logic.
    *   Wrap with `// feature-start: [name]` tags.
3.  **Sync**: Trigger `/portkit.update.registry` to index tags.
4.  **Report**: List tagged files.
