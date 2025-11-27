"""
Graph Compiler: Compiles graph_definition to compiled_logic

Converts React Flow visual representation into optimized execution format:
- Extracts start node
- Builds adjacency lists (next_nodes)
- Extracts variable declarations
- Removes UI-specific metadata (positions, colors, etc.)

Feature: Advanced Visual Workflow Builder
Version: 1.0.0
Created: 2025-11-27
"""

from typing import Dict, List, Any, Set
from datetime import datetime
import re


class GraphCompiler:
    """
    Compiles visual graph_definition into executable compiled_logic.
    Maps to: FR-BC-005 (Dual-state storage)
    """

    COMPILER_VERSION = "1.0.0"

    def compile(self, graph_definition: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compile graph_definition to optimized execution format.

        Args:
            graph_definition: React Flow graph structure with nodes, edges, viewport

        Returns:
            CompiledLogic optimized for execution

        Raises:
            ValueError: If graph is invalid or missing required data
        """
        nodes = graph_definition.get('nodes', [])
        edges = graph_definition.get('edges', [])

        # Find start node
        start_nodes = [n for n in nodes if n.get('type') == 'start']
        if not start_nodes:
            raise ValueError("Graph must have a start node")

        start_node_id = start_nodes[0]['id']

        # Build adjacency map
        adjacency_map = self._build_adjacency_map(nodes, edges)

        # Compile nodes
        compiled_nodes = {}
        for node in nodes:
            compiled_nodes[node['id']] = self._compile_node(node, adjacency_map)

        # Extract variable declarations
        variables = self._extract_variables(nodes, adjacency_map, start_node_id)

        return {
            'version': self.COMPILER_VERSION,
            'start_node_id': start_node_id,
            'nodes': compiled_nodes,
            'variables': variables,
            'compiled_at': datetime.utcnow().isoformat() + 'Z',
            'compiler_version': self.COMPILER_VERSION
        }

    def _build_adjacency_map(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, List[str]]:
        """Build adjacency map from edges"""
        adjacency: Dict[str, List[str]] = {node['id']: [] for node in nodes}

        for edge in edges:
            source = edge.get('source')
            target = edge.get('target')
            if source and target and source in adjacency:
                adjacency[source].append(target)

        return adjacency

    def _compile_node(self, node: Dict[str, Any], adjacency: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Compile single node, stripping UI metadata and extracting config.

        Args:
            node: React Flow node with position, data, etc.
            adjacency: Adjacency map for next_nodes

        Returns:
            LogicNode for execution
        """
        node_id = node['id']
        node_type = node['type']
        node_data = node.get('data', {})
        label = node_data.get('label', node_id)
        config = node_data.get('config', {})

        # Base logic node
        logic_node: Dict[str, Any] = {
            'id': node_id,
            'type': node_type,
            'label': label,
            'config': self._compile_config(node_type, config),
            'next_nodes': adjacency.get(node_id, [])
        }

        # Add output_variable if present
        if node_type in ['ai_step', 'llm_condition']:
            output_var = config.get('output_variable')
            if output_var:
                logic_node['output_variable'] = output_var

        return logic_node

    def _compile_config(self, node_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compile node-specific configuration, stripping UI metadata.

        Args:
            node_type: Type of node
            config: Raw config from node data

        Returns:
            Cleaned config for execution
        """
        if node_type == 'start':
            return {}

        elif node_type == 'ai_step':
            return {
                'prompt': config.get('prompt', ''),
                'model': config.get('model', ''),
                'tools': config.get('tools', []),
                **({' max_tokens': config['max_tokens']} if 'max_tokens' in config else {}),
                **({'temperature': config['temperature']} if 'temperature' in config else {}),
                **({'system_prompt': config['system_prompt']} if 'system_prompt' in config else {})
            }

        elif node_type == 'rule_condition':
            return {
                'rules': config.get('rules', []),
                'default_next_node_id': config.get('default_next_node_id')
            }

        elif node_type == 'llm_condition':
            return {
                'context_prompt': config.get('context_prompt', ''),
                'branches': config.get('branches', []),
                'model': config.get('model', 'gpt-4o-mini'),
                **({'context_variables': config['context_variables']} if 'context_variables' in config else {})
            }

        elif node_type == 'end':
            return {
                **({'message': config['message']} if 'message' in config else {}),
                **({'status': config['status']} if 'status' in config else {})
            }

        return config

    def _extract_variables(self, nodes: List[Dict], adjacency: Dict[str, List[str]], start_node_id: str) -> List[Dict[str, Any]]:
        """
        Extract all variable declarations from the graph.

        Args:
            nodes: All nodes in graph
            adjacency: Adjacency map
            start_node_id: ID of start node

        Returns:
            List of variable declarations
        """
        variables: List[Dict[str, Any]] = []
        seen_vars: Set[str] = set()

        # Trigger variables (assumed from start node)
        # TODO: Extract from trigger configuration when available
        trigger_var = {
            'name': 'trigger',
            'type': 'object',
            'source': 'trigger',
            'always_defined': True
        }
        variables.append(trigger_var)
        seen_vars.add('trigger')

        # Node output variables
        for node in nodes:
            node_id = node['id']
            node_type = node.get('type')
            node_data = node.get('data', {})
            config = node_data.get('config', {})

            # Only AI steps and LLM conditions produce outputs
            if node_type in ['ai_step', 'llm_condition']:
                output_var = config.get('output_variable')
                if output_var and output_var not in seen_vars:
                    # Determine if variable is always defined
                    # (simplified: assume true if node is on all paths from start)
                    always_defined = self._is_node_on_all_paths(node_id, start_node_id, adjacency, nodes)

                    variables.append({
                        'name': output_var,
                        'type': 'string',  # Simplified: assume string for now
                        'source': 'node_output',
                        'source_node_id': node_id,
                        'always_defined': always_defined
                    })
                    seen_vars.add(output_var)

        return variables

    def _is_node_on_all_paths(self, node_id: str, start_id: str, adjacency: Dict[str, List[str]], nodes: List[Dict]) -> bool:
        """
        Check if a node is on all paths from start to any end node.
        Simplified version: returns False for any branching paths.

        Args:
            node_id: Node to check
            start_id: Start node ID
            adjacency: Adjacency map
            nodes: All nodes

        Returns:
            True if node is on all execution paths
        """
        # Find all end nodes
        end_nodes = [n['id'] for n in nodes if n.get('type') == 'end']

        if not end_nodes:
            # No end nodes, check if on path from start
            return self._is_reachable(start_id, node_id, adjacency)

        # Check if node is on every path from start to each end node
        for end_id in end_nodes:
            if not self._is_on_path(start_id, node_id, end_id, adjacency):
                return False

        return True

    def _is_reachable(self, from_id: str, to_id: str, adjacency: Dict[str, List[str]]) -> bool:
        """Check if to_id is reachable from from_id"""
        visited: Set[str] = set()
        queue = [from_id]

        while queue:
            current = queue.pop(0)
            if current == to_id:
                return True

            if current in visited:
                continue

            visited.add(current)
            queue.extend(adjacency.get(current, []))

        return False

    def _is_on_path(self, start: str, middle: str, end: str, adjacency: Dict[str, List[str]]) -> bool:
        """Check if middle node is on any path from start to end"""
        # DFS to find if there's a path start -> middle -> end
        if not self._is_reachable(start, middle, adjacency):
            return False
        if not self._is_reachable(middle, end, adjacency):
            return False
        return True
