import json
from typing import Any
from core.services.redis import get_client
from core.utils.logger import logger


class _cache:
    async def get(self, key: str):
        try:
            redis = await get_client()
            key = f"cache:{key}"
            result = await redis.get(key)
            if result:
                return json.loads(result)
            return None
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int = 15 * 60):
        try:
            redis = await get_client()
            key = f"cache:{key}"
            await redis.set(key, json.dumps(value), ex=ttl)
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")

    async def invalidate(self, key: str):
        try:
            redis = await get_client()
            key = f"cache:{key}"
            await redis.delete(key)
        except Exception as e:
            logger.warning(f"Cache invalidate failed: {e}")


Cache = _cache()
