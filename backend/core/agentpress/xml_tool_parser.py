"""
XML Tool Call Parser Module

This module provides a reliable XML tool call parsing system that supports
the XML format with structured function_calls blocks.
"""

import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import json
import logging

from core.agentpress.tool_validation import ToolCallValidator

logger = logging.getLogger(__name__)


@dataclass
class XMLToolCall:
    """Represents a parsed XML tool call."""
    function_name: str
    parameters: Dict[str, Any]
    raw_xml: str
    parsing_details: Dict[str, Any]


class XMLToolParser:
    """
    Parser for XML tool calls format:
    
    <function_calls>
    <invoke name="function_name">
    <parameter name="param_name">param_value</parameter>
    ...
    </invoke>
    </function_calls>
    """
    
    # Regex patterns for extracting XML blocks
    FUNCTION_CALLS_PATTERN = re.compile(
        r'<function_calls>(.*?)</function_calls>',
        re.DOTALL | re.IGNORECASE
    )
    
    INVOKE_PATTERN = re.compile(
        r'<invoke\s+name=["\']([^"\']+)["\']>(.*?)</invoke>',
        re.DOTALL | re.IGNORECASE
    )
    
    PARAMETER_PATTERN = re.compile(
        r'<parameter\s+name=["\']([^"\']+)["\']>(.*?)</parameter>',
        re.DOTALL | re.IGNORECASE
    )
    
    def __init__(self, tool_registry=None):
        """
        Initialize the XML tool parser.
        
        Args:
            tool_registry: Optional ToolRegistry for validation (if None, validation is skipped)
        """
        self.validator = ToolCallValidator(tool_registry) if tool_registry else None
    
    def validate_tool_call(
        self, 
        tool_call: XMLToolCall
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        Validate a parsed tool call for malformations.
        
        This method performs basic XML structure validation and delegates
        to the ToolCallValidator for schema validation if a registry is available.
        
        Args:
            tool_call: The parsed XMLToolCall object
            
        Returns:
            Tuple of (is_valid, error_message, malformation_details)
        """
        # First check basic XML structure
        malformation_details = {}
        
        # Check 1: Detect XML strings in parameter values
        for param_name, param_value in tool_call.parameters.items():
            if isinstance(param_value, str):
                # Check for nested XML tags (indicating malformed parsing)
                if '<parameter' in param_value:
                    malformation_details[param_name] = {
                        'type': 'nested_xml_detected',
                        'value_preview': param_value[:200].replace('\n', '\\n'),
                        'full_length': len(param_value)
                    }
                # Check for unclosed tags
                elif param_value.count('<') != param_value.count('>'):
                    malformation_details[param_name] = {
                        'type': 'unbalanced_brackets',
                        'value_preview': param_value[:200]
                    }
        
        # Check 2: Validate XML structure balance in raw XML
        raw_xml = tool_call.raw_xml
        open_tags = raw_xml.count('<parameter')
        close_tags = raw_xml.count('</parameter>')
        
        if open_tags != close_tags:
            malformation_details['xml_structure'] = {
                'type': 'unbalanced_tags',
                'open_count': open_tags,
                'close_count': close_tags
            }
        
        # Return early if basic XML validation failed
        if malformation_details:
            error_msg = f"Malformed tool call '{tool_call.function_name}': {', '.join(malformation_details.keys())}"
            return False, error_msg, malformation_details
        
        # Delegate to validator for schema validation if available
        if self.validator:
            tool_call_dict = {
                'function_name': tool_call.function_name,
                'arguments': tool_call.parameters
            }
            return self.validator.validate_tool_call(
                tool_call_dict,
                tool_call.parsing_details
            )
        
        return True, None, None
    
    def parse_content(self, content: str) -> List[XMLToolCall]:
        """
        Parse XML tool calls from content.
        
        Args:
            content: The text content potentially containing XML tool calls
            
        Returns:
            List of parsed XMLToolCall objects
        """
        tool_calls = []
        
        # Find function_calls blocks
        function_calls_matches = self.FUNCTION_CALLS_PATTERN.findall(content)
        
        for fc_content in function_calls_matches:
            # Find all invoke blocks within this function_calls block
            invoke_matches = self.INVOKE_PATTERN.findall(fc_content)
            
            for function_name, invoke_content in invoke_matches:
                try:
                    tool_call = self._parse_invoke_block(
                        function_name, 
                        invoke_content,
                        fc_content
                    )
                    if tool_call:
                        tool_calls.append(tool_call)
                except Exception as e:
                    logger.error(f"Error parsing invoke block for {function_name}: {e}")
        
        return tool_calls
    
    def _parse_invoke_block(
        self, 
        function_name: str, 
        invoke_content: str,
        full_block: str
    ) -> Optional[XMLToolCall]:
        """Parse a single invoke block into an XMLToolCall."""
        parameters = {}
        parsing_details = {
            "function_name": function_name,
            "raw_parameters": {}
        }
        
        # Extract all TOP-LEVEL parameters only (not nested ones)
        # This regex uses a non-greedy match and stops at the first </parameter>
        param_pattern = re.compile(
            r'<parameter\s+name=["\']([^"\']+)["\']>([^<]*(?:<(?!parameter)[^>]*>[^<]*)*)</parameter>',
            re.DOTALL | re.IGNORECASE
        )
        param_matches = param_pattern.findall(invoke_content)
        
        for param_name, param_value in param_matches:
            # Clean up the parameter value
            param_value = param_value.strip()
            
            # If the parameter value contains nested <parameter> tags, extract them
            if '<parameter' in param_value:
                # This looks like improperly nested XML - try to extract as structured data
                parsed_value = self._parse_nested_parameters(param_value)
            else:
                # Try to parse as JSON if it looks like JSON
                parsed_value = self._parse_parameter_value(param_value)
            
            parameters[param_name] = parsed_value
            parsing_details["raw_parameters"][param_name] = param_value
        
        # PHASE 1 FIX: Ensure all parameter values are safe for string operations
        # Convert any remaining lists or dicts to JSON strings
        for param_name, param_value in parameters.items():
            if isinstance(param_value, list):
                # Convert lists to JSON strings
                parameters[param_name] = json.dumps(param_value)
                logger.debug(f"Converted list parameter '{param_name}' to JSON string")
            elif isinstance(param_value, dict):
                # Convert dicts to JSON strings
                parameters[param_name] = json.dumps(param_value)
                logger.debug(f"Converted dict parameter '{param_name}' to JSON string")
        
        # Extract the raw XML for this specific invoke
        invoke_pattern = re.compile(
            rf'<invoke\s+name=["\']{re.escape(function_name)}["\']>.*?</invoke>',
            re.DOTALL | re.IGNORECASE
        )
        raw_xml_match = invoke_pattern.search(full_block)
        raw_xml = raw_xml_match.group(0) if raw_xml_match else f"<invoke name=\"{function_name}\">...</invoke>"
        
        return XMLToolCall(
            function_name=function_name,
            parameters=parameters,
            raw_xml=raw_xml,
            parsing_details=parsing_details
        )
    
    def _parse_nested_parameters(self, nested_xml: str) -> Any:
        """
        Parse improperly nested parameters from XML content.
        
        When LLM generates nested <parameter> tags, extract them as a structured list/dict.
        Example:
            <parameter name="tasks">
            <parameter name="task">Task 1</parameter>
            <parameter name="task">Task 2</parameter>
            </parameter>
        
        Args:
            nested_xml: XML content with nested parameter tags
            
        Returns:
            List of extracted parameter values
        """
        try:
            # Extract all nested <parameter> tags
            nested_pattern = re.compile(
                r'<parameter\s+name=["\']([^"\']+)["\']>([^<]*)</parameter>',
                re.DOTALL | re.IGNORECASE
            )
            matches = nested_pattern.findall(nested_xml)
            
            if matches:
                # If all nested parameters have the same name, return as list of values
                # Otherwise return as dict
                names = [name for name, _ in matches]
                values = [self._parse_parameter_value(value.strip()) for _, value in matches]
                
                if len(set(names)) == 1:
                    # All same parameter name - return as JSON string to prevent concatenation errors
                    result = values if len(values) > 1 else values[0] if values else None
                    # CRITICAL FIX: Convert list to JSON string to prevent "can only concatenate str (not 'list') to str" error
                    if isinstance(result, list):
                        return json.dumps(result)
                    return result
                else:
                    # Different names - return as dict (also convert to JSON string for safety)
                    result_dict = {name: value for name, value in zip(names, values)}
                    return json.dumps(result_dict)
            
            # If no nested parameters found, return the raw value
            return nested_xml.strip()
            
        except Exception as e:
            logger.error(f"Error parsing nested parameters: {e}")
            return nested_xml.strip()
    
    def _parse_parameter_value(self, value: str) -> Any:
        """
        Parse a parameter value, attempting to convert to appropriate type.
        
        Args:
            value: The string value to parse
            
        Returns:
            Parsed value (could be dict, list, bool, int, float, or str)
        """
        value = value.strip()
        
        # Try to parse as JSON first
        if value.startswith(('{', '[')):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass
        
        # Try to parse as boolean
        if value.lower() in ('true', 'false'):
            return value.lower() == 'true'
        
        # Try to parse as number
        try:
            if '.' in value:
                return float(value)
            else:
                return int(value)
        except ValueError:
            pass
        
        # Return as string
        return value
      
    def format_tool_call(self, function_name: str, parameters: Dict[str, Any]) -> str:
        """
        Format a tool call in the XML format.
        
        Args:
            function_name: Name of the function to call
            parameters: Dictionary of parameters
            
        Returns:
            Formatted XML string
        """
        lines = ['<function_calls>', '<invoke name="{}">'.format(function_name)]
        
        for param_name, param_value in parameters.items():
            # Convert value to string representation
            if isinstance(param_value, (dict, list)):
                value_str = json.dumps(param_value)
            elif isinstance(param_value, bool):
                value_str = str(param_value).lower()
            else:
                value_str = str(param_value)
            
            lines.append('<parameter name="{}">{}</parameter>'.format(
                param_name, value_str
            ))
        
        lines.extend(['</invoke>', '</function_calls>'])
        return '\n'.join(lines)
    
    def validate_tool_call(self, tool_call: XMLToolCall, expected_params: Optional[Dict[str, type]] = None) -> Tuple[bool, Optional[str]]:
        """
        Validate a tool call against expected parameters.
        
        Args:
            tool_call: The XMLToolCall to validate
            expected_params: Optional dict of parameter names to expected types
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not tool_call.function_name:
            return False, "Function name is required"
        
        if expected_params:
            for param_name, expected_type in expected_params.items():
                if param_name not in tool_call.parameters:
                    return False, f"Missing required parameter: {param_name}"
                
                param_value = tool_call.parameters[param_name]
                if not isinstance(param_value, expected_type):
                    return False, f"Parameter {param_name} should be of type {expected_type.__name__}"
        
        return True, None


# Convenience function for quick parsing
def parse_xml_tool_calls(content: str) -> List[XMLToolCall]:
    """
    Parse XML tool calls from content.
    
    Args:
        content: The text content potentially containing XML tool calls
        
    Returns:
        List of parsed XMLToolCall objects
    """
    parser = XMLToolParser()
    return parser.parse_content(content) 