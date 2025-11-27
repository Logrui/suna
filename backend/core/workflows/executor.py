"""
Graph Executor: Executes compiled workflow logic

Implements iterative DFS graph traversal to execute workflow nodes:
- AI Step nodes: Call ThreadManager for LLM generation
- Rule Condition nodes: Evaluate deterministic rules
- LLM Condition nodes: Use mini LLM for semantic routing
- End nodes: Terminate execution

Feature: Advanced Visual Workflow Builder
Version: 1.0.0
Created: 2025-11-27
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from .variables import VariableResolver, VariableNotFoundError
from .types import CompiledLogic, LogicNode, ExecutionResult, ExecutionEvent
import logging

logger = logging.getLogger(__name__)


class ExecutionContext:
    """Runtime execution state"""

    def __init__(
        self,
        thread_id: str,
        workflow_id: str,
        trigger_context: Dict[str, Any],
    ):
        self.thread_id = thread_id
        self.workflow_id = workflow_id
        self.trigger_context = trigger_context

        # Runtime state
        self.variables: Dict[str, Any] = {'trigger': trigger_context}
        self.step_outputs: Dict[str, Any] = {}
        self.execution_log: List[Dict[str, Any]] = []
        self.current_node_id: Optional[str] = None
        self.status: str = 'running'
        self.started_at: datetime = datetime.utcnow()
        self.completed_at: Optional[datetime] = None
        self.error: Optional[str] = None
        self.step_count: int = 0
        self.max_steps: int = 100  # Prevent infinite loops

    def log_event(self, event_type: str, node_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        """Add event to execution log"""
        event = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'event_type': event_type,
            'node_id': node_id,
            'details': details or {}
        }
        self.execution_log.append(event)
        logger.info(f"Execution event: {event_type} | node: {node_id}")

    def set_variable(self, name: str, value: Any):
        """Set variable value"""
        self.variables[name] = value

    def get_variable(self, name: str) -> Any:
        """Get variable value"""
        return self.variables.get(name)


class GraphExecutor:
    """
    Main workflow execution engine.
    Maps to: R3 (Graph traversal algorithm), FR-027 (Execution)

    Uses iterative DFS to traverse compiled_logic graph.
    """

    def __init__(self, thread_manager: Any = None, redis_client: Any = None):
        """
        Args:
            thread_manager: ThreadManager instance for LLM calls (optional for now)
            redis_client: Redis client for pub/sub events (optional for now)
        """
        self.thread_manager = thread_manager
        self.redis = redis_client
        self.variable_resolver = VariableResolver()

    async def execute(
        self,
        workflow_id: str,
        thread_id: str,
        compiled_logic: Dict[str, Any],
        trigger_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute workflow from compiled logic.

        Algorithm:
        1. Initialize ExecutionContext
        2. Start from start_node_id
        3. Execute nodes iteratively (DFS)
        4. Return ExecutionResult

        Args:
            workflow_id: Workflow ID
            thread_id: Thread ID for execution
            compiled_logic: Compiled logic graph
            trigger_context: Trigger data

        Returns:
            ExecutionResult with final variables and log
        """
        context = ExecutionContext(thread_id, workflow_id, trigger_context)
        context.log_event('execution_started')

        try:
            # Start execution from start node
            start_node_id = compiled_logic['start_node_id']
            nodes = compiled_logic['nodes']

            current_id = start_node_id

            while current_id and context.step_count < context.max_steps:
                context.step_count += 1
                context.current_node_id = current_id

                node = nodes.get(current_id)
                if not node:
                    raise ValueError(f"Node {current_id} not found in compiled logic")

                # Execute node
                next_id = await self._execute_node(node, context)
                current_id = next_id

            # Check if max steps exceeded
            if context.step_count >= context.max_steps:
                raise RuntimeError(f"Execution exceeded maximum steps ({context.max_steps})")

            # Mark as completed
            context.status = 'completed'
            context.completed_at = datetime.utcnow()
            context.log_event('execution_completed')

        except Exception as e:
            logger.error(f"Execution failed: {str(e)}", exc_info=True)
            context.status = 'failed'
            context.error = str(e)
            context.completed_at = datetime.utcnow()
            context.log_event('execution_failed', details={'error': str(e)})

        # Build result
        duration_ms = int((context.completed_at - context.started_at).total_seconds() * 1000) if context.completed_at else 0

        result: Dict[str, Any] = {
            'execution_id': thread_id,  # Use thread_id as execution_id for now
            'workflow_id': workflow_id,
            'thread_id': thread_id,
            'status': context.status,
            'started_at': context.started_at.isoformat() + 'Z',
            'completed_at': context.completed_at.isoformat() + 'Z' if context.completed_at else None,
            'duration_ms': duration_ms,
            'final_variables': context.variables,
            'execution_log': context.execution_log,
        }

        if context.error:
            result['error'] = context.error

        return result

    async def _execute_node(self, node: Dict[str, Any], context: ExecutionContext) -> Optional[str]:
        """
        Execute single node and return next node ID.

        Args:
            node: Logic node to execute
            context: Current execution context

        Returns:
            Next node ID to execute, or None if workflow ends
        """
        node_id = node['id']
        node_type = node['type']

        context.log_event('node_started', node_id=node_id, details={'label': node['label']})

        try:
            if node_type == 'start':
                # Start node: just pass through
                next_nodes = node['next_nodes']
                next_id = next_nodes[0] if next_nodes else None

            elif node_type == 'ai_step':
                next_id = await self._execute_ai_step(node, context)

            elif node_type == 'rule_condition':
                next_id = await self._execute_rule_condition(node, context)

            elif node_type == 'llm_condition':
                next_id = await self._execute_llm_condition(node, context)

            elif node_type == 'end':
                # End node: terminate
                next_id = None

            else:
                raise ValueError(f"Unknown node type: {node_type}")

            context.log_event('node_completed', node_id=node_id, details={'next_node_id': next_id})
            return next_id

        except Exception as e:
            context.log_event('node_failed', node_id=node_id, details={'error': str(e)})
            raise

    async def _execute_ai_step(self, node: Dict[str, Any], context: ExecutionContext) -> Optional[str]:
        """
        Execute AI step node.

        Process:
        1. Resolve variables in prompt
        2. Call ThreadManager (or mock for now)
        3. Store output in variable (if output_variable set)
        4. Return single next_node_id

        Args:
            node: AI step logic node
            context: Execution context

        Returns:
            Next node ID
        """
        config = node['config']
        prompt = config['prompt']

        # Resolve variables in prompt
        resolved_prompt = self.variable_resolver.resolve(prompt, context.variables, strict=False)

        # TODO: Call ThreadManager for actual LLM generation
        # For now, create a mock response
        if self.thread_manager:
            # Integration with ThreadManager goes here
            # response = await self.thread_manager.run_thread_stream(...)
            pass

        mock_response = f"[AI Response to: {resolved_prompt[:50]}...]"

        # Store output if output_variable is set
        if 'output_variable' in node:
            output_var = node['output_variable']
            context.set_variable(output_var, mock_response)
            context.step_outputs[node['id']] = mock_response

        # Return next node
        next_nodes = node['next_nodes']
        return next_nodes[0] if next_nodes else None

    async def _execute_rule_condition(self, node: Dict[str, Any], context: ExecutionContext) -> Optional[str]:
        """
        Execute rule-based condition node.

        Process:
        1. Iterate through rules in order
        2. Evaluate variable against operator and value
        3. Return first matching next_node_id
        4. Return default_next_node_id if no matches

        Args:
            node: Rule condition logic node
            context: Execution context

        Returns:
            Next node ID
        """
        config = node['config']
        rules = config['rules']
        default_next = config.get('default_next_node_id')

        # Evaluate rules in order
        for rule in rules:
            variable_name = rule['variable']
            operator = rule['operator']
            expected_value = rule['value']

            try:
                actual_value = self.variable_resolver.get_variable(variable_name, context.variables)
            except VariableNotFoundError:
                # Variable not found, skip this rule
                continue

            # Evaluate condition
            if self._evaluate_rule(actual_value, operator, expected_value):
                return rule['next_node_id']

        # No rules matched, use default
        return default_next if default_next else None

    def _evaluate_rule(self, actual: Any, operator: str, expected: Any) -> bool:
        """Evaluate a single rule condition"""
        if operator == 'equals':
            return actual == expected
        elif operator == 'not_equals':
            return actual != expected
        elif operator == 'contains':
            return str(expected) in str(actual)
        elif operator == 'greater_than':
            return float(actual) > float(expected)
        elif operator == 'less_than':
            return float(actual) < float(expected)
        elif operator == 'matches_regex':
            import re
            return bool(re.search(str(expected), str(actual)))
        else:
            logger.warning(f"Unknown operator: {operator}")
            return False

    async def _execute_llm_condition(self, node: Dict[str, Any], context: ExecutionContext) -> Optional[str]:
        """
        Execute LLM-based condition node.

        Process:
        1. Build context from context_variables
        2. Call mini LLM with few-shot prompting
        3. Parse structured output to get selected branch
        4. Store branch label in output_variable (if set)
        5. Return corresponding next_node_id

        Args:
            node: LLM condition logic node
            context: Execution context

        Returns:
            Next node ID
        """
        config = node['config']
        context_prompt = config['context_prompt']
        branches = config['branches']

        # TODO: Implement LLM-based semantic routing
        # For now, return first branch as default
        logger.warning("LLM condition execution not yet implemented, using first branch")

        if branches:
            selected_branch = branches[0]
            if 'output_variable' in node:
                context.set_variable(node['output_variable'], selected_branch['label'])
            return selected_branch['next_node_id']

        return None
