from typing import Dict, List, Optional
from .models import Model, ModelProvider, ModelCapability, ModelPricing
from .ollama_client import OllamaClient
from .lmstudio_client import LMStudioClient
from core.utils.logger import logger

class LocalModelRegistry:
    """
    Registry for local models (Ollama, LM Studio).
    Discovers models on initialization.
    """
    def __init__(self):
        self._models: Dict[str, Model] = {}
        self.ollama_client = OllamaClient()
        self.lmstudio_client = LMStudioClient()
        
    async def initialize(self):
        """Discover models from local providers."""
        await self._discover_ollama()
        
    async def _discover_ollama(self):
        try:
            logger.info("Discovering Ollama models...")
            ollama_models = await self.ollama_client.list_models()
            
            for model_data in ollama_models:
                name = model_data.get("name")
                if not name:
                    continue
                    
                try:
                    info = await self.ollama_client.get_model_info(name)
                    
                    context_window = self.ollama_client.extract_context_window(info) or 4096
                    display_name = self.ollama_client.construct_display_name(
                        info.get("model_info", {}), 
                        info.get("details", {}), 
                        name
                    )
                    
                    model = Model(
                        id=f"ollama/{name}",
                        name=display_name,
                        provider=ModelProvider.OLLAMA,
                        context_window=context_window,
                        max_output_tokens=4096, 
                        capabilities=[ModelCapability.CHAT],
                        enabled=True,
                        tier_availability=["free"],
                        pricing=ModelPricing(0, 0),
                        priority=50
                    )
                    
                    self._models[model.id] = model
                    logger.debug(f"Registered Ollama model: {model.id}")
                    
                except Exception as e:
                    logger.warning(f"Failed to process Ollama model {name}: {e}")
                    continue
                    
        except Exception as e:
            logger.warning(f"Failed to discover Ollama models: {e}")

    def get_all(self) -> List[Model]:
        return list(self._models.values())
        
    def get(self, model_id: str) -> Optional[Model]:
        return self._models.get(model_id)
