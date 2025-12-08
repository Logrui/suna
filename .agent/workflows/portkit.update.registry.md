---
description: Update `addon-features-registry.json` with the latest feature details.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1.  **Parse Input**: Identify Feature Name (optional) or "Scan All".
2.  **Context**: Read `.portkit/addon-features-registry/addon-features-registry.json`.

3.  **Execution (Deep Scan)**:
    *   **Goal**: Lock the current state of feature files.
    *   **Run Script**: `uv run scripts/python/scan-registry.py --update --feature [Name]`.
    *   **Logic (Mental Model)**:
        *   Script scans for `// feature-start: [Name]` tags.
        *   Calculates checksums/paths of tagged regions.
        *   Updates the JSON registry file entries.

4.  **Verification**:
    *   Reload `addon-features-registry.json`.
    *   Confirm the entry for `[feature-name]` has updated `last_sync` timestamp and file list.

5.  **Completion**:
    *   Output: "Registry updated for [Feature]. Lockfile is current."
    *   Stats: "Tracking X files, Y lines of code."
