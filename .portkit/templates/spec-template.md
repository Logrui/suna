# Portkit - Feature Specification: [FEATURE NAME] from Remote Repository [REMOTE REPO eg. github.com/[owner]/[repo]:[branch]:[commit-sha]] 

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## 1. Port Scope (The "Target")
**What are we pulling?**
*   **Upstream Entry Points**: `[e.g., src/features/settings/*, src/components/SettingsModal.tsx]`
*   **Feature Description**: [Briefly describe what this feature does in the upstream repo]

## 2. Adaptation Strategy (The "Bridge")
We are not just copying files; we are adapting them to our **Local Architecture**.

### A. Core Logic (Keep 1:1)
*   [e.g., The UI layout, the form validation logic]

### B. Bridge Adapters (Morph/Replace)
**Upstream Dependency** -> **Local Replacement**
*   `[Upstream Auth]` -> `[Local Auth]`
*   `[Upstream DB]` -> `[Local DB]`

### C. Omissions (Nuke)
**Intentionally excluded components:**
*   (Refer to `.portkit/ecosystem-rules.json` for global rules)
*   [e.g. Specific sub-feature X]

## 3. Verification Scenarios (The "Proof")
After the port is complete, these scenarios must pass locally.

### Scenario 1: [Core Workflow]
*   **Given**: User is logged in.
*   **When**: User performs action X.
*   **Then**: Result Y happens using local architecture.

### Scenario 2: [Data Persistence]
*   **Given**: User modifies data.
*   **When**: User saves.
*   **Then**: Data is persisted to locally configured database.

## 4. Success Criteria
*   [ ] Feature compiles successfully.
*   [ ] No regressions in existing features (Blast Radius check).
*   [ ] All Denied Dependencies (per `ecosystem-rules.json`) are removed.
