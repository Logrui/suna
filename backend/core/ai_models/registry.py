from typing import Dict, List, Optional, Set
from .ai_models import Model, ModelProvider, ModelCapability, ModelPricing, ModelConfig
from core.utils.config import config, EnvMode

# SHOULD_USE_ANTHROPIC = False
# CRITICAL: Production and Staging must ALWAYS use Bedrock, never Anthropic API directly
SHOULD_USE_ANTHROPIC = config.ENV_MODE == EnvMode.LOCAL and bool(config.ANTHROPIC_API_KEY)

# Set premium model ID based on environment - using MAP-tagged application inference profiles with global routing
if SHOULD_USE_ANTHROPIC:
    FREE_MODEL_ID = "anthropic/claude-haiku-4-5"
    PREMIUM_MODEL_ID = "anthropic/claude-haiku-4-5"
else:  
    FREE_MODEL_ID = "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48"
    PREMIUM_MODEL_ID = "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48"

is_local = config.ENV_MODE == EnvMode.LOCAL

class ModelRegistry:
    def __init__(self):
        self._models: Dict[str, Model] = {}
        self._aliases: Dict[str, str] = {}
        self._initialize_models()
    
    def _initialize_models(self):
        self.register(Model(
            id="anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            name="Haiku 4.5",
            provider=ModelProvider.ANTHROPIC,
            aliases=["claude-haiku-4.5", "anthropic/claude-haiku-4.5", "Claude Haiku 4.5", "global.anthropic.claude-haiku-4-5-20251001-v1:0", "bedrock/global.anthropic.claude-haiku-4-5-20251001-v1:0", "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48"],
            context_window=200_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.00,
                output_cost_per_million_tokens=5.00
            ),
            tier_availability=["paid"],
            priority=102,
            recommended=True,
            enabled=True,
            config=ModelConfig(),
            # Fallback chain: try other models when rate limited
            fallback_models=[
                "anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
                "anthropic/claude-sonnet-4-5-20250929" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh",
            ]
        ))
        
        self.register(Model(
            id="anthropic/claude-sonnet-4-5-20250929" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh",
            name="Sonnet 4.5",
            provider=ModelProvider.ANTHROPIC,
            aliases=["claude-sonnet-4.5", "anthropic/claude-sonnet-4.5", "Claude Sonnet 4.5", "claude-sonnet-4-5-20250929", "global.anthropic.claude-sonnet-4-5-20250929-v1:0", "arn:aws:bedrock:us-west-2:935064898258:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0", "bedrock/global.anthropic.claude-sonnet-4-5-20250929-v1:0", "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=3.00,
                output_cost_per_million_tokens=15.00
            ),
            tier_availability=["paid"],
            priority=101,
            recommended=True,
            enabled=True,
            config=ModelConfig(
                extra_headers={
                    "anthropic-beta": "context-1m-2025-08-07" 
                },
            ),
            # Fallback chain: try other models when rate limited
            fallback_models=[
                "anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
                "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ]
        ))
        
        self.register(Model(
            id="anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
            name="Sonnet 4",
            provider=ModelProvider.ANTHROPIC,
            aliases=["claude-sonnet-4", "Claude Sonnet 4", "claude-sonnet-4-20250514", "global.anthropic.claude-sonnet-4-20250514-v1:0", "arn:aws:bedrock:us-west-2:935064898258:inference-profile/global.anthropic.claude-sonnet-4-20250514-v1:0", "bedrock/global.anthropic.claude-sonnet-4-20250514-v1:0", "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=3.00,
                output_cost_per_million_tokens=15.00
            ),
            tier_availability=["paid"],
            priority=100,
            recommended=True,
            enabled=True,
            config=ModelConfig(
                extra_headers={
                    "anthropic-beta": "context-1m-2025-08-07" 
                },
            ),
            # Fallback chain: try other models when rate limited
            fallback_models=[
                "anthropic/claude-sonnet-4-5-20250929" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/few7z4l830xh",
                "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ]
        ))
        
        # OpenAI Models - Updated with GPT-5 lineup (Nov 1, 2025)
        self.register(Model(
            id="openai/gpt-5",
            name="GPT-5",
            provider=ModelProvider.OPENAI,
            aliases=["gpt-5", "GPT-5"],
            context_window=128_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.STRUCTURED_OUTPUT,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.25,
                output_cost_per_million_tokens=10.00
            ),
            tier_availability=["paid"],
            priority=95,
            enabled=config.OPENAI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "openai/gpt-5-mini",
                "openai/gpt-4o",
                "anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
            ]
        ))
        
        self.register(Model(
            id="openai/gpt-5-mini",
            name="GPT-5 Mini",
            provider=ModelProvider.OPENAI,
            aliases=["gpt-5-mini", "GPT-5 Mini"],
            context_window=128_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.25,
                output_cost_per_million_tokens=2.00
            ),
            tier_availability=["paid"],
            priority=94,
            enabled=config.OPENAI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "openai/gpt-4o",
                "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ]
        ))
        
        self.register(Model(
            id="openai/gpt-4o",
            name="GPT-4o (Legacy)",
            provider=ModelProvider.OPENAI,
            aliases=["gpt-4o", "GPT-4o"],
            context_window=128_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.STRUCTURED_OUTPUT,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=2.50,
                output_cost_per_million_tokens=10.00
            ),
            tier_availability=["paid"],
            priority=93,
            enabled=config.OPENAI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
            ]
        ))
        
        self.register(Model(
            id="openai/gpt-4o-mini",
            name="GPT-4o Mini (Legacy)",
            provider=ModelProvider.OPENAI,
            aliases=["gpt-4o-mini", "GPT-4o Mini"],
            context_window=128_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.15,
                output_cost_per_million_tokens=0.60
            ),
            tier_availability=["free", "paid"],
            priority=92,
            enabled=config.OPENAI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ]
        ))
        
        # Google Gemini Models - Updated with latest pricing (Nov 1, 2025)
        self.register(Model(
            id="gemini/gemini-3-pro-preview",
            name="Gemini 3 Pro Preview",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-3-pro-preview", "Gemini 3 Pro Preview"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=2.00,
                output_cost_per_million_tokens=12.00
            ),
            tier_availability=["free", "paid"],
            priority=98,
            enabled=config.GEMINI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "anthropic/claude-haiku-4-5",
                "gemini/gemini-2.5-pro",
                "openai/gpt-4o" if config.OPENAI_API_KEY else "anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
            ]
        ))
        
        # Google Gemini Models - Updated with latest pricing (Nov 1, 2025)
        self.register(Model(
            id="gemini/gemini-2.5-pro",
            name="Gemini 2.5 Pro",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.5-pro", "Gemini 2.5 Pro"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.25,
                output_cost_per_million_tokens=10.00
            ),
            tier_availability=["free", "paid"],
            priority=98,
            enabled=config.GEMINI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "gemini/gemini-2.5-flash",
                "gemini/gemini-2.5-pro",
                "openai/gpt-4o" if config.OPENAI_API_KEY else "anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
            ]
        ))
        
        self.register(Model(
            id="gemini/gemini-2.5-flash",
            name="Gemini 2.5 Flash",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.5-flash", "gemini-flash-latest", "Gemini 2.5 Flash"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.30,
                output_cost_per_million_tokens=2.50
            ),
            tier_availability=["free", "paid"],
            priority=97,
            enabled=config.GEMINI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "gemini/gemini-2.5-pro",
                "openai/gpt-4o-mini" if config.OPENAI_API_KEY else "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
            ]
        ))

        # Google Gemini Models - Updated with latest pricing (Nov 1, 2025)
        self.register(Model(
            id="gemini/gemini-2.5-flash-lite",
            name="Gemini 2.5 Flash-Lite",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite"],
            context_window=1_000_000,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.30,
                output_cost_per_million_tokens=0.40
            ),
            tier_availability=["free", "paid"],
            priority=98,
            enabled=config.GEMINI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "gemini/gemini-2.5-flash",
                "gemini/gemini-2.5-pro",
                "openai/gpt-4o" if config.OPENAI_API_KEY else "anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
            ]
        ))
        
        self.register(Model(
            id="gemini/gemini-2.5-computer-use-preview",
            name="Gemini 2.5 Computer Use Preview",
            provider=ModelProvider.GOOGLE,
            aliases=["gemini-2.5-computer-use-preview", "Gemini 2.5 Computer Use Preview", "gemini-2.5-computer-use-preview-10-2025", "models/gemini-2.5-computer-use-preview-10-2025"],
            context_window=131_072,
            max_output_tokens=65_536,
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
                ModelCapability.VISION,
                ModelCapability.THINKING,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=1.25,
                output_cost_per_million_tokens=10.00
            ),
            tier_availability=["paid"],
            priority=97,
            enabled=config.GEMINI_API_KEY is not None,  # Only enable if API key exists
            fallback_models=[
                "gemini/gemini-2.5-pro",
                "openai/gpt-4o" if config.OPENAI_API_KEY else "anthropic/claude-sonnet-4-20250514" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/tyj1ks3nj9qf",
            ]
        ))
        
        # OpenAI-Compatible Models (for Ollama, LM Studio, vLLM, etc.)
        # Note: Actual registration happens in initialize_ollama_models() called during app startup
        # This ensures we don't block synchronous initialization with async API calls
        
        # # Commented out OpenRouter models
        
        # self.register(Model(
        #     id="openrouter/moonshotai/kimi-k2",
        #     name="Kimi K2",
        #     provider=ModelProvider.MOONSHOTAI,
        #     aliases=["kimi-k2", "Kimi K2", "moonshotai/kimi-k2"],
        #     context_window=200_000,
        #     capabilities=[
        #         ModelCapability.CHAT,
        #         ModelCapability.FUNCTION_CALLING,
        #     ],
        #     pricing=ModelPricing(
        #         input_cost_per_million_tokens=1.00,
        #         output_cost_per_million_tokens=3.00
        #     ),
        #     tier_availability=["free", "paid"],
        #     priority=94,
        #     enabled=True,
        #     config=ModelConfig(
        #         extra_headers={
        #             "HTTP-Referer": config.OR_SITE_URL if hasattr(config, 'OR_SITE_URL') and config.OR_SITE_URL else "",
        #             "X-Title": config.OR_APP_NAME if hasattr(config, 'OR_APP_NAME') and config.OR_APP_NAME else ""
        #         }
        #     )
        # ))
        
        # # DeepSeek Models
        # self.register(Model(
        #     id="openrouter/deepseek/deepseek-chat",
        #     name="DeepSeek Chat",
        #     provider=ModelProvider.OPENROUTER,
        #     aliases=["deepseek", "deepseek-chat"],
        #     context_window=128_000,
        #     capabilities=[
        #         ModelCapability.CHAT, 
        #         ModelCapability.FUNCTION_CALLING
        #     ],
        #     pricing=ModelPricing(
        #         input_cost_per_million_tokens=0.38,
        #         output_cost_per_million_tokens=0.89
        #     ),
        #     tier_availability=["free", "paid"],
        #     priority=95,
        #     enabled=False  # Currently disabled
        # ))
        
        # # Qwen Models
        # self.register(Model(
        #     id="openrouter/qwen/qwen3-235b-a22b",
        #     name="Qwen3 235B",
        #     provider=ModelProvider.OPENROUTER,
        #     aliases=["qwen3", "qwen-3"],
        #     context_window=128_000,
        #     capabilities=[
        #         ModelCapability.CHAT, 
        #         ModelCapability.FUNCTION_CALLING
        #     ],
        #     pricing=ModelPricing(
        #         input_cost_per_million_tokens=0.13,
        #         output_cost_per_million_tokens=0.60
        #     ),
        #     tier_availability=["free", "paid"],
        #     priority=90,
        #     enabled=False  # Currently disabled
        # ))
        
    
    def register(self, model: Model) -> None:
        self._models[model.id] = model
        for alias in model.aliases:
            self._aliases[alias] = model.id
    
    def get(self, model_id: str) -> Optional[Model]:
        # Handle None or empty model_id
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
    
    def get_by_tier(self, tier: str, enabled_only: bool = True) -> List[Model]:
        models = self.get_all(enabled_only)
        return [m for m in models if tier in m.tier_availability]
    
    def get_by_provider(self, provider: ModelProvider, enabled_only: bool = True) -> List[Model]:
        models = self.get_all(enabled_only)
        return [m for m in models if m.provider == provider]
    
    def get_by_capability(self, capability: ModelCapability, enabled_only: bool = True) -> List[Model]:
        models = self.get_all(enabled_only)
        return [m for m in models if capability in m.capabilities]
    
    def resolve_model_id(self, model_id: str) -> Optional[str]:
        model = self.get(model_id)
        return model.id if model else None
    
    
    def get_aliases(self, model_id: str) -> List[str]:
        model = self.get(model_id)
        return model.aliases if model else []
    
    def enable_model(self, model_id: str) -> bool:
        model = self.get(model_id)
        if model:
            model.enabled = True
            return True
        return False
    
    def disable_model(self, model_id: str) -> bool:
        model = self.get(model_id)
        if model:
            model.enabled = False
            return True
        return False
    
    def get_context_window(self, model_id: str, default: int = 64_000) -> int:
        model = self.get(model_id)
        return model.context_window if model else default
    
    def get_pricing(self, model_id: str) -> Optional[ModelPricing]:
        model = self.get(model_id)
        return model.pricing if model else None
    
    def to_legacy_format(self) -> Dict:
        models_dict = {}
        pricing_dict = {}
        context_windows_dict = {}
        
        for model in self.get_all(enabled_only=True):
            models_dict[model.id] = {
                "pricing": {
                    "input_cost_per_million_tokens": model.pricing.input_cost_per_million_tokens,
                    "output_cost_per_million_tokens": model.pricing.output_cost_per_million_tokens,
                } if model.pricing else None,
                "context_window": model.context_window,
                "tier_availability": model.tier_availability,
            }
            
            if model.pricing:
                pricing_dict[model.id] = {
                    "input_cost_per_million_tokens": model.pricing.input_cost_per_million_tokens,
                    "output_cost_per_million_tokens": model.pricing.output_cost_per_million_tokens,
                }
            
            context_windows_dict[model.id] = model.context_window
        
        free_models = [m.id for m in self.get_by_tier("free")]
        paid_models = [m.id for m in self.get_by_tier("paid")]
        
        # Debug logging
        from core.utils.logger import logger
        logger.debug(f"Legacy format generation: {len(free_models)} free models, {len(paid_models)} paid models")
        logger.debug(f"Free models: {free_models}")
        logger.debug(f"Paid models: {paid_models}")
        
        return {
            "MODELS": models_dict,
            "HARDCODED_MODEL_PRICES": pricing_dict,
            "MODEL_CONTEXT_WINDOWS": context_windows_dict,
            "FREE_TIER_MODELS": free_models,
            "PAID_TIER_MODELS": paid_models,
        }
    
    def _register_generic_openai_compatible(self):
        """
        Register a generic OpenAI-compatible local model.
        
        This is the fallback registration method used when:
        - OLLAMA_ENABLED is False/not set
        - Ollama discovery fails
        - No specific provider integration is configured
        """
        if not (config.OPENAI_COMPATIBLE_API_KEY and config.OPENAI_COMPATIBLE_API_BASE):
            return
        
        self.register(Model(
            id="openai-compatible/local-model",
            name="Local LLM (OpenAI-Compatible)",
            provider=ModelProvider.OPENAI,
            aliases=["local-llm", "ollama", "lm-studio", "local"],
            context_window=4_000,  # Default, can be overridden
            capabilities=[
                ModelCapability.CHAT,
                ModelCapability.FUNCTION_CALLING,
            ],
            pricing=ModelPricing(
                input_cost_per_million_tokens=0.0,
                output_cost_per_million_tokens=0.0
            ),
            tier_availability=["free", "paid"],
            priority=50,  # Lower priority - fallback option
            enabled=True,
            config=ModelConfig(
                api_base=config.OPENAI_COMPATIBLE_API_BASE,
            ),
            fallback_models=[
                "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
                "openai/gpt-4o-mini" if config.OPENAI_API_KEY else "gemini/gemini-2.5-flash" if config.GEMINI_API_KEY else "anthropic/claude-sonnet-4-20250514",
            ]
        ))
    
    async def initialize_ollama_models(self):
        """
        Discover and register Ollama models dynamically.
        
        This method should be called during application startup (after async services are ready).
        If OLLAMA_ENABLED is False or Ollama discovery fails, falls back to generic registration.
        """
        from core.utils.logger import logger
        
        # Check if Ollama integration is enabled
        if not config.OLLAMA_ENABLED:
            logger.info("OLLAMA_ENABLED is False, using generic OpenAI-compatible registration")
            self._register_generic_openai_compatible()
            return
        
        # Check if API base is configured
        if not config.OLLAMA_API_BASE:
            logger.warning("OLLAMA_API_BASE not set, skipping Ollama discovery")
            return
        
        try:
            from .ollama_client import OllamaClient
            
            logger.info("Starting Ollama model discovery...")
            client = OllamaClient()
            
            # List all models
            models_data = await client.list_models()
            
            if not models_data:
                logger.warning("No Ollama models found, using generic registration as fallback")
                self._register_generic_openai_compatible()
                return
            
            # Track registered count
            registered_count = 0
            
            # Process each model
            for model_data in models_data:
                try:
                    model_name = model_data.get("name")
                    if not model_name:
                        continue
                    
                    details = model_data.get("details", {})
                    
                    # Get detailed model info
                    model_info = await client.get_model_info(model_name)
                    
                    # Filter out embedding-only models
                    capabilities = model_info.get("capabilities", [])
                    if not client.is_chat_model(capabilities):
                        logger.debug(f"Skipping embedding-only model: {model_name}")
                        continue
                    
                    # Extract context window
                    context_window = client.extract_context_window(model_info)
                    
                    # Construct display name
                    display_name = client.construct_display_name(model_info, details, model_name)
                    
                    # Calculate priority (50-63 range based on parameter size)
                    base_priority = 50
                    param_size = details.get("parameter_size", "")
                    
                    # Add small boost for larger models
                    priority_boost = 0
                    if param_size:
                        try:
                            # Extract number from "3.2B", "8B", etc.
                            size_str = param_size.replace('B', '').replace('M', '')
                            size_num = float(size_str)
                            
                            # Larger models get slightly higher priority (max +13)
                            if 'B' in param_size:
                                priority_boost = min(int(size_num / 2), 13)
                            elif 'M' in param_size:
                                priority_boost = min(int(size_num / 1000), 5)
                        except (ValueError, AttributeError):
                            pass
                    
                    priority = base_priority + priority_boost
                    
                    # Register the model
                    model_id = f"openai-compatible/{model_name}"
                    
                    self.register(Model(
                        id=model_id,
                        name=display_name,
                        provider=ModelProvider.OPENAI,
                        aliases=[model_name],
                        context_window=context_window,
                        capabilities=[
                            ModelCapability.CHAT,
                            ModelCapability.FUNCTION_CALLING,
                        ] if "tools" in capabilities else [ModelCapability.CHAT],
                        pricing=ModelPricing(
                            input_cost_per_million_tokens=0.0,
                            output_cost_per_million_tokens=0.0
                        ),
                        tier_availability=["free", "paid"],
                        priority=priority,
                        enabled=True,
                        config=ModelConfig(
                            api_base=config.OLLAMA_API_BASE,
                        ),
                        fallback_models=[
                            "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
                            "openai/gpt-4o-mini" if config.OPENAI_API_KEY else "gemini/gemini-2.5-flash" if config.GEMINI_API_KEY else "anthropic/claude-sonnet-4-20250514",
                        ]
                    ))
                    
                    registered_count += 1
                    logger.debug(f"Registered Ollama model: {display_name} (context: {context_window}, priority: {priority})")
                    
                except Exception as e:
                    logger.warning(f"Failed to register Ollama model {model_name}: {e}")
                    continue
            
            if registered_count > 0:
                logger.info(f"Successfully registered {registered_count} Ollama models")
            else:
                logger.warning("No Ollama models were registered, using generic registration as fallback")
                self._register_generic_openai_compatible()
                
        except Exception as e:
            logger.error(f"Ollama model discovery failed: {e}")
            logger.info("Falling back to generic OpenAI-compatible registration")
            self._register_generic_openai_compatible()

    async def initialize_lm_studio_models(self):
        """
        Discover and register LM Studio models dynamically.
        
        This method should be called during application startup (after async services are ready).
        If LM Studio discovery fails, models will still be accessible via the API but won't be in the registry.
        """
        from core.utils.logger import logger
        
        try:
            from .lmstudio_client import LMStudioClient
            
            logger.info("Starting LM Studio model discovery...")
            client = LMStudioClient()
            
            # List all models
            models_data = await client.list_models()
            
            if not models_data:
                logger.warning("No LM Studio models found")
                return
            
            # Track registered count
            registered_count = 0
            
            # Process each model
            for model_data in models_data:
                try:
                    # LM Studio returns "id" field, not "name"
                    model_id = model_data.get("id") or model_data.get("model_name")
                    if not model_id:
                        continue
                    
                    # Extract context window - LM Studio uses different field names
                    context_window = model_data.get("max_context_length") or model_data.get("context_window", 64_000)
                    
                    # Use model name as display name
                    display_name = model_id
                    
                    # LM Studio models get priority 70+ (higher than Ollama's 50-63)
                    # This reflects that LM Studio typically has more capable models
                    base_priority = 70
                    priority = base_priority
                    
                    # Register the model with lm_studio provider
                    model_registry_id = f"lm_studio/{model_id}"
                    
                    self.register(Model(
                        id=model_registry_id,
                        name=display_name,
                        provider=ModelProvider.OPENAI,  # LM Studio is OpenAI-compatible
                        aliases=[model_id, f"lm_studio:{model_id}"],
                        context_window=context_window,
                        capabilities=[
                            ModelCapability.CHAT,
                            ModelCapability.FUNCTION_CALLING,
                        ],
                        pricing=ModelPricing(
                            input_cost_per_million_tokens=0.0,
                            output_cost_per_million_tokens=0.0
                        ),
                        tier_availability=["free", "paid"],
                        priority=priority,
                        enabled=True,
                        config=ModelConfig(
                            api_base=config.LM_STUDIO_API_BASE or "http://localhost:1234",
                        ),
                        fallback_models=[
                            "anthropic/claude-haiku-4-5" if SHOULD_USE_ANTHROPIC else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:application-inference-profile/heol2zyy5v48",
                            "openai/gpt-4o-mini" if config.OPENAI_API_KEY else "gemini/gemini-2.5-flash" if config.GEMINI_API_KEY else "anthropic/claude-sonnet-4-20250514",
                        ]
                    ))
                    
                    registered_count += 1
                    logger.debug(f"Registered LM Studio model: {display_name} (context: {context_window}, priority: {priority})")
                    
                except Exception as e:
                    logger.warning(f"Failed to register LM Studio model {model_id}: {e}")
                    continue
            
            if registered_count > 0:
                logger.info(f"Successfully registered {registered_count} LM Studio models")
            else:
                logger.warning("No LM Studio models were registered")
                
        except Exception as e:
            logger.error(f"LM Studio model discovery failed: {e}")

registry = ModelRegistry() 