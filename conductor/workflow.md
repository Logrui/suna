# Development Workflow

This document defines the development workflow for the project.

## 1. Task Execution
- Tasks should be executed sequentially as defined in the `plan.md` of each track.
- For each task:
    - **TDD (Recommended):** Write tests first, then implement the feature.
    - **Documentation:** Update relevant `.md` files if the change affects architecture or usage.
    - **Verification:** Run tests and linting to ensure quality.

## 2. Testing Standards
- **Minimum Coverage:** 80% code test coverage is required for all new features.
- **Tools:** `pytest` (Backend), `vitest` (Frontend).

## 3. Version Control & Checkpointing
- **Tool:** **Jujutsu (`jj`)** MUST be used for all version control operations. Standard Git commands (`git add`, `git commit`) are forbidden.
- **Checkpointing:** Commit changes after **every phase** (group of tasks) is completed.
- **Commit Conventions:** Use `jj describe -m` with **Semantic Commit Conventions** (e.g., `feat:`, `fix:`, `chore:`).
- **Summaries:** Use **Git Notes** (via `jj` metadata/notes) to record detailed task summaries.

## 4. Phase Completion Protocol
At the end of each phase, the following verification must be performed:
- [ ] All tests in the phase are passing.
- [ ] Code coverage meets the 80% threshold.
- [ ] Documentation is up to date.
- [ ] User Manual Verification: Perform a manual walkthrough of the phase's features.