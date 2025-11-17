# Workflow & Playbook System Code Map (Legacy, Pre–Oct 2025)

This document lists the key **backend**, **database/migrations**, and **frontend** code files required for the legacy workflow and playbook system to function.

---

## 1. Database / Migrations (Supabase)

Core tables, JSON `steps` structure, and versioning integration.

- **Database schema evolution (Codemap 1a–1f)**  
  - **Initial schema – `20250705161610_agent_workflows.sql`**
    - **1a – `agent_workflows` table creation**  
      Creates `agent_workflows` with `agent_id`, `name`, `description`, `status`,
      `trigger_phrase`, `is_default`, timestamps, etc.
    - **1b – `workflow_steps` table (later removed)**  
      Creates normalized `workflow_steps` with `step_order`, `type`, `config`,
      `conditions` linked to `agent_workflows(id)`.

  - **Denormalization – `20250708034613_add_steps_to_workflows.sql`**
    - **1c – Add `steps` JSONB column**  
      Adds `steps JSONB` column to `agent_workflows` plus a GIN index for flexible JSON queries.
    - **1d – Migrate existing steps to JSON**  
      Aggregates rows from `workflow_steps` into `agent_workflows.steps` (denormalizes
      `workflow_steps → steps`).

  - **Cleanup – `20250726180605_remove_old_workflow_sys.sql`**
    - **1e – Clean up old execution tables**  
      Drops `workflow_step_executions`, `workflow_executions`, `workflow_steps`, etc.,
      leaving `agent_workflows` + `steps` JSON as the canonical representation.

  - **Versioning integration – `20250814184554_add_workflows_to_config.sql`**
    - **1f – Version config sync function**  
      Defines `update_version_config_with_workflows(p_version_id ...)`, which aggregates
      workflows into JSONB and writes them into `agent_versions.config['workflows']`.

- **Other workflow-related migrations**
  - `backend/supabase/migrations/20250417000000_workflow_system.sql`
  - `backend/supabase/migrations/20250418000000_workflow_flows.sql`
  - `backend/supabase/migrations/20250705155923_rollback_workflows.sql`
  - `backend/supabase/migrations/20250705164211_fix_agent_workflows.sql`
  - `backend/supabase/migrations/20250706130554_simplify_workflow_steps.sql`
  - `backend/supabase/migrations/20250723093053_fix_workflow_policy_conflicts.sql`

- **Triggers schema (to launch workflows via events/schedule)**
  - `backend/supabase/migrations/20250630070510_agent_triggers.sql`
---

## 2. Backend – Core Workflow & Playbook Logic

### 2.1 Triggers & Workflows API Layer

- **Triggers & workflows router (HTTP API)**
  - `backend/core/triggers/api.py`
    - `workflows_router` under `/triggers/workflows`
    - `get_agent_workflows`, `create_agent_workflow`, `update_agent_workflow`, `delete_agent_workflow`
    - `execute_agent_workflow` (manual workflow execution endpoint)
    - `convert_steps_to_json` (persists steps JSON structure, incl. playbook metadata)
    - `sync_workflows_to_version_config` (keeps `agent_versions.config.workflows` in sync)
    - `trigger_webhook` (entrypoint for webhook/scheduled triggers → may execute workflows)

- **Trigger service + providers (including workflow execution path)**
  - `backend/core/triggers/trigger_service.py`
    - Trigger domain model (`Trigger`, `TriggerResult`, `TriggerEvent`, etc.)
    - Routing logic that decides whether to execute agent vs workflow
  - `backend/core/triggers/provider_service.py`
    - `ScheduleProvider` with `execution_type` = `agent | workflow`
    - Passes `workflow_id` and `workflow_input` into trigger payloads used by execution service

- **Composio integration for event-based triggers → workflows**
  - `backend/core/composio_integration/composio_trigger_service.py`
    - Bridge between external Composio events and internal trigger/workflow system

### 2.2 Workflow Execution Service & LLM Formatting

- **Execution service and workflow executor**
  - `backend/core/triggers/execution_service.py`
    - `ExecutionService.execute_trigger_result` → delegates to `WorkflowExecutor` when `should_execute_workflow` is true
    - `WorkflowExecutor.execute_workflow` (fetches workflow config from `agent_workflows`, sets up session, starts background run)
    - `SessionManager.create_workflow_session` (creates project/thread + sandbox with workflow metadata)
    - `_enhance_agent_config_for_workflow` (injects workflow/playbook prompt into agent config)

- **Workflow & playbook LLM prompt formatting**
  - `backend/core/triggers/utils.py`
    - `format_workflow_for_llm(workflow_config, steps, input_data, available_tools)`
      - Detects playbooks vs regular workflows (`is_playbook`)
      - For playbooks, delegates to `format_playbook_for_llm`
      - For regular workflows, uses `WorkflowParser` to build step-by-step prompt
    - `format_playbook_for_llm(...)`
      - Extracts `config.playbook.template` and `config.playbook.variables`
      - Builds simplified playbook prompt instructing the LLM to treat template as authoritative
    - `WorkflowParser` and helpers for legacy/non-playbook workflows

### 2.3 Agent Builder Tools (Create Workflows / Playbooks Programmatically)

- **Workflow creation via agent builder tools**
  - `backend/core/tools/agent_builder_tools/workflow_tool.py`
    - `create_workflow` tool used by the agent builder
    - Builds playbook-like step structure (`config.playbook` payload) and wraps it in a `Start` node
    - Inserts into `agent_workflows` (`steps` JSON) and calls `_sync_workflows_to_version_config`

- **Trigger configuration from agent builder side (for workflow execution)**
  - `backend/core/tools/agent_builder_tools/trigger_tool.py`
    - Creates triggers that can execute either an agent or a workflow
    - Ensures config includes `execution_type`, `workflow_id`, and optional `workflow_input` for workflow executions

---

## 3. Frontend – Workflows UI & React Query Hooks

### 3.1 React Query Hooks for Workflows

- **Workflow data access layer**
  - `frontend/src/hooks/react-query/agents/workflow-utils.ts`
    - Types: `AgentWorkflow`, `WorkflowStep`, `CreateWorkflowRequest`, `UpdateWorkflowRequest`, `ExecuteWorkflowRequest`, `WorkflowExecution`
    - REST calls:
      - `getAgentWorkflows` → `GET /triggers/workflows/agents/{agent_id}/workflows`
      - `createAgentWorkflow` → `POST /triggers/workflows/agents/{agent_id}/workflows`
      - `updateAgentWorkflow` → `PUT /triggers/workflows/agents/{agent_id}/workflows/{workflow_id}`
      - `deleteAgentWorkflow` → `DELETE /triggers/workflows/agents/{agent_id}/workflows/{workflow_id}`
      - `executeWorkflow` → `POST /triggers/workflows/agents/{agent_id}/workflows/{workflow_id}/execute`
      - `getWorkflowExecutions` → `GET /triggers/workflows/agents/{agent_id}/workflows/{workflow_id}/executions`
    - Frontend-only LLM helpers: `convertWorkflowToLLMFormat`, `generateLLMWorkflowPrompt`

  - `frontend/src/hooks/react-query/agents/use-agent-workflows.ts`
    - `useAgentWorkflows`
    - `useCreateAgentWorkflow`
    - `useUpdateAgentWorkflow`
    - `useDeleteAgentWorkflow`
    - `useExecuteWorkflow`
    - `useWorkflowExecutions`

  - `frontend/src/hooks/react-query/agents/conditional-workflow-types.ts`
    - Shared TypeScript types used by the conditional workflow builder

  - `frontend/src/hooks/react-query/agents/workflow-builder.ts`
    - Helpers for building/saving conditional workflow structures

  - `frontend/src/hooks/react-query/agents/workflow-keys.ts`
    - React Query key factories for workflow queries/mutations

  - `frontend/src/hooks/react-query/agents/workflow-prompt-builder.ts`
    - Client-side utilities for generating workflow prompts (frontend view of workflow → LLM)

### 3.2 Workflow Builder & Management UI

- **Agent-level workflow configuration screen**
  - `frontend/src/components/agents/workflows/agent-workflows-configuration.tsx`
    - Main UI for listing, creating, editing, activating workflows per agent

- **Conditional workflow builder UI**
  - `frontend/src/components/agents/workflows/conditional-workflow-builder.tsx`
    - Visual builder for conditional workflows (branching, conditions, nested steps)

- **Workflow builder shared components**
  - `frontend/src/components/workflows/workflow-builder.tsx`
    - Core workflow builder canvas and layout
  - `frontend/src/components/workflows/steps/workflow-steps.tsx`
    - Render and manage individual workflow steps
  - `frontend/src/components/workflows/hooks/use-workflow-steps.ts`
    - Hook managing step add/remove/reorder for the builder
  - `frontend/src/components/workflows/workflow-definitions.ts`
    - Definitions for step types, default configs, etc.
  - `frontend/src/components/workflows/workflow-header.tsx`
    - Header UI for workflow editor (name, status, actions)
  - `frontend/src/components/workflows/workflow-layout.tsx`
    - Layout shell around the builder
  - `frontend/src/components/workflows/workflow-side-panel.tsx`
    - Side panel for step details/configuration

- **Workflow execution UI**
  - `frontend/src/components/workflows/workflow-execution-dialog.tsx`
    - Dialog for manually running a workflow and showing execution status

- **Thread tool views that interact with workflows**
  - `frontend/src/components/thread/tool-views/activate-agent-workflow/activate-agent-workflow.tsx`
  - `frontend/src/components/thread/tool-views/create-agent-workflow/create-agent-workflow.tsx`
  - `frontend/src/components/thread/tool-views/list-agent-workflows/list-agent-workflows.tsx`

- **Internal workflow docs (for dev reference)**
  - `frontend/src/components/workflows/workflow-structure-test.md`
    - Developer notes/examples for workflow step JSON structure

---

## 4. Frontend – Playbooks UI & Integration with Workflows

Playbooks are a specialized form of workflow that use a text template plus variables, encoded into `config.playbook` on a workflow step.

### 4.1 Playbook Creation & Editing

- **Playbook create/edit modal**
  - `frontend/src/components/playbooks/playbook-create-modal.tsx`
    - `extractTokensFromTemplate` to parse `{{variable}}` tokens from the template
    - Builds a single `playbook` step structure:
      - `config.playbook.template`
      - `config.playbook.variables` (key, label, type, default, etc.)
    - Uses `useCreateAgentWorkflow` / `updateWorkflowMutation` to create a backing workflow in `agent_workflows`

- **Agent-level playbooks configuration**
  - `frontend/src/components/agents/playbooks/agent-playbooks-configuration.tsx`
    - Lists playbooks for an agent (subset/view of `agent_workflows` that are playbook-shaped)
    - Entry point into `PlaybookCreateModal` and execution dialogs

### 4.2 Playbook Execution & Navigation

- **Manual playbook execution dialog**
  - `frontend/src/components/playbooks/playbook-execute-dialog.tsx`
    - Extracts variables from `config.playbook.variables`
    - Renders inputs, posts to `executeWorkflow` API
    - On success, opens the resulting thread/project for the workflow run

- **Triggers UI – using a workflow/playbook as the execution target**
  - `frontend/src/components/agents/triggers/event-based-trigger-dialog.tsx`
    - For `execution_type = 'workflow'`, allows selecting a workflow/playbook
    - Reads playbook variables from the selected workflow steps JSON (`config.playbook.variables`)
    - Captures default values into `workflow_input`

  - `frontend/src/components/agents/triggers/providers/event-config.tsx`
    - Trigger provider UI for choosing execution type `agent` vs `workflow`
    - When `workflow` is selected, shows workflow selector and `workflow_input` variable fields

- **Triggers hooks (for connecting triggers to workflows)**
  - `frontend/src/hooks/react-query/triggers/use-agent-triggers.ts`
    - `createTrigger`, `updateTrigger`, `deleteTrigger`
    - Trigger configs include `execution_type`, `workflow_id`, and `workflow_input` for workflow/playbook execution

---

## 5. Related / Supporting Docs & Notes

These are not executed at runtime but are helpful for understanding or evolving the system.

- `docs/SELF-HOSTING.md` (deployment context for backend/frontend)
- `frontend/src/components/workflows/workflow-structure-test.md` (example JSON structures used by builder & backend)

---

## 6. How to Use This Map

- **To trace a manual playbook run:**
  1. Frontend: `playbook-execute-dialog.tsx` → `useExecuteWorkflow` → `workflow-utils.ts`
  2. Backend: `api.py.execute_agent_workflow` → `ExecutionService.execute_trigger_result` → `WorkflowExecutor.execute_workflow`
  3. LLM prompt: `format_workflow_for_llm` / `format_playbook_for_llm` in `triggers/utils.py`

- **To trace an event-based trigger starting a workflow/playbook:**
  1. Frontend: `event-config.tsx` / `event-based-trigger-dialog.tsx` → `use-agent-triggers.ts`
  2. Backend: `trigger_service.py` / `provider_service.py` (e.g., `ScheduleProvider`) → `ExecutionService` / `WorkflowExecutor`

This list is intended as the **authoritative file index** for the legacy workflow & playbook system in `suna-main` (pre–Oct 2025).
