from typing import Dict, List, Optional
from .models import Model, ModelProvider, ModelCapability, ModelPricing, ModelConfig
from core.utils.config import config, EnvMode

class AWSModelRegistry:
    """
    Registry for AWS Bedrock models.
    """
    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._aliases: Dict[str, str] = {}
        self._initialize_models()
    
    def _initialize_models(self):
        # Pricing multiplier based on environment
        is_prod = config.ENV_MODE == EnvMode.PRODUCTION
        pricing_multiplier = 0.20 if is_prod else 1.0

        # Claude Haiku 4.5
        self.register(Model(
            id="openrouter/anthropic/claude-haiku-4.5",
            name="Haiku 4.5",
            provider=ModelProvider.ANTHROPIC,
            aliases=[
                "claude-haiku-4.5", 
                "anthropic/claude-haiku-4.5", 
                "anthropic/claude-haiku-4-5", 
                "Claude Haiku 4.5", 
                "anthropic/claude-haiku-4-5-20251001", 
                "global.anthropic.claude-haiku-4-5-20251001-v1:0", 
                "bedrock/global.anthropic.claude-haiku-4-5-20251001-v1:0", 
                "arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
                # Add bedrock/converse/ prefixed alias for Router fallback compatibility
                "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ],
            context_window=200_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.00 * pricing_multiplier,
                output_cost_per_million_tokens=5.00 * pricing_multiplier
            ),
            tier_availability=["paid"],
            priority=102,
            recommended=True,
            enabled=True,
            config=ModelConfig()
        ))

        # Claude Opus 4.5
        self.register(Model(
            id="openrouter/anthropic/claude-opus-4.5",
            name="Opus 4.5",
            provider=ModelProvider.ANTHROPIC,
            aliases=[
                "claude-opus-4.5", 
                "anthropic/claude-opus-4.5", 
                "anthropic/claude-opus-4-5", 
                "Claude Opus 4.5", 
                "anthropic/claude-opus-4-5-20251001", 
                "global.anthropic.claude-opus-4-5-20251001-v1:0", 
                "bedrock/global.anthropic.claude-opus-4-5-20251001-v1:0", 
                "arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
                # Add bedrock/converse/ prefixed alias for Router fallback compatibility
                "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ],
            context_window=200_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.00 * pricing_multiplier,
                output_cost_per_million_tokens=5.00 * pricing_multiplier
            ),
            tier_availability=["paid"],
            priority=102,
            recommended=True,
            enabled=True,
            config=ModelConfig()
        ))
        
        # Claude Sonnet 4.5
        self.register(Model(
            id="openrouter/anthropic/claude-sonnet-4.5",
            name="Sonnet 4.5",
            provider=ModelProvider.ANTHROPIC,
            aliases=[
                "claude-sonnet-4.5", 
                "anthropic/claude-sonnet-4.5", 
                "anthropic/claude-sonnet-4-5", 
                "anthropic/claude-sonnet-4-5-20250929", 
                "Claude Sonnet 4.5", 
                "claude-sonnet-4-5-20250929", 
                "global.anthropic.claude-sonnet-4-5-20250929-v1:0", 
                "arn:aws:bedrock:us-west-2:935064898258:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0", 
                "bedrock/global.anthropic.claude-sonnet-4-5-20250929-v1:0", 
                "arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh",
                # Add bedrock/converse/ prefixed alias for Router fallback compatibility
                "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh",
            ],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=3.00 * pricing_multiplier,
                output_cost_per_million_tokens=15.00 * pricing_multiplier
            ),
            tier_availability=["paid"],
            priority=101,
            recommended=True,
            enabled=True,
            config=ModelConfig(
                extra_headers={
                    "anthropic-beta": "context-1m-2025-08-07" 
                },
            )
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

registry = AWSModelRegistry()
