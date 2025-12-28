"""
Tool Schema Adapter for Gemini/Vertex AI Compatibility

Gemini has strict schema requirements that differ from OpenAI/Anthropic:
1. No `oneOf` or `anyOf` at any level of the schema
2. `required` arrays can only appear inside objects with `type: "object"`
3. No nested conditional structures

This adapter transforms tool schemas at runtime to be compatible with Gemini
while preserving full functionality through runtime argument normalization.
"""

import json
import copy
import logging
import inspect
from typing import List, Dict, Any, Union, Optional
from core.ai_models import ModelProvider
from core.utils.logger import logger


def adapt_tool_schemas(tools: List[Dict[str, Any]], provider: Optional[Union[str, ModelProvider]] = None) -> List[Dict[str, Any]]:
    """
    Adapts tool schemas for specific providers.
    Specifically handles Google/Gemini's strict requirement for no 'oneOf'/'anyOf' in schemas.
    
    Args:
        tools: List of tool definitions in OpenAPI format
        provider: The model provider (used to determine if adaptation is needed)
        
    Returns:
        Adapted tool schemas (deep copy, originals are not modified)
    """
    if not tools:
        return tools
    
    # Check if provider is Google/Vertex
    is_google = False
    if provider:
        if isinstance(provider, ModelProvider):
            is_google = provider in (ModelProvider.GOOGLE, ModelProvider.VERTEX_AI)
        elif isinstance(provider, str):
            is_google = provider.lower() in ("google", "vertex_ai", "gemini")
            
    if not is_google:
        return tools

    logger.debug(f"🔧 Adapting {len(tools)} tool schemas for Google/Gemini compatibility")
    
    # Deep copy tools to avoid modifying originals in registry cache
    adapted_tools = copy.deepcopy(tools)
    
    for tool in adapted_tools:
        if "function" in tool:
            params = tool["function"].get("parameters", {})
            _sanitize_schema_for_gemini(params)
            
    return adapted_tools


def _sanitize_schema_for_gemini(schema: Dict[str, Any], depth: int = 0) -> None:
    """
    Recursively sanitizes a schema object to be Gemini-compatible.
    
    Handles:
    1. Removing `anyOf`/`oneOf` at the root level of parameters
    2. Converting polymorphic property types to simple string types
    3. Removing `required` arrays from non-object contexts
    4. Recursively processing nested objects and arrays
    
    Modifies the schema in-place.
    """
    if not isinstance(schema, dict):
        return
        
    # Remove root-level anyOf/oneOf (conditional requirements)
    # These are typically used for "one of these groups of fields is required"
    # For Gemini, we make all fields optional and let the tool validate
    if "anyOf" in schema:
        logger.debug(f"{'  ' * depth}Removing root-level 'anyOf' from schema")
        del schema["anyOf"]
        
    if "oneOf" in schema:
        logger.debug(f"{'  ' * depth}Removing root-level 'oneOf' from schema")
        del schema["oneOf"]
    
    # Remove `required` if this is not an object type
    # Gemini error: "required: only allowed for OBJECT type"
    if "required" in schema and schema.get("type") != "object":
        logger.debug(f"{'  ' * depth}Removing 'required' from non-object schema (type={schema.get('type')})")
        del schema["required"]
    
    # Process properties
    if "properties" in schema:
        for prop_name, prop_def in schema["properties"].items():
            _sanitize_property(prop_name, prop_def, depth + 1)
    
    # Process array items
    if "items" in schema:
        items = schema["items"]
        if isinstance(items, dict):
            _sanitize_schema_for_gemini(items, depth + 1)


def _sanitize_property(prop_name: str, prop_def: Dict[str, Any], depth: int = 0) -> None:
    """
    Sanitizes a single property definition.
    
    Transforms oneOf/anyOf polymorphic types into simple string types
    with descriptive hints for JSON encoding.
    """
    if not isinstance(prop_def, dict):
        return
    
    # Handle nested objects recursively
    if prop_def.get("type") == "object":
        _sanitize_schema_for_gemini(prop_def, depth)
        return

    # Handle arrays - recurse into items
    if prop_def.get("type") == "array" and "items" in prop_def:
        items = prop_def["items"]
        if isinstance(items, dict):
            _sanitize_schema_for_gemini(items, depth)
        return

    # Handle oneOf/anyOf polymorphic types
    if "oneOf" in prop_def or "anyOf" in prop_def:
        options = prop_def.get("oneOf") or prop_def.get("anyOf")
        
        # Analyze the options to provide better hints
        has_string = any(opt.get("type") == "string" for opt in options if isinstance(opt, dict))
        has_array = any(opt.get("type") == "array" for opt in options if isinstance(opt, dict))
        has_object = any(opt.get("type") == "object" for opt in options if isinstance(opt, dict))
        
        # Build a helpful description
        original_desc = prop_def.get("description", "")
        type_hints = []
        if has_string:
            type_hints.append("string")
        if has_array:
            type_hints.append("JSON array string")
        if has_object:
            type_hints.append("JSON object string")
            
        hint = f" (Accepts: {' or '.join(type_hints)}. For arrays/objects, pass as JSON-encoded string.)"
        
        # Clear the property and set to string type
        keys_to_remove = ["oneOf", "anyOf", "items", "minItems", "maxItems", "enum"]
        for key in keys_to_remove:
            prop_def.pop(key, None)
            
        prop_def["type"] = "string"
        prop_def["description"] = original_desc + hint
        
        logger.debug(f"{'  ' * depth}Flattened '{prop_name}' from oneOf/anyOf to string type")


def normalize_tool_arguments(tool_fn: Any, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """
    Inspects the tool function signature and arguments.
    If an argument is expected to be a list/dict but received a string (from Gemini adaptation),
    attempts to JSON parse it.
    
    Args:
        tool_fn: The tool function to call
        arguments: The arguments dict from the LLM
        
    Returns:
        Normalized arguments with JSON strings parsed where appropriate
    """
    try:
        sig = inspect.signature(tool_fn)
        normalized = arguments.copy()
        
        for name, value in arguments.items():
            if name not in sig.parameters:
                continue
                
            param = sig.parameters[name]
            annotation = param.annotation
            
            # Skip if no type hint
            if annotation == inspect.Parameter.empty:
                continue
            
            # Check if we have a type mismatch: expected list/dict, got str
            if isinstance(value, str):
                # Get the string representation of the type annotation
                type_str = str(annotation).lower()
                
                # Check for complex types (list, dict, etc.)
                expected_complex = any(t in type_str for t in ["list", "dict", "array", "mapping"])
                
                # If value looks like JSON array/object
                stripped = value.strip()
                is_json_like = (
                    (stripped.startswith("[") and stripped.endswith("]")) or
                    (stripped.startswith("{") and stripped.endswith("}"))
                )
                
                if expected_complex and is_json_like:
                    try:
                        parsed = json.loads(value)
                        normalized[name] = parsed
                        logger.debug(f"🔄 Normalized argument '{name}': parsed JSON string to {type(parsed).__name__}")
                    except json.JSONDecodeError:
                        logger.warning(f"⚠️ Failed to parse JSON string for argument '{name}' despite expected complex type")
                        
        return normalized
        
    except Exception as e:
        logger.warning(f"⚠️ Error normalizing tool arguments: {e}")
        return arguments
