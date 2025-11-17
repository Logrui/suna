Codemap title: Suna Legacy Workflow & Playbook System (Pre–Oct 2025, suna-main)
Codemap ID: 'Suna_Legacy_Workflow_&_Playbook_System_(Pre–Oct_2025,_suna-main)_20251113_180751'
Codemap description: This codemap documents the legacy workflow and playbook system in suna-main, covering database schema (agent_workflows table), backend CRUD operations (workflow_tool.py and triggers/api.py), workflow execution (execution_service.py), LLM prompt formatting (triggers/utils.py), versioning integration (sync to agent_versions.config), and frontend UI components for creating and executing workflows/playbooks. Key entry points: workflow creation [2c], API execution endpoint [3e], WorkflowExecutor [4c], playbook UI [7c].

Trace ID: 1
Title: Database Schema: agent_workflows Table & Migration Evolution
Description: Database layer: Shows the evolution of the workflow schema from complex execution tables to simplified agent_workflows with JSON steps column.

Trace text diagram:
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

Location ID: 1a
Title: agent_workflows table creation
Description: Initial table with agent_id, name, description, status, trigger_phrase, is_default
Path:LineNumber: d:\Homelab\suna-main\suna\backend\supabase\migrations\20250705161610_agent_workflows.sql:28
Location ID: 1b
Title: workflow_steps table (later removed)
Description: Original normalized steps table with step_order, type, config, conditions
Path:LineNumber: d:\Homelab\suna-main\suna\backend\supabase\migrations\20250705161610_agent_workflows.sql:41
Location ID: 1c
Title: Add steps JSONB column
Description: Migration to denormalize steps into a flexible JSON field
Path:LineNumber: d:\Homelab\suna-main\suna\backend\supabase\migrations\20250708034613_add_steps_to_workflows.sql:4
Location ID: 1d
Title: Migrate existing steps to JSON
Description: Data migration from workflow_steps table to agent_workflows.steps JSONB
Path:LineNumber: d:\Homelab\suna-main\suna\backend\supabase\migrations\20250708034613_add_steps_to_workflows.sql:9
Location ID: 1e
Title: Clean up old execution tables
Description: Remove workflow_step_executions, workflow_executions, workflow_steps tables
Path:LineNumber: d:\Homelab\suna-main\suna\backend\supabase\migrations\20250726180605_remove_old_workflow_sys.sql:8
Location ID: 1f
Title: Version config sync function
Description: Migration to sync workflows into agent_versions.config for versioning
Path:LineNumber: d:\Homelab\suna-main\suna\backend\supabase\migrations\20250814184554_add_workflows_to_config.sql:3

Trace ID: 2
Title: Backend Workflow Tool: create_workflow in Agent Builder
Description: Backend agent-builder tool: Shows how agents create workflows using the workflow_tool, including playbook structure creation and version sync.

Trace text diagram:
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

Location ID: 2a
Title: create_workflow method signature
Description: Agent-builder tool method for creating workflows/playbooks
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:194
Location ID: 2b
Title: Construct playbook step structure
Description: Creates the Execute Workflow Template step with config.playbook containing template and variables
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:207
Location ID: 2c
Title: Insert workflow into database
Description: Persists workflow with steps JSON to agent_workflows table
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:248
Location ID: 2d
Title: Sync to version config
Description: Updates agent_versions.config with the new workflow
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:252
Location ID: 2e
Title: Set workflows in config
Description: Adds workflows array to agent version config for runtime access
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\tools\agent_builder_tools\workflow_tool.py:49

Trace ID: 3
Title: Backend API: workflows_router CRUD Endpoints
Description: Backend REST API: Exposes workflow CRUD operations via /triggers/workflows endpoints for frontend integration.

Trace text diagram:
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

Location ID: 3a
Title: Workflows router definition
Description: FastAPI router for workflow endpoints under /triggers/workflows
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:29
Location ID: 3b
Title: Create workflow endpoint
Description: POST endpoint for creating new workflows
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:724
Location ID: 3c
Title: Insert workflow via API
Description: Converts WorkflowCreateRequest to database insert
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:737
Location ID: 3d
Title: Sync after creation
Description: Triggers version config sync after workflow creation
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:748
Location ID: 3e
Title: Execute workflow endpoint
Description: POST endpoint for manual workflow execution
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:821
Location ID: 3f
Title: Delegate to execution service
Description: Hands off to ExecutionService for workflow execution
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:898

Trace ID: 4
Title: Backend Execution: WorkflowExecutor Flow
Description: Backend execution service: Traces workflow execution from trigger result through agent config enhancement to background agent run.

Trace text diagram:
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

Location ID: 4a
Title: Route to workflow executor
Description: ExecutionService routes workflow executions to WorkflowExecutor
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:35
Location ID: 4b
Title: Call WorkflowExecutor
Description: Delegates to WorkflowExecutor.execute_workflow method
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:36
Location ID: 4c
Title: Fetch workflow from database
Description: Retrieves workflow config and steps JSON from agent_workflows table
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:443
Location ID: 4d
Title: Enhance agent config with workflow
Description: Injects workflow prompt into agent system_prompt using format_workflow_for_llm
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:446
Location ID: 4e
Title: Format workflow for LLM
Description: Converts workflow steps to LLM-readable prompt format
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:540
Location ID: 4f
Title: Create workflow session
Description: Creates new project and thread for workflow execution
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:450
Location ID: 4g
Title: Start background agent run
Description: Dispatches agent execution with enhanced config to background worker
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\execution_service.py:708

Trace ID: 5
Title: Backend LLM Formatting: Workflow & Playbook Prompts
Description: Backend utilities: Shows how workflows and playbooks are formatted into LLM prompts, with different logic for playbooks vs regular workflows.

Trace text diagram:
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

Location ID: 5a
Title: Main workflow formatting function
Description: Entry point for converting workflow to LLM prompt
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:240
Location ID: 5b
Title: Check if playbook
Description: Detects playbook structure (Start node with config.playbook child)
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:247
Location ID: 5c
Title: Route to playbook formatter
Description: Uses simplified playbook prompt for template-based workflows
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:248
Location ID: 5d
Title: Extract playbook config
Description: Retrieves template and variables from config.playbook
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:344
Location ID: 5e
Title: Generate playbook prompt
Description: Returns simplified prompt with template and variable substitution rules
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:366
Location ID: 5f
Title: Parse regular workflow steps
Description: For non-playbooks, parses steps into structured format with conditions
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:252
Location ID: 5g
Title: Generate workflow prompt
Description: Returns detailed prompt with step-by-step execution instructions
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\utils.py:269

Trace ID: 6
Title: Versioning Integration: Sync Workflows to agent_versions.config
Description: Backend versioning: Shows how workflows are synchronized into agent_versions.config for runtime access and version control.

Trace text diagram:
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

Location ID: 6a
Title: Sync function definition
Description: Helper function to sync workflows into agent version config
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:145
Location ID: 6b
Title: Fetch all agent workflows
Description: Retrieves all workflows for the agent from database
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:156
Location ID: 6c
Title: Set workflows in config
Description: Adds workflows array to the version config object
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:166
Location ID: 6d
Title: Update version config
Description: Persists updated config back to agent_versions table
Path:LineNumber: d:\Homelab\suna-main\suna\backend\core\triggers\api.py:168
Location ID: 6e
Title: Aggregate workflows to JSON
Description: Migration function aggregates workflows into JSONB array for config
Path:LineNumber: d:\Homelab\suna-main\suna\backend\supabase\migrations\20250814184554_add_workflows_to_config.sql:20

Trace ID: 7
Title: Frontend Playbook Creation: PlaybookCreateModal Flow
Description: Frontend playbook UI: Traces playbook creation from modal form through template parsing to API call and activation.

Trace text diagram:
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

Location ID: 7a
Title: Extract variable tokens
Description: Parses {{variable}} tokens from playbook template
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-create-modal.tsx:26
Location ID: 7b
Title: Construct playbook step
Description: Creates Execute Playbook step with config.playbook structure
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-create-modal.tsx:87
Location ID: 7c
Title: Create workflow via mutation
Description: Calls createAgentWorkflow API with playbook structure
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-create-modal.tsx:149
Location ID: 7d
Title: Auto-activate playbook
Description: Immediately activates the playbook after creation
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-create-modal.tsx:151
Location ID: 7e
Title: Mutation function
Description: React Query mutation wraps createAgentWorkflow API call
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\use-agent-workflows.ts:33

Trace ID: 8
Title: Frontend Playbook Execution: PlaybookExecuteDialog Flow
Description: Frontend playbook execution: Shows user filling variables, clicking Run, and navigating to the execution thread.

Trace text diagram:
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

Location ID: 8a
Title: Extract playbook variables
Description: Parses variable specs from config.playbook.variables
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:49
Location ID: 8b
Title: Execute workflow mutation
Description: Calls executeWorkflow API with input_data containing variable values
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:93
Location ID: 8c
Title: Store execution result
Description: Captures thread_id and agent_run_id from execution response
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:100
Location ID: 8d
Title: Fetch thread details
Description: Retrieves thread to get project_id for navigation
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:171
Location ID: 8e
Title: Navigate to execution thread
Description: Redirects user to the thread where workflow is executing
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\components\playbooks\playbook-execute-dialog.tsx:173

Trace ID: 9
Title: Frontend API Integration: workflow-utils.ts
Description: Frontend API layer: Shows how frontend makes authenticated REST calls to backend workflow endpoints.

Trace text diagram:
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

Location ID: 9a
Title: Get workflows API function
Description: Fetches all workflows for an agent from backend
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:144
Location ID: 9b
Title: GET workflows endpoint
Description: Calls /triggers/workflows/agents/{agent_id}/workflows
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:153
Location ID: 9c
Title: Create workflow API function
Description: Posts new workflow to backend
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:174
Location ID: 9d
Title: POST workflows endpoint
Description: Creates workflow via POST with CreateWorkflowRequest body
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:183
Location ID: 9e
Title: Execute workflow API function
Description: Triggers workflow execution with input_data
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:267
Location ID: 9f
Title: POST execute endpoint
Description: Calls /execute endpoint with ExecuteWorkflowRequest containing input_data
Path:LineNumber: d:\Homelab\suna-main\suna\frontend\src\hooks\react-query\agents\workflow-utils.ts:286
