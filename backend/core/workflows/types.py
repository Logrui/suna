"""
Python Schema: Compiled Logic (Execution State)

Type definitions for compiled_logic JSONB field in agent_workflows table.
Represents the execution state used by GraphExecutor to run workflows.

Feature: Advanced Visual Workflow Builder
Version: 1.0.0
Created: 2025-11-27
"""

from typing import TypedDict, List, Dict, Any, Optional, Union, Literal, NotRequired
from datetime import datetime


# ============================================================================
# Core Compiled Logic Types
# ============================================================================

class Transition(TypedDict):
    """Edge to next node in execution"""
    target_id: str
    condition: Optional[str]  # 'true', 'false', 'default', 'error', None


class LogicNode(TypedDict):
    """
    Base structure for all logic nodes.
    Discriminated by 'type' field.
    """
    id: str
    type: Literal['start', 'ai_step', 'rule_condition', 'llm_condition', 'end']
    label: str  # Human-readable label for logging
    config: Dict[str, Any]
    next_nodes: List[str]  # List of next node IDs
    output_variable: NotRequired[str]  # Only for ai_step, llm_condition


class VariableDeclaration(TypedDict):
    """Variable available in workflow"""
    name: str
    type: Literal['string', 'number', 'boolean', 'object', 'array', 'unknown']
    source: Literal['trigger', 'node_output']
    source_node_id: NotRequired[str]
    always_defined: bool


class CompiledLogic(TypedDict):
    """
    Execution logic for advanced workflows.
    Maps to: agent_workflows.compiled_logic (JSONB)
    """
    version: str  # e.g., "1.0.0"
    start_node_id: str
    nodes: Dict[str, LogicNode]
    variables: List[VariableDeclaration]
    compiled_at: NotRequired[str]  # ISO 8601 timestamp
    compiler_version: NotRequired[str]


# ============================================================================
# Node-Specific Config Types
# ============================================================================

class AIStepConfig(TypedDict):
    """Configuration for AI Step execution"""
    prompt: str
    model: str
    tools: List[str]
    max_tokens: NotRequired[int]
    temperature: NotRequired[float]
    system_prompt: NotRequired[str]


class ConditionalRule(TypedDict):
    """Single conditional rule for rule-based condition"""
    variable: str
    operator: Literal['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'matches_regex']
    value: Union[str, int, float, bool]
    next_node_id: str
    label: NotRequired[str]


class RuleConditionConfig(TypedDict):
    """Configuration for rule-based condition node"""
    rules: List[ConditionalRule]
    default_next_node_id: Optional[str]


class BranchOption(TypedDict):
    """LLM branch option for semantic routing"""
    label: str
    description: str
    next_node_id: str


class LLMConditionConfig(TypedDict):
    """Configuration for LLM-based condition node"""
    context_prompt: str
    branches: List[BranchOption]
    model: str
    context_variables: NotRequired[List[str]]


class EndConfig(TypedDict):
    """Configuration for end node"""
    message: NotRequired[str]
    status: NotRequired[Literal['success', 'failure']]


# ============================================================================
# Execution Context (Runtime State)
# ============================================================================

class ExecutionEvent(TypedDict):
    """
    Single execution event for logging.
    Maps to: FR-030 (Real-time monitoring)
    """
    timestamp: str  # ISO 8601
    event_type: Literal[
        'execution_started',
        'node_started',
        'node_progress',
        'node_completed',
        'node_failed',
        'execution_paused',
        'execution_completed',
        'execution_failed',
    ]
    node_id: NotRequired[str]
    details: NotRequired[Dict[str, Any]]


class ExecutionResult(TypedDict):
    """
    Final execution result.
    Maps to: FR-028 (Execution status)
    """
    execution_id: str
    workflow_id: str
    thread_id: str
    status: Literal['completed', 'failed', 'paused']
    started_at: str  # ISO 8601
    completed_at: Optional[str]  # ISO 8601
    duration_ms: int
    final_variables: Dict[str, Any]
    execution_log: List[ExecutionEvent]
    error: NotRequired[str]
