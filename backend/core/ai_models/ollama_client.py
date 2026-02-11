"""
Ollama API client for discovering and querying local Ollama models.

This module provides async methods to interact with the Ollama API
for dynamic model discovery and metadata extraction.
"""

from typing import List, Dict, Optional, Any
import httpx
from core.utils.logger import logger
from core.utils.config import config


class OllamaClient:
    """Async client for Ollama API interactions."""
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize Ollama client.
        
        Args:
            base_url: Ollama API base URL (e.g., http://localhost:11434)
                     If None, tries multiple strategies:
                     1. OLLAMA_API_BASE (explicit override for Docker)
                     2. OPENAI_COMPATIBLE_API_BASE (fallback)
                     3. Default localhost:11434
        """
        self.enabled = config.OLLAMA_ENABLED and (base_url or config.OLLAMA_API_BASE or config.OPENAI_COMPATIBLE_API_BASE)
        
        # Strategy 1: Use explicit OLLAMA_API_BASE if set (for Docker override)
        if base_url:
            self.base_url = base_url.rstrip('/v1').rstrip('/')
        elif config.OLLAMA_API_BASE:
            logger.debug(f"Using OLLAMA_API_BASE: {config.OLLAMA_API_BASE}")
            self.base_url = config.OLLAMA_API_BASE.rstrip('/v1').rstrip('/')
        elif config.OPENAI_COMPATIBLE_API_BASE:
            # Strategy 2: Extract from OPENAI_COMPATIBLE_API_BASE
            # Convert http://localhost:11434/v1 -> http://localhost:11434
            self.base_url = config.OPENAI_COMPATIBLE_API_BASE.rstrip('/v1').rstrip('/')
            logger.debug(f"Using OPENAI_COMPATIBLE_API_BASE: {self.base_url}")
        else:
            # Strategy 3: Default
            self.base_url = "http://localhost:11434"
        
        self._model_cache: Dict[str, Dict[str, Any]] = {}
        if self.enabled:
            logger.debug(f"OllamaClient initialized with base_url: {self.base_url}")
        else:
            logger.info("OllamaClient initialized but disabled via configuration")
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """
        List all available Ollama models.
        
        Returns:
            List of model dictionaries from /api/tags
            
        Raises:
            httpx.HTTPError: If API request fails
        """
        url = f"{self.base_url}/api/tags"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                models = data.get("models", [])
                logger.info(f"Found {len(models)} Ollama models")
                return models
                
        except httpx.HTTPError as e:
            logger.error(f"Failed to list Ollama models: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error listing Ollama models: {e}")
            raise
    
    async def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific model.
        
        Args:
            model_name: Name of the model (e.g., "llama3.2:latest")
            
        Returns:
            Model info dictionary from /api/show
            
        Raises:
            httpx.HTTPError: If API request fails
        """
        # Check cache first
        if model_name in self._model_cache:
            logger.debug(f"Using cached model info for {model_name}")
            return self._model_cache[model_name]
        
        url = f"{self.base_url}/api/show"
        payload = {"name": model_name, "verbose": True}
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                model_info = response.json()
                
                # Cache the result
                self._model_cache[model_name] = model_info
                logger.debug(f"Retrieved and cached info for {model_name}")
                
                return model_info
                
        except httpx.HTTPError as e:
            logger.error(f"Failed to get info for model {model_name}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting model info for {model_name}: {e}")
            raise
    
    def extract_context_window(self, data: Dict[str, Any]) -> Optional[int]:
        """
        Extract context window from model data.
        
        Args:
            data: Dictionary from /api/show (the root response)
            
        Returns:
            Context window size in tokens, or None if not found
        """
        # The API response contains a 'model_info' key which holds the actual metadata
        # If passed the root response, try to get the inner dictionary
        model_info = data.get('model_info', data)
        
        # Debug: Log available keys to help diagnose
        logger.debug(f"Extracting context. Keys in search scope: {list(model_info.keys())}")
        
        # Step 1: Search for ANY field ending with .context_length or _context_length
        for key, value in model_info.items():
            if key.endswith('.context_length') or key.endswith('_context_length'):
                logger.debug(f"Found context window via dynamic search {key}: {value}")
                return int(value)
        
        # Step 2: Fallback to exact match if pattern search fails
        if 'context_length' in model_info:
             logger.debug(f"Found context window via exact match 'context_length': {model_info['context_length']}")
             return int(model_info['context_length'])
             
        # Log that we are hitting the default
        logger.debug("No context window found in metadata via dynamic search or exact match.")
        
        # Return None if context window cannot be determined
        # The caller should decide whether to exclude the model or use a fallback
        logger.warning(f"Could not determine context window for model. Skipping default assignment.")
        return None

    
    def is_chat_model(self, capabilities: Optional[List[str]]) -> bool:
        """
        Check if model supports chat completion.
        
        Filters out embedding-only models.
        
        Args:
            capabilities: List of capabilities from model_info
            
        Returns:
            True if chat model, False if embedding-only
        """
        if not capabilities:
            # Assume chat if no capabilities listed
            return True
        
        # Has completion or tools capability = chat model
        if "completion" in capabilities or "tools" in capabilities:
            return True
        
        # Only has embedding = NOT a chat model
        if capabilities == ["embedding"]:
            logger.debug("Model is embedding-only, filtering out")
            return False
        
        # Default to chat model
        return True
    
    def construct_display_name(
        self, 
        model_info: Dict[str, Any], 
        details: Dict[str, Any],
        fallback_name: str
    ) -> str:
        """
        Construct human-friendly display name from model metadata.
        
        Format: "{ModelName} ({Quantization} - {Size})"
        Examples:
            - "Llama 3.2 (Q4_K_M - 3B)"
            - "DeepSeek-R1 (Q4_K_M - 8B)"
            - "GPT-OSS (Q4_0 - 20.9B)"
            
        Args:
            model_info: Dictionary from /api/show
            details: Details sub-dictionary with parameter_size, quantization_level
            fallback_name: Original model name to use if parsing fails
            
        Returns:
            Human-friendly display name
        """
        # Extract basic info
        quantization = details.get("quantization_level", "") if details else ""
        size_label = details.get("parameter_size", "") if details else ""
        
        # Parse the model name to get a nice display name
        # Start with fallback_name which looks like "llama3.2:latest" or "gpt-oss:latest"
        model_name_raw = fallback_name.split(':')[0]  # Remove :latest tag
        
        # Try to get basename from model_info first (more reliable if available)
        basename = model_info.get("general.basename", "")
        if basename:
            # If we have basename, use it - it's already nicely formatted
            display_model_name = basename
        else:
            # Otherwise, manually parse and format the model name
            # Convert "llama3.2" -> "Llama 3.2"
            # Convert "gpt-oss" -> "GPT-OSS"
            # Convert "deepseek-r1" -> "DeepSeek-R1"
            
            formatted = model_name_raw.replace('-', ' ').replace('_', ' ')
            words = formatted.split()
            
            # Special handling for known patterns
            if "gpt" in model_name_raw.lower():
                display_model_name = "GPT-OSS" if "gpt-oss" in model_name_raw.lower() else "GPT"
            elif "deepseek" in model_name_raw.lower():
                display_model_name = "-".join(word.capitalize() for word in words)
            elif "qwen" in model_name_raw.lower():
                # Handle qwen2.5-coder -> Qwen2.5 Coder
                display_model_name = model_name_raw.replace("-", " ").title()
            else:
                # Default: capitalize each word
                display_model_name = " ".join(word.capitalize() for word in words)
        
        # Build the final display name: "{Name} ({Quantization} - {Size})"
        if quantization and size_label:
            display_name = f"{display_model_name} ({quantization} - {size_label})"
        elif quantization:
            display_name = f"{display_model_name} ({quantization})"
        elif size_label:
            display_name = f"{display_model_name} ({size_label})"
        else:
            display_name = display_model_name
        
        logger.debug(f"Constructed display name: {display_name}")
        return display_name
