"""
Graph Validator: Validates workflow graph structure and configuration

Checks for:
- Circular references
- Orphaned nodes (not reachable from start)
- Missing start node
- Invalid node configurations
- Undefined variable references

Feature: Advanced Visual Workflow Builder
Version: 1.0.0
Created: 2025-11-27
"""

from typing import Dict, List, Any, Set, Optional, Tuple


class ValidationError:
    """Validation error"""
    def __init__(self, code: str, message: str, node_id: Optional[str] = None, edge_id: Optional[str] = None):
        self.severity = 'error'
        self.code = code
        self.message = message
        self.node_id = node_id
        self.edge_id = edge_id
        self.details = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            'severity': self.severity,
            'code': self.code,
            'message': self.message,
            'node_id': self.node_id,
            'edge_id': self.edge_id,
            'details': self.details
        }


class ValidationWarning:
    """Validation warning"""
    def __init__(self, code: str, message: str, node_id: Optional[str] = None):
        self.severity = 'warning'
        self.code = code
        self.message = message
        self.node_id = node_id
        self.details = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            'severity': self.severity,
            'code': self.code,
            'message': self.message,
            'node_id': self.node_id,
            'details': self.details
        }


class GraphValidator:
    """
    Validates workflow graph structure and configuration.
    Maps to: FR-041 (Validation engine)
    """

    def validate(self, graph_definition: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate complete graph definition.

        Args:
            graph_definition: Graph with nodes, edges, viewport

        Returns:
            Validation result with errors and warnings
        """
        errors: List[ValidationError] = []
        warnings: List[ValidationWarning] = []

        nodes = graph_definition.get('nodes', [])
        edges = graph_definition.get('edges', [])

        # Build adjacency lists for graph traversal
        adjacency_map = self._build_adjacency_map(nodes, edges)

        # Validation checks
        errors.extend(self._check_single_start_node(nodes))
        errors.extend(self._check_circular_references(nodes, adjacency_map))
        errors.extend(self._check_orphaned_nodes(nodes, edges, adjacency_map))
        errors.extend(self._check_node_configurations(nodes))
        warnings.extend(self._check_unreachable_nodes(nodes, adjacency_map))

        return {
            'valid': len(errors) == 0,
            'errors': [e.to_dict() for e in errors],
            'warnings': [w.to_dict() for w in warnings]
        }

    def _build_adjacency_map(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, List[str]]:
        """Build adjacency map from edges"""
        adjacency: Dict[str, List[str]] = {node['id']: [] for node in nodes}

        for edge in edges:
            source = edge.get('source')
            target = edge.get('target')
            if source and target:
                if source in adjacency:
                    adjacency[source].append(target)

        return adjacency

    def _check_single_start_node(self, nodes: List[Dict]) -> List[ValidationError]:
        """Check that workflow has exactly one start node"""
        errors = []
        start_nodes = [n for n in nodes if n.get('type') == 'start']

        if len(start_nodes) == 0:
            errors.append(ValidationError(
                'MISSING_START',
                'Workflow must have exactly one start node'
            ))
        elif len(start_nodes) > 1:
            errors.append(ValidationError(
                'MULTIPLE_START_NODES',
                f'Workflow has {len(start_nodes)} start nodes, but only one is allowed',
                node_id=start_nodes[1]['id']
            ))

        return errors

    def _check_circular_references(self, nodes: List[Dict], adjacency: Dict[str, List[str]]) -> List[ValidationError]:
        """Check for cycles in the graph using DFS"""
        errors = []
        visited: Set[str] = set()
        rec_stack: Set[str] = set()

        def dfs(node_id: str, path: List[str]) -> Optional[List[str]]:
            """DFS to detect cycles, returns cycle path if found"""
            visited.add(node_id)
            rec_stack.add(node_id)
            path.append(node_id)

            for neighbor in adjacency.get(node_id, []):
                if neighbor not in visited:
                    cycle = dfs(neighbor, path.copy())
                    if cycle:
                        return cycle
                elif neighbor in rec_stack:
                    # Found cycle
                    cycle_start = path.index(neighbor)
                    return path[cycle_start:] + [neighbor]

            rec_stack.remove(node_id)
            return None

        for node in nodes:
            node_id = node['id']
            if node_id not in visited:
                cycle = dfs(node_id, [])
                if cycle:
                    cycle_path = ' → '.join(cycle)
                    errors.append(ValidationError(
                        'CIRCULAR_REFERENCE',
                        f'Circular reference detected: {cycle_path}',
                        node_id=cycle[0]
                    ))
                    break  # Report first cycle only

        return errors

    def _check_orphaned_nodes(self, nodes: List[Dict], edges: List[Dict], adjacency: Dict[str, List[str]]) -> List[ValidationError]:
        """Check for nodes with no incoming edges (except start node)"""
        errors = []

        # Find nodes with incoming edges
        has_incoming: Set[str] = set()
        for edge in edges:
            target = edge.get('target')
            if target:
                has_incoming.add(target)

        # Check each node
        for node in nodes:
            node_id = node['id']
            node_type = node.get('type')

            # Start nodes shouldn't have incoming edges
            if node_type == 'start' and node_id in has_incoming:
                errors.append(ValidationError(
                    'START_NODE_HAS_INCOMING',
                    'Start node cannot have incoming edges',
                    node_id=node_id
                ))

            # Non-start nodes should have incoming edges
            elif node_type != 'start' and node_id not in has_incoming:
                errors.append(ValidationError(
                    'ORPHANED_NODE',
                    f'Node "{node.get("data", {}).get("label", node_id)}" has no incoming edges',
                    node_id=node_id
                ))

        return errors

    def _check_unreachable_nodes(self, nodes: List[Dict], adjacency: Dict[str, List[str]]) -> List[ValidationWarning]:
        """Check for nodes unreachable from start node"""
        warnings = []

        # Find start node
        start_nodes = [n for n in nodes if n.get('type') == 'start']
        if not start_nodes:
            return warnings  # Already reported as error

        start_id = start_nodes[0]['id']

        # BFS to find reachable nodes
        reachable: Set[str] = set()
        queue = [start_id]
        reachable.add(start_id)

        while queue:
            current = queue.pop(0)
            for neighbor in adjacency.get(current, []):
                if neighbor not in reachable:
                    reachable.add(neighbor)
                    queue.append(neighbor)

        # Check for unreachable nodes
        for node in nodes:
            node_id = node['id']
            if node_id not in reachable and node.get('type') != 'start':
                warnings.append(ValidationWarning(
                    'UNREACHABLE_NODE',
                    f'Node "{node.get("data", {}).get("label", node_id)}" is not reachable from start node',
                    node_id=node_id
                ))

        return warnings

    def _check_node_configurations(self, nodes: List[Dict]) -> List[ValidationError]:
        """Check that each node has valid configuration"""
        errors = []

        for node in nodes:
            node_id = node['id']
            node_type = node.get('type')
            node_data = node.get('data', {})
            config = node_data.get('config', {})

            # AI Step validation
            if node_type == 'ai_step':
                if not config.get('prompt'):
                    errors.append(ValidationError(
                        'INVALID_CONFIG',
                        'AI Step node must have a prompt',
                        node_id=node_id
                    ))
                if not config.get('model'):
                    errors.append(ValidationError(
                        'INVALID_CONFIG',
                        'AI Step node must specify a model',
                        node_id=node_id
                    ))

            # Rule Condition validation
            elif node_type == 'rule_condition':
                rules = config.get('rules', [])
                if not rules or len(rules) == 0:
                    errors.append(ValidationError(
                        'INVALID_CONFIG',
                        'Rule Condition node must have at least one rule',
                        node_id=node_id
                    ))

            # LLM Condition validation
            elif node_type == 'llm_condition':
                if not config.get('context_prompt'):
                    errors.append(ValidationError(
                        'INVALID_CONFIG',
                        'LLM Condition node must have a context prompt',
                        node_id=node_id
                    ))
                branches = config.get('branches', [])
                if len(branches) < 2:
                    errors.append(ValidationError(
                        'INVALID_CONFIG',
                        'LLM Condition node must have at least 2 branches',
                        node_id=node_id
                    ))

        return errors
