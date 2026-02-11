import asyncio
from typing import List, Optional, Dict, Any
from abc import ABC, abstractmethod
from core.utils.logger import logger
from core.utils.config import config

class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        pass
    
    @abstractmethod
    async def embed_single(self, text: str) -> List[float]:
        pass

class LiteLLMEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model: str, api_key: Optional[str] = None):
        self.model = model
        self.api_key = api_key
        self._litellm = None

    @property
    def litellm(self):
        if self._litellm is None:
            import litellm
            self._litellm = litellm
            # Configure OpenRouter headers if necessary
            if "openrouter" in self.model:
                self._litellm.headers = {
                    "HTTP-Referer": config.OR_SITE_URL or "https://kortix.com",
                    "X-Title": config.OR_APP_NAME or "Kortix",
                }
        return self._litellm

    async def embed(self, texts: List[str]) -> List[List[float]]:
        try:
            extra_kwargs = {}
            if "openrouter" in self.model or (self.api_key and self.api_key == config.OPENROUTER_API_KEY):
                extra_kwargs["api_base"] = config.OPENROUTER_API_BASE or "https://openrouter.ai/api/v1"
                extra_kwargs["extra_headers"] = {
                    "HTTP-Referer": config.OR_SITE_URL or "https://kortix.com",
                    "X-Title": config.OR_APP_NAME or "Kortix",
                }

            logger.info(f"🧠 [EMBEDDING] Calling litellm.aembedding with model={self.model}, api_base={extra_kwargs.get('api_base')}")
            
            response = await self.litellm.aembedding(
                model=self.model,
                input=texts,
                api_key=self.api_key,
                **extra_kwargs
            )
            return [e["embedding"] for e in response.data]
        except Exception as e:
            logger.error(f"LiteLLM embedding error ({self.model}): {str(e)}")
            raise

    async def embed_single(self, text: str) -> List[float]:
        embeddings = await self.embed([text])
        return embeddings[0]

class LocalEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model: str = "all-MiniLM-L6-v2"):
        self.model = model
        self._model_instance = None
    
    @property
    def model_instance(self):
        if self._model_instance is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model_instance = SentenceTransformer(self.model)
            except ImportError:
                logger.error("sentence-transformers not installed. Install with: pip install sentence-transformers")
                raise
        return self._model_instance
    
    async def embed(self, texts: List[str]) -> List[List[float]]:
        try:
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(
                None,
                lambda: self.model_instance.encode(texts, convert_to_numpy=True)
            )
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Local embedding error: {str(e)}")
            raise
    
    async def embed_single(self, text: str) -> List[float]:
        embeddings = await self.embed([text])
        return embeddings[0]

class EmbeddingService:
    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None):
        self.provider_name = provider or config.MEMORY_EMBEDDING_PROVIDER or "openrouter"
        self.model = model
        self._provider = None
    
    @property
    def provider(self) -> EmbeddingProvider:
        if self._provider is None:
            self._provider = self._create_provider()
        return self._provider
    
    def _create_provider(self) -> EmbeddingProvider:
        provider_name = self.provider_name.lower()
        
        if provider_name == "local":
            model = self.model or "all-MiniLM-L6-v2"
            logger.info(f"Using local embedding provider with model: {model}")
            return LocalEmbeddingProvider(model=model)
        
        # Default to LiteLLM for everything else (OpenAI, Voyage, OpenRouter, etc.)
        model = self.model or config.MEMORY_EMBEDDING_MODEL or "openai/text-embedding-3-small"
        
        # If provider is explicitly 'openai' but model doesn't have it, we might need to prefix for LiteLLM
        # but usually config.MEMORY_EMBEDDING_MODEL should be correct.
        
        logger.info(f"Using LiteLLM embedding provider ({provider_name}) with model: {model}")
        
        api_key = None
        if provider_name == "openrouter":
            api_key = config.OPENROUTER_API_KEY
        elif provider_name == "openai":
            api_key = config.OPENAI_API_KEY
        elif provider_name == "voyage":
            api_key = config.VOYAGE_API_KEY
            
        return LiteLLMEmbeddingProvider(model=model, api_key=api_key)
    
    async def embed_text(self, text: str) -> List[float]:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        return await self.provider.embed_single(text)
    
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        
        valid_texts = [t for t in texts if t and t.strip()]
        if not valid_texts:
            raise ValueError("All texts are empty")
        
        return await self.provider.embed(valid_texts)
    
    async def embed_batch(self, texts: List[str], batch_size: int = 100) -> List[List[float]]:
        if not texts:
            return []
        
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = await self.embed_texts(batch)
            all_embeddings.extend(embeddings)
        
        return all_embeddings

embedding_service = EmbeddingService()
