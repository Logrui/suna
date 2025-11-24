from typing import Dict, List, Optional, Set
from .ai_models import Model, ModelProvider, ModelCapability, ModelPricing, ModelConfig
from core.utils.config import config, EnvMode

from .ai_models import FallbackModelRegistry


class FallbackModelRegistry:
    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._aliases: Dict[str, str] = {}
        self._initialize_models()
    
    def _initialize_models(self):

        # --- Vertex AI Studio Models (Google & Anthropic) ---

        # Gemini 3 Pro Preview
        self.register(Model(
            id="google/gemini-3-pro-preview",
            name="Gemini 3 Pro Preview",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-3-pro-preview", "google-gemini-3-pro"],
            context_window=1_000_000,
            max_output_tokens=64_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING, # "thinking_level" support
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=2.00, # Estimated based on previous Pro pricing
                output_cost_per_million_tokens=12.00
            ),
            tier_availability=["paid"],
            priority=110,
            enabled=config.GOOGLE_API_KEY is not None,
            fallback_models=["google/gemini-2.5-pro"]
        ))

        # Gemini 2.5 Pro
        self.register(Model(
            id="google/gemini-2.5-pro",
            name="Gemini 2.5 Pro",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.5-pro", "google-gemini-2.5-pro"],
            context_window=1_048_576,
            max_output_tokens=65_536,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING, # "thinking_budget" support
                ModelCapability.STRUCTURED_OUTPUT,
                ModelCapability.WEB_SEARCH, # "Grounding"
                ModelCapability.CODE_INTERPRETER, # "Code Execution"
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.25,
                output_cost_per_million_tokens=10.00
            ),
            tier_availability=["paid"],
            priority=109,
            enabled=config.GOOGLE_API_KEY is not None,
            fallback_models=["google/gemini-2.5-flash"]
        ))

        # Gemini 2.5 Flash
        self.register(Model(
            id="google/gemini-2.5-flash",
            name="Gemini 2.5 Flash",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.5-flash", "google-gemini-2.5-flash"],
            context_window=1_048_576,
            max_output_tokens=64_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING, # "thinking_budget" support
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.15,
                output_cost_per_million_tokens=0.60
            ),
            tier_availability=["free", "paid"],
            priority=108,
            enabled=config.GOOGLE_API_KEY is not None,
            fallback_models=["google/claude-haiku-4-5@20251001"]
        ))

        # Gemini 2.0 Flash-Lite
        self.register(Model(
            id="google/gemini-2.0-flash-lite-001",
            name="Gemini 2.0 Flash-Lite",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.0-flash-lite", "google-gemini-2.0-flash-lite"],
            context_window=1_048_576,
            max_output_tokens=8_192,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.STRUCTURED_OUTPUT,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.075, # Estimated lower than Flash
                output_cost_per_million_tokens=0.30
            ),
            tier_availability=["free", "paid"],
            priority=90,
            enabled=config.GOOGLE_API_KEY is not None,
            fallback_models=["google/claude-haiku-4-5@20251001"]
        ))

        # Gemini Computer Use Preview
        self.register(Model(
            id="google/gemini-2.5-computer-use-preview-10-2025",
            name="Gemini Computer Use Preview",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-computer-use", "google-gemini-computer-use"],
            context_window=128_000,
            max_output_tokens=64_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.VISION,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.25, # Using Pro pricing as placeholder
                output_cost_per_million_tokens=10.00
            ),
            tier_availability=["paid"],
            priority=90,
            enabled=config.GOOGLE_API_KEY is not None,
            fallback_models=["google/claude-haiku-4-5@20251001"]
        ))

        # Claude Sonnet 4.5 (via Vertex AI)
        self.register(Model(
            id="google/claude-sonnet-4-5@20250929",
            name="Claude Sonnet 4.5",
            provider=ModelProvider.GOOGLE,
            aliases=["claude-sonnet-4.5", "google-claude-sonnet-4.5"],
            context_window=1_000_000, # 1M in Beta
            max_output_tokens=64_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING, # "Extended Thinking" implied?
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=3.00,
                output_cost_per_million_tokens=15.00
            ),
            tier_availability=["paid"],
            priority=106,
            enabled=config.GOOGLE_API_KEY is not None,
            fallback_models=["google/gemini-3-pro-preview-10-2025"],
            config=ModelConfig(
                extra_headers={
                    "anthropic-beta": "context-1m-2025-08-07"
                },
            ),
        ))

        # Claude Haiku 4.5 (via Vertex AI)
        self.register(Model(
            id="google/claude-haiku-4-5@20251001",
            name="Claude Haiku 4.5",
            provider=ModelProvider.GOOGLE,
            aliases=["claude-haiku-4.5", "google-claude-haiku-4.5"],
            context_window=200_000,
            max_output_tokens=64_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING, # "Extended Thinking"
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.00,
                output_cost_per_million_tokens=5.00
            ),
            tier_availability=["paid"],
            priority=110,
            enabled=config.GOOGLE_API_KEY is not None,
            fallback_models=["google/gemini-2.5-flash"],
            config=ModelConfig(
                extra_body={
                    "anthropic_version": "vertex-2023-10-16"
                }
            ),
        ))


registry = ModelRegistry() 