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

## Outline
1.  **Parse Input**: Identify Feature Name.
2.  **Verify Context**: Ensure `tasks.md` marked complete.

3.  **Phase 1: Static Analysis (The Audit)**:
    *   **Registry Check**: Does `addon-features-registry.json` exist?
    *   **Lint**: Run `npm run lint` (or project equivalent).
    *   **Build**: Run `npm run build` (or `uv run verify-project.py`).
    *   **Artifact Consistency**: Check if `spec.md` requirements match `tasks.md` completion.

4.  **Phase 2: Behavioral Verification**:
    *   **Goal**: Ensure feature actually works.
    *   **Action**:
        *   Ask user: "Do we have a specific test script?"
        *   If yes: Run `npx playwright test tests/feature.spec.ts`.
        *   If no: Suggest creating one via `/portkit.generate.tests` OR run a manual walkthrough plan.

5.  **Phase 3: Validation Report**:
    *   Read template: `.portkit/templates/review.md`.
    *   **Fill Sections**:
        *   `## Automated Checks`: Pass/Fail status of Build/Lint.
        *   `## Manual Verification`: User sign-off.
        *   `## Registry Status`: Is it ready to be locked?
    *   Write to: `.portkit/specs/[feature]/review.md`.

6.  **Completion**:
    *   If **PASS**: Handoff to `/portkit.update.registry`.
    *   If **FAIL**: Suggest remediation or `/portkit.implement` loop.
