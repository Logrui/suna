---
description: Ask the user specifying questions to clarify scope before deep research
handoffs:
  - label: Research Feature
    agent: portkit.research
    prompt: Clarification complete. Updates have been made to specs/[feature]/spec.md. Proceed to research.
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal
Facilitate a "Clarification Phase" where the agent asks the user critical questions about the feature to prevent assumptions during the Research phase (e.g., "Where is the entry point?", "Is this a UI component or a backend service?").

## Note
This is an **Interactive** workflow. The agent should stop and wait for user input after generating the questions.

## Outline
1.  **Parse Input**: Identify Feature Name/Spec from `$ARGUMENTS`.
2.  **Verify Context**: Ensure `specs/[feature]/spec.md` exists. Use `portkit.specify` if it does not.

3.  **Phase 1: Ambiguity Scan & Question Generation**:
    *   **Action**: Load the current spec file. Perform a structured ambiguity & coverage scan using this taxonomy. For each category, mark status: Clear / Partial / Missing.
       *   **Functional Scope**: Core user goals, success criteria, explicit inclusions/exclusions.
       *   **Adaptation Strategy**: Bridge adapters, omissions, replaced dependencies.
       *   **Dependencies**: Internal vs External, Conflict resolution (e.g. Auth, Billing), "Poison" dependencies.
       *   **Integration Points**: UI location, Route structure, Backend hooks.
       *   **Edge Cases**: Failure handling, specific constraint scenarios.
    *   **Generate Questions**:
        *   Create a prioritized queue of candidate clarification questions (maximum 5).
        *   Each question must be answerable with a short multiple-choice selection or a short phrase.
        *   Focus on "High Impact" ambiguities that would block Research or Planning.

4.  **Phase 2: Sequential Questioning Loop (Interactive)**:
    *   **User Interaction**: Present EXACTLY ONE question at a time.
    *   **Recommendation**:
        *   For multiple-choice, recommend the best option based on Portkit best practices (e.g. "Strip Billing").
        *   Format as: `**Recommended:** Option [X] - <reasoning>`
    *   **Integration**:
        *   After EACH accepted answer, immediately update the in-memory representation of the spec.
        *   Append to a `## Clarifications` section: `- Q: <question> → A: <final answer>`.
        *   Apply the clarification to the appropriate section (Scope, Strategy, etc).
    *   **Stop Condition**: 5 questions asked, or user signals "done".

5.  **Phase 3: Finalize Spec**:
    *   **Action**: Write the updated spec back to `specs/[feature]/spec.md`.
        *   Ensure no contradictory statements remain.
        *   Ensure terminology is consistent.
    *   **Keyword Generation**:
        *   Based on the spec and clarifications, append a list of **search keywords** to the Spec file (e.g., `## Research Keywords`).
        *   Format: `* Scan Keywords: [array of technical terms, e.g., 'Credits', 'BillingContext', 'verify_user']`
        *   These hints will guide the `scan-risk` and `grep` operations in the Research phase.

6.  **Completion**:
    *   Output: "Spec updated with clarification details and research keywords."
    *   **Stats**: Questions asked/answered, sections touched, keywords generated.
    *   **Recommendation**: Run `/portkit.research` to begin technical analysis with these new constraints.
