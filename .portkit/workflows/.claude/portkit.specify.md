---
description: Specify a feature to port using Portkit. Creates `spec.md` with robust ambiguity checking.
---

## User Input
```text
$ARGUMENTS
```

## Goal
Transform a natural language feature request into a robust, ambiguity-free `spec.md` file in the `.portkit/specs/` directory.

## Operating Constraints
*   **Validation**: The spec MUST pass a "Builder-Ready" quality check (no ambiguity).
*   **No Forced Branching**: Do not create git branches; work on the current branch.
*   **Clarification Limit**: Ask max 3 clarification questions.

## Execution Steps
1.  **Generate Short Name**:
    *   Create `kebab-case` name (e.g. `user-auth`) from input.

2.  **Environment Check**:
    *   Verify if `.portkit/specs/[feature]/` exists.
    *   Ask user for permission if overwriting.

3.  **Ambiguity Analysis**:
    *   Analyze `$ARGUMENTS` for Actors, Actions, Data.
    *   Identify gaps in Scope, Security, UX.
    *   Generate max 3 clarification questions if critical.

4.  **Draft Spec**:
    *   Load template `.portkit/templates/spec-template.md`.
    *   Fill all sections. Use "Assumptions" for defaults.

5.  **Quality Loop**:
    *   Verify: Testable requirements? Technology-agnostic success criteria?
    *   If quality check passes, write to `.portkit/specs/[feature]/spec.md`.

6.  **Report**:
    *   Output path to `spec.md`.
    *   Suggest next command: `/portkit.research`.
