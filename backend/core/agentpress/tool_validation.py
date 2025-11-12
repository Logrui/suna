"""
Tool Call Validation Module

This module provides validation logic for tool calls, including:
- Schema validation against JSON Schema specifications
- Malformed XML detection (nested parameters, unbalanced tags)
- Error feedback generation for LLM self-correction
- Auto-reprompt handling

The validation system catches common mistakes and provides detailed
correction guidance to help LLMs fix malformed tool calls automatically.
"""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple, AsyncGenerator

from core.agentpress.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


class ToolCallValidator:
    """
    Validates tool calls against schemas and detects malformations.
    
    This class handles:
    - JSON Schema validation for parameters
    - Type checking and coercion
    - Malformation detection (nested XML, missing params, etc.)
    - Error message generation with examples
    """
    
    def __init__(self, tool_registry: ToolRegistry):
        """
        Initialize validator with tool registry.
        
        Args:
            tool_registry: Registry containing tool schemas and metadata
        """
        self.tool_registry = tool_registry
    
    def validate_tool_call(
        self, 
        tool_call: Dict[str, Any],
        parsing_details: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Validate a parsed tool call against its schema.
        
        Performs comprehensive validation including:
        - Tool existence check
        - Schema compliance
        - Required parameter presence
        - Parameter type validation
        - Nested XML detection (from parsing_details)
        
        Args:
            tool_call: Parsed tool call dictionary with function_name and arguments
            parsing_details: Optional parsing metadata (raw_xml, nested_params, etc.)
            
        Returns:
            Tuple of (is_valid, error_message, malformation_details)
            - is_valid: True if tool call is valid
            - error_message: Human-readable error description (None if valid)
            - malformation_details: Dict with malformation info for feedback generation
        """
        function_name = tool_call.get('function_name')
        arguments = tool_call.get('arguments', {})
        
        # Check if tool exists
        available_functions = self.tool_registry.get_available_functions()
        if function_name not in available_functions:
            return (
                False,
                f"Tool '{function_name}' not found in registry",
                {"error_type": "tool_not_found", "tool_name": function_name}
            )
        
        # Get tool schema
        tool_schema = self.tool_registry.get_tool_schema(function_name)
        if not tool_schema:
            logger.warning(f"No schema found for tool '{function_name}', skipping validation")
            return (True, None, None)  # Allow if no schema (permissive)
        
        # Extract parameter schema
        parameters_schema = tool_schema.get('parameters', {})
        required_params = parameters_schema.get('required', [])
        properties = parameters_schema.get('properties', {})
        
        # Check for nested XML in parsing details (Phase 1 detection)
        if parsing_details and parsing_details.get('has_nested_xml'):
            return (
                False,
                "Nested XML parameters detected - parameters cannot contain nested <parameter> tags",
                {
                    "error_type": "nested_xml",
                    "nested_params": parsing_details.get('nested_params', []),
                    "function_name": function_name
                }
            )
        
        # Validate required parameters
        missing_params = []
        for param in required_params:
            if param not in arguments:
                missing_params.append(param)
        
        if missing_params:
            return (
                False,
                f"Missing required parameters: {', '.join(missing_params)}",
                {
                    "error_type": "missing_parameters",
                    "missing_params": missing_params,
                    "function_name": function_name
                }
            )
        
        # Validate parameter types
        type_mismatches = {}
        for param_name, param_value in arguments.items():
            if param_name in properties:
                expected_schema = properties[param_name]
                is_valid_type, error = self._validate_parameter_type(
                    param_name, param_value, expected_schema
                )
                if not is_valid_type:
                    type_mismatches[param_name] = {
                        "expected": expected_schema.get('type', 'unknown'),
                        "received": type(param_value).__name__,
                        "error": error
                    }
        
        if type_mismatches:
            return (
                False,
                f"Parameter type mismatches: {', '.join(type_mismatches.keys())}",
                {
                    "error_type": "type_mismatch",
                    "type_mismatches": type_mismatches,
                    "function_name": function_name
                }
            )
        
        # All validations passed
        return (True, None, None)
    
    def _validate_parameter_type(
        self,
        param_name: str,
        param_value: Any,
        schema: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate parameter value against JSON Schema type.
        
        Args:
            param_name: Parameter name
            param_value: Parameter value to validate
            schema: JSON Schema for the parameter
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        expected_type = schema.get('type')
        
        if not expected_type:
            return (True, None)  # No type constraint
        
        # Map JSON Schema types to Python types
        type_mapping = {
            'string': str,
            'number': (int, float),
            'integer': int,
            'boolean': bool,
            'array': list,
            'object': dict,
            'null': type(None)
        }
        
        python_type = type_mapping.get(expected_type)
        if not python_type:
            return (True, None)  # Unknown type, skip validation
        
        # Check type
        if not isinstance(param_value, python_type):
            return (
                False,
                f"Expected {expected_type}, got {type(param_value).__name__}"
            )
        
        return (True, None)
    
    def validate_xml_structure(self, raw_xml: str) -> Tuple[bool, Optional[str]]:
        """
        Validate XML structure for common malformations.
        
        Checks for:
        - Nested <parameter> tags
        - Unbalanced tags
        - Malformed XML structure
        
        Args:
            raw_xml: Raw XML string from LLM
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check for nested parameters (most common issue)
        # Pattern: <parameter ...>...<parameter>...</parameter>...</parameter>
        nested_param_pattern = r'<parameter[^>]*>(?:[^<]|<(?!parameter|/parameter))*<parameter'
        if re.search(nested_param_pattern, raw_xml, re.DOTALL):
            return (False, "Nested <parameter> tags detected")
        
        # Check for unbalanced tags
        open_tags = re.findall(r'<(\w+)', raw_xml)
        close_tags = re.findall(r'</(\w+)>', raw_xml)
        
        for tag in open_tags:
            open_count = open_tags.count(tag)
            close_count = close_tags.count(tag)
            if open_count != close_count:
                return (False, f"Unbalanced <{tag}> tags: {open_count} open, {close_count} close")
        
        return (True, None)


class MalformedToolCallHandler:
    """
    Handles malformed tool calls by generating error feedback and managing reprompts.
    
    This class:
    - Generates detailed error messages with examples
    - Saves error feedback as user messages (for LLM context)
    - Yields status messages to frontend
    - Triggers auto-reprompt via metadata
    """
    
    def __init__(self, message_handler):
        """
        Initialize handler with message handler.
        
        Args:
            message_handler: Object with add_message and _yield_message methods
        """
        self.message_handler = message_handler
    
    async def handle_malformed_calls(
        self,
        malformed_calls: List[Dict[str, Any]],
        thread_id: str,
        thread_run_id: str,
        assistant_message_id: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Handle malformed tool calls by generating error feedback.
        
        This method:
        1. Generates detailed error messages for the LLM
        2. Saves error feedback as user message (for LLM context)
        3. Yields status messages to frontend
        4. Triggers auto-reprompt by setting metadata
        
        Args:
            malformed_calls: List of malformed tool call dictionaries
            thread_id: Thread ID
            thread_run_id: Current thread run ID
            assistant_message_id: ID of assistant message containing malformed calls
            
        Yields:
            Status messages and error feedback for frontend
        """
        for malformed in malformed_calls:
            tool_call = malformed['tool_call']
            function_name = tool_call.get('function_name', 'unknown')
            error_msg = malformed['error']
            malformation = malformed['malformation']
            raw_xml = malformed['raw_xml']
            
            # Generate detailed error message for the LLM
            error_feedback = self.generate_malformation_feedback(
                function_name=function_name,
                malformation=malformation,
                raw_xml=raw_xml
            )
            
            # Log the error
            logger.error(f"🚫 MALFORMED TOOL CALL: {function_name}")
            logger.error(f"   Error: {error_msg}")
            logger.error(f"   Raw XML: {raw_xml[:200]}...")
            
            # Add error message to thread (as user message for LLM context)
            error_content = {
                "role": "user",
                "content": error_feedback
            }
            
            error_msg_obj = await self.message_handler.add_message(
                thread_id=thread_id,
                type="user",
                content=error_content,
                is_llm_message=True,
                metadata={
                    "thread_run_id": thread_run_id,
                    "error_type": "malformed_tool_call",
                    "function_name": function_name,
                    "original_message_id": assistant_message_id,
                    "reprompt_trigger": True
                }
            )
            
            # Yield error message to frontend
            if error_msg_obj:
                yield error_msg_obj
            
            # Yield status message
            status_content = {
                "status_type": "tool_validation_failed",
                "function_name": function_name,
                "error": error_msg,
                "reprompt": True
            }
            
            status_msg_obj = await self.message_handler.add_message(
                thread_id=thread_id,
                type="status",
                content=status_content,
                is_llm_message=False,
                metadata={
                    "thread_run_id": thread_run_id
                }
            )
            
            if status_msg_obj:
                yield status_msg_obj
    
    def generate_malformation_feedback(
        self,
        function_name: str,
        malformation: Dict[str, Any],
        raw_xml: str
    ) -> str:
        """
        Generate detailed error feedback with examples for LLM correction.
        
        Creates a comprehensive error message that:
        - Explains what went wrong
        - Shows incorrect vs correct examples
        - Provides actionable guidance
        
        Args:
            function_name: Name of the tool that was malformed
            malformation: Dictionary with malformation details
            raw_xml: The malformed XML that was generated
            
        Returns:
            Formatted error message string for LLM
        """
        feedback_parts = [
            f"🚫 **Tool Call Validation Failed: {function_name}**",
            ""
        ]
        
        error_type = malformation.get('error_type', 'unknown')
        
        # Nested XML parameters (most common issue)
        if error_type == 'nested_xml' or 'nested_params' in malformation:
            feedback_parts.extend([
                "**Issue: Nested XML parameters detected**",
                "",
                "You used nested `<parameter>` tags, which causes parsing errors.",
                "The parser cannot handle parameters inside other parameters.",
                "",
                "❌ **Incorrect format (nested parameters):**",
                "```xml",
                "<parameter name=\"sections\">",
                "  <parameter name=\"title\">Research</parameter>",
                "  <parameter name=\"tasks\">",
                "    <parameter name=\"task\">Task 1</parameter>",
                "    <parameter name=\"task\">Task 2</parameter>",
                "  </parameter>",
                "</parameter>",
                "```",
                "",
                "✅ **Correct format (flat parameters with JSON):**",
                "```xml",
                "<parameter name=\"sections\">[",
                "  {\"title\": \"Research\", \"tasks\": [\"Task 1\", \"Task 2\"]},",
                "  {\"title\": \"Analysis\", \"tasks\": [\"Task 3\", \"Task 4\"]}",
                "]</parameter>",
                "```",
                "",
                "**OR use separate flat parameters:**",
                "```xml",
                "<parameter name=\"title\">Research</parameter>",
                "<parameter name=\"tasks\">[\"Task 1\", \"Task 2\"]</parameter>",
                "```",
                ""
            ])
        
        # Missing parameters
        if 'missing_params' in malformation:
            missing = malformation['missing_params']
            feedback_parts.extend([
                f"**Issue: Missing required parameters**",
                "",
                f"The following required parameters are missing: {', '.join(f'`{p}`' for p in missing)}",
                ""
            ])
        
        # Type mismatches
        if 'type_mismatches' in malformation:
            feedback_parts.extend([
                "**Issue: Parameter type mismatches**",
                ""
            ])
            for param, details in malformation['type_mismatches'].items():
                feedback_parts.append(
                    f"- `{param}`: Expected `{details['expected']}`, got `{details['received']}`"
                )
            feedback_parts.append("")
        
        # Show malformed XML (truncated)
        feedback_parts.extend([
            "**Your malformed XML:**",
            "```xml",
            raw_xml[:500] + ("..." if len(raw_xml) > 500 else ""),
            "```",
            "",
            "**Please:**",
            "1. Review the correct format above",
            "2. Regenerate the tool call with proper flat parameters or JSON objects",
            "3. Do NOT nest `<parameter>` tags inside other `<parameter>` tags",
            ""
        ])
        
        return "\n".join(feedback_parts)


class ValidationResult:
    """
    Data class for validation results.
    
    Provides a clean interface for validation outcomes with all necessary
    metadata for error handling and reprompting.
    """
    
    def __init__(
        self,
        is_valid: bool,
        error_message: Optional[str] = None,
        malformation_details: Optional[Dict[str, Any]] = None,
        tool_call: Optional[Dict[str, Any]] = None,
        raw_xml: Optional[str] = None
    ):
        self.is_valid = is_valid
        self.error_message = error_message
        self.malformation_details = malformation_details or {}
        self.tool_call = tool_call
        self.raw_xml = raw_xml
    
    def to_malformed_dict(self) -> Dict[str, Any]:
        """
        Convert to malformed call dictionary for handler.
        
        Returns:
            Dictionary with all info needed for error feedback generation
        """
        return {
            "tool_call": self.tool_call or {},
            "error": self.error_message or "Unknown validation error",
            "malformation": self.malformation_details,
            "raw_xml": self.raw_xml or ""
        }
