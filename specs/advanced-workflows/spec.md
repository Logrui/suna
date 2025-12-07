# Feature Specification: Advanced Visual Workflow Builder

**Feature Branch**: `advanced-workflows`
**Created**: 2025-11-23
**Status**: Draft
**Input**: User description: "Build a sophisticated visual workflow builder that enables users to create complex, non-linear AI agent workflows with branching logic, conditions, loops, and parallel execution - replicating Motion AI Skill Builder's visual programming capabilities"

## Background & Platform Context

### Current System: "Simple Mode" Workflows

Suna Kortix currently has a functional workflow system that will become the "Simple Mode" when this feature is implemented. Understanding this existing system is critical because the Advanced Visual Workflow Builder extends it rather than replacing it.

#### Architecture Overview

**Database Foundation:**
- **Table**: `agent_workflows` - Stores workflow definitions associated with agents
- **Storage Model**: JSONB column `steps` contains an array of workflow steps
- **Schema**:
  ```sql
  CREATE TABLE agent_workflows (
      id UUID PRIMARY KEY,
      agent_id UUID REFERENCES agents(agent_id),
      name VARCHAR(255),
      description TEXT,
      status agent_workflow_status DEFAULT 'draft',
      trigger_phrase VARCHAR(255),
      is_default BOOLEAN DEFAULT FALSE,
      steps JSONB DEFAULT NULL,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
  );
  ```

**Step Structure:**
Each workflow is an ordered array of steps with this shape:
```typescript
interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  type: 'instruction' | 'message' | 'tool_call' | 'condition' | 'loop' | 'wait' | 'input' | 'output';
  config: Record<string, any>;
  order: number;
  parentConditionalId?: string;  // For nested conditional steps
  children?: WorkflowStep[];     // Nested steps within conditionals
}
```

#### Current Capabilities

**What Works Today:**
1. **Linear Step Execution** - Sequential processing of instruction steps
2. **Basic Conditional Branching** - If/else logic with nested children steps (stored hierarchically in `children` array)
3. **Tool Integration** - Steps can call any AgentPress tool via `config.tool_name`
4. **LLM-Interpreted Execution** - Workflows are converted to structured prompts that the AI agent interprets and executes
5. **Trigger Integration** - Workflows execute via:
   - Manual execution (API call)
   - Trigger phrases (detected in conversations)
   - Webhook/schedule triggers
6. **Version Synchronization** - Workflows sync to `agent_versions.config.workflows` for version history

**Current User Interface:**
- **Component**: `ConditionalWorkflowBuilder` - List-based editor
- **UX Pattern**: Nested expandable list showing parent-child relationship for conditionals
- **Editing**: Side panel configuration for individual steps
- **Visualization**: No visual graph - users see a vertical list of steps

#### Current Limitations (Why Advanced Mode is Needed)

**Architectural Constraints:**
1. **No Visual Graph** - Complex workflows are difficult to understand from a list view
2. **Limited Branching** - Only supports if/else conditionals with nested children, no complex routing or multiple branches
3. **No Variable Management** - Variables are implicit in step outputs, no formal variable scoping or references
4. **No Execution Visualization** - Cannot see which step is currently executing or trace execution path
5. **No Parallel Execution** - All steps are sequential, cannot model concurrent operations
6. **Loop Implementation Missing** - Loop type exists in enum but is not functionally implemented
7. **Limited Debugging** - No execution logs, step timing, or error tracking at the workflow level

**User Experience Issues:**
- Large workflows (10+ steps with multiple conditionals) become difficult to navigate
- No way to visualize the "flow" of logic between steps
- Cannot see at a glance which steps depend on which others
- Editing nested conditionals requires expanding/collapsing multiple levels

### Platform Integration Points

The Advanced Visual Workflow Builder must integrate seamlessly with the existing Suna Kortix platform architecture.

#### Agent System Integration

**AgentPress Framework:**
- **ThreadManager** (`backend/core/agentpress/thread_manager.py`) - Manages AI conversation threads and executes workflows
- **Tool Registry** (`backend/core/agentpress/tool_registry.py`) - Auto-discovers all tools from `backend/core/tools/`
- **Context Manager** - Maintains conversation context, token limits, and execution state
- **Response Processor** - Handles LLM responses and tool call execution

**Current Workflow → Agent Flow:**
```
1. Trigger Event (webhook/schedule/manual)
2. execution_service.verify_and_authorize_trigger_agent_access()
3. Create new Thread + Project + Sandbox (Daytona)
4. Insert initial message with workflow context
5. Enqueue Dramatiq task: run_agent_background()
6. ThreadManager processes workflow steps:
   - Convert steps to structured LLM prompt
   - Agent interprets instructions
   - Agent calls tools as needed
   - Results stored in thread messages
```

**Key Integration Requirement:**
- Advanced workflows must work with the same ThreadManager and tool system
- Execution should create threads and use Dramatiq background tasks
- Tool calls must use the existing tool registry

#### Database Schema Relationships

**Current Schema:**
```
agents (1:N) ──→ agent_workflows
                 └── steps: JSONB[]

agents (1:N) ──→ agent_versions
                 └── config.workflows: JSONB  (synced copy)

agents (1:N) ──→ agent_triggers
                 └── config: JSONB  (trigger settings)

agents (1:N) ──→ threads
                 └── messages (1:N)
                 └── agent_runs (1:N)
```

**Critical Sync Pattern:**
- When workflows are created/updated/deleted, `sync_workflows_to_version_config()` is called
- This copies the current workflow state into `agent_versions.config.workflows`
- Enables version history and rollback capabilities

#### Trigger System Integration

**Trigger Architecture:**
- **Service**: `backend/core/triggers/` - Manages trigger creation, configuration, and execution
- **Types**: webhook, schedule, event, polling, manual, workflow
- **Execution Service**: `execution_service.py` handles trigger → agent execution flow

**Workflow Execution Endpoint:**
```
POST /workflows/agents/{agent_id}/workflows/{workflow_id}/execute
→ Creates thread
→ Passes workflow context (variables from trigger)
→ Enqueues background agent run
→ Returns thread_id and agent_run_id
```

**Integration Requirement:**
- Advanced workflows must use the same execution endpoints
- Trigger payloads must populate workflow variables
- Execution context must flow from trigger → workflow → agent

#### Frontend Architecture

**Current Stack:**
- **Framework**: Next.js 15 with App Router
- **State Management**:
  - TanStack Query for server state (`use-agent-workflows.ts` hook)
  - React state for local UI state
- **API Client**: `workflow-utils.ts` - Handles all workflow CRUD operations

**Current Data Flow:**
```
API (/workflows/agents/{id}/workflows)
  → useAgentWorkflows() hook (React Query)
  → ConditionalWorkflowBuilder component
  → Nested step rendering + side panel editing
```

**Integration Requirement:**
- Share the same `useAgentWorkflows` hook for data fetching
- Preserve existing API endpoints
- Add mode switcher UI to toggle between Simple and Advanced editors

### Design Philosophy & Constraints

#### Existing Design Patterns

**Database Design:**
- **JSONB Flexibility** - Use flexible JSONB storage over rigid normalized schemas (allows schema evolution without migrations)
- **Row-Level Security** - All tables use Basejump `has_role_on_account()` pattern for multi-tenancy
- **Sync for Versioning** - Critical data is duplicated into `agent_versions.config` for immutable version history

**Execution Philosophy:**
- **LLM-Interpreted Workflows** - Current system converts workflows to structured prompts; the AI agent decides how to execute
- **Context-Aware** - Execution maintains context from trigger payloads, thread history, and previous step outputs
- **Background Processing** - Long-running workflows execute via Dramatiq workers, not synchronous API calls

**Migration History:**
- Original system had complex normalized tables (`workflows`, `workflow_flows`, `workflow_steps`, `workflow_executions`)
- Simplified in July 2025 to single `agent_workflows` table with JSONB `steps`
- Rationale: Complexity wasn't being used, JSONB provides flexibility, execution tracking via threads is sufficient

#### Critical Constraints

**Must Preserve:**
1. **Backward Compatibility** - Existing simple workflows must continue working without modification
2. **Same Database Table** - Extend `agent_workflows`, don't create new tables
3. **Version Sync Pattern** - Maintain `sync_workflows_to_version_config()` behavior
4. **Execution Service** - Use existing `execution_service.py` for thread creation and agent runs
5. **RLS Policies** - All queries must respect Basejump row-level security
6. **Billing Integration** - Model access checks via `billing_integration.check_model_and_billing_access()`
7. **Sandbox Creation** - Each execution creates isolated Daytona sandbox for tool operations

### Why Advanced Mode: The Gap Analysis

Based on analysis of Motion AI's Skill Builder and user needs for complex automation:

**Functional Gaps:**
- Cannot build workflows with multiple decision points leading to different paths
- No way to visualize or debug complex branching logic
- Limited to simple if/else, cannot do switch/case or semantic routing
- No formal variable system (e.g., "store email subject as `subject` and use it in step 5")
- Cannot model parallel operations or fan-out/fan-in patterns
- No execution monitoring (which step is running, what's the current state)

**User Experience Gaps:**
- Power users need visual programming capabilities (like n8n, Zapier, Motion AI)
- Debugging failures requires reading through message logs, not seeing workflow execution
- Sharing/documenting workflows is difficult without visual representation
- Onboarding new team members to complex workflows takes significant time

**Strategic Need:**
- Competitors (Motion AI, Relevance AI, n8n) offer visual workflow builders
- Enterprise users expect visual debugging and monitoring tools
- Advanced automation use cases (multi-step research, complex document processing) require graph-based workflows

**What Advanced Mode Enables:**
- Visual canvas showing the complete workflow graph at a glance
- Drag-and-drop construction of complex branching logic
- Real-time execution visualization (see which nodes are active/complete/failed)
- Formal variable management with scoping and autocomplete
- Support for semantic routing (LLM-based condition evaluation)
- Parallel execution paths and complex flow control
- Execution history and debugging tools

### Scope of This Feature

**In Scope (MVP):**
- Visual node-based editor using drag-and-drop
- Dual-mode system (Simple mode + Advanced mode)
- Support for branching via Rule-Based and LLM-Based condition nodes
- Variable management with @ symbol autocomplete
- Execution monitoring with real-time visual feedback
- Automatic conversion from Simple to Advanced mode (for linear workflows)
- Backward compatibility with all existing workflows

**Out of Scope (Post-MVP):**
- Real-time collaborative editing (multi-user simultaneously editing same workflow)
- Sub-workflows (workflows calling other workflows as nodes)
- Advanced loop constructs (for-each, while, until)
- Versioning UI and diff visualization
- Workflow templates marketplace
- External API integration nodes (beyond existing tool system)

**Explicitly NOT Changing:**
- Existing `agent_workflows` table structure (only adding columns)
- Current Simple mode UI (`ConditionalWorkflowBuilder` remains functional)
- Trigger system architecture
- Agent execution model (ThreadManager, Dramatiq, tools)
- Billing and access control patterns

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Basic Visual Workflow (Priority: P1)

As a workflow designer, I want to visually connect AI agent steps in a drag-and-drop canvas so that I can see and understand the flow of my automation without reading code or lists.

**Why this priority**: This is the foundation of the visual editor. Without the ability to create and visualize basic linear workflows, no other advanced features can be built. Delivers immediate value by making workflow creation more intuitive than the current list-based interface.

**Independent Test**: Can be fully tested by creating a 3-step workflow (trigger → AI generation → stop) using drag-and-drop nodes on a canvas, saving it, and reloading to verify the visual layout persists.

**Acceptance Scenarios**:

1. **Given** I am viewing an empty workflow canvas, **When** I drag a "Trigger" node from the palette and drop it onto the canvas, **Then** the trigger node appears at the drop position with connection handles visible
2. **Given** I have a trigger node on the canvas, **When** I drag an "AI Agent Step" node and connect it to the trigger, **Then** a visual edge appears connecting the two nodes showing the flow direction
3. **Given** I have created a multi-node workflow, **When** I save the workflow and navigate away, **Then** when I return to edit the workflow, all nodes appear in their exact saved positions with all connections preserved
4. **Given** I am editing a node on the canvas, **When** I change the node's label or configuration, **Then** the node updates in real-time without requiring a page refresh
5. **Given** I have multiple nodes on the canvas, **When** I pan and zoom the canvas, **Then** all nodes and connections maintain their relative positions and the viewport state is preserved

---

### User Story 2 - Configure AI Agent Steps Visually (Priority: P1)

As a workflow designer, I want to configure each AI agent step's behavior (model, prompt, tools) through a visual property panel so that I don't need to edit JSON or code to customize agent behavior.

**Why this priority**: Without the ability to configure what each step does, the visual workflow is just a diagram with no functionality. This enables users to build working workflows, making it a P1 requirement alongside the basic canvas.

**Independent Test**: Can be tested by creating a single AI agent step, opening its property panel, configuring model selection and prompt text, then executing the workflow to verify the step runs with the specified configuration.

**Acceptance Scenarios**:

1. **Given** I have selected an AI agent step node, **When** I view the property panel, **Then** I see configuration options for model selection, system prompt, user prompt, temperature, and available tools
2. **Given** I am configuring an AI step's prompt, **When** I type text into the prompt field, **Then** the node's preview updates to show a truncated version of the prompt text
3. **Given** I have configured an AI step with specific settings, **When** I save and execute the workflow, **Then** the AI agent runs using exactly the model and prompts I specified
4. **Given** I am editing a prompt field, **When** I reference dynamic data from previous steps by typing the @ symbol, **Then** an autocomplete dropdown appears showing all available variables from upstream steps, and when I select a variable, the system validates that the referenced data exists and highlights any errors

---

### User Story 3 - Add Conditional Branching (Priority: P2)

As a workflow designer, I want to add decision points that route execution to different paths based on conditions so that I can build workflows that handle different scenarios appropriately.

**Why this priority**: Branching is what separates linear workflows from truly intelligent automation. While P1 features enable basic visual workflows, branching unlocks complex use cases like "if email is urgent, escalate; else, draft response." This is the first "advanced" feature.

**Independent Test**: Can be tested by creating a workflow with a condition node that has two outgoing paths (true/false), defining a simple condition (e.g., "response contains keyword"), and verifying execution follows the correct path based on test data.

**Acceptance Scenarios**:

1. **Given** I drag a "Condition" node onto the canvas, **When** I connect it to a previous step, **Then** the condition node displays two output handles labeled "True" and "False"
2. **Given** I have selected a Rule-Based Condition node, **When** I open the property panel, **Then** I see options to define deterministic comparison rules (field equals value, contains text, greater than, etc.), **Or** when I select an LLM-Based Condition node, **Then** I see a text field to enter natural language condition descriptions (e.g., "if the response seems urgent or angry") that will be evaluated semantically using a mini LLM
3. **Given** I have configured a condition with "if response contains 'urgent'", **When** workflow execution reaches this node and the previous step's output contains "urgent", **Then** execution follows the "True" branch path
4. **Given** I have configured a condition, **When** the condition evaluation fails or produces an error, **Then** execution follows a default error path or fails gracefully with a logged error message
5. **Given** I have multiple condition nodes in a workflow, **When** I execute the workflow, **Then** each condition is evaluated independently based on the execution context at that point in the flow

---

### User Story 4 - Manage Workflow Variables (Priority: P2)

As a workflow designer, I want to define variables that can be set by triggers and used across multiple steps so that I can pass data through complex workflows without manual copying.

**Why this priority**: Variables are essential for non-trivial workflows. Without them, users cannot build workflows where one step's output influences multiple later steps, or where trigger data is used throughout. Required for most real-world use cases.

**Independent Test**: Can be tested by creating a workflow where a trigger sets a variable (e.g., "customer_email"), then using that variable in three different AI step prompts, and verifying all steps receive the correct value.

**Acceptance Scenarios**:

1. **Given** I am configuring a trigger node, **When** I define output variables (e.g., "email_subject", "sender_name"), **Then** these variables become available for reference in all downstream steps
2. **Given** I am editing an AI step's prompt, **When** I insert a variable reference, **Then** the system provides autocomplete suggestions for all available variables from upstream steps
3. **Given** I have a workflow with variables, **When** I execute the workflow, **Then** each step receives the current value of referenced variables from the execution context
4. **Given** an AI step produces output, **When** I configure how to store that output as a variable, **Then** downstream steps can reference that variable by name
5. **Given** I reference a variable that doesn't exist or isn't yet set, **When** I save the workflow, **Then** the system shows a validation error indicating which variables are missing or out of scope

---

### User Story 5 - Execute and Monitor Workflow Runs (Priority: P1)

As a workflow operator, I want to trigger workflow execution and see real-time progress through each step so that I can verify workflows are running correctly and troubleshoot failures.

**Why this priority**: Without execution visibility, users cannot tell if their workflows work or debug failures. This is essential for any workflow system and must be part of the MVP to deliver usable functionality.

**Independent Test**: Can be tested by creating a simple 3-step workflow, triggering execution, and observing that each node highlights as it executes, displays its output, and shows completion status (success/failure).

**Acceptance Scenarios**:

1. **Given** I have saved a complete workflow, **When** I trigger manual execution, **Then** the workflow starts running and the first node highlights to indicate active execution
2. **Given** a workflow is executing, **When** each step completes, **Then** the canvas shows which node is currently executing, which have completed successfully (green), and which failed (red)
3. **Given** a workflow step completes, **When** I click on that step node, **Then** I can view the step's input, output, execution time, and any error messages in a detail panel
4. **Given** a workflow execution fails at a step, **When** I view the failure details, **Then** I see a clear error message explaining what went wrong and what data was being processed
5. **Given** I have multiple workflow executions, **When** I view the workflow's execution history, **Then** I see a list of past runs with timestamps, status, and trigger source

---

### User Story 6 - Switch Between Simple and Advanced Modes (Priority: P3)

As a user, I want to choose between a simple list-based workflow editor and the advanced visual canvas so that beginners can use simple workflows while power users can build complex ones.

**Why this priority**: Maintains backward compatibility and provides a gentler learning curve for new users. However, the advanced editor is the primary value, so this is lower priority - can be added after the visual editor is solid.

**Independent Test**: Can be tested by creating a workflow in simple mode, switching to advanced mode to see it visualized, making changes in advanced mode, then switching back to simple mode to verify the workflow still works.

**Acceptance Scenarios**:

1. **Given** I am creating a new workflow, **When** I choose "Simple Mode", **Then** I see the existing list-based editor for creating linear workflows
2. **Given** I have a simple linear workflow, **When** I switch to "Advanced Mode", **Then** the system automatically converts the list into a visual graph with nodes arranged top-to-bottom
3. **Given** I have built a workflow with branching in advanced mode, **When** I attempt to switch to simple mode, **Then** the system prevents the switch and explains that branching workflows require advanced mode
4. **Given** I am in advanced mode, **When** I create a purely linear workflow (no branches or conditions), **Then** I have the option to switch to simple mode for easier editing

---

### User Story 7 - Auto-Layout Complex Workflows (Priority: P3)

As a workflow designer, I want to automatically arrange a messy or imported workflow into a clean hierarchical layout so that I can quickly understand complex workflows without manually repositioning nodes.

**Why this priority**: Nice-to-have quality-of-life feature. Users can manually arrange nodes, so this is not critical for MVP functionality. Primarily useful when importing workflows from templates or dealing with very large workflows.

**Independent Test**: Can be tested by creating a workflow with 10+ randomly positioned nodes, clicking "Auto-Layout", and verifying nodes are rearranged into a clean top-to-bottom hierarchy with no overlapping nodes or crossed edges.

**Acceptance Scenarios**:

1. **Given** I have a workflow with nodes in random positions, **When** I click "Auto-Layout", **Then** nodes are rearranged into a hierarchical tree structure with trigger at top and consistent spacing
2. **Given** I have a workflow with parallel branches, **When** I auto-layout, **Then** parallel paths are arranged side-by-side rather than overlapping
3. **Given** I have manually positioned nodes, **When** I auto-layout, **Then** I receive a warning that manual positions will be lost and must confirm before proceeding

---

### Edge Cases

- **What happens when a user creates a circular reference** (node A → node B → node A)?
  System must detect cycles during save validation and prevent saving with a clear error message indicating which nodes form the cycle.

- **What happens when a workflow has no trigger node?**
  System prevents saving and shows validation error: "Workflow must have exactly one trigger node to define how execution starts."

- **What happens when a workflow has disconnected subgraphs** (orphaned nodes not connected to the main flow)?
  System warns during save that nodes X, Y, Z are unreachable from the trigger and will never execute. User can either connect them or delete them.

- **What happens when a step times out or the AI service is unavailable?**
  The system automatically retries failed steps using the existing LLM fallback system. For mini LLM features (semantic branching, condition evaluation), a new fallback model group is configured to ensure reliable execution even when primary models are unavailable. If all fallbacks are exhausted, execution stops at that step, marks it as failed, and logs the error.

- **What happens when execution reaches a condition node but the condition cannot be evaluated** (e.g., references a variable that wasn't set)?
  Condition evaluates to false by default (follows the "False" path) and logs a warning, OR fails execution with an error depending on user's error handling configuration.

- **What happens when a user deletes a node that other nodes depend on for variables?**
  System immediately shows validation warnings on all dependent nodes indicating that referenced variables are no longer available. User must fix references before saving.

- **What happens when a workflow has multiple end points** (multiple branches end without connecting)?
  This is valid - execution simply terminates when reaching any end point. Not all branches need to converge.

- **What happens when a user tries to connect incompatible node types** (e.g., connecting a True output to a Stop node)?
  System allows the connection - all node types can connect to most other types. Only restriction is that triggers cannot have incoming connections.

- **What happens when execution context becomes too large** (hundreds of variables or large outputs)?
  System enforces a maximum context size (e.g., 1MB of execution state). If exceeded, older step outputs are summarized or truncated, with full data still accessible in logs.

## Requirements *(mandatory)*

### Backward Compatibility Requirements

These requirements ensure the Advanced Workflow Builder integrates seamlessly with the existing Suna Kortix platform without breaking current functionality.

#### Database Schema Compatibility

- **FR-BC-001**: System MUST extend the existing `agent_workflows` table by adding new columns (`mode`, `graph_definition`, `compiled_logic`) without modifying or removing existing columns
- **FR-BC-002**: System MUST preserve the existing `steps` JSONB column for simple mode workflows
- **FR-BC-003**: System MUST default new workflows to `mode='simple'` to maintain backward compatibility
- **FR-BC-004**: System MUST allow existing workflows (those with `steps` but no `mode` column) to continue functioning by treating them as simple mode workflows
- **FR-BC-005**: System MUST apply the same Row-Level Security (RLS) policies to advanced mode workflows as simple mode workflows using `basejump.has_role_on_account()`

#### API Compatibility

- **FR-BC-006**: System MUST preserve all existing workflow CRUD API endpoints (`GET/POST/PUT/DELETE /workflows/agents/{id}/workflows`)
- **FR-BC-007**: System MUST return the `mode` field in workflow API responses to allow clients to determine which editor to use
- **FR-BC-008**: System MUST accept both `steps` (simple mode) and `graph_definition`/`compiled_logic` (advanced mode) in workflow update requests
- **FR-BC-009**: System MUST continue to support the existing workflow execution endpoint (`POST /workflows/agents/{id}/workflows/{wf_id}/execute`)
- **FR-BC-010**: System MUST maintain backward compatibility with existing trigger → workflow execution flow

#### Version Synchronization Compatibility

- **FR-BC-011**: System MUST call `sync_workflows_to_version_config()` after creating, updating, or deleting workflows (both simple and advanced modes)
- **FR-BC-012**: System MUST store advanced mode workflows in `agent_versions.config.workflows` using a format that includes the `mode` field and appropriate data (`steps` for simple, `compiled_logic` for advanced)
- **FR-BC-013**: System MUST preserve version history when converting a simple workflow to advanced mode

#### Execution Compatibility

- **FR-BC-014**: System MUST use the existing `execution_service.py` for creating threads, projects, and sandboxes regardless of workflow mode
- **FR-BC-015**: System MUST enqueue workflow execution via the existing Dramatiq `run_agent_background` task
- **FR-BC-016**: System MUST execute simple mode workflows using the existing LLM-interpreted execution model (convert `steps` to structured prompts)
- **FR-BC-017**: System MUST execute advanced mode workflows using a new `GraphExecutor` that traverses `compiled_logic`
- **FR-BC-018**: System MUST pass workflow context (trigger payloads, variables) to advanced workflows in the same format as simple workflows
- **FR-BC-019**: System MUST respect existing billing checks (`billing_integration.check_model_and_billing_access()`) before executing advanced workflows

#### Frontend Compatibility

- **FR-BC-020**: System MUST preserve the existing `ConditionalWorkflowBuilder` component for editing simple mode workflows
- **FR-BC-021**: System MUST reuse the existing `useAgentWorkflows()` React Query hook for fetching workflow data in both modes
- **FR-BC-022**: System MUST reuse the existing `workflow-utils.ts` API client functions for CRUD operations
- **FR-BC-023**: System MUST provide a mode switcher UI that allows users to toggle between Simple and Advanced mode editors
- **FR-BC-024**: System MUST prevent users from switching to simple mode if a workflow contains advanced-mode-only features (branching, multiple conditions, etc.)

#### Tool Integration Compatibility

- **FR-BC-025**: Advanced mode AI step nodes MUST support calling the same AgentPress tools available in simple mode via the tool registry
- **FR-BC-026**: Tool calls from advanced workflows MUST execute using the same tool execution mechanisms as simple workflows (via ThreadManager)
- **FR-BC-027**: Tool outputs from advanced workflows MUST be stored in thread messages using the same format as simple workflows

### Functional Requirements

#### Visual Editor Core

- **FR-001**: System MUST provide a drag-and-drop canvas interface for creating workflows visually
- **FR-002**: System MUST support panning and zooming the workflow canvas to navigate large workflows
- **FR-003**: System MUST provide a component palette containing all available node types (triggers, AI steps, conditions, loops, stops)
- **FR-004**: System MUST allow users to drag nodes from the palette onto the canvas at a specific position
- **FR-005**: System MUST allow users to connect nodes by dragging from one node's output handle to another node's input handle
- **FR-006**: System MUST visually display the direction of workflow execution through edge arrows
- **FR-007**: System MUST allow users to delete nodes and edges using keyboard shortcuts or context menus
- **FR-008**: System MUST allow users to select multiple nodes for bulk operations (delete, move)
- **FR-009**: System MUST save the exact visual layout (node positions, zoom level, viewport position) when a workflow is saved
- **FR-010**: System MUST restore the exact visual layout when a workflow is loaded for editing

#### Node Configuration

- **FR-011**: System MUST display a property panel when a node is selected showing that node's configuration options
- **FR-012**: System MUST provide node-specific configuration forms based on node type (AI steps have model/prompt fields, conditions have rule builders, etc.)
- **FR-013**: System MUST update node visual preview in real-time as configuration changes are made
- **FR-014**: System MUST validate node configuration before allowing save (e.g., required fields are filled)
- **FR-015**: System MUST visually indicate invalid nodes with warning icons or color coding

#### AI Agent Steps

- **FR-016**: AI agent step nodes MUST allow selection of which AI model to use for that step
- **FR-017**: AI agent step nodes MUST provide fields for defining system prompt (agent persona/instructions)
- **FR-018**: AI agent step nodes MUST provide fields for defining user prompt (the actual query sent to the AI)
- **FR-019**: AI agent step nodes MUST allow users to reference dynamic variables within prompts
- **FR-020**: AI agent step nodes MUST allow configuration of which tools are available to the agent during that step
- **FR-021**: AI agent step nodes MUST allow configuration of model parameters (temperature, max tokens, etc.)

#### Conditional Logic

- **FR-022**: System MUST provide two distinct condition node types: Rule-Based Condition nodes and LLM-Based Condition nodes
- **FR-023**: Both condition node types MUST support two outgoing paths (true and false branches)
- **FR-024**: Rule-Based Condition nodes MUST allow users to define deterministic comparison rules (equals, contains, greater than, less than, etc.)
- **FR-025**: LLM-Based Condition nodes MUST allow users to enter natural language condition descriptions that are evaluated semantically using a mini LLM
- **FR-026**: LLM-Based Condition nodes MUST use a dedicated fallback model group configured for mini LLM features (semantic branching, micro-flows)
- **FR-027**: System MUST evaluate conditions during workflow execution and route to the appropriate branch based on the result
- **FR-028**: System MUST handle condition evaluation errors gracefully (either fail execution or follow default path)

#### Variable Management

- **FR-029**: System MUST allow trigger nodes to define what variables they expose to the workflow (e.g., email subject, sender, body)
- **FR-030**: System MUST allow AI step nodes to store their output as a named variable for use in downstream steps
- **FR-031**: System MUST provide @ symbol autocomplete UI when users reference variables in prompts, showing all available variables from upstream steps
- **FR-032**: System MUST validate that all referenced variables exist and are accessible from that point in the workflow
- **FR-033**: System MUST maintain an execution context that stores all variable values during a workflow run
- **FR-034**: System MUST support accessing nested data within variables using a path syntax

#### Workflow Execution

- **FR-035**: System MUST store both the visual representation AND a compiled logical execution plan when a workflow is saved
- **FR-036**: System MUST execute workflows based on the logical execution plan, not the visual representation
- **FR-037**: System MUST start execution at the designated trigger node
- **FR-038**: System MUST execute nodes in the order defined by the graph edges, respecting branching and conditional logic
- **FR-039**: System MUST enforce a maximum execution step limit to prevent infinite loops
- **FR-040**: System MUST enforce a maximum execution time limit per workflow run
- **FR-041**: System MUST log each step's execution including inputs, outputs, execution time, and status
- **FR-042**: System MUST stop execution when reaching a Stop node or when no more nodes are reachable
- **FR-043**: System MUST automatically retry failed steps using the existing LLM fallback system, with a dedicated fallback model group for mini LLM operations

#### Execution Monitoring

- **FR-044**: System MUST provide real-time visual feedback on the canvas showing which node is currently executing
- **FR-045**: System MUST update node status indicators as each step completes (success, failure, skipped)
- **FR-046**: System MUST allow users to view detailed execution results for each step (input, output, logs, errors)
- **FR-047**: System MUST maintain an execution history showing past workflow runs with timestamps and outcomes
- **FR-048**: System MUST allow users to view execution logs and debug information for failed runs

#### Workflow Validation

- **FR-049**: System MUST validate workflows before allowing save, checking for: missing trigger, disconnected nodes, circular references, invalid variable references
- **FR-050**: System MUST display clear validation error messages indicating exactly what needs to be fixed
- **FR-051**: System MUST prevent execution of invalid workflows
- **FR-052**: System MUST allow saving of incomplete workflows (for work-in-progress) but mark them as "Draft" and prevent execution until valid

#### Mode Switching

- **FR-053**: System MUST support two distinct editor modes: Simple (list-based) and Advanced (visual canvas)
- **FR-054**: System MUST allow users to switch from Simple to Advanced mode for linear workflows
- **FR-055**: System MUST automatically convert linear list-based workflows into visual graph format when switching to Advanced mode
- **FR-056**: System MUST prevent switching from Advanced to Simple mode when workflow contains non-linear features (branching, conditions, loops)
- **FR-057**: System MUST preserve all workflow functionality when converting between modes for linear workflows

#### Auto-Layout

- **FR-058**: System MUST provide an auto-layout function that arranges nodes into a clean hierarchical structure
- **FR-059**: Auto-layout MUST arrange nodes top-to-bottom with trigger at the top
- **FR-060**: Auto-layout MUST position parallel branches side-by-side to avoid overlaps
- **FR-061**: Auto-layout MUST warn users that manual positions will be lost before executing

### Key Entities

- **Workflow**: Represents a complete automation definition including nodes, edges, configuration, and metadata (name, description, created date, mode)
  - **Platform Integration**: Stored in existing `agent_workflows` table, extends it without breaking existing workflows
  - **Mode Differentiation**: Can be in "simple" mode (uses `steps` JSONB column) or "advanced" mode (uses `graph_definition` + `compiled_logic` columns)
  - **Simple Mode**: Linear list of steps stored as JSONB array in `steps` column, edited via `ConditionalWorkflowBuilder`
  - **Advanced Mode**: Visual graph stored in `graph_definition` (nodes with x/y positions, edges, viewport) and compiled execution logic in `compiled_logic` (adjacency map for GraphExecutor)
  - **Trigger Node**: Advanced mode has exactly one trigger node that defines how execution starts
  - **Version Synchronization**: Changes are automatically synced to `agent_versions.config.workflows` after create/update/delete operations
  - **Ownership**: Belongs to an agent (via `agent_id` foreign key), inherits account permissions via Row-Level Security
  - **Execution**: Can be triggered manually, via trigger phrase, webhook, or schedule through the trigger system

- **Node**: Represents a single step or decision point in a workflow
  - Has a unique identifier within the workflow
  - Has a type (trigger, AI step, condition, loop, stop)
  - Has type-specific configuration data (model settings for AI steps, rules for conditions)
  - Has a visual position (x, y coordinates) on the canvas
  - Has zero or more incoming connections and zero or more outgoing connections
  - Can be marked as valid/invalid based on configuration completeness

- **Edge**: Represents a connection between two nodes defining execution flow
  - Connects a source node to a target node
  - May have a condition label (for condition node branches: "true", "false", "default")
  - Defines the order of execution in the workflow
  - Has visual properties (curve style, animation)

- **Variable**: Represents a piece of data available during workflow execution
  - Has a name/identifier unique within the workflow execution context
  - Has a value that may be a string, number, boolean, object, or array
  - Originates from either a trigger (input data) or a step output
  - Has a scope defined by graph topology (only accessible to downstream nodes)

- **Execution Run**: Represents a single execution instance of a workflow
  - Has a unique identifier
  - Tracks which workflow and workflow version was executed
  - Stores trigger input data that started the execution
  - Maintains execution context (all variable values) throughout the run
  - Records step-by-step execution log with inputs, outputs, timing, and status
  - Has an overall status (running, completed, failed)
  - Tracks start time, end time, and total execution duration

- **Execution Context**: The runtime state during a workflow execution
  - Contains all variable values at the current point in execution
  - Contains references to all previous step outputs
  - Enforces variable scope (variables only accessible from reachable nodes)
  - Persists across the entire execution run

- **Trigger Configuration**: Defines how a workflow is initiated
  - Specifies trigger type (manual, webhook, schedule, email, etc.)
  - Defines what input variables are exposed to the workflow
  - Contains trigger-specific settings (webhook URL, cron schedule, email filters)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a complete 5-step visual workflow (trigger → 3 AI steps → stop) in under 5 minutes without consulting documentation
- **SC-002**: The visual canvas renders and remains interactive with up to 100 nodes without noticeable lag (60fps interaction)
- **SC-003**: Workflow execution completes successfully for valid workflows with a 99% success rate (excluding intentional test failures)
- **SC-004**: Users can understand a complex workflow's logic by viewing the visual canvas alone (no need to read code or documentation) - measured by task comprehension tests showing 80%+ accuracy
- **SC-005**: Workflow save and load operations complete in under 2 seconds for workflows up to 50 nodes
- **SC-006**: Users successfully debug failed workflow executions using execution logs and visual status indicators 90% of the time without needing developer support
- **SC-007**: The system prevents 100% of invalid workflows from executing (all validation rules are enforced)
- **SC-008**: Workflow execution time is within 10% of the theoretical minimum (sum of AI step response times + negligible overhead for graph traversal)
- **SC-009**: Users report higher satisfaction with visual workflow builder compared to list-based editor (measured by NPS score improvement of 20+ points)
- **SC-010**: Complex workflows with branching logic are created 3x faster using the visual editor compared to JSON/code-based alternatives

## Technical Architecture Note

This section clarifies how the Advanced Workflow Builder integrates with the existing Suna Kortix execution architecture.

### Dual Execution Model

The system supports two execution paths depending on workflow mode:

**Simple Mode Execution (Existing):**
```
1. Trigger Event (manual/webhook/schedule)
2. execution_service.verify_and_authorize_trigger_agent_access(agent_id, user_id)
3. execution_service.create_thread_and_project(agent_id, trigger_payload)
4. Create Daytona sandbox for isolated tool execution
5. Insert initial message with workflow context
6. Convert workflow.steps (JSONB array) to structured LLM prompt
7. Enqueue Dramatiq task: run_agent_background(thread_id, agent_config)
8. ThreadManager.run_thread() processes the LLM-interpreted workflow
9. Agent calls tools via tool_registry as needed
10. Results stored in thread.messages
```

**Advanced Mode Execution (New):**
```
1. Trigger Event (manual/webhook/schedule)
2. execution_service.verify_and_authorize_trigger_agent_access(agent_id, user_id)
3. execution_service.create_thread_and_project(agent_id, trigger_payload)
4. Create Daytona sandbox for isolated tool execution
5. Insert initial message with workflow context
6. Load workflow.compiled_logic (adjacency map)
7. Enqueue Dramatiq task: run_agent_background(thread_id, agent_config)
8. GraphExecutor.execute(compiled_logic, context) - NEW component
   - Traverses graph from start_node_id
   - Executes each node (LLM calls, tool calls, conditions)
   - Routes based on edges and condition results
   - Maintains execution context (variables)
9. Results stored in thread.messages + execution logs
```

### Mode Detection Logic

```
IF workflow.mode IS NULL OR workflow.mode = 'simple':
    Use LLM-interpreted execution (existing)
    Convert workflow.steps to structured prompt

ELSE IF workflow.mode = 'advanced':
    Use GraphExecutor (new)
    Traverse workflow.compiled_logic
```

### Data Storage Strategy

**Simple Mode:**
- `workflow.steps`: JSONB array of WorkflowStep objects
- `workflow.mode`: `'simple'` or NULL (for backward compatibility)
- Frontend: `ConditionalWorkflowBuilder` component
- Backend: Existing execution logic in `execution_service.py`

**Advanced Mode:**
- `workflow.graph_definition`: JSONB containing React Flow nodes/edges/viewport (for UI rendering)
- `workflow.compiled_logic`: JSONB containing adjacency map (for execution)
- `workflow.mode`: `'advanced'`
- Frontend: New `AdvancedWorkflowBuilder` component with React Flow
- Backend: New `GraphExecutor` service for graph traversal

### Version Synchronization Flow

```
Workflow Create/Update/Delete
  ↓
API endpoint (POST/PUT/DELETE /workflows/agents/{id}/workflows)
  ↓
Database: Update agent_workflows table
  ↓
trigger_service.sync_workflows_to_version_config(agent_id)
  ↓
Copy workflow data to agent_versions.config.workflows
  ↓
  IF simple mode: Copy workflow.steps
  IF advanced mode: Copy workflow.compiled_logic + workflow.mode
```

This ensures version history captures the execution logic, not just the UI state.

### Tool Integration Flow

Both simple and advanced workflows use the same tool execution mechanism:

```
Workflow requests tool execution
  ↓
ThreadManager.execute_tool_call(tool_name, parameters)
  ↓
tool_registry.get_tool(tool_name)
  ↓
Tool executes in Daytona sandbox
  ↓
Result returned to workflow execution context
  ↓
Stored in thread.messages
```

**Key Principle**: Tools don't know or care if they're being called from simple or advanced workflows.

## Assumptions *(mandatory)*

1. **User Technical Level**: Assumes target users are comfortable with drag-and-drop interfaces (similar to tools like Figma, Miro, or Zapier) but may not be programmers
2. **Workflow Complexity**: Assumes most workflows will have 5-20 nodes, with some power users creating workflows up to 100 nodes
3. **Execution Environment**: Assumes workflows execute in an environment where AI service API calls may take 2-30 seconds per step, so total execution time for large workflows may be several minutes
4. **Browser Capabilities**: Assumes users are on modern browsers (Chrome, Firefox, Safari, Edge) with JavaScript enabled and screen resolution of at least 1280x720
5. **Network Connectivity**: Assumes stable internet connection for real-time visual editing and execution monitoring
6. **Data Size**: Assumes individual step outputs are typically under 10KB of text, with occasional larger outputs (documents, images) up to 1MB
7. **Concurrent Editing**: Assumes single-user editing (no real-time collaboration) for MVP - one user edits a workflow at a time
8. **Backward Compatibility**: Assumes existing simple workflows must continue working without modification after this feature is deployed
9. **Error Recovery**: System provides automatic retry using existing LLM fallback mechanisms, plus visibility into failures through execution logs and status indicators
10. **Variable Types**: Assumes variables are primarily text/string data with basic support for structured objects, but not complex binary data
11. **Database Schema Evolution**: Advanced mode extends the existing `agent_workflows` table by adding columns (`mode`, `graph_definition`, `compiled_logic`) rather than creating new normalized tables, following Suna Kortix's JSONB flexibility philosophy
12. **Agent Versioning**: Workflow changes (create, update, delete) must synchronize to `agent_versions.config.workflows` to maintain version history and enable rollback capabilities
13. **Execution Model Coexistence**: Advanced workflows use a new `GraphExecutor` for graph traversal while simple workflows maintain the existing LLM-interpreted execution model (converting `steps` to structured prompts)
14. **Billing & Access Control**: Model access verification via `billing_integration.check_model_and_billing_access()` and Row-Level Security via `basejump.has_role_on_account()` apply to both simple and advanced workflows
15. **Tool System Integration**: Advanced mode AI steps can call any tool registered in the AgentPress tool registry (`backend/core/tools/`), using the same tool execution mechanisms as simple workflows
