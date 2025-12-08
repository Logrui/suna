---
description: Create repo-specific testing scripts to enable behavioral verification.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To scaffold strict testing scripts (Playwright/Pytest) for the specific feature to ensure validation is executable.

## Execution Steps
1.  **Analyze**: Determine Tech Stack (Next.js vs Python).
2.  **Scaffold**:
    *   Create `tests/portkit_[feature].spec.ts` (or `.py`).
    *   Populate with assertions derived from `spec.md`.
3.  **Report**:
    *   "Test Scaffold at `tests/portkit_[feature].spec.ts`."
