from .models import Model, ModelProvider, ModelCapability, ModelPricing, ModelConfig
from .registry import ModelRegistry, registry
from .local_registry import LocalModelRegistry

# Backwards compatibility alias
model_manager = registry

__all__ = [
    'ModelRegistry',
    'LocalModelRegistry',
    'registry',
    'Model',
    'ModelProvider',
    'ModelCapability',
    'ModelPricing',
    'ModelConfig',
    'model_manager',  # Backwards compatibility
]