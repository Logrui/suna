
import unittest
import json
import logging
import sys
import os
import copy

# Add backend root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from typing import List, Dict, Union
from core.utils.tool_schema_adapter import adapt_tool_schemas, normalize_tool_arguments

# Configure logging to prevent spam
logging.basicConfig(level=logging.ERROR)


class TestGeminiSchemaAdapter(unittest.TestCase):
    """Tests for the Gemini schema adapter."""

    def test_property_level_oneOf_flattening(self):
        """Test that oneOf inside properties is flattened to string."""
        tools = [{
            "type": "function",
            "function": {
                "name": "test_tool",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "oneOf": [
                                {"type": "string"},
                                {"type": "array", "items": {"type": "string"}}
                            ],
                            "description": "A search query."
                        },
                        "simple": {
                            "type": "string"
                        }
                    }
                }
            }
        }]
        
        # Test generic provider (should not change)
        unchanged = adapt_tool_schemas(tools, provider="openai")
        self.assertIn("oneOf", json.dumps(unchanged))
        
        # Test Google provider
        adapted = adapt_tool_schemas(tools, provider="google")
        adapted_json = json.dumps(adapted)
        
        self.assertNotIn("oneOf", adapted_json)
        
        param_def = adapted[0]["function"]["parameters"]["properties"]["query"]
        self.assertEqual(param_def["type"], "string")
        self.assertIn("JSON", param_def["description"])

    def test_root_level_anyOf_removal(self):
        """Test that anyOf at the root of parameters is removed."""
        tools = [{
            "type": "function",
            "function": {
                "name": "create_tasks",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sections": {"type": "array", "items": {"type": "object"}},
                        "section_title": {"type": "string"},
                        "task_contents": {"type": "array", "items": {"type": "string"}}
                    },
                    "anyOf": [
                        {"required": ["sections"]},
                        {
                            "required": ["task_contents"],
                            "anyOf": [
                                {"required": ["section_title"]},
                                {"required": ["section_id"]}
                            ]
                        }
                    ]
                }
            }
        }]
        
        adapted = adapt_tool_schemas(tools, provider="google")
        adapted_json = json.dumps(adapted)
        
        self.assertNotIn("anyOf", adapted_json)
        # Properties should still exist
        self.assertIn("sections", adapted[0]["function"]["parameters"]["properties"])
        self.assertIn("section_title", adapted[0]["function"]["parameters"]["properties"])

    def test_nested_oneOf_and_anyOf_removal(self):
        """Test the delete_tasks-like schema with both anyOf and property-level oneOf."""
        tools = [{
            "type": "function",
            "function": {
                "name": "delete_tasks",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_ids": {
                            "oneOf": [
                                {"type": "string"},
                                {"type": "array", "items": {"type": "string"}, "minItems": 1}
                            ],
                            "description": "Task IDs to delete"
                        },
                        "section_ids": {
                            "oneOf": [
                                {"type": "string"},
                                {"type": "array", "items": {"type": "string"}, "minItems": 1}
                            ],
                            "description": "Section IDs to delete"
                        },
                        "confirm": {"type": "boolean"}
                    },
                    "anyOf": [
                        {"required": ["task_ids"]},
                        {"required": ["section_ids", "confirm"]}
                    ]
                }
            }
        }]
        
        adapted = adapt_tool_schemas(tools, provider="google")
        adapted_json = json.dumps(adapted)
        
        # No oneOf or anyOf anywhere
        self.assertNotIn("oneOf", adapted_json)
        self.assertNotIn("anyOf", adapted_json)
        
        # Properties should be converted to string
        props = adapted[0]["function"]["parameters"]["properties"]
        self.assertEqual(props["task_ids"]["type"], "string")
        self.assertEqual(props["section_ids"]["type"], "string")
        # Boolean should remain boolean
        self.assertEqual(props["confirm"]["type"], "boolean")

    def test_required_not_removed_from_object(self):
        """Test that required is preserved in proper object contexts."""
        tools = [{
            "type": "function",
            "function": {
                "name": "test",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"}
                    },
                    "required": ["name"]
                }
            }
        }]
        
        adapted = adapt_tool_schemas(tools, provider="google")
        # Required should still exist at the object level
        self.assertIn("required", adapted[0]["function"]["parameters"])
        self.assertEqual(adapted[0]["function"]["parameters"]["required"], ["name"])


class TestArgumentNormalization(unittest.TestCase):
    """Tests for argument normalization."""

    def test_json_string_to_list(self):
        """Test that JSON string arrays are parsed to lists."""
        def tool_func(query: List[str], other: Dict[str, str], simple: str):
            pass
            
        args = {
            "query": '["item1", "item2"]',
            "other": '{"key": "value"}',
            "simple": "normal"
        }
        
        normalized = normalize_tool_arguments(tool_func, args)
        
        self.assertIsInstance(normalized["query"], list)
        self.assertEqual(normalized["query"], ["item1", "item2"])
        
        self.assertIsInstance(normalized["other"], dict)
        self.assertEqual(normalized["other"]["key"], "value")
        
        self.assertEqual(normalized["simple"], "normal")

    def test_already_parsed_preserved(self):
        """Test that already-parsed lists/dicts are not modified."""
        def tool_func(query: List[str]):
            pass
            
        args = {"query": ["item1", "item2"]}
        normalized = normalize_tool_arguments(tool_func, args)
        
        self.assertIsInstance(normalized["query"], list)
        self.assertEqual(normalized["query"], ["item1", "item2"])

    def test_malformed_json_kept_as_string(self):
        """Test that malformed JSON strings are kept as-is."""
        def tool_func(query: List[str]):
            pass
            
        args = {"query": '["item1", numeric_error]'}
        normalized = normalize_tool_arguments(tool_func, args)
        
        # Should remain a string since JSON parsing failed
        self.assertIsInstance(normalized["query"], str)


if __name__ == "__main__":
    unittest.main()
