---
description: Update `feature-registry.json` with the latest feature details or an existing feature's details based on user description
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal
Scan the codebase for feature tags and update the `feature-registry.json` source of truth.

## Note
This acts as the "Commit" step for Portkit. Until this runs, the system is unaware of the new feature boundaries.

## Outline
1.  **Parse Input**: Identify Feature Name (optional) or "Scan All".
2.  **Context**: Read `.portkit/addon-features-registry/feature-registry.json`.

3.  **Execution (Deep Scan)**:
    *   **Goal**: Lock the current state of feature files.
    *   **Run Script**: `uv run scripts/python/scan-registry.py --update --feature [Name]`.
    *   **Logic (Mental Model)**:
        *   Script scans for `// feature-start: [Name]` tags.
        *   Calculates checksums/paths of tagged regions.
        *   Updates the JSON registry file entries.

4.  **Verification**:
    *   Reload `feature-registry.json`.
    *   Confirm the entry for `[feature-name]` has updated `last_sync` timestamp and file list.

6.  **Completion**:
    *   Output: "Registry updated for [Feature]. Lockfile is current."
    *   Stats: "Tracking X files, Y lines of code."
    *   **Recommendation**: Porting process complete. Suggest the user runs `/portkit.specify` if they wish to start a new feature port.
