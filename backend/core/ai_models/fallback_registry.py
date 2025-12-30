from typing import Dict, List, Optional, Set
from .ai_models import Model, ModelProvider, ModelCapability, ModelPricing, ModelConfig
from core.utils.config import config, EnvMode


class FallbackModelRegistry:
    """
    Registry for fallback models that use API keys instead of Vertex AI credentials.
    These models use Google AI Studio (Gemini API) as a fallback when Vertex AI is unavailable.
    """
    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._aliases: Dict[str, str] = {}
        self._initialize_models()
    
    def _initialize_models(self):

        # --- Google AI Studio Models (via Gemini API) ---

        # Gemini 2.5 Pro
        self.register(Model(
            id="google/gemini-2.5-pro",
            name="Gemini 2.5 Pro",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.5-pro-api", "google-gemini-2.5-pro-api"],
            context_window=1_048_576,
            max_output_tokens=65_536,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
                ModelCapability.STRUCTURED_OUTPUT,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.0,
                output_cost_per_million_tokens=0.0
            ),
            tier_availability=["paid"],
            priority=109,
            enabled=config.GEMINI_API_KEY is not None,
            fallback_models=["google/gemini-2.5-flash"]
        ))

        # Gemini 2.5 Flash
        self.register(Model(
            id="google/gemini-2.5-flash",
            name="Gemini 2.5 Flash",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.5-flash-api", "google-gemini-2.5-flash-api"],
            context_window=1_048_576,
            max_output_tokens=64_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.0,
                output_cost_per_million_tokens=0.0
            ),
            tier_availability=["free", "paid"],
            priority=108,
            enabled=config.GEMINI_API_KEY is not None,
        ))

        # Gemini 2.0 Flash-Lite
        self.register(Model(
            id="google/gemini-2.0-flash-lite-001",
            name="Gemini 2.0 Flash-Lite",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.0-flash-lite-api", "google-gemini-2.0-flash-lite-api"],
            context_window=1_048_576,
            max_output_tokens=8_192,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.STRUCTURED_OUTPUT,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.0,
                output_cost_per_million_tokens=0.0
            ),
            tier_availability=["free", "paid"],
            priority=90,
            enabled=config.GEMINI_API_KEY is not None,
        ))
        
        # Claude Sonnet 4.5 (via Claude API)
        self.register(Model(
            id="anthropic/claude-sonnet-4-5",
            name="Claude Sonnet 4.5",
            provider=ModelProvider.ANTHROPIC,
            aliases=["claude-sonnet-4.5", "anthropic-claude-sonnet-4.5"],
            context_window=1_000_000, # 1M in Beta
            max_output_tokens=64_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING, # "Extended Thinking" implied?
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.0,
                output_cost_per_million_tokens=0.0
            ),
            tier_availability=["paid"],
            priority=106,
            enabled=config.ANTHROPIC_API_KEY is not None,
            fallback_models=["anthropic/claude-haiku-4-5"],
            config=ModelConfig(
                extra_headers={
                    "anthropic-beta": "context-1m-2025-08-07"
                },
            ),
        ))

        # Claude Haiku 4.5 (via Claude API)
        self.register(Model(
            id="anthropic/claude-haiku-4-5",
            name="Claude Haiku 4.5",
            provider=ModelProvider.ANTHROPIC,
            aliases=["claude-haiku-4.5", "anthropic-claude-haiku-4.5"],
            context_window=200_000,
            max_output_tokens=64_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING, # "Extended Thinking"
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.0,
                output_cost_per_million_tokens=0.0
            ),
            tier_availability=["paid"],
            priority=110,
            enabled=config.ANTHROPIC_API_KEY is not None,
            fallback_models=["google/gemini-2.5-flash"],
            config=ModelConfig(
                extra_body={
                    "anthropic_version": "vertex-2023-10-16"
                }
            ),
        ))

    def register(self, model: Model) -> None:
        self._models[model.id] = model
        for alias in model.aliases:
            self._aliases[alias] = model.id
    
    def get(self, model_id: str) -> Optional[Model]:
        if not model_id:
            return None
            
        if model_id in self._models:
            return self._models[model_id]
        
        if model_id in self._aliases:
            actual_id = self._aliases[model_id]
            return self._models.get(actual_id)
        
        return None
    
    def get_all(self, enabled_only: bool = True) -> List[Model]:
        models = list(self._models.values())
        if enabled_only:
            models = [m for m in models if m.enabled]
        return models


fallback_registry = FallbackModelRegistry()