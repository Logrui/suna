from typing import Dict, List, Optional
from .models import Model, ModelProvider
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
        # To be implemented in later phases
        pass

    def get_all(self) -> List[Model]:
        return list(self._models.values())
        
    def get(self, model_id: str) -> Optional[Model]:
        return self._models.get(model_id)
