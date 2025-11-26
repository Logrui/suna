"""
Excluded models configuration.

This file tracks models that should be excluded from the available models list.
Models are excluded based on context window size (<100K) or other criteria.
"""

# Models excluded due to small context window (<100K)
# Format: "provider:model-name" or just "model-name" for automatic matching
EXCLUDED_MODELS_SMALL_CONTEXT = {
    # CRITICAL WARNING: This list is manually maintained and may be out of sync with actual model capabilities.
    # Ideally, models should be excluded dynamically based on their reported context window (see is_model_excluded).
    # This list serves as a fallback for models where context window cannot be determined.

    # LM Studio
    "lm_studio:hermes-2-pro-mistral-7b",  # 32K context
    "lm_studio:qwen2.5-coder-32b-instruct",  # 32K context
    "lm_studio:qwen/qwen2.5-coder-32b",  # 32K context
    "lm_studio:text-embedding-nomic-embed-text-v1.5",  # 2K - embedding model
    "lm_studio:granite-20b-code-instruct",  # 8K context
    "lm_studio:xlam-2-32b-fc-r",  # 32K context
    "lm_studio:internlm_januscoder-14b",  # 32K context
    
    # Ollama
    "ollama:devstral:latest",  # 4K context
    "ollama:devstral",  # 4K context
    "ollama:phi4-mini:latest",  # 4K context
    "ollama:phi4-mini",  # 4K context
    "ollama:deepseek-coder:33b",  # 4K context
    "ollama:deepseek-coder",  # 4K context
    "ollama:embeddinggemma:latest",  # 512 - embedding model
    "ollama:embeddinggemma",  # 512 - embedding model
    "ollama:codegemma:7b",  # 8K context
    "ollama:codegemma",  # 8K context
    "ollama:gemma3:4b",  # 8K context
    "ollama:gemma3",  # 8K context
    "ollama:mistral:7b-instruct",  # 32K context
    "ollama:mistral:7b",  # 32K context
    "ollama:mistral-small3.2:latest",  # 32K context
    "ollama:mistral-small3.2",  # 32K context
    "ollama:deepseek-r1:latest",  # 64K context
    "ollama:deepseek-r1",  # 64K context
}

# Models excluded for other reasons (manually excluded by user)
EXCLUDED_MODELS_MANUAL = set()

# All excluded models combined
EXCLUDED_MODELS = EXCLUDED_MODELS_SMALL_CONTEXT | EXCLUDED_MODELS_MANUAL


# Minimum context window size for models to be included (64K)
MIN_CONTEXT_WINDOW = 64_000

def is_model_excluded(model_id: str, provider: str = None, context_window: int = None) -> bool:
    """
    Check if a model should be excluded.
    
    Args:
        model_id: The model ID (can be prefixed or not)
        provider: Optional provider name (e.g., "ollama", "lm_studio")
        context_window: Optional context window size to check against MIN_CONTEXT_WINDOW
        
    Returns:
        True if model should be excluded, False otherwise
    """
    # Check manual exclusion first (user override)
    if model_id in EXCLUDED_MODELS_MANUAL:
        return True
    
    # Check context window if provided
    if context_window is not None:
        if context_window < MIN_CONTEXT_WINDOW:
            return True
        # If context window is large enough, we IGNORE the legacy small context list
        # This allows models like deepseek-r1 (which might be in the list but have 128k context) to pass
        return False

    # Fallback: Check legacy small context list if context window is unknown
    # Check exact match
    if model_id in EXCLUDED_MODELS_SMALL_CONTEXT:
        return True
    
    # Check with provider prefix
    if provider and not model_id.startswith(f"{provider}:"):
        prefixed_id = f"{provider}:{model_id}"
        if prefixed_id in EXCLUDED_MODELS_SMALL_CONTEXT:
            return True
    
    # Check by partial match
    for excluded in EXCLUDED_MODELS_SMALL_CONTEXT:
        if excluded in model_id or model_id in excluded:
            return True
    
    return False


def exclude_model(model_id: str, reason: str = "user_excluded"):
    """
    Manually exclude a model.
    
    Args:
        model_id: The model ID to exclude
        reason: Reason for exclusion (stored for reference)
    """
    EXCLUDED_MODELS_MANUAL.add(model_id)
    EXCLUDED_MODELS.add(model_id)


def include_model(model_id: str):
    """
    Re-include a previously excluded model.
    
    Args:
        model_id: The model ID to include
    """
    if model_id in EXCLUDED_MODELS_MANUAL:
        EXCLUDED_MODELS_MANUAL.discard(model_id)
    if model_id in EXCLUDED_MODELS:
        EXCLUDED_MODELS.discard(model_id)


def get_excluded_count() -> dict:
    """Get count of excluded models by reason."""
    return {
        "small_context": len(EXCLUDED_MODELS_SMALL_CONTEXT),
        "manual": len(EXCLUDED_MODELS_MANUAL),
        "total": len(EXCLUDED_MODELS),
    }
