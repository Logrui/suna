"""
Model management API endpoints for local LLM providers.

Provides endpoints for:
- Warming up (loading) models into GPU
- Unloading models from GPU
- Checking model status
- Unloading entire providers (for provider switching)

All endpoints return immediately (non-blocking), with actual operations
running as background async tasks. Real-time status is communicated
via WebSocket events.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import asyncio
import time
import httpx

from core.utils.logger import logger
from core.websocket import broadcaster
from core.ai_models.lmstudio_client import LMStudioClient
from core.ai_models.ollama_client import OllamaClient
from core.ai_models.excluded_models import is_model_excluded, get_excluded_count


# Request/Response Models
class WarmupRequest(BaseModel):
    """Request to warm up (load) a model."""
    model_id: str
    provider: str  # "lm_studio" or "ollama"


class UnloadRequest(BaseModel):
    """Request to unload a model."""
    model_id: str
    provider: str  # "lm_studio" or "ollama"


class UnloadProviderRequest(BaseModel):
    """Request to unload all models from a provider."""
    provider: str  # "lm_studio" or "ollama"


class WarmupResponse(BaseModel):
    """Response to warmup request."""
    status: str
    model_id: str
    estimated_time: int


class UnloadResponse(BaseModel):
    """Response to unload request."""
    status: str
    model_id: str


class UnloadProviderResponse(BaseModel):
    """Response to unload provider request."""
    status: str
    provider: str
    models_unloaded: List[str]
    count: int


class ModelStatusResponse(BaseModel):
    """Response with model status."""
    model_id: str
    provider: str
    status: str  # "loaded", "loading", "unloaded", "error"
    load_time_ms: Optional[int] = None
    context_window: Optional[int] = None
    quantization: Optional[str] = None
    timestamp: str


# Global state tracking
_model_load_times: dict[str, float] = {}  # Track when models started loading
_loading_models: set[str] = set()  # Track models currently loading


# Initialize clients
lmstudio_client = LMStudioClient()
ollama_client = OllamaClient()


def get_provider_client(provider: str):
    """Get the appropriate client for a provider."""
    if provider == "lm_studio":
        return lmstudio_client
    elif provider == "ollama":
        return ollama_client
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")


# Router
router = APIRouter(prefix="/models", tags=["models"])


# Background Tasks

async def _trigger_model_load(model_id: str, provider: str) -> None:
    """
    Background task: Load model into GPU.
    
    Broadcasts WebSocket events on progress:
    - model_loading: When load task starts
    - model_loaded: When load completes successfully
    - model_load_failed: When load fails
    """
    load_start_time = time.time()
    _model_load_times[f"{provider}:{model_id}"] = load_start_time
    _loading_models.add(f"{provider}:{model_id}")
    
    try:
        # Broadcast: Loading started
        await broadcaster.broadcast_model_loading(
            model_id=model_id,
            provider=provider,
            estimated_time=15
        )
        
        # Get provider client and load model
        # Model auto-loads into GPU on first inference request
        try:
            # Get the configured base URL from the provider client
            client = get_provider_client(provider)
            base_url = client.base_url
            
            # Make dummy inference request to trigger load
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{base_url}/v1/chat/completions",
                    json={
                        "model": model_id,
                        "messages": [{"role": "user", "content": "test"}],
                        "max_tokens": 1
                    }
                )
                response.raise_for_status()
            
            # Calculate load time
            load_time_ms = int((time.time() - load_start_time) * 1000)
            
            # Broadcast: Loading succeeded
            await broadcaster.broadcast_model_loaded(
                model_id=model_id,
                provider=provider,
                load_time_ms=load_time_ms
            )
            logger.info(f"Model {model_id} loaded successfully in {load_time_ms}ms")
            
        except httpx.ConnectError as e:
            error_msg = f"Cannot connect to {provider} (port {'1234' if provider == 'lm_studio' else '11434'})"
            await broadcaster.broadcast_model_load_failed(
                model_id=model_id,
                provider=provider,
                error=error_msg,
                error_code="CONNECT_ERROR"
            )
            logger.error(f"Model load failed: {error_msg}")
            
        except httpx.TimeoutException as e:
            error_msg = f"Model loading timeout after 120s"
            await broadcaster.broadcast_model_load_failed(
                model_id=model_id,
                provider=provider,
                error=error_msg,
                error_code="TIMEOUT"
            )
            logger.error(f"Model load failed: {error_msg}")
            
        except Exception as e:
            error_msg = f"Model loading error: {str(e)}"
            await broadcaster.broadcast_model_load_failed(
                model_id=model_id,
                provider=provider,
                error=error_msg,
                error_code="UNKNOWN"
            )
            logger.error(f"Model load failed: {error_msg}")
    
    finally:
        _loading_models.discard(f"{provider}:{model_id}")


async def _unload_model(model_id: str, provider: str) -> None:
    """
    Background task: Unload model from GPU.
    
    Broadcasts WebSocket event when complete:
    - model_unloading: When unload task starts
    """
    try:
        # Broadcast: Unloading started
        await broadcaster.broadcast_model_unloading(
            model_id=model_id,
            provider=provider
        )
        
        # Call provider-specific unload endpoint
        if provider == "lm_studio":
            try:
                # Get the configured base URL from the provider client
                client_instance = get_provider_client(provider)
                base_url = client_instance.base_url
                
                async with httpx.AsyncClient(timeout=10.0) as http_client:
                    await http_client.post(
                        f"{base_url}/api/v0/models/unload",
                        json={"model": model_id}
                    )
                logger.info(f"Model {model_id} unloaded from {provider}")
            except Exception as e:
                logger.warning(f"Failed to unload {model_id} from {provider}: {e}")
        
        elif provider == "ollama":
            # Ollama doesn't have a direct unload API
            # Models unload automatically based on timeout (keep_alive)
            # This is a no-op for API compatibility
            logger.info(f"Ollama unload requested for {model_id} (will auto-unload)")
    
    except Exception as e:
        logger.error(f"Error during model unload: {e}")


# Response Models for list endpoint
class LocalModel(BaseModel):
    """Local model metadata."""
    id: str  # Full model ID with provider prefix
    name: str  # Display name
    provider: str  # "lm_studio" or "ollama"
    loaded: bool  # Whether model is currently loaded
    context_window: Optional[int] = None
    quantization: Optional[str] = None


class LocalModelsResponse(BaseModel):
    """Response with list of available local models."""
    lm_studio: List[LocalModel] = []
    ollama: List[LocalModel] = []


# Ollama model context window mapping (since Ollama API doesn't provide this)
# Ollama model context window mapping (since Ollama API doesn't provide this)
# DEPRECATED: We now use dynamic extraction via OllamaClient.extract_context_window
# This dictionary is removed to prevent maintenance burden and inconsistency.


@router.get("/local", response_model=LocalModelsResponse)
async def list_local_models():
    """
    List all available models from local providers (LM Studio & Ollama).
    
    Returns models with provider metadata for correct icon/branding display.
    Model IDs are prefixed with provider for easy detection:
    - lm_studio:model-name
    - ollama:model-name
    
    Returns:
        LocalModelsResponse with models grouped by provider
    """
    lmstudio_models: List[LocalModel] = []
    ollama_models: List[LocalModel] = []
    
    # Fetch LM Studio models
    try:
        lmstudio_client = LMStudioClient()
        models = await lmstudio_client.list_models()
        
        for model in models:
            model_id = model.get("id") or model.get("model_name", "unknown")
            # Prefix with provider for easy detection in frontend
            prefixed_id = f"lm_studio:{model_id}"
            
            # Skip excluded models
            if is_model_excluded(prefixed_id, "lm_studio"):
                logger.debug(f"Skipping excluded LM Studio model: {prefixed_id}")
                continue
            
            lmstudio_models.append(
                LocalModel(
                    id=prefixed_id,
                    name=model_id,
                    provider="lm_studio",
                    loaded=model.get("loaded", False),
                    context_window=model.get("max_context_length") or model.get("context_window"),
                    quantization=model.get("quantization")
                )
            )
        
        logger.info(f"Listed {len(lmstudio_models)} LM Studio models (after filtering excluded models)")
        
    except Exception as e:
        logger.warning(f"Could not list LM Studio models: {e}")
    
    # Fetch Ollama models
    try:
        ollama_client = OllamaClient()
        models = await ollama_client.list_models()
        
        for model in models:
            model_id = model.get("name") or model.get("model_name", "unknown")
            # Prefix with provider for easy detection in frontend
            prefixed_id = f"ollama:{model_id}"
            
            # Get detailed model info for context window extraction
            try:
                model_info = await ollama_client.get_model_info(model_id)
                context_window = ollama_client.extract_context_window(model_info)
            except Exception as e:
                logger.warning(f"Failed to get details for Ollama model {model_id}: {e}")
                context_window = 131_072  # Fallback to 128k default
            
            # Skip excluded models (checking both ID and context window)
            if is_model_excluded(prefixed_id, "ollama", context_window=context_window):
                logger.debug(f"Small Context Window Ollama model Detected - Excluding: {prefixed_id} (context: {context_window}) - excluded by context size (<64k) or manual override")
                continue
            
            ollama_models.append(
                LocalModel(
                    id=prefixed_id,
                    name=model_id,
                    provider="ollama",
                    loaded=model.get("loaded", False),
                    context_window=context_window,
                    quantization=model.get("quantization")
                )
            )
        
        logger.info(f"Listed {len(ollama_models)} Ollama models (after filtering excluded models)")
        
    except Exception as e:
        logger.warning(f"Could not list Ollama models: {e}")
    
    return LocalModelsResponse(
        lm_studio=lmstudio_models,
        ollama=ollama_models
    )


@router.post("/warmup", response_model=WarmupResponse)
async def warmup_model(request: WarmupRequest, background_tasks: BackgroundTasks):
    """
    Trigger background model loading into GPU.
    
    Returns immediately (< 100ms) while actual loading happens asynchronously.
    Real-time status is communicated via WebSocket events:
    - model_loading: When load starts
    - model_loaded: When load completes
    - model_load_failed: When load fails
    
    Args:
        model_id: ID of model to load
        provider: "lm_studio" or "ollama"
    
    Returns:
        Immediate response with status and estimated load time
    """
    try:
        # Validate provider
        provider = request.provider.lower()
        if provider not in ["lm_studio", "ollama"]:
            raise HTTPException(status_code=400, detail="Provider must be 'lm_studio' or 'ollama'")
        
        # Check provider availability
        if provider == "lm_studio":
            is_available = await lmstudio_client.is_available()
        else:
            is_available = await ollama_client.is_available()
        
        if not is_available:
            raise HTTPException(
                status_code=503,
                detail=f"Provider {provider} is not available"
            )
        
        # Spawn async task for background loading (don't wait for it)
        asyncio.create_task(_trigger_model_load(request.model_id, provider))
        
        # Return immediately to frontend
        logger.info(f"Warmup request received for {request.model_id} on {provider}")
        return WarmupResponse(
            status="warming_up",
            model_id=request.model_id,
            estimated_time=15
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in warmup endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unload", response_model=UnloadResponse)
async def unload_model(request: UnloadRequest):
    """
    Trigger background model unloading from GPU.
    
    Returns immediately (< 100ms) while unloading happens asynchronously.
    WebSocket event is sent when complete:
    - model_unloading: When unload completes
    
    Args:
        model_id: ID of model to unload
        provider: "lm_studio" or "ollama"
    
    Returns:
        Immediate response with status
    """
    try:
        # Validate provider
        provider = request.provider.lower()
        if provider not in ["lm_studio", "ollama"]:
            raise HTTPException(status_code=400, detail="Provider must be 'lm_studio' or 'ollama'")
        
        # Spawn async task for background unloading (don't wait for it)
        asyncio.create_task(_unload_model(request.model_id, provider))
        
        # Return immediately
        logger.info(f"Unload request received for {request.model_id} on {provider}")
        return UnloadResponse(
            status="unloading",
            model_id=request.model_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in unload endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unload_provider", response_model=UnloadProviderResponse)
async def unload_provider(request: UnloadProviderRequest):
    """
    Unload ALL models from a specific provider.
    
    Used when switching between providers (LM Studio ↔ Ollama) to ensure
    clean provider switching and avoid VRAM conflicts.
    
    Returns immediately while unloading all models asynchronously.
    
    Args:
        provider: "lm_studio" or "ollama"
    
    Returns:
        Immediate response with list of models being unloaded
    """
    try:
        provider = request.provider.lower()
        if provider not in ["lm_studio", "ollama"]:
            raise HTTPException(status_code=400, detail="Provider must be 'lm_studio' or 'ollama'")
        
        # Get list of loaded models
        try:
            if provider == "lm_studio":
                models_response = await lmstudio_client.list_models()
                # Filter to loaded models
                loaded_models = [m["id"] for m in models_response if m.get("state") == "loaded"]
            else:  # ollama
                models_response = await ollama_client.list_models()
                # Ollama doesn't track individual load state, assume all are potentially loaded
                loaded_models = [m["name"] for m in models_response]
        except Exception as e:
            logger.warning(f"Could not get list of loaded models for {provider}: {e}")
            loaded_models = []
        
        # Spawn unload tasks for each model
        for model_id in loaded_models:
            asyncio.create_task(_unload_model(model_id, provider))
        
        logger.info(f"Unloading {len(loaded_models)} models from {provider}")
        return UnloadProviderResponse(
            status="unloading_provider",
            provider=provider,
            models_unloaded=loaded_models,
            count=len(loaded_models)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in unload_provider endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{model_id}/status", response_model=ModelStatusResponse)
async def get_model_status(model_id: str):
    """
    Check current status of a model.
    
    Returns immediately with current load status.
    
    Args:
        model_id: ID of model to check
    
    Returns:
        Current model status
    """
    try:
        # Determine if model is currently loading
        status = "unloaded"
        
        for provider in ["lm_studio", "ollama"]:
            key = f"{provider}:{model_id}"
            if key in _loading_models:
                status = "loading"
                break
        
        logger.debug(f"Status check for {model_id}: {status}")
        
        return ModelStatusResponse(
            model_id=model_id,
            provider="unknown",
            status=status,
            load_time_ms=None,
            context_window=None,
            quantization=None,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error in status endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
