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
    
    PARAMETER_START_PATTERN = re.compile(
        r'<parameter\s+name=["\']([^"\']+)["\']>',
        re.IGNORECASE
    )
    
    def __init__(self):
        """Initialize the XML tool parser."""
        pass
    
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
        
        # Use a stack-based approach to extract parameters to handle nesting correctly
        # Regex fails on nested <parameter> tags because it stops at the first </parameter>
        
        current_pos = 0
        while current_pos < len(invoke_content):
            # Find the next parameter start
            param_start_match = self.PARAMETER_START_PATTERN.search(invoke_content, current_pos)
            if not param_start_match:
                break
            
            param_name = param_start_match.group(1)
            start_tag_end = param_start_match.end()
            
            # Find the matching closing tag using a stack
            # We start with depth 1 (the parameter we just found)
            depth = 1
            search_pos = start_tag_end
            content_end = -1
            
            # Scan for tags to balance the nesting
            while depth > 0 and search_pos < len(invoke_content):
                # Find next tag (open or close)
                # We look for <parameter...> or </parameter>
                next_tag_match = re.search(r'</?parameter\b[^>]*>', invoke_content[search_pos:], re.IGNORECASE)
                if not next_tag_match:
                    break
                
                tag = next_tag_match.group(0)
                if tag.lower().startswith('</parameter'):
                    depth -= 1
                    if depth == 0:
                        content_end = search_pos + next_tag_match.start()
                        # Update current_pos to continue searching after this parameter
                        current_pos = search_pos + next_tag_match.end()
                else:
                    # Check if it's a self-closing tag (unlikely for parameter but good to handle)
                    if not tag.endswith('/>'):
                        depth += 1
                
                search_pos += next_tag_match.end()
            
            if content_end != -1:
                param_value = invoke_content[start_tag_end:content_end]
                
                # Clean up the parameter value
                param_value = param_value.strip()
                
                # Try to parse as JSON if it looks like JSON
                parsed_value = self._parse_parameter_value(param_value)
                
                parameters[param_name] = parsed_value
                parsing_details["raw_parameters"][param_name] = param_value
            else:
                # Malformed or truncated XML, stop parsing or skip this parameter
                # If we can't find the closing tag, we can't safely extract the value
                logger.warning(f"Could not find closing tag for parameter '{param_name}' in tool call '{function_name}'")
                break
        
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