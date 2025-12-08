---
description: Update `addon-features-registry.json` with the latest feature details.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To lock the current feature state into the `addon-features-registry.json` Source of Truth.

## Execution Steps
1.  **Scan**:
    *   Run `uv run scripts/python/scan-registry.py --update`.

2.  **Verify**:
    *   Confirm JSON updated with new timestamps and file paths.

3.  **Report**:
    *   "Registry Updated. Feature Locked."
