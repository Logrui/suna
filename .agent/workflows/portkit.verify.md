---
description: Verify the ported feature via build, lint, and behavioral tests. Generates `review.md`.
handoffs:
  - label: Update Registry
    agent: portkit.update.registry
    prompt: Verification passed. Update the registry to lock this feature.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal
Validate the implemented feature via static analysis (lint/build) and behavioral testing.

## Note
Do not proceed to Registry Update until this phase passes. A broken feature should not be locked into the registry.

## Outline
1.  **Parse Input**: Identify Feature Name.
2.  **Verify Context**: Ensure `tasks.md` marked complete.

3.  **Phase 1: Static Analysis (The Audit)**:
    *   **Registry Check**: Does `feature-registry.json` exist?
    *   **Lint**: Run `npm run lint` (or project equivalent).
    *   **Build**: (assuming there is a docker files and docker compose files)
        *   Frontend: `docker compose up -d --build --no-deps frontend` (Ensures build passes in container).
        *   Backend: `docker compose up -d --build --no-deps backend` (if backend changes).
    *   **Artifact Consistency**: Check if `spec.md` requirements match `tasks.md` completion.

4.  **Phase 2: Behavioral Verification**:
    *   **Goal**: Ensure feature actually works.
    *   **Action**:
        *   Ask user: "Do we have a specific test script?"
        *   If yes: Run `npx playwright test tests/feature.spec.ts`.
        *   If no: Suggest creating one via `/portkit.generate.tests` OR run a manual walkthrough plan.

4.  **Registry Coverage Audit (The Safety Net)**:
    *   **Action**: `uv run scripts/python/update-registry.py --audit`
    *   **Goal**: Detect if any *modified* or *new* files are missing `// feature-start` tags.
    *   **Logic**:
        *   If it returns "success": Pass.
        *   If it returns "warning" with a list of "untracked_files":
            *   **STOP**. You have created orphaned code.
            *   **Fix**: Go back and add tags to those files.

5.  **Report Generation**:
    *   Compile findings into `review.md`.
    *   Verdict: `PASS` / `FAIL`.
    *   Write to: `.portkit/specs/[feature]/review.md`.

6.  **Completion**:
    *   If **PASS**: Suggest the user runs `/portkit.update.registry` to lock the feature.
    *   If **FAIL**: Suggest potential remediation steps or suggest to the user to run `/portkit.implement` again to fix bugs.
