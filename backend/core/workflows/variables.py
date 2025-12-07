"""
Variable Resolver: Resolves @variable references in prompts

Replaces @variable syntax with actual values from execution context:
- @trigger.field → value from trigger context
- @variable_name → value from node output
- @step_id.output → value from specific step

Feature: Advanced Visual Workflow Builder
Version: 1.0.0
Created: 2025-11-27
"""

from typing import Dict, Any, List
import re


class VariableNotFoundError(Exception):
    """Raised when a required variable is not found in context"""
    pass


class VariableResolver:
    """
    Resolves variable references in prompts.
    Maps to: FR-032 (Variable interpolation)
    """

    # Regex to match @variable or @object.field syntax
    VARIABLE_PATTERN = re.compile(r'@([a-zA-Z_][a-zA-Z0-9_\.]*)')

    def resolve(self, text: str, context: Dict[str, Any], strict: bool = True) -> str:
        """
        Replace @variable references with actual values.

        Args:
            text: Prompt with @variable references
            context: Execution context with variable values
            strict: If True, raise error on missing variables. If False, leave unresolved.

        Returns:
            Resolved prompt string

        Raises:
            VariableNotFoundError: If required variable is missing and strict=True
        """
        def replacer(match: re.Match) -> str:
            variable_path = match.group(1)
            try:
                value = self.get_variable(variable_path, context)
                return self._format_value(value)
            except VariableNotFoundError as e:
                if strict:
                    raise
                # Keep original @variable syntax if not strict
                return match.group(0)

        return self.VARIABLE_PATTERN.sub(replacer, text)

    def get_variable(self, path: str, context: Dict[str, Any]) -> Any:
        """
        Resolve variable by path (e.g., 'trigger.email' or 'step_1.output').

        Args:
            path: Variable path
            context: Current execution context

        Returns:
            Variable value

        Raises:
            VariableNotFoundError: If variable not found
        """
        parts = path.split('.')
        value = context

        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                raise VariableNotFoundError(f"Variable '{path}' not found in context")

        return value

    def extract_variables(self, text: str) -> List[str]:
        """
        Extract all @variable references from text.

        Args:
            text: Text to search

        Returns:
            List of variable paths (without @ prefix)
        """
        return self.VARIABLE_PATTERN.findall(text)

    def _format_value(self, value: Any) -> str:
        """
        Format variable value as string for insertion into prompt.

        Args:
            value: Variable value

        Returns:
            String representation
        """
        if value is None:
            return ''
        elif isinstance(value, str):
            return value
        elif isinstance(value, (int, float, bool)):
            return str(value)
        elif isinstance(value, dict):
            # Format dict as JSON
            import json
            return json.dumps(value, indent=2)
        elif isinstance(value, list):
            # Format list as JSON
            import json
            return json.dumps(value, indent=2)
        else:
            return str(value)
