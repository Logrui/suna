"""
Python Schema: Compiled Logic (Execution State)

This file defines the Python TypedDict structures for the compiled_logic JSONB field
stored in agent_workflows table. This represents the EXECUTION state of the workflow
used by GraphExecutor to run workflows.

Feature: Advanced Visual Workflow Builder
Version: 1.0.0
Created: 2025-11-23

Key Differences from graph_definition:
- Flattened structure optimized for traversal (no nested React Flow metadata)
- Explicit next_nodes lists for O(1) edge lookup
- Variable declarations extracted for validation
- Position/viewport data removed (execution doesn't need UI state)
- Edge labels/styles removed (execution doesn't need visual metadata)
"""

from typing import TypedDict, Literal, Any, NotRequired
from datetime import datetime


# ============================================================================
# Top-Level Compiled Logic
# ============================================================================

class CompiledLogic(TypedDict):
    """
    Complete compiled logic stored in database.
    Maps to: agent_workflows.compiled_logic (JSONB)

    This is generated from graph_definition by the compilation process.
    """

    # Schema version for future migrations
    version: str  # "1.0.0"

    # Entry point node ID
    start_node_id: str

    # Flattened node lookup (node_id -> LogicNode)
    nodes: dict[str, 'LogicNode']

    # Variable declarations for validation
    variables: list['VariableDeclaration']

    # Compilation metadata
    compiled_at: NotRequired[str]  # ISO 8601 timestamp
    compiler_version: NotRequired[str]


# ============================================================================
# Logic Node Types
# ============================================================================

class LogicNode(TypedDict):
    """
    Base structure for all logic nodes.
    Discriminated by 'type' field.
    """

    # Node identifier (matches graph_definition node ID)
    id: str

    # Node type discriminator
    type: Literal['start', 'ai_step', 'rule_condition', 'llm_condition', 'end']

    # Human-readable label (for logging)
    label: str

    # Type-specific configuration
    config: dict[str, Any]

    # Next nodes (empty list for end nodes)
    next_nodes: list[str]

    # Output variable name (only for ai_step, llm_condition)
    output_variable: NotRequired[str]


class StartLogicNode(TypedDict):
    """
    Start node - Entry point.
    Maps to: FR-014 (Start node)
    """
    id: str
    type: Literal['start']
    label: str
    config: dict[str, Any]  # Empty for start nodes
    next_nodes: list[str]  # Single next node


class AIStepLogicNode(TypedDict):
    """
    AI Step node - LLM execution.
    Maps to: FR-015 (AI Step nodes), FR-017 (LLM configuration)
    """
    id: str
    type: Literal['ai_step']
    label: str
    config: 'AIStepConfig'
    next_nodes: list[str]  # Single next node (sequential)
    output_variable: NotRequired[str]


class AIStepConfig(TypedDict):
    """Configuration for AI Step execution"""

    # Prompt with variable placeholders
    prompt: str

    # Model identifier
    model: str

    # Tool identifiers
    tools: list[str]

    # Optional overrides
    max_tokens: NotRequired[int]
    temperature: NotRequired[float]
    system_prompt: NotRequired[str]


class RuleConditionLogicNode(TypedDict):
    """
    Rule-Based Condition node - Deterministic branching.
    Maps to: FR-022 (Rule-based conditions), FR-023 (Operators)
    """
    id: str
    type: Literal['rule_condition']
    label: str
    config: 'RuleConditionConfig'
    next_nodes: list[str]  # Multiple branches


class RuleConditionConfig(TypedDict):
    """Configuration for rule evaluation"""

    # Ordered rules (evaluated sequentially)
    rules: list['ConditionalRule']

    # Default branch if no rules match
    default_next_node_id: str | None


class ConditionalRule(TypedDict):
    """Single conditional rule"""

    # Variable to evaluate
    variable: str

    # Comparison operator
    operator: Literal['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'matches_regex']

    # Comparison value
    value: str | int | float | bool

    # Target node if rule matches
    next_node_id: str

    # Label (for logging)
    label: NotRequired[str]


class LLMConditionLogicNode(TypedDict):
    """
    LLM-Based Condition node - Semantic branching.
    Maps to: FR-022 (LLM conditions), FR-024 (Semantic evaluation)
    """
    id: str
    type: Literal['llm_condition']
    label: str
    config: 'LLMConditionConfig'
    next_nodes: list[str]  # Multiple branches
    output_variable: NotRequired[str]  # Stores selected branch label


class LLMConditionConfig(TypedDict):
    """Configuration for LLM evaluation"""

    # Context prompt explaining the decision
    context_prompt: str

    # Branch options
    branches: list['BranchOption']

    # Model for evaluation
    model: str

    # Variables to include in context
    context_variables: NotRequired[list[str]]


class BranchOption(TypedDict):
    """LLM branch option"""

    # Branch label
    label: str

    # Description of when to take this branch
    description: str

    # Target node ID
    next_node_id: str


class EndLogicNode(TypedDict):
    """
    End node - Workflow termination.
    Maps to: FR-016 (End nodes)
    """
    id: str
    type: Literal['end']
    label: str
    config: 'EndConfig'
    next_nodes: list[str]  # Always empty


class EndConfig(TypedDict):
    """Configuration for end node"""

    # Final message
    message: NotRequired[str]

    # Status indicator
    status: NotRequired[Literal['success', 'failure']]


# ============================================================================
# Variable Declarations
# ============================================================================

class VariableDeclaration(TypedDict):
    """
    Variable declaration for validation.
    Maps to: FR-033 (Variable validation)
    """

    # Variable name (without @ prefix)
    name: str

    # Data type
    type: Literal['string', 'number', 'boolean', 'object', 'array', 'unknown']

    # Source
    source: Literal['trigger', 'node_output']

    # Source node ID (if source == 'node_output')
    source_node_id: NotRequired[str]

    # Whether variable is always defined
    always_defined: bool


# ============================================================================
# Execution Context (Runtime State)
# ============================================================================

class ExecutionContext:
    """
    Runtime execution state.
    NOT stored in database - created fresh for each execution.
    Maps to: FR-027 (Execution engine)
    """

    def __init__(
        self,
        thread_id: str,
        workflow_id: str,
        trigger_context: dict[str, Any],
        compiled_logic: CompiledLogic,
    ):
        self.thread_id = thread_id
        self.workflow_id = workflow_id
        self.trigger_context = trigger_context
        self.compiled_logic = compiled_logic

        # Runtime state
        self.variables: dict[str, Any] = self._init_trigger_variables(trigger_context)
        self.step_outputs: dict[str, Any] = {}
        self.execution_log: list[ExecutionEvent] = []
        self.current_node_id: str | None = compiled_logic['start_node_id']
        self.status: Literal['running', 'paused', 'completed', 'failed'] = 'running'
        self.started_at: datetime = datetime.utcnow()
        self.completed_at: datetime | None = None
        self.error: str | None = None

    def _init_trigger_variables(self, trigger_context: dict[str, Any]) -> dict[str, Any]:
        """Initialize variables with trigger context"""
        return {f'trigger.{key}': value for key, value in trigger_context.items()}

    def set_variable(self, name: str, value: Any) -> None:
        """Set variable value"""
        self.variables[name] = value

    def get_variable(self, name: str) -> Any:
        """Get variable value"""
        return self.variables.get(name)

    def log_event(self, event: 'ExecutionEvent') -> None:
        """Add event to execution log"""
        self.execution_log.append(event)


class ExecutionEvent(TypedDict):
    """
    Single execution event for logging.
    Maps to: FR-030 (Real-time monitoring)
    """

    # Timestamp
    timestamp: str  # ISO 8601

    # Event type
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

    # Node ID (if applicable)
    node_id: NotRequired[str]

    # Event details
    details: NotRequired[dict[str, Any]]


# ============================================================================
# Execution Result
# ============================================================================

class ExecutionResult(TypedDict):
    """
    Final execution result.
    Maps to: FR-028 (Execution status)
    """

    # Execution metadata
    execution_id: str
    workflow_id: str
    thread_id: str
    status: Literal['completed', 'failed', 'paused']

    # Timing
    started_at: str  # ISO 8601
    completed_at: str | None  # ISO 8601
    duration_ms: int

    # Results
    final_variables: dict[str, Any]
    execution_log: list[ExecutionEvent]
    error: NotRequired[str]


# ============================================================================
# Graph Executor Interface
# ============================================================================

class GraphExecutor:
    """
    Main workflow execution engine.
    Maps to: R3 (Graph traversal algorithm), FR-027 (Execution)

    Uses iterative DFS to traverse compiled_logic graph.
    """

    def __init__(self, thread_manager: Any, redis_client: Any):
        """
        Args:
            thread_manager: ThreadManager instance for LLM calls
            redis_client: Redis client for pub/sub events
        """
        self.thread_manager = thread_manager
        self.redis = redis_client

    async def execute(
        self,
        workflow_id: str,
        thread_id: str,
        compiled_logic: CompiledLogic,
        trigger_context: dict[str, Any],
    ) -> ExecutionResult:
        """
        Execute workflow from compiled logic.

        Algorithm:
        1. Initialize ExecutionContext
        2. Push start_node_id to stack
        3. While stack not empty:
           a. Pop node_id
           b. Execute node (may be async LLM call)
           c. Publish progress events to Redis
           d. Determine next_nodes based on node type
           e. Push next_nodes to stack
        4. Return ExecutionResult

        Returns:
            ExecutionResult with final variables and log
        """
        raise NotImplementedError("See research.md R3 for implementation details")

    async def _execute_node(
        self,
        node: LogicNode,
        context: ExecutionContext,
    ) -> list[str]:
        """
        Execute single node and return next node IDs.

        Args:
            node: Logic node to execute
            context: Current execution context

        Returns:
            List of next node IDs to execute
        """
        raise NotImplementedError("See research.md R3 for implementation details")

    async def _execute_ai_step(
        self,
        node: AIStepLogicNode,
        context: ExecutionContext,
    ) -> str:
        """
        Execute AI step node.

        Process:
        1. Resolve variables in prompt
        2. Call ThreadManager.run_thread_stream()
        3. Stream response and publish progress events
        4. Store output in variable (if output_variable set)
        5. Return single next_node_id
        """
        raise NotImplementedError("See research.md R3 for implementation details")

    async def _execute_rule_condition(
        self,
        node: RuleConditionLogicNode,
        context: ExecutionContext,
    ) -> str:
        """
        Execute rule-based condition node.

        Process:
        1. Iterate through rules in order
        2. Evaluate variable against operator and value
        3. Return first matching next_node_id
        4. Return default_next_node_id if no matches
        """
        raise NotImplementedError("See research.md R3 for implementation details")

    async def _execute_llm_condition(
        self,
        node: LLMConditionLogicNode,
        context: ExecutionContext,
    ) -> str:
        """
        Execute LLM-based condition node.

        Process:
        1. Build context from context_variables
        2. Call mini LLM with few-shot prompting
        3. Parse structured output to get selected branch
        4. Store branch label in output_variable (if set)
        5. Return corresponding next_node_id
        """
        raise NotImplementedError("See research.md R4 for implementation details")

    def _publish_event(self, event: ExecutionEvent) -> None:
        """Publish event to Redis for SSE streaming"""
        raise NotImplementedError("See research.md R5 for implementation details")


# ============================================================================
# Compilation Process (graph_definition → compiled_logic)
# ============================================================================

class GraphCompiler:
    """
    Compiles graph_definition to compiled_logic.
    Maps to: FR-BC-005 (Dual-state storage)
    """

    def compile(self, graph_definition: dict[str, Any]) -> CompiledLogic:
        """
        Compile graph_definition to optimized execution format.

        Process:
        1. Validate graph (circular refs, orphaned nodes)
        2. Extract start node
        3. Build node lookup with next_nodes lists
        4. Extract variable declarations
        5. Return CompiledLogic

        Args:
            graph_definition: React Flow graph structure

        Returns:
            CompiledLogic optimized for execution

        Raises:
            ValidationError: If graph is invalid
        """
        raise NotImplementedError("Implementation in backend/core/workflows/compiler.py")


# ============================================================================
# Variable Resolution
# ============================================================================

class VariableResolver:
    """
    Resolves variable references in prompts.
    Maps to: FR-032 (Variable interpolation)
    """

    def resolve_prompt(self, prompt: str, context: ExecutionContext) -> str:
        """
        Replace @variable references with actual values.

        Process:
        1. Find all @variable patterns using regex
        2. Look up variable in context.variables
        3. Replace with string representation
        4. Handle missing variables (error or warning)

        Args:
            prompt: Prompt with @variable references
            context: Current execution context

        Returns:
            Resolved prompt string

        Raises:
            VariableNotFoundError: If required variable missing
        """
        raise NotImplementedError("Implementation in backend/core/workflows/variables.py")

    def extract_variables(self, prompt: str) -> list[str]:
        """Extract all @variable references from prompt"""
        import re
        pattern = r'@([a-zA-Z_][a-zA-Z0-9_\.]*)'
        return re.findall(pattern, prompt)


# ============================================================================
# Example Usage
# ============================================================================

# Example compiled_logic stored in database:
EXAMPLE_COMPILED_LOGIC: CompiledLogic = {
    "version": "1.0.0",
    "start_node_id": "start_1",
    "nodes": {
        "start_1": {
            "id": "start_1",
            "type": "start",
            "label": "Start",
            "config": {},
            "next_nodes": ["ai_step_1"],
        },
        "ai_step_1": {
            "id": "ai_step_1",
            "type": "ai_step",
            "label": "Research Topic",
            "config": {
                "prompt": "Research the topic: @trigger.topic",
                "model": "claude-3-5-sonnet-20241022",
                "tools": ["web_search"],
            },
            "next_nodes": ["condition_1"],
            "output_variable": "research_results",
        },
        "condition_1": {
            "id": "condition_1",
            "type": "rule_condition",
            "label": "Check Length",
            "config": {
                "rules": [
                    {
                        "variable": "research_results",
                        "operator": "greater_than",
                        "value": 1000,
                        "next_node_id": "ai_step_2",
                        "label": "Long response",
                    }
                ],
                "default_next_node_id": "end_1",
            },
            "next_nodes": ["ai_step_2", "end_1"],
        },
        "ai_step_2": {
            "id": "ai_step_2",
            "type": "ai_step",
            "label": "Summarize",
            "config": {
                "prompt": "Summarize this research: @research_results",
                "model": "claude-3-5-haiku-20241022",
                "tools": [],
            },
            "next_nodes": ["end_1"],
            "output_variable": "summary",
        },
        "end_1": {
            "id": "end_1",
            "type": "end",
            "label": "End",
            "config": {"status": "success"},
            "next_nodes": [],
        },
    },
    "variables": [
        {
            "name": "trigger.topic",
            "type": "string",
            "source": "trigger",
            "always_defined": True,
        },
        {
            "name": "research_results",
            "type": "string",
            "source": "node_output",
            "source_node_id": "ai_step_1",
            "always_defined": True,
        },
        {
            "name": "summary",
            "type": "string",
            "source": "node_output",
            "source_node_id": "ai_step_2",
            "always_defined": False,  # Conditional on research length
        },
    ],
    "compiled_at": "2025-11-23T15:00:00Z",
    "compiler_version": "1.0.0",
}
