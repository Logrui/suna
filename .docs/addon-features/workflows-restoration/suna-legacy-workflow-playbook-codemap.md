# Suna Legacy Workflow & Playbook System (Pre–Oct 2025, suna-main)

**Codemap ID:** `Suna_Legacy_Workflow_&_Playbook_System_(Pre–Oct_2025,_suna-main)_20251113_180751`

## Overview

This codemap documents the legacy workflow and playbook system in `suna-main`, covering:

- **Database Schema:** `agent_workflows` table with JSONB steps
- **Backend CRUD:** `workflow_tool.py` and `triggers/api.py` operations
- **Workflow Execution:** `execution_service.py` orchestration
- **LLM Formatting:** `triggers/utils.py` prompt generation
- **Versioning:** Sync to `agent_versions.config`
- **Frontend UI:** Components for creating and executing workflows/playbooks

### Key Entry Points

- Workflow creation: [2c]
- API execution endpoint: [3e]
- WorkflowExecutor: [4c]
- Playbook UI: [7c]

---

## Trace 1: Database Schema & Migration Evolution

**Description:** Database layer showing the evolution of the workflow schema from complex execution tables to simplified `agent_workflows` with JSON steps column.

### Schema Evolution Diagram

```
Database Schema Evolution (Migrations)
├── Initial Schema (20250705161610)
│   ├── CREATE agent_workflows table <-- 1a
│   │   └── (agent_id, name, status, etc.) <-- 20250705161610_agent_workflows.sql:30
│   └── CREATE workflow_steps table <-- 1b
│       └── (normalized: step_order, type, config) <-- 20250705161610_agent_workflows.sql:44
├── Denormalization (20250708034613)
│   ├── ADD steps JSONB column <-- 1c
│   │   └── (flexible JSON field) <-- 20250708034613_add_steps_to_workflows.sql:31
│   └── MIGRATE data to JSON <-- 1d
│       └── (workflow_steps → steps) <-- 20250708034613_add_steps_to_workflows.sql:26
├── Cleanup (20250726180605)
│   └── DROP old execution tables <-- 1e
│       └── (workflow_executions, etc.) <-- 20250726180605_remove_old_workflow_sys.sql:11
└── Versioning Integration (20250814184554)
    └── CREATE sync function <-- 1f
        └── update_version_config() body <-- 20250814184554_add_workflows_to_config.sql:12
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **1a** | `agent_workflows` table creation | Initial table with `agent_id`, `name`, `description`, `status`, `trigger_phrase`, `is_default` | `d:\Homelab\suna-main\suna\backend\supabase\migrations\20250705161610_agent_workflows.sql:28` |
| **1b** | `workflow_steps` table (later removed) | Original normalized steps table with `step_order`, `type`, `config`, `conditions` | `d:\Homelab\suna-main\suna\backend\supabase\migrations\20250705161610_agent_workflows.sql:41` |
| **1c** | Add `steps` JSONB column | Migration to denormalize steps into a flexible JSON field | `d:\Homelab\suna-main\suna\backend\supabase\migrations\20250708034613_add_steps_to_workflows.sql:4` |
| **1d** | Migrate existing steps to JSON | Data migration from `workflow_steps` table to `agent_workflows.steps` JSONB | `d:\Homelab\suna-main\suna\backend\supabase\migrations\20250708034613_add_steps_to_workflows.sql:9` |
| **1e** | Clean up old execution tables | Remove `workflow_step_executions`, `workflow_executions`, `workflow_steps` tables | `d:\Homelab\suna-main\suna\backend\supabase\migrations\20250726180605_remove_old_workflow_sys.sql:8` |
| **1f** | Version config sync function | Migration to sync workflows into `agent_versions.config` for versioning | `d:\Homelab\suna-main\suna\backend\supabase\migrations\20250814184554_add_workflows_to_config.sql:3` |

---

## Trace 2: Backend Workflow Tool - `create_workflow` in Agent Builder

**Description:** Backend agent-builder tool showing how agents create workflows using `workflow_tool`, including playbook structure creation and version sync.

### Execution Diagram

```
Backend Workflow Tool (workflow_tool.py)
└── Agent calls create_workflow() <-- 2a
    ├── Build playbook step structure
    │   ├── playbook_step dict with config <-- 2b
    │   └── start_node wraps playbook_step <-- workflow_tool.py:222
    ├── Insert into database
    │   └── client.table('agent_workflows')
    │       .insert(workflow_data) <-- 2c
    ├── Sync to version config
    │   └── _sync_workflows_to_version_config() <-- 2d
    │       ├── Fetch workflows from DB <-- workflow_tool.py:25
    │       ├── Get current_version_id <-- workflow_tool.py:18
    │       ├── config['workflows'] = workflows <-- 2e
    │       └── Update agent_versions table <-- workflow_tool.py:52
    └── Return success response with workflow ID <-- workflow_tool.py:255
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **2a** | `create_workflow` method signature | Agent-builder tool method for creating workflows/playbooks | `d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:194` |
| **2b** | Construct playbook step structure | Creates the Execute Workflow Template step with `config.playbook` containing template and variables | `d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:207` |
| **2c** | Insert workflow into database | Persists workflow with steps JSON to `agent_workflows` table | `d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:248` |
| **2d** | Sync to version config | Updates `agent_versions.config` with the new workflow | `d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:252` |
| **2e** | Set workflows in config | Adds workflows array to agent version config for runtime access | `d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:49` |

---

## Trace 3: Backend API - `workflows_router` CRUD Endpoints

**Description:** Backend REST API exposing workflow CRUD operations via `/triggers/workflows` endpoints for frontend integration.

### Execution Diagram

```
Backend API: workflows_router CRUD Endpoints
├── FastAPI Application
│   └── /triggers/workflows router <-- 3a
│       ├── POST /agents/{agent_id}/workflows <-- 3b
│       │   ├── verify_and_authorize_trigger_agent_access() <-- api.py:137
│       │   ├── convert_steps_to_json() <-- api.py:682
│       │   ├── client.table('agent_workflows')
│       │   │   .insert() <-- 3c
│       │   └── sync_workflows_to_version_config() <-- 3d
│       │       ├── fetch agent.current_version_id <-- api.py:149
│       │       ├── fetch all agent_workflows <-- api.py:156
│       │       └── update agent_versions.config <-- api.py:168
│       └── POST /agents/{agent_id}/workflows/
│           {workflow_id}/execute <-- 3e
│           ├── verify workflow is active <-- api.py:838
│           ├── check billing & model access <-- api.py:859
│           ├── create TriggerResult & TriggerEvent <-- api.py:876
│           └── execution_service
│               .execute_trigger_result() <-- 3f
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **3a** | Workflows router definition | FastAPI router for workflow endpoints under `/triggers/workflows` | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:29` |
| **3b** | Create workflow endpoint | POST endpoint for creating new workflows | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:724` |
| **3c** | Insert workflow via API | Converts `WorkflowCreateRequest` to database insert | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:737` |
| **3d** | Sync after creation | Triggers version config sync after workflow creation | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:748` |
| **3e** | Execute workflow endpoint | POST endpoint for manual workflow execution | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:821` |
| **3f** | Delegate to execution service | Hands off to `ExecutionService` for workflow execution | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:898` |

---

## Trace 4: Backend Execution - `WorkflowExecutor` Flow

**Description:** Backend execution service tracing workflow execution from trigger result through agent config enhancement to background agent run.

### Execution Diagram

```
Workflow Execution Flow (Trace 4)
└── ExecutionService.execute_trigger_result() <-- execution_service.py:26
    ├── Check trigger type <-- 4a
    └── WorkflowExecutor.execute_workflow() <-- 4b
        ├── _get_workflow_data() <-- 4c
        │   └── Query agent_workflows table <-- execution_service.py:484
        ├── _get_agent_data() <-- execution_service.py:495
        │   └── Fetch agent config from versions <-- execution_service.py:509
        ├── _enhance_agent_config_for_workflow() <-- 4d
        │   ├── _get_available_tools() <-- execution_service.py:565
        │   └── format_workflow_for_llm() <-- 4e
        │       ├── Parse workflow steps <-- utils.py:252
        │       └── Generate LLM prompt <-- utils.py:269
        ├── SessionManager.create_workflow_session() <-- 4f
        │   ├── Create project & thread <-- execution_service.py:107
        │   └── Create sandbox <-- execution_service.py:114
        ├── _create_workflow_message() <-- execution_service.py:619
        │   └── Insert initial message <-- execution_service.py:640
        └── _start_workflow_agent_execution() <-- 4g
            ├── Check billing & model access <-- execution_service.py:685
            ├── Insert agent_run record <-- execution_service.py:692
            └── run_agent_background.send() <-- 4g
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **4a** | Route to workflow executor | `ExecutionService` routes workflow executions to `WorkflowExecutor` | `d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:35` |
| **4b** | Call `WorkflowExecutor` | Delegates to `WorkflowExecutor.execute_workflow` method | `d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:36` |
| **4c** | Fetch workflow from database | Retrieves workflow config and steps JSON from `agent_workflows` table | `d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:443` |
| **4d** | Enhance agent config with workflow | Injects workflow prompt into agent `system_prompt` using `format_workflow_for_llm` | `d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:446` |
| **4e** | Format workflow for LLM | Converts workflow steps to LLM-readable prompt format | `d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:540` |
| **4f** | Create workflow session | Creates new project and thread for workflow execution | `d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:450` |
| **4g** | Start background agent run | Dispatches agent execution with enhanced config to background worker | `d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:708` |

---

## Trace 5: Backend LLM Formatting - Workflow & Playbook Prompts

**Description:** Backend utilities showing how workflows and playbooks are formatted into LLM prompts, with different logic for playbooks vs regular workflows.

### Execution Diagram

```
Backend LLM Formatting Pipeline
├── format_workflow_for_llm() entry <-- 5a
│   ├── is_playbook(steps) check <-- 5b
│   │   ├── [TRUE] Playbook Branch
│   │   │   └── format_playbook_for_llm() <-- 5c
│   │   │       ├── Extract playbook config <-- 5d
│   │   │       │   └── config.playbook.template <-- utils.py:346
│   │   │       │   └── config.playbook.variables <-- utils.py:345
│   │   │       └── Generate playbook prompt <-- 5e
│   │   │           └── "Treat template as authoritative"
│   │   └── [FALSE] Regular Workflow Branch
│   │       ├── WorkflowParser.parse_workflow_steps() <-- 5f
│   │       │   └── Parses steps into structured format <-- utils.py:38
│   │       └── Generate workflow prompt <-- 5g
│   │           └── "Follow steps exactly as specified"
│   └── Return formatted LLM prompt string <-- utils.py:301
└── Called by _enhance_agent_config_for_workflow() <-- execution_service.py:530
    └── Injected into agent system_prompt <-- execution_service.py:548
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **5a** | Main workflow formatting function | Entry point for converting workflow to LLM prompt | `d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:240` |
| **5b** | Check if playbook | Detects playbook structure (Start node with `config.playbook` child) | `d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:247` |
| **5c** | Route to playbook formatter | Uses simplified playbook prompt for template-based workflows | `d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:248` |
| **5d** | Extract playbook config | Retrieves template and variables from `config.playbook` | `d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:344` |
| **5e** | Generate playbook prompt | Returns simplified prompt with template and variable substitution rules | `d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:366` |
| **5f** | Parse regular workflow steps | For non-playbooks, parses steps into structured format with conditions | `d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:252` |
| **5g** | Generate workflow prompt | Returns detailed prompt with step-by-step execution instructions | `d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:269` |

---

## Trace 6: Versioning Integration - Sync Workflows to `agent_versions.config`

**Description:** Backend versioning showing how workflows are synchronized into `agent_versions.config` for runtime access and version control.

### Execution Diagram

```
Versioning Integration: Sync Workflows to Config
├── API Workflow Operations
│   ├── POST /workflows (create) <-- 6a
│   ├── PUT /workflows/{id} (update) <-- api.py:757
│   └── DELETE /workflows/{id} (delete) <-- api.py:800
│       └── sync_workflows_to_version_config()
│           ├── Get current_version_id <-- api.py:149
│           ├── Fetch workflows from DB <-- 6b
│           │   └── SELECT * FROM agent_workflows
│           ├── Get version config <-- api.py:159
│           ├── Update config object <-- 6c
│           │   └── config['workflows'] = workflows
│           └── Persist to agent_versions <-- 6d
│               └── UPDATE agent_versions SET config
└── Migration: Backfill Existing Versions
    └── update_version_config_with_workflows() <-- 6e
        └── jsonb_agg(workflows) INTO config
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **6a** | Sync function definition | Helper function to sync workflows into agent version config | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:145` |
| **6b** | Fetch all agent workflows | Retrieves all workflows for the agent from database | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:156` |
| **6c** | Set workflows in config | Adds workflows array to the version config object | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:166` |
| **6d** | Update version config | Persists updated config back to `agent_versions` table | `d:\Homelab\suna-main\suna\backend\core\triggers\api.py:168` |
| **6e** | Aggregate workflows to JSON | Migration function aggregates workflows into JSONB array for config | `d:\Homelab\suna-main\suna\backend\supabase\migrations\20250814184554_add_workflows_to_config.sql:20` |

---

## Trace 7: Frontend Playbook Creation - `PlaybookCreateModal` Flow

**Description:** Frontend playbook UI tracing playbook creation from modal form through template parsing to API call and activation.

### Execution Diagram

```
Frontend Playbook Creation Flow
├── PlaybookCreateModal Component <-- playbook-create-modal.tsx:43
│   ├── extractTokensFromTemplate() <-- 7a
│   │   └── Parse {{variable}} from template <-- playbook-create-modal.tsx:28
│   ├── Construct playbook step structure <-- 7b
│   │   └── config.playbook { template, variables } <-- playbook-create-modal.tsx:93
│   └── handleSave() <-- playbook-create-modal.tsx:123
│       ├── createWorkflowMutation.mutateAsync() <-- 7c
│       │   └── useCreateAgentWorkflow hook <-- 7e
│       │       └── createAgentWorkflow(agentId, workflow) <-- workflow-utils.ts:174
│       │           └── POST /workflows/agents/{id}/workflows <-- workflow-utils.ts:183
│       │               └── Backend: workflows_router.post() <-- api.py:724
│       │                   └── INSERT INTO agent_workflows <-- api.py:737
│       └── updateWorkflowMutation.mutateAsync() <-- 7d
│           └── Set status='active' <-- playbook-create-modal.tsx:154
└── Result: Playbook created and activated
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **7a** | Extract variable tokens | Parses `{{variable}}` tokens from playbook template | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-create-modal.tsx:26` |
| **7b** | Construct playbook step | Creates Execute Playbook step with `config.playbook` structure | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-create-modal.tsx:87` |
| **7c** | Create workflow via mutation | Calls `createAgentWorkflow` API with playbook structure | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-create-modal.tsx:149` |
| **7d** | Auto-activate playbook | Immediately activates the playbook after creation | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-create-modal.tsx:151` |
| **7e** | Mutation function | React Query mutation wraps `createAgentWorkflow` API call | `d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\use-agent-workflows.ts:33` |

---

## Trace 8: Frontend Playbook Execution - `PlaybookExecuteDialog` Flow

**Description:** Frontend playbook execution showing user filling variables, clicking Run, and navigating to the execution thread.

### Execution Diagram

```
Frontend Playbook Execution Flow
├── PlaybookExecuteDialog component <-- playbook-execute-dialog.tsx:35
│   ├── useMemo: extract variables <-- 8a
│   │   └── parse config.playbook.variables <-- playbook-execute-dialog.tsx:56
│   ├── User fills variable inputs
│   ├── handleRun: click Run button <-- playbook-execute-dialog.tsx:83
│   │   ├── executeMutation.mutateAsync() <-- 8b
│   │   │   └── calls executeWorkflow API
│   │   ├── setStartedInfo() <-- 8c
│   │   │   └── store thread_id & agent_run_id
│   │   └── openThread helper <-- playbook-execute-dialog.tsx:102
│   │       ├── getThread() <-- 8d
│   │       │   └── fetch thread details
│   │       └── router.push() <-- 8e
│   │           └── navigate to execution thread
│   └── Dialog shows "Playbook is running" <-- playbook-execute-dialog.tsx:161
└── useExecuteWorkflow hook <-- use-agent-workflows.ts:74
    └── wraps executeWorkflow API call
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **8a** | Extract playbook variables | Parses variable specs from `config.playbook.variables` | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:49` |
| **8b** | Execute workflow mutation | Calls `executeWorkflow` API with `input_data` containing variable values | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:93` |
| **8c** | Store execution result | Captures `thread_id` and `agent_run_id` from execution response | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:100` |
| **8d** | Fetch thread details | Retrieves thread to get `project_id` for navigation | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:171` |
| **8e** | Navigate to execution thread | Redirects user to the thread where workflow is executing | `d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:173` |

---

## Trace 9: Frontend API Integration - `workflow-utils.ts`

**Description:** Frontend API layer showing how frontend makes authenticated REST calls to backend workflow endpoints.

### Execution Diagram

```
Frontend API Integration (workflow-utils.ts)
├── List Workflows
│   ├── getAgentWorkflows() <-- 9a
│   └── fetch GET /workflows/agents/{id} <-- 9b
├── Create Workflow
│   ├── createAgentWorkflow() <-- 9c
│   └── fetch POST /workflows/agents/{id} <-- 9d
└── Execute Workflow
    ├── executeWorkflow() <-- 9e
    └── fetch POST /workflows/{id}/execute <-- 9f
```

### Location Details

| ID | Title | Description | Path |
|---|---|---|---|
| **9a** | Get workflows API function | Fetches all workflows for an agent from backend | `d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:144` |
| **9b** | GET workflows endpoint | Calls `/triggers/workflows/agents/{agent_id}/workflows` | `d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:153` |
| **9c** | Create workflow API function | Posts new workflow to backend | `d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:174` |
| **9d** | POST workflows endpoint | Creates workflow via POST with `CreateWorkflowRequest` body | `d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:183` |
| **9e** | Execute workflow API function | Triggers workflow execution with `input_data` | `d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:267` |
| **9f** | POST execute endpoint | Calls `/execute` endpoint with `ExecuteWorkflowRequest` containing `input_data` | `d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:286` |
