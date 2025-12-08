---
description: Specify a feature to port using Portkit. Creates `spec.md` with robust ambiguity checking.
handoffs:
  - label: Research Feature
    agent: portkit.research
    prompt: The spec is ready at `specs/[feature]/spec.md`. Begin research.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal
Define a clear, unambiguous specification for the feature to be ported, including scope and initial assumptions.

## Note
Ambiguity here leads to failure later. Ensure checking for existing registry conflicts before proceeding.

## Outline
The text the user provided in `$ARGUMENTS` is the feature description.

1.  **Generate Feature Short Name**:
    *   Analyze description. Create a concise `kebab-case` name (e.g., `user-auth`, `fix-payment-bug`).
    *   *Constraint*: 2-4 words, descriptive.

2.  **Environment Check (No Forced Branching)**:
    *   Check if directory `.portkit/specs/[feature-name]/` already exists.
    *   **Interactive Decision**:
        *   If it exists: Ask user "Spec directory `[feature-name]` exists. Overwrite? (y/n)".
            *   If 'n', abort or ask for new name.
        *   If it doesn't exist: Proceed.
    *   *Note*: Unlike Speckit, we do NOT forcibly create a Git branch here. We work in the main workspace, relying on the user's git workflow or later stages to handle branching.

3.  **Draft Specification**:
    *   Read template: `.portkit/templates/spec-template.md`.
    *   **Analysis Loop**:
        *   Extract: Actors, Actions, Data, Constraints from inputs.
        *   Fill Mandatory Sections: Functional Requirements, Success Criteria (Measurable/Testable).
        *   *Defaulting*: Use industry standards (e.g., Standard Auth, Cloudflare Images) where details are missing but obvious.
    *   **Clarification (Ambiguity Detection)**:
        *   Identify critical gaps (Scope, Security, UX).
        *   **Limit**: Max 3 `[NEEDS CLARIFICATION]` tags.
        *   If <3 clarifications needed, proceed to fill them with best-guess defaults and mark as "Assumption".

4.  **Write Initial Spec**:
    *   Ensure directory `.portkit/specs/[feature-name]/` exists.
    *   Write file `.portkit/specs/[feature-name]/spec.md`.

5.  **Quality Validation Loop** (The "Speckit Standard"):
    *   **Goal**: Ensure spec is "Builder-Ready".
    *   **Action**: Create temporary checklist `requirements_check.md` (in memory or temp file).
    *   **Checklist Items**:
        *   [ ] No `[NEEDS CLARIFICATION]` remains (resolve them if user answers now, or note them).
        *   [ ] Requirements are Testable.
        *   [ ] Success criteria are Technology-Agnostic.
        *   [ ] Bridge Adapters defined (if obvious from prompt, e.g., "Use our Auth").
    *   **Self-Correction**: If validation fails, attempt to fix the `spec.md` immediately using context.

6.  **Registry Check**:
    *   Read `.portkit/addon-features-registry/feature-registry.json`.
    *   Warn if `[feature-name]` conflicts with an existing registry key.

7.  **Completion**:
    *   Output: "Spec created at `.portkit/specs/[feature-name]/spec.md`".
    *   **Recommendation**: Recommend to the user to run `/portkit.research` next to begin the technical analysis.
