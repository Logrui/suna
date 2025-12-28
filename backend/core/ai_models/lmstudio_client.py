"""
LM Studio API client for discovering and querying local LM Studio models.

This module provides async methods to interact with the LM Studio API
for dynamic model discovery, metadata extraction, and model management.
"""

from typing import List, Dict, Optional, Any
import httpx
from core.utils.logger import logger
from core.utils.config import config


class LMStudioClient:
    """Async client for LM Studio API interactions."""
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize LM Studio client.
        
        Args:
            base_url: LM Studio API base URL (e.g., http://localhost:1234)
                     If None, uses LM_STUDIO_API_BASE or defaults to localhost:1234
        """
        if base_url:
            self.base_url = base_url.rstrip('/v1').rstrip('/')
        elif hasattr(config, 'LM_STUDIO_API_BASE') and config.LM_STUDIO_API_BASE:
            logger.debug(f"Using LM_STUDIO_API_BASE: {config.LM_STUDIO_API_BASE}")
            self.base_url = config.LM_STUDIO_API_BASE.rstrip('/v1').rstrip('/')
        else:
            # Default - use host.docker.internal for Docker networking
            self.base_url = "http://host.docker.internal:1234"
        
        self._model_cache: Dict[str, Dict[str, Any]] = {}
        logger.debug(f"LMStudioClient initialized with base_url: {self.base_url}")
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """
        List all available LM Studio models.
        
        Returns:
            List of model dictionaries from /api/v0/models
            
        Raises:
            httpx.HTTPError: If API request fails
        """
        url = f"{self.base_url}/api/v0/models"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                models = data.get("data", [])
                logger.debug(f"Found {len(models)} LM Studio models")
                return models
                
        except httpx.HTTPError as e:
            logger.error(f"Failed to list LM Studio models: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error listing LM Studio models: {e}")
            raise
    
    async def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific model.
        
        Args:
            model_id: ID of the model (e.g., "hermes-2-pro-mistral-7b")
            
        Returns:
            Model info dictionary from /api/v0/models/{id}
            
        Raises:
            httpx.HTTPError: If API request fails
        """
        # Check cache first
        if model_id in self._model_cache:
            logger.debug(f"Using cached model info for {model_id}")
            return self._model_cache[model_id]
        
        url = f"{self.base_url}/api/v0/models/{model_id}"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                model_info = response.json()
                
                # Cache the result
                self._model_cache[model_id] = model_info
                return model_info
                
        except httpx.HTTPError as e:
            logger.error(f"Failed to get LM Studio model info for {model_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting LM Studio model info: {e}")
            raise
    
    async def unload_model(self, model_id: str) -> bool:
        """
        Unload a model from GPU memory.
        
        Args:
            model_id: ID of the model to unload
            
        Returns:
            True if unload was successful
            
        Raises:
            httpx.HTTPError: If API request fails
        """
        url = f"{self.base_url}/api/v0/models/unload"
        payload = {"model": model_id}
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                logger.info(f"Successfully unloaded model {model_id}")
                return True
                
        except httpx.HTTPError as e:
            logger.error(f"Failed to unload LM Studio model {model_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error unloading model: {e}")
            raise
    
    async def get_context_window(self, model_id: str) -> Optional[int]:
        """
        Get the context window size for a specific LM Studio model.
        
        Args:
            model_id: ID of the model (e.g., "google/gemma-3-27b")
            
        Returns:
            Context window size in tokens, or None if not available
        """
        try:
            model_info = await self.get_model_info(model_id)
            max_context = model_info.get("max_context_length")
            
            if max_context and isinstance(max_context, int):
                logger.debug(f"LM Studio model {model_id} has context window: {max_context}")
                return max_context
            
            logger.warning(f"LM Studio model {model_id} missing max_context_length in API response")
            return None
            
        except Exception as e:
            logger.warning(f"Could not fetch context window for LM Studio model {model_id}: {e}")
            return None
    
    async def is_available(self) -> bool:
        """
        Check if LM Studio server is available.
        
        Returns:
            True if server is reachable, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/v0/models")
                response.raise_for_status()
                return True
        except Exception as e:
            logger.debug(f"LM Studio server not available: {e}")
            return False
