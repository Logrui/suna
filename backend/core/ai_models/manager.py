from typing import Optional, List, Dict, Any, Tuple
from .registry import registry
from .ai_models import Model, ModelCapability
from core.utils.logger import logger
from .registry import PREMIUM_MODEL_ID, FREE_MODEL_ID
import asyncio

class ModelManager:
    def __init__(self):
        self.registry = registry
    
    def get_model(self, model_id: str) -> Optional[Model]:
        return self.registry.get(model_id)
    
    def resolve_model_id(self, model_id: str) -> str:
        # logger.debug(f"resolve_model_id called with: '{model_id}' (type: {type(model_id)})")
        
        resolved = self.registry.resolve_model_id(model_id)
        if resolved:
            return resolved
            
        return model_id
    
    def validate_model(self, model_id: str) -> Tuple[bool, str]:
        model = self.get_model(model_id)
        
        if not model:
            return False, f"Model '{model_id}' not found"
        
        if not model.enabled:
            return False, f"Model '{model.name}' is currently disabled"
        
        return True, ""
    
    def calculate_cost(
        self,
        model_id: str,
        input_tokens: int,
        output_tokens: int
    ) -> Optional[float]:
        model = self.get_model(model_id)
        if not model or not model.pricing:
            logger.warning(f"No pricing available for model: {model_id}")
            return None
        
        input_cost = input_tokens * model.pricing.input_cost_per_token
        output_cost = output_tokens * model.pricing.output_cost_per_token
        total_cost = input_cost + output_cost
        
        # logger.debug(
        #     f"Cost calculation for {model.name}: "
        #     f"{input_tokens} input tokens (${input_cost:.6f}) + "
        #     f"{output_tokens} output tokens (${output_cost:.6f}) = "
        #     f"${total_cost:.6f}"
        # )
        
        return total_cost
    
    def get_models_for_tier(self, tier: str) -> List[Model]:
        return self.registry.get_by_tier(tier, enabled_only=True)
    
    def get_litellm_params(self, model_id: str, **override_params) -> Dict[str, Any]:
        """Get complete LiteLLM parameters for a model from the registry."""
        model = self.get_model(model_id)
        if not model:
            logger.warning(f"Model '{model_id}' not found in registry, using basic params")
            
            # Handle local models (lm_studio:* and ollama:*) by converting format for litellm
            litellm_model_id = model_id
            if ":" in litellm_model_id:
                litellm_model_id = litellm_model_id.replace(":", "/")
                logger.debug(f"Converted local model format: {model_id} -> {litellm_model_id}")
            
            return {
                "model": litellm_model_id,
                "num_retries": 5,
                **override_params
            }
        
        # Get the complete configuration from the model
        params = model.get_litellm_params(**override_params)
        # logger.debug(f"Generated LiteLLM params for {model.name}: {list(params.keys())}")
        
        return params
    
    def get_models_with_capability(self, capability: ModelCapability) -> List[Model]:
        return self.registry.get_by_capability(capability, enabled_only=True)
    
    def select_best_model(
        self,
        tier: str,
        required_capabilities: Optional[List[ModelCapability]] = None,
        min_context_window: Optional[int] = None,
        prefer_cheaper: bool = False
    ) -> Optional[Model]:
        models = self.get_models_for_tier(tier)
        
        if required_capabilities:
            models = [
                m for m in models
                if all(cap in m.capabilities for cap in required_capabilities)
            ]
        
        if min_context_window:
            models = [m for m in models if m.context_window >= min_context_window]
        
        if not models:
            return None
        
        if prefer_cheaper and any(m.pricing for m in models):
            models_with_pricing = [m for m in models if m.pricing]
            if models_with_pricing:
                models = sorted(
                    models_with_pricing,
                    key=lambda m: m.pricing.input_cost_per_million_tokens
                )
        else:
            models = sorted(
                models,
                key=lambda m: (-m.priority, not m.recommended)
            )
        
        return models[0] if models else None
    
    def get_default_model(self, tier: str = "free") -> Optional[Model]:
        models = self.get_models_for_tier(tier)
        
        recommended = [m for m in models if m.recommended]
        if recommended:
            recommended = sorted(recommended, key=lambda m: -m.priority)
            return recommended[0]
        
        if models:
            models = sorted(models, key=lambda m: -m.priority)
            return models[0]
        
        return None
    
    async def get_context_window_async(self, model_id: str, default: int = 128_000) -> int:
        """
        Get context window for a model, with dynamic lookup for LM Studio models.
        
        Args:
            model_id: Model identifier (e.g., "lm_studio/google/gemma-3-27b")
            default: Fallback value if model not found
            
        Returns:
            Context window size in tokens
        """
        # First check registry
        model = self.get_model(model_id)
        if model:
            return model.context_window
        
        # For LM Studio models, query the API dynamically
        if model_id.startswith("lm_studio/") or model_id.startswith("lm_studio:"):
            try:
                from .lmstudio_client import LMStudioClient
                
                # Extract the model name (remove lm_studio/ or lm_studio: prefix)
                lm_model_id = model_id.split("/", 1)[1] if "/" in model_id else model_id.split(":", 1)[1]
                
                client = LMStudioClient()
                context_window = await client.get_context_window(lm_model_id)
                
                if context_window:
                    logger.info(f"Dynamically fetched context window for {model_id}: {context_window}")
                    return context_window
                else:
                    logger.warning(f"Could not fetch context window for {model_id}, using default: {default}")
                    return default
                    
            except Exception as e:
                logger.error(f"Error querying LM Studio for {model_id}: {e}, using default: {default}")
                return default
        
        # Fallback to default
        return default
    
    def get_context_window(self, model_id: str, default: int = 128_000) -> int:
        """
        Synchronous wrapper for get_context_window_async.
        
        Note: This will use the default for LM Studio models if called from sync context.
        Prefer using get_context_window_async() for dynamic LM Studio lookups.
        """
        # Check registry first (fast path)
        model = self.get_model(model_id)
        if model:
            return model.context_window
        
        # For LM Studio models in sync context, try to run async lookup
        if model_id.startswith("lm_studio/") or model_id.startswith("lm_studio:"):
            try:
                # Try to get or create event loop
                try:
                    loop = asyncio.get_running_loop()
                    # We're in an async context, but this is a sync function
                    # Fall back to default to avoid blocking
                    logger.warning(f"get_context_window called for LM Studio model {model_id} in async context, using default: {default}")
                    return default
                except RuntimeError:
                    # No running loop, we can create one
                    return asyncio.run(self.get_context_window_async(model_id, default))
            except Exception as e:
                logger.error(f"Error in sync LM Studio lookup for {model_id}: {e}, using default: {default}")
                return default
        
        # Fallback
        return default
    
    def check_token_limit(
        self,
        model_id: str,
        token_count: int,
        is_input: bool = True
    ) -> Tuple[bool, int]:
        model = self.get_model(model_id)
        if not model:
            return False, 0
        
        if is_input:
            max_allowed = model.context_window
        else:
            max_allowed = model.max_output_tokens or model.context_window
        
        return token_count <= max_allowed, max_allowed
    
    def format_model_info(self, model_id: str) -> Dict[str, Any]:
        model = self.get_model(model_id)
        if not model:
            return {"error": f"Model '{model_id}' not found"}
        
        return {
            "id": model.id,
            "name": model.name,
            "provider": model.provider.value,
            "context_window": model.context_window,
            "max_output_tokens": model.max_output_tokens,
            "capabilities": [cap.value for cap in model.capabilities],
            "pricing": {
                "input_per_million": model.pricing.input_cost_per_million_tokens,
                "output_per_million": model.pricing.output_cost_per_million_tokens,
            } if model.pricing else None,
            "enabled": model.enabled,
            "beta": model.beta,
            "tier_availability": model.tier_availability,
            "priority": model.priority,
            "recommended": model.recommended,
        }
    
    def list_available_models(
        self,
        tier: Optional[str] = None,
        include_disabled: bool = False
    ) -> List[Dict[str, Any]]:
        # logger.debug(f"list_available_models called with tier='{tier}', include_disabled={include_disabled}")
        
        if tier:
            models = self.registry.get_by_tier(tier, enabled_only=not include_disabled)
            # logger.debug(f"Found {len(models)} models for tier '{tier}'")
        else:
            models = self.registry.get_all(enabled_only=not include_disabled)
            # logger.debug(f"Found {len(models)} total models")
        
        if models:
            model_names = [m.name for m in models]
            # logger.debug(f"Models: {model_names}")
        else:
            logger.warning(f"No models found for tier '{tier}' - this might indicate a configuration issue")
        
        models = sorted(
            models,
            key=lambda m: (not m.is_free_tier, -m.priority, m.name)
        )
        
        return [self.format_model_info(m.id) for m in models]
    
    def get_legacy_constants(self) -> Dict:
        return self.registry.to_legacy_format()
    
    async def get_default_model_for_user(self, client, user_id: str) -> str:
        try:
            from core.utils.config import config, EnvMode
            if config.ENV_MODE == EnvMode.LOCAL:
                return PREMIUM_MODEL_ID
                
            from core.billing.subscription_service import subscription_service
            
            subscription_info = await subscription_service.get_subscription(user_id)
            subscription = subscription_info.get('subscription')
            
            is_paid_tier = False
            if subscription:
                price_id = None
                if subscription.get('items') and subscription['items'].get('data') and len(subscription['items']['data']) > 0:
                    price_id = subscription['items']['data'][0]['price']['id']
                else:
                    price_id = subscription.get('price_id')
                
                # Check if this is a paid tier by looking at the tier info
                tier_info = subscription_info.get('tier', {})
                if tier_info and tier_info.get('name') != 'free' and tier_info.get('name') != 'none':
                    is_paid_tier = True
            
            if is_paid_tier:
                # logger.debug(f"Setting Default Premium Model for paid user {user_id}")
                return PREMIUM_MODEL_ID
            else:
                # logger.debug(f"Setting Default Free Model for free user {user_id}")
                return FREE_MODEL_ID
                
        except Exception as e:
            logger.warning(f"Failed to determine user tier for {user_id}: {e}")
            return FREE_MODEL_ID


model_manager = ModelManager() 