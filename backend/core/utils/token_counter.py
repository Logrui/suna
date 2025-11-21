"""
Token counting utilities for tracking usage by component.
"""

import tiktoken
from typing import Dict, List, Any, Optional
from core.utils.logger import logger


class TokenCounter:
    """Count tokens for different text components."""
    
    def __init__(self, model: str = "gpt-4"):
        """Initialize with model-specific tokenizer."""
        try:
            # Try to get model-specific encoding
            self.encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            # Fallback to cl100k_base for unknown models (works for most modern models)
            logger.debug(f"Model {model} not found in tiktoken, using cl100k_base encoding")
            self.encoding = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if not text:
            return 0
        try:
            return len(self.encoding.encode(text))
        except Exception as e:
            logger.warning(f"Error counting tokens: {e}")
            # Rough estimate: ~4 characters per token
            return len(text) // 4
    
    def count_messages_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """Count tokens in a list of messages."""
        total = 0
        for message in messages:
            # Account for message formatting tokens
            # Format: <|im_start|>role\ncontent<|im_end|>\n
            total += 4  # Message formatting overhead
            
            # Count content tokens
            content = message.get('content', '')
            if isinstance(content, str):
                total += self.count_tokens(content)
            elif isinstance(content, list):
                # Handle multi-part content (e.g., vision models)
                for part in content:
                    if isinstance(part, dict) and 'text' in part:
                        total += self.count_tokens(part['text'])
            
            # Count name tokens if present
            if message.get('name'):
                total += self.count_tokens(message['name'])
        
        # Add tokens for conversation start
        total += 2  # <|im_start|>assistant
        
        return total
    
    def count_tools_tokens(self, tools: List[Dict[str, Any]]) -> int:
        """Count tokens in tool definitions."""
        import json
        try:
            tools_json = json.dumps(tools, ensure_ascii=False)
            return self.count_tokens(tools_json)
        except Exception as e:
            logger.warning(f"Error counting tool tokens: {e}")
            return 0
