# API Endpoints Contract

**Feature**: Advanced Visual Workflow Builder
**Version**: 1.0.0
**Created**: 2025-11-23
**Base URL**: `/api`

## Overview

REST API contract for Advanced Visual Workflow system. All endpoints require authentication via Supabase JWT token. All responses follow standard AgentPress error handling patterns.

---

## Workflow Management

### GET /workflows/:workflowId

**Description**: Retrieve workflow with graph definition and compiled logic
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-001 (Open existing workflow), FR-BC-004 (Mode field)

**Response 200**:
```json
{
  "id": "uuid",
  "agent_id": "uuid",
  "account_id": "uuid",
  "mode": "advanced",
  "steps": null,
  "graph_definition": {
    "nodes": [
      {
        "id": "node_1",
        "type": "ai_step",
        "position": { "x": 100, "y": 100 },
        "data": {
          "label": "Research Topic",
          "config": {
            "prompt": "Research the topic: @trigger.topic",
            "model": "claude-3-5-sonnet-20241022",
            "tools": ["web_search"],
            "output_variable": "research_results"
          }
        }
      }
    ],
    "edges": [
      {
        "id": "edge_1",
        "source": "node_1",
        "target": "node_2",
        "type": "default"
      }
    ],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "compiled_logic": {
    "version": "1.0.0",
    "start_node_id": "node_1",
    "nodes": {
      "node_1": {
        "id": "node_1",
        "type": "ai_step",
        "config": { "prompt": "Research the topic: @trigger.topic" },
        "next_nodes": ["node_2"],
        "output_variable": "research_results"
      }
    },
    "variables": [
      {
        "name": "research_results",
        "type": "string",
        "source_node_id": "node_1"
      }
    ]
  },
  "created_at": "2025-11-23T10:00:00Z",
  "updated_at": "2025-11-23T12:30:00Z"
}
```

**Error Responses**:
- `404`: Workflow not found
- `403`: User lacks access to workflow's account
- `500`: Database or internal error

---

### PUT /workflows/:workflowId

**Description**: Update workflow graph definition and recompile logic
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-002 (Save workflow), FR-BC-005 (Dual-state storage)

**Request Body**:
```json
{
  "graph_definition": {
    "nodes": [...],
    "edges": [...],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

**Response 200**:
```json
{
  "id": "uuid",
  "graph_definition": { ... },
  "compiled_logic": { ... },
  "updated_at": "2025-11-23T12:35:00Z",
  "validation_warnings": [
    {
      "severity": "warning",
      "node_id": "node_5",
      "message": "Variable @step3_output referenced but step may not execute in all paths"
    }
  ]
}
```

**Error Responses**:
- `400`: Invalid graph_definition schema
- `422`: Validation failed (circular references, orphaned nodes)
- `403`: User lacks write access
- `404`: Workflow not found

---

### POST /workflows/:workflowId/validate

**Description**: Validate graph definition without saving
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-041 (Validation engine)

**Request Body**:
```json
{
  "graph_definition": { ... }
}
```

**Response 200**:
```json
{
  "valid": false,
  "errors": [
    {
      "severity": "error",
      "node_id": "node_3",
      "code": "CIRCULAR_REFERENCE",
      "message": "Circular reference detected: node_3 → node_5 → node_7 → node_3"
    }
  ],
  "warnings": [
    {
      "severity": "warning",
      "node_id": "node_9",
      "code": "ORPHANED_NODE",
      "message": "Node has no incoming edges and is not the start node"
    }
  ]
}
```

**Error Responses**:
- `400`: Invalid request body schema

---

### POST /workflows/:workflowId/compile

**Description**: Compile graph_definition to compiled_logic without saving
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-BC-005 (Dual-state storage)

**Request Body**:
```json
{
  "graph_definition": { ... }
}
```

**Response 200**:
```json
{
  "compiled_logic": {
    "version": "1.0.0",
    "start_node_id": "node_1",
    "nodes": { ... },
    "variables": [ ... ]
  },
  "compilation_warnings": []
}
```

**Error Responses**:
- `400`: Graph validation failed (must pass validation before compilation)

---

### POST /workflows

**Description**: Create new advanced workflow
**Authorization**: User must have account membership
**Maps to**: FR-001 (Create workflow)

**Request Body**:
```json
{
  "agent_id": "uuid",
  "mode": "advanced",
  "graph_definition": {
    "nodes": [
      {
        "id": "start_node",
        "type": "start",
        "position": { "x": 250, "y": 50 },
        "data": { "label": "Start" }
      }
    ],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "agent_id": "uuid",
  "mode": "advanced",
  "graph_definition": { ... },
  "compiled_logic": { ... },
  "created_at": "2025-11-23T13:00:00Z"
}
```

**Error Responses**:
- `400`: Invalid request body
- `403`: User lacks account access
- `404`: Agent not found

---

### POST /workflows/:workflowId/mode

**Description**: Convert workflow between simple and advanced modes
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-035 (One-way conversion simple → advanced)

**Request Body**:
```json
{
  "target_mode": "advanced"
}
```

**Response 200**:
```json
{
  "id": "uuid",
  "mode": "advanced",
  "graph_definition": {
    "nodes": [
      {
        "id": "step_1_converted",
        "type": "ai_step",
        "position": { "x": 100, "y": 100 },
        "data": {
          "label": "Step 1 (Converted)",
          "config": { /* Original step config */ }
        }
      }
    ],
    "edges": [ /* Sequential connections */ ]
  },
  "steps": null,
  "conversion_notes": [
    "3 steps converted to sequential AI Step nodes",
    "Original step order preserved"
  ]
}
```

**Error Responses**:
- `400`: Invalid target_mode or conversion not supported (advanced → simple blocked)
- `422`: Workflow contains features incompatible with target mode

---

## Execution Management

### POST /workflows/:workflowId/execute

**Description**: Execute workflow with trigger context
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-027 (Start execution), FR-BC-007 (Router)

**Request Body**:
```json
{
  "trigger_context": {
    "source": "manual",
    "topic": "AI in healthcare",
    "user_email": "user@example.com"
  },
  "thread_id": "uuid (optional, creates new thread if omitted)"
}
```

**Response 202**:
```json
{
  "execution_id": "uuid",
  "thread_id": "uuid",
  "status": "running",
  "started_at": "2025-11-23T14:00:00Z",
  "monitor_url": "/api/workflows/executions/{execution_id}/stream"
}
```

**Error Responses**:
- `400`: Invalid trigger_context
- `404`: Workflow not found
- `422`: Workflow validation failed

---

### GET /workflows/executions/:executionId/stream

**Description**: Server-Sent Events stream for real-time execution monitoring
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-030 (Real-time monitoring)

**Response**: `text/event-stream`

```
event: node_started
data: {"node_id": "node_1", "label": "Research Topic", "timestamp": "2025-11-23T14:00:01Z"}

event: node_progress
data: {"node_id": "node_1", "message": "Calling web_search tool...", "timestamp": "2025-11-23T14:00:03Z"}

event: node_completed
data: {"node_id": "node_1", "output": "Research complete", "timestamp": "2025-11-23T14:00:15Z"}

event: execution_completed
data: {"status": "success", "duration_ms": 45000, "timestamp": "2025-11-23T14:00:45Z"}
```

**Event Types**:
- `execution_started`: Workflow execution began
- `node_started`: Node execution started
- `node_progress`: Progress update within node (tool calls, LLM streaming)
- `node_completed`: Node execution completed
- `node_failed`: Node execution failed with error
- `execution_paused`: Execution paused (e.g., awaiting human input)
- `execution_completed`: Workflow execution finished (success)
- `execution_failed`: Workflow execution failed (error)

**Error Responses**:
- `404`: Execution not found
- `403`: User lacks access

---

### GET /workflows/executions/:executionId

**Description**: Get execution status and history
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-028 (View execution status)

**Response 200**:
```json
{
  "id": "uuid",
  "workflow_id": "uuid",
  "thread_id": "uuid",
  "status": "completed",
  "started_at": "2025-11-23T14:00:00Z",
  "completed_at": "2025-11-23T14:00:45Z",
  "duration_ms": 45000,
  "trigger_context": { "source": "manual", "topic": "AI in healthcare" },
  "execution_log": [
    {
      "timestamp": "2025-11-23T14:00:01Z",
      "event_type": "node_started",
      "node_id": "node_1",
      "details": { "label": "Research Topic" }
    },
    {
      "timestamp": "2025-11-23T14:00:15Z",
      "event_type": "node_completed",
      "node_id": "node_1",
      "details": { "output_length": 1500 }
    }
  ],
  "final_output": {
    "variables": {
      "research_results": "...",
      "summary": "..."
    },
    "thread_url": "/threads/uuid"
  },
  "error": null
}
```

**Error Responses**:
- `404`: Execution not found

---

### POST /workflows/executions/:executionId/pause

**Description**: Pause running workflow execution
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-029 (Pause/resume execution)

**Response 200**:
```json
{
  "id": "uuid",
  "status": "paused",
  "paused_at": "2025-11-23T14:05:00Z",
  "current_node_id": "node_5"
}
```

---

### POST /workflows/executions/:executionId/resume

**Description**: Resume paused workflow execution
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-029 (Pause/resume execution)

**Response 200**:
```json
{
  "id": "uuid",
  "status": "running",
  "resumed_at": "2025-11-23T14:10:00Z"
}
```

---

## Variable Management

### GET /workflows/:workflowId/variables

**Description**: Get all variables available in workflow
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-031 (Autocomplete system)

**Response 200**:
```json
{
  "variables": [
    {
      "name": "trigger.topic",
      "type": "string",
      "source": "trigger",
      "description": "Topic from trigger context"
    },
    {
      "name": "research_results",
      "type": "string",
      "source_node_id": "node_1",
      "source_node_label": "Research Topic",
      "description": "Output from Research Topic step"
    },
    {
      "name": "summary",
      "type": "string",
      "source_node_id": "node_3",
      "source_node_label": "Summarize Findings"
    }
  ]
}
```

---

### POST /workflows/:workflowId/variables/validate

**Description**: Validate variable references in prompt
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-033 (Variable validation)

**Request Body**:
```json
{
  "node_id": "node_5",
  "prompt": "Write a report using @research_results and @summary. Send to @trigger.email"
}
```

**Response 200**:
```json
{
  "valid": true,
  "variables_found": ["research_results", "summary", "trigger.email"],
  "warnings": [
    {
      "variable": "research_results",
      "message": "Variable may be undefined if upstream condition fails"
    }
  ],
  "errors": []
}
```

**Error 422**:
```json
{
  "valid": false,
  "errors": [
    {
      "variable": "nonexistent_var",
      "message": "Variable @nonexistent_var not found in workflow"
    }
  ]
}
```

---

## Canvas Operations

### POST /workflows/:workflowId/auto-layout

**Description**: Calculate auto-layout positions for graph
**Authorization**: User must have `has_role_on_account()` for workflow's account
**Maps to**: FR-038 (Auto-layout)

**Request Body**:
```json
{
  "graph_definition": { ... },
  "layout_direction": "TB",
  "preserve_viewport": false
}
```

**Response 200**:
```json
{
  "graph_definition": {
    "nodes": [
      {
        "id": "node_1",
        "position": { "x": 250, "y": 50 },
        "...": "..."
      }
    ],
    "edges": [ ... ],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

---

## Node Templates

### GET /workflows/node-templates

**Description**: Get available node types and their default configurations
**Authorization**: Authenticated user
**Maps to**: FR-003 (Node palette)

**Response 200**:
```json
{
  "templates": [
    {
      "type": "ai_step",
      "display_name": "AI Step",
      "icon": "brain",
      "color": "blue",
      "default_config": {
        "prompt": "",
        "model": "claude-3-5-sonnet-20241022",
        "tools": [],
        "output_variable": ""
      },
      "schema": {
        "prompt": { "type": "string", "required": true },
        "model": { "type": "string", "enum": ["claude-3-5-sonnet-20241022", "gpt-4o"] },
        "tools": { "type": "array", "items": { "type": "string" } }
      }
    },
    {
      "type": "rule_condition",
      "display_name": "Rule-Based Condition",
      "icon": "git-branch",
      "color": "purple",
      "default_config": {
        "rules": [
          {
            "variable": "",
            "operator": "equals",
            "value": "",
            "next_node_id": ""
          }
        ],
        "default_next_node_id": null
      }
    },
    {
      "type": "llm_condition",
      "display_name": "LLM-Based Condition",
      "icon": "sparkles",
      "color": "purple",
      "default_config": {
        "context_prompt": "",
        "branches": [
          { "label": "Branch A", "description": "", "next_node_id": "" }
        ],
        "model": "gpt-4o-mini"
      }
    }
  ]
}
```

---

## Error Response Format

All errors follow standard format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Circular reference detected in workflow graph",
    "details": {
      "cycle_path": ["node_3", "node_5", "node_7", "node_3"],
      "affected_nodes": ["node_3", "node_5", "node_7"]
    }
  }
}
```

**Standard Error Codes**:
- `VALIDATION_ERROR`: Graph validation failed
- `CIRCULAR_REFERENCE`: Circular dependency detected
- `ORPHANED_NODE`: Node unreachable from start
- `UNDEFINED_VARIABLE`: Variable reference not found
- `COMPILATION_ERROR`: Graph compilation failed
- `EXECUTION_ERROR`: Runtime execution error
- `AUTHENTICATION_ERROR`: Invalid or missing JWT token
- `AUTHORIZATION_ERROR`: User lacks required permissions
- `NOT_FOUND`: Resource not found
- `INTERNAL_ERROR`: Server error

---

## Rate Limiting

- **Execution endpoints**: 10 requests/minute per user
- **Validation endpoints**: 60 requests/minute per user
- **Read endpoints**: 120 requests/minute per user

Rate limit headers included in all responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1732368000
```

---

## Versioning

API version specified in Accept header:
```
Accept: application/vnd.suna.v1+json
```

Current version: `v1`

---

## Authentication

All endpoints require Supabase JWT token in Authorization header:
```
Authorization: Bearer <supabase_jwt_token>
```

Token obtained from Supabase Auth client on frontend.

---

## Notes

- **Backward Compatibility**: Simple mode workflows continue to use existing `/api/workflows` endpoints with `steps` field
- **Mode Detection**: Backend router inspects `mode` field to determine execution path (FR-BC-007)
- **Database Constraint**: Advanced workflows MUST have both `graph_definition` and `compiled_logic` (CHECK constraint)
- **Real-time**: SSE streams use Redis pub/sub for scalability across Dramatiq workers
- **Validation**: All graph modifications trigger validation before compilation
- **Variables**: Trigger context variables always prefixed with `trigger.` (e.g., `@trigger.topic`)
