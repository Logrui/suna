---
description: Verify the ported feature via build, lint, and behavioral tests. Generates `review.md`.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To audit the implementation for build stability, lint compliance, and functional correctness.

## Execution Steps
1.  **Static Analysis**:
    *   Run `verify-project.py` (or `npm run lint`).
    *   Check `tasks.md` vs `spec.md` consistency.

2.  **Behavioral Verification**:
    *   Run generated tests (from `/portkit.generate.tests`).
    *   Or perform managed manual walkthrough.

3.  **Report**:
    *   Fill `.portkit/templates/review.md`.
    *   Save to `.portkit/specs/[feature]/review.md`.
    *   If PASS, suggest `/portkit.update.registry`.
