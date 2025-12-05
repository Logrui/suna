"""
LLM API interface for making calls to various language models.

This module provides a unified interface for making API calls to different LLM providers
using LiteLLM with simplified error handling and clean parameter management.
"""

from typing import Union, Dict, Any, Optional, AsyncGenerator, List
import os
import asyncio
import litellm
from litellm.router import Router
from litellm.files.main import ModelResponse
from core.utils.logger import logger
from core.utils.config import config
from core.agentpress.error_processor import ErrorProcessor

# Configure LiteLLM
# os.environ['LITELLM_LOG'] = 'DEBUG'
# litellm.set_verbose = True  # Enable verbose logging
litellm.modify_params = True
litellm.drop_params = True

# Enable additional debug logging
# import logging
# litellm_logger = logging.getLogger("LiteLLM")
# litellm_logger.setLevel(logging.DEBUG)

# Constants
MAX_RETRIES = 3
provider_router = None


class LLMError(Exception):
    """Exception for LLM-related errors."""
    pass

# Thread-local storage for fallback events using ContextVars
from contextvars import ContextVar
fallback_context: ContextVar[dict] = ContextVar('fallback_context', default={})

def on_litellm_failure(kwargs, completion_response, start_time, end_time):
    """Callback when a model call fails (before fallback attempt)."""
    model = kwargs.get('model', 'unknown')
    
    # Check if completion_response is an Exception or has an error attribute
    if isinstance(completion_response, Exception):
        error_msg = str(completion_response)
    else:
        error_obj = getattr(completion_response, 'error', None)
        error_msg = str(error_obj) if error_obj else 'Unknown error'
    
    # Extract user-friendly error reason
    error_lower = error_msg.lower()
    if 'rate limit' in error_lower or 'overloaded' in error_lower:
        reason = 'Overloaded'
    elif 'timeout' in error_lower or 'connection' in error_lower:
        reason = 'Connection Issues'
    elif 'busy' in error_lower:
        reason = 'Busy Server'
    elif 'unavailable' in error_lower or 'not found' in error_lower:
        reason = 'Model Unavailable'
    else:
        reason = 'Error'
    
    # Store failure info in context
    ctx = fallback_context.get({})
    if 'failures' not in ctx:
        ctx['failures'] = []
    
    ctx['failures'].append({
        'model': model,
        'error': error_msg,
        'reason': reason,
        'timestamp': end_time
    })
    fallback_context.set(ctx)
    
    logger.warning(f"🔴 Model failure: {model} - {reason}: {error_msg}")

def on_litellm_success(kwargs, completion_response, start_time, end_time):
    """Callback on successful completion (may be from fallback)."""
    requested_model = kwargs.get('model', 'unknown')
    actual_model = getattr(completion_response, 'model', requested_model)
    
    # Check if actual model differs from requested (fallback occurred)
    if requested_model != actual_model:
        ctx = fallback_context.get({})
        ctx['fallback'] = {
            'requested': requested_model,
            'actual': actual_model,
            'timestamp': end_time
        }
        fallback_context.set(ctx)
        logger.warning(f"🔄 Fallback used: {requested_model} -> {actual_model}")

def get_fallback_events() -> dict:
    """Get and clear fallback events from current context."""
    ctx = fallback_context.get({})
    fallback_context.set({})  # Clear after reading
    return ctx

def setup_api_keys() -> None:
    """Set up API keys from environment variables."""
    if not config:
        logger.warning("Config not loaded - skipping API key setup")
        return
        
    providers = [
        "OPENAI",
        "ANTHROPIC",
        "GROQ",
        "OPENROUTER",
        "XAI",
        "MORPH",
        "GEMINI",
        "OPENAI_COMPATIBLE",
    ]
    
    for provider in providers:
        try:
            key = getattr(config, f"{provider}_API_KEY", None)
            if key:
                # logger.debug(f"API key set for provider: {provider}")
                pass
            else:
                #logger.debug(f"No API key found for provider: {provider} (this is normal if not using this provider)")
                continue
        except AttributeError as e:
            #logger.debug(f"Could not access {provider}_API_KEY: {e}")
            continue

    # Set up OpenRouter API base if not already set
    if hasattr(config, 'OPENROUTER_API_KEY') and hasattr(config, 'OPENROUTER_API_BASE'):
        if config.OPENROUTER_API_KEY and config.OPENROUTER_API_BASE:
            os.environ["OPENROUTER_API_BASE"] = config.OPENROUTER_API_BASE
            # logger.debug(f"Set OPENROUTER_API_BASE to {config.OPENROUTER_API_BASE}")

    # Set up AWS Bedrock bearer token authentication
    if hasattr(config, 'AWS_BEARER_TOKEN_BEDROCK'):
        bedrock_token = config.AWS_BEARER_TOKEN_BEDROCK
        if bedrock_token:
            os.environ["AWS_BEARER_TOKEN_BEDROCK"] = bedrock_token
            logger.debug("AWS Bedrock bearer token configured")

    # Set up Standard AWS Credentials (Access Key / Secret)
    if hasattr(config, 'AWS_ACCESS_KEY_ID') and config.AWS_ACCESS_KEY_ID:
        os.environ["AWS_ACCESS_KEY_ID"] = config.AWS_ACCESS_KEY_ID
        
    if hasattr(config, 'AWS_SECRET_ACCESS_KEY') and config.AWS_SECRET_ACCESS_KEY:
        os.environ["AWS_SECRET_ACCESS_KEY"] = config.AWS_SECRET_ACCESS_KEY
        
    if hasattr(config, 'AWS_REGION_NAME') and config.AWS_REGION_NAME:
        os.environ["AWS_REGION_NAME"] = config.AWS_REGION_NAME
        
    if config.AWS_ACCESS_KEY_ID and config.AWS_SECRET_ACCESS_KEY:
        logger.debug("AWS Bedrock credentials configured")
    else:
        logger.debug("AWS Bedrock credentials not fully configured (missing key or secret)")

def setup_provider_router(openai_compatible_api_key: str = None, openai_compatible_api_base: str = None):
    global provider_router
    
    # Get config values safely
    config_openai_key = getattr(config, 'OPENAI_COMPATIBLE_API_KEY', None) if config else None
    config_openai_base = getattr(config, 'OPENAI_COMPATIBLE_API_BASE', None) if config else None
    
    model_list = [
        {
            "model_name": "openai-compatible/*", # support OpenAI-Compatible LLM provider
            "litellm_params": {
                "model": "openai/*",
                "api_key": openai_compatible_api_key or config_openai_key,
                "api_base": openai_compatible_api_base or config_openai_base,
            },
        },
        {
            "model_name": "*", # supported LLM provider by LiteLLM
            "litellm_params": {
                "model": "*",
            },
        },
    ]
    
    # Build fallbacks from registry
    from core.ai_models import model_manager
    fallbacks = []
    
    # 1. Add registry-defined fallbacks
    try:
        available_models = model_manager.list_available_models(include_disabled=True)
        for model_info in available_models:
            model_id = model_info['id']
            model = model_manager.get_model(model_id)
            if model and model.fallback_models:
                # LiteLLM expects fallbacks as a list of dicts: [{"model_name": ["fallback_1", "fallback_2"]}]
                fallbacks.append({
                    model_id: model.fallback_models
                })
                
                # Also add slash-replaced version for robustness (in case colons get replaced by LiteLLM or elsewhere)
                if ":" in model_id:
                    slash_id = model_id.replace(":", "/")
                    if slash_id != model_id:
                        fallbacks.append({
                            slash_id: model.fallback_models
                        })
                # logger.debug(f"Added fallback for {model_id}: {model.fallback_models}")
    except Exception as e:
        logger.warning(f"Failed to load fallbacks from registry: {e}")

    # 2. Add legacy Bedrock fallbacks (keep for backward compatibility if needed)
    fallbacks.extend([
        # MAP-tagged Haiku 4.5 (default) -> Sonnet 4 -> Sonnet 4.5
        {
            "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48": [
                "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
                "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh",
            ]
        },
        # MAP-tagged Sonnet 4.5 -> Sonnet 4 -> Haiku 4.5
        {
            "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh": [
                "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
                "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ]
        },
        # MAP-tagged Sonnet 4 -> Haiku 4.5
        {
            "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf": [
                "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ]
        }
    ])
    
    # Set callbacks globally (Router doesn't accept them in __init__)
    litellm.success_callback = [on_litellm_success]
    litellm.failure_callback = [on_litellm_failure]
    
    provider_router = Router(
        model_list=model_list,
        retry_after=15,
        fallbacks=fallbacks,
    )
    
    logger.info(f"Configured LiteLLM Router with {len(fallbacks)} fallback rules and global callbacks")

def _configure_openai_compatible(params: Dict[str, Any], model_name: str, api_key: Optional[str], api_base: Optional[str]) -> None:
    """Configure OpenAI-compatible provider setup."""
    if not model_name.startswith("openai-compatible/"):
        return
    
    # Get config values safely
    config_openai_key = getattr(config, 'OPENAI_COMPATIBLE_API_KEY', None) if config else None
    config_openai_base = getattr(config, 'OPENAI_COMPATIBLE_API_BASE', None) if config else None
    
    # Check if have required config either from parameters or environment
    if (not api_key and not config_openai_key) or (
        not api_base and not config_openai_base
    ):
        raise LLMError(
            "OPENAI_COMPATIBLE_API_KEY and OPENAI_COMPATIBLE_API_BASE is required for openai-compatible models. If just updated the environment variables, wait a few minutes or restart the service to ensure they are loaded."
        )
    
    setup_provider_router(api_key, api_base)
    logger.debug(f"Configured OpenAI-compatible provider with custom API base")

def _add_tools_config(params: Dict[str, Any], tools: Optional[List[Dict[str, Any]]], tool_choice: str) -> None:
    """Add tools configuration to parameters."""
    if tools is None:
        return
    
    params.update({
        "tools": tools,
        "tool_choice": tool_choice
    })
    # logger.debug(f"Added {len(tools)} tools to API parameters")


async def make_llm_api_call(
    messages: List[Dict[str, Any]],
    model_name: str,
    response_format: Optional[Any] = None,
    temperature: float = 0,
    max_tokens: Optional[int] = None,
    tools: Optional[List[Dict[str, Any]]] = None,
    tool_choice: str = "auto",
    api_key: Optional[str] = None,
    api_base: Optional[str] = None,
    stream: bool = True,  # Always stream for better UX
    top_p: Optional[float] = None,
    model_id: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
    extra_headers: Optional[Dict[str, str]] = None,
) -> Union[Dict[str, Any], AsyncGenerator, ModelResponse]:
    """Make an API call to a language model using LiteLLM."""
    logger.info(f"Making LLM API call to model: {model_name} with {len(messages)} messages")
    
    # Prepare parameters using centralized model configuration
    from core.ai_models import model_manager
    resolved_model_name = model_manager.resolve_model_id(model_name)
    # logger.debug(f"Model resolution: '{model_name}' -> '{resolved_model_name}'")
    
    # Only pass headers/extra_headers if they are not None to avoid overriding model config
    override_params = {
        "messages": messages,
        "temperature": temperature,
        "response_format": response_format,
        "top_p": top_p,
        "stream": stream,
        "api_key": api_key,
        "api_base": api_base
    }
    
    # Only add headers if they are provided (not None)
    if headers is not None:
        override_params["headers"] = headers
    if extra_headers is not None:
        override_params["extra_headers"] = extra_headers
    
    params = model_manager.get_litellm_params(resolved_model_name, **override_params)
    
    # logger.debug(f"Parameters from model_manager.get_litellm_params: {params}")
    
    if model_id:
        params["model_id"] = model_id
    
    if stream:
        params["stream_options"] = {"include_usage": True}
    
    # Apply additional configurations that aren't in the model config yet
    _configure_openai_compatible(params, model_name, api_key, api_base)
    _add_tools_config(params, tools, tool_choice)
    
    # Global Label Suffix Filtering
    # Strip internal context window tags/suffixes (e.g., -max, :max) from ALL models
    # This ensures internal UI/logic tags don't break provider API calls
    original_resolved_name = resolved_model_name
    
    # Handle :max suffix and anything following it (e.g., :max;tag)
    if ":max" in resolved_model_name:
        resolved_model_name = resolved_model_name.split(":max")[0]
        
    # Handle -max suffix (only at the end)
    if resolved_model_name.endswith("-max"):
        resolved_model_name = resolved_model_name[:-4]
        
    if original_resolved_name != resolved_model_name:
        logger.debug(f"Stripped suffixes: {original_resolved_name} -> {resolved_model_name}")

    # Inject num_ctx for Ollama models
    if resolved_model_name.startswith("ollama/"):
        context_window = model_manager.get_context_window(resolved_model_name)
        
        if "extra_body" not in params:
            params["extra_body"] = {}
        
        # Ensure options dict exists
        if "options" not in params["extra_body"]:
            params["extra_body"]["options"] = {}
            
        # Set num_ctx if not already present
        if "num_ctx" not in params["extra_body"]["options"]:
            params["extra_body"]["options"]["num_ctx"] = context_window
            logger.debug(f"Injected num_ctx={context_window} for Ollama model {resolved_model_name}")

    # Handle LM Studio models
    if resolved_model_name.startswith("lm_studio:") or resolved_model_name.startswith("lm_studio/"):
        # Strip prefix to get actual model name
        actual_model_name = resolved_model_name.split(":", 1)[-1] if ":" in resolved_model_name else resolved_model_name.split("/", 1)[-1]
        
        # Force OpenAI provider for LiteLLM
        params["model"] = f"openai/{actual_model_name}"
        
        # Set API Base if not provided
        if not api_base and config.LM_STUDIO_API_BASE:
            base = config.LM_STUDIO_API_BASE.rstrip('/')
            if not base.endswith("/v1"):
                base += "/v1"
            params["api_base"] = base
            
        # Set dummy API Key if not provided
        if "api_key" not in params or not params["api_key"]:
            params["api_key"] = "lm-studio"
            
        logger.debug(f"Configured LM Studio call: {params['model']} at {params.get('api_base')}")
    
    try:
        # Log the complete parameters being sent to LiteLLM
        # logger.debug(f"Calling LiteLLM acompletion for {resolved_model_name}")
        # logger.debug(f"Complete LiteLLM parameters: {params}")
        
        # # Save parameters to txt file for debugging
        # import json
        # import os
        # from datetime import datetime
        
        # debug_dir = "debug_logs"
        # os.makedirs(debug_dir, exist_ok=True)
        
        # timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        # filename = f"{debug_dir}/llm_params_{timestamp}.txt"
        
        # with open(filename, 'w') as f:
        #     f.write(f"Timestamp: {datetime.now().isoformat()}\n")
        #     f.write(f"Model Name: {model_name}\n")
        #     f.write(f"Resolved Model Name: {resolved_model_name}\n")
        #     f.write(f"Parameters:\n{json.dumps(params, indent=2, default=str)}\n")
        
        # logger.debug(f"LiteLLM parameters saved to: {filename}")
        
        response = await provider_router.acompletion(**params)
        
        # For streaming responses, we need to handle errors that occur during iteration
        if hasattr(response, '__aiter__') and stream:
            return _wrap_streaming_response(response)
        
        return response
        
    except Exception as e:
        # Use ErrorProcessor to handle the error consistently
        processed_error = ErrorProcessor.process_llm_error(e, context={"model": model_name})
        ErrorProcessor.log_error(processed_error)
        raise LLMError(processed_error.message)

async def _wrap_streaming_response(response) -> AsyncGenerator:
    """Wrap streaming response to handle errors during iteration."""
    try:
        async for chunk in response:
            yield chunk
    except Exception as e:
        # Convert streaming errors to processed errors
        processed_error = ErrorProcessor.process_llm_error(e)
        ErrorProcessor.log_error(processed_error)
        raise LLMError(processed_error.message)

setup_api_keys()
setup_provider_router()


if __name__ == "__main__":
    from litellm import completion
    import os

    setup_api_keys()

    response = completion(
        model="bedrock/anthropic.claude-sonnet-4-20250115-v1:0",
        messages=[{"role": "user", "content": "Hello! Testing 1M context window."}],
        max_tokens=100,
        extra_headers={
            "anthropic-beta": "context-1m-2025-08-07"  # 👈 Enable 1M context
        }
    )

