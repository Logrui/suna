---
description: Create component morphing strategy and implementation plan. Generates `implementation_plan.md`.
---

## User Input
```text
$ARGUMENTS
```

## Goal
To formulate a safe, step-by-step Implementation Plan that defines how to "Morph" upstream components into the local codebase without breaking existing functionality.

## Operating Constraints
*   **Constitution Check**: Enforce "Safe Overwrites" (sanitize first).
*   **Completeness**: Every file in the Blast Radius must have a Strategy defined.

## Execution Steps
1.  **Analyze Context**:
    *   Read `research.md`.
    *   Identify "Poison" dependencies (e.g. Billing, Auth).

2.  **Formulate Strategy**:
    *   **Morphing**: For complex UI, define `Extract -> Overwrite -> Inject`.
    *   **Shimming**: Define `Bridge Adapters` for missing upstream deps.

3.  **Draft Plan**:
    *   Load `.portkit/templates/implementation_plan.md`.
    *   Fill `Component Morph Strategy` table.
    *   Generate `checklists/requirements_check.md` for verification.
    *   Save to `.portkit/specs/[feature]/implementation_plan.md`.

4.  **Report**:
    *   Output the plan path.
    *   Ask user for approval before enabling `/portkit.tasks`.
