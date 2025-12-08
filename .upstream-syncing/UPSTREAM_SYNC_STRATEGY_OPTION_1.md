# Upstream Sync Strategy v5.0: The Living Strategy

**Location**: `.upstream-syncing/UPSTREAM_SYNC_STRATEGY.md`
**Status**: DRAFT (Awaiting Implementation)

## 1. The Core Philosophy
A "Soft Fork" cannot survive by manually merging files one by one. It requires a **Platform Approach**:
*   **Upstream**: Treated as an external dependency we ingest.
*   **Custom Features**: Treated as "Add-ons" that hook into the upstream code.
*   **Sync Process**: An automated compilation pipeline, not a manual text merge.

## 2. Architecture: The Multi-Agent Swarm
We utilize a hierarchical agent structure compatible with advanced coding agents (like Claude Code).

### 👑 The Orchestrator (Manager Agent) - will not be a subagent but rather main agent or agent instance where the initial workflow entry point is run
*   **Role**: Project Lead & Human Interface.
*   **Responsibilities**:
    *   Receives high-level intent ("Port the new Settings Page").
    *   Deploys sub-agents.
    *   Synthesizes all reports into a unified **Implementation Plan**.
    *   **Gatekeeper**: Demands the "Go/No-Go" decision from the user when Hard Conflicts arise.

### 🔬 The Scout (Research & Dependency Agent)
*   **Role**: The "Codemapper".
*   **Responsibilities**:
    *   **Multi-File Tracing**: Identifies the *entire* subgraph of a feature (Frontend UI + Hooks + utils + Backend Routes + DB Schema).
    *   **Artifact Generation**: Produces the `codemap_report.md` and `diff_report.md`.
    *   **Heuristic**: "If Upstream UI uses `useNewFeature`, I must find where `useNewFeature` is defined, and what API it calls."

### 🛡️ The Guardian (Safeguard Agent)
*   **Role**: The "Compliance Officer".
*   **Responsibilities**:
    *   **Registry Enforcement**: Consults `.agent/feature-registry.json`.
    *   **Potential Conflict Detection**: "The Scout wants to overwrite `Sidebar.tsx`, but the Registry says `Sidebar.tsx` is modified by `[Feature Name]`."
    *   **Artifact Generation**: Produces the `specifications_and_limitations_report.md`.

### 👷 The Builder (Implementation Agent)
*   **Role**: The Executer.
*   **Responsibilities**:
    *   **Sanitized Execution**: Runs the `sanitize-upstream` script on every file *before* attempting a merge.
    *   **Bridge Coding**: Writes the glue code that adapts an Upstream Feature to work with our Custom Backend.
    *   **Artifact Generation**: Produces the `post_implementation_report.md`.

---

## 3. The "Hard Tooling" Specification
To enable the agents, we need deterministic scripts.

**Why TypeScript/Node.js?**
*   **Cross-Platform**: Runs identically on Windows (`d:\Homelab`) and Linux CI. PowerShell (`.ps1`) and Bash (`.sh`) inevitably drift apart in logic, causing "My machine works, CI fails" bugs.
*   **Ecosystem**: We need to parse ASTs (Abstract Syntax Trees). TypeScript has `ts-morph`. Bash has... `grep`. You cannot robustly refactor code with regex.

### The Scripts (`.upstream-syncing/scripts/`)
1.  **`smart-diff.ts`**:
    *   Input: Two files (Upstream vs Local).
    *   Action: Parses the two files (Upstream vs Local).
    *   Output: **Semantic Diff**: "Method `submit` changed signature", "New Export `Types` added".
    *   Ignores formatting/whitespace noise.
2.  **`sanitize-upstream.ts`**:
    *   Input: Raw Upstream File.
    *   Config: `.upstream-syncing/port-config.json`.
    *   Action: Removes `next-intl`, billing hooks, and other "poison" imports that exist in the registry.
3.  **`map-dependencies.ts`**:
    *   Input: Entry file.
    *   Action: Generates a JSON list of all internal imports (the "Blast Radius").
4.  **`smart-diff-feature.ts`**:
    *   Input: Entry file.
    *   Action: Generates a JSON list of all internal imports (the "Blast Radius").

---

## 4. The "Hard Tooling" Specification
To enable the agents, we need deterministic scripts.

**Why TypeScript/Node.js?**
*   **Cross-Platform**: Runs identically on Window and Linux CI environments. PowerShell (`.ps1`) and Bash (`.sh`) inevitably drift apart in logic, causing "My machine works, CI fails" bugs.
*   **Ecosystem**: We need to parse ASTs (Abstract Syntax Trees). TypeScript has `ts-morph`. Bash has... `grep`. You cannot robustly refactor code with regex.

### The Scripts (`.upstream-syncing/scripts/`)
1.  **`smart-diff.ts`**:
    *   Input: Two files (Upstream vs Local).
    *   Action: Parses the two files (Upstream vs Local).
    *   Output: **Semantic Diff**: "Method `submit` changed signature", "New Export `Types` added".
    *   Ignores formatting/whitespace noise.
2.  **`sanitize-upstream.ts`**:
    *   Input: Raw Upstream File.
    *   Config: `.upstream-syncing/port-config.json`.
    *   Action: Removes `next-intl`, billing hooks, and other "poison" imports that exist in the registry.
3.  **`map-dependencies.ts`**:
    *   Input: Entry file.
    *   Action: Generates a JSON list of all internal imports (the "Blast Radius").
4.  **`smart-diff-feature.ts`**:
    *   Input: Entry file.
    *   Action: Generates a JSON list of all internal imports (the "Blast Radius").



---

## 5. Workflows
These will be workflows that will be created inside of the .agent/workflows/ directory and .claude/commands/ directory to enable usage in Antigravity, Gemini, and Claude.
1.  **`update-addon-features-registry.md`**:
    *   This will be a workflow that is used at the beginning and end of the workflow to update the .upstream-syncing/addon-features-registry.json file
    *   Agent will be instructed to review either a specific implementation feature and/or entire .docs/addon-features folder
    *   Due to context limitations, this should likely be a workflow that is run with 2 to 3 features at a time

2.  **`port-feature.md`**:
    *   Analgous to speckit /specify workflow command. This is the entry point for the Upstream Syncing or Feature porting process
    *   Explicit "Conflict Resolution" strategies for every file in the Danger Zone.

3. * `analyze-upstream-feature.md`
    *   This will be a AI Agent workflow to create a feature-diff-codemap.md file. Semantic analysis of *what* is changing and relevant files across the codebase
    *   Needs to have a feature diff structure (local section and upstream section) and a feature diff structure diff comparing the file structure of the local and upstream sections
    *   Needs to have awareness to ignore codebase differences that are not relevant to the Upstream Feature given we have a large amount of modifications
    *   Tree view of all files involved in the Upstream Feature.
    *   Tree view of all Local files that would be touched.
    *   Intersection list (The Danger Zone).
4.  **`specifications-and-limitations-report.md`** :
    *   "The Upstream Feature expects standard Supabase Auth."
    *   "Limitation: We use a custom local-first auth. This feature will require a Bridge Adapter."
5.  **`implementation-plan.md`** :
    *   The "Step-by-Step" instructions for the Builder.
    *   Explicit "Conflict Resolution" strategies for every file in the Danger Zone.
6.  **`post-implementation-report.md`**:
    *   What was synced.
    *   What was *intentionally* left behind (Billing, etc.).
    *   Verification steps performed.
7.  **`verify-build.md`**:
    *   "The Upstream Feature expects standard Supabase Auth."
    *   "Limitation: We use a custom local-first auth. This feature will require a Bridge Adapter."
7.  **`sync-feature.md`**:
    *   Review of our implementation of the sync, what was synced, and etc
    *   What was *intentionally* left behind (Billing, etc.).
    *   Verification steps performed.

---

## 6. Required Artifacts/Reports per Step and/or Operation
Required documents prior to implementation or porting of a feature from upstream to local fork

1.  **`codemap_report.md`** (By Scout):
    *   Tree view of all files involved in the Upstream Feature.
    *   Tree view of all Local files that would be touched.
    *   Intersection list (The Danger Zone).

2.  **`feature_diff_report.md`** (By Scout/Tool):
    *   Semantic analysis of *what* is changing.
    *   "Upstream is rewriting the Auth flow. Local has custom Auth hooks."

3.  **`specifications_and_limitations_report.md`** (By Guardian):
    *   "The Upstream Feature expects standard Supabase Auth."
    *   "Limitation: We use a custom local-first auth. This feature will require a Bridge Adapter."

4.  **`safety_check_report.md`** (By Guardian):
    *   "The Upstream Feature expects standard Supabase Auth."
    *   "Limitation: We use a custom local-first auth. This feature will require a Bridge Adapter."

5.  **`implementation_plan.md`** (By Orchestrator):
    *   The "Step-by-Step" instructions for the Builder.
    *   Explicit "Conflict Resolution" strategies for every file in the Danger Zone.

6.  **`sync_feature_report.md`** (By Builder):
    *   What was synced.
    *   What was *intentionally* left behind (Billing, etc.).
    *   Verification steps performed.


## 7. File Templates
These will be file templates that will be created inside of the .upstream-syncing/templates/ directory for the reports that need to be generated.


## 8. Next Steps (Implementation)

1.  **Registry**: Build `feature-registry.json` by auditing `.docs/addon-features` - this should be a new slash/workflow command as well `/update-addon-features-registry`
2.  **Scripts**: Scaffold the TypeScript tooling environment in `.upstream-syncing/scripts/`.
3.  **Workflow**: Write the `port-feature.md` workflow prompt for the Orchestrator and place into `.agent/workflows/` AND a claude specific version in .claude/commands/. Given that gemini doesnt support subagents we dont need to add to .gemini/commands/


## 99999. Developer Notes and Scratchpad Area (AI AGENTS ARE TO NOT EDIT ANYTHING BELOW THE LINE OF THIS DOCUMENTS)

This implementation is likely potentially to be successful eventually, but it would be a lot of work to potentially implement a fully automated systems. Intead it is probably a better idea to make this system semi-automated, where the AI agents can complete most of the work, but the developer can still review and approve the changes. We should follow the github speckit model with human in the loop, memory, document templates, and scripts.

This should essentially be a highly modified version of github speckit used only for this repo and this specific workflow of porting features from upstream to this local fork and shouldnt be generalized to other workflows or projects. 

If using Gemini CLI, we will likely need to refactor this system to be compatible with the gemini cli as it does not support subagents - but this is fine as Gemini models tend to have very large context windows and can handle the complexity of this system. 

Alternative idea, we could simply just modify the exist github speckit system to be compatible with this idea or concept .upstream-syncing system.