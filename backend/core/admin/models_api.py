from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from core.auth import require_admin
from core.ai_models.registry import registry
from core.ai_models.models import ModelProvider
from core.services.llm import make_llm_api_call
from core.utils.logger import logger
import time
import asyncio

router = APIRouter(prefix="/admin/models", tags=["admin-models"])

class ModelMetadata(BaseModel):
    id: str
    name: str
    provider: str
    enabled: bool
    context_window: int
    max_output_tokens: Optional[int] = None
    input_cost_per_million: float = 0
    output_cost_per_million: float = 0
    litellm_id: str
    fallbacks: List[str]
    capabilities: List[str]
    tier_availability: List[str]
    priority: int
    recommended: bool

class TestRequest(BaseModel):
    include_local: bool = False
    disable_fallbacks: bool = True

class TestResult(BaseModel):
    model_id: str
    status: str
    latency_ms: float
    outcome: str
    provider: str

@router.get("/", response_model=List[ModelMetadata])
async def list_admin_models(admin: dict = Depends(require_admin)):
    """List all registered models with detailed metadata for admin dashboard."""
    # Ensure local models are initialized
    await registry.initialize_local_models()
    
    models = registry.get_all(enabled_only=False)
    result = []
    
    for m in models:
        result.append(ModelMetadata(
            id=m.id,
            name=m.name,
            provider=m.provider.value,
            enabled=m.enabled,
            context_window=m.context_window,
            max_output_tokens=m.max_output_tokens,
            input_cost_per_million=m.pricing.input_cost_per_million_tokens if m.pricing else 0,
            output_cost_per_million=m.pricing.output_cost_per_million_tokens if m.pricing else 0,
            litellm_id=m.litellm_model_id,
            fallbacks=m.fallback_models,
            capabilities=[cap.value for cap in m.capabilities],
            tier_availability=m.tier_availability,
            priority=m.priority,
            recommended=m.recommended
        ))
    
    return sorted(result, key=lambda x: (-x.priority, x.id))

@router.post("/test", response_model=List[TestResult])
async def test_models(request: TestRequest, admin: dict = Depends(require_admin)):
    """Run connectivity tests for models."""
    await registry.initialize_local_models()
    models = registry.get_all(enabled_only=False)
    
    # Filter models
    target_models = []
    for m in models:
        is_local = m.provider in [ModelProvider.OLLAMA, ModelProvider.LM_STUDIO]
        if not request.include_local and is_local:
            continue
        target_models.append(m)
    
    # 標準的なテストメッセージ
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "This is a network connectivity test, respond with a short generic one sentence response"}
    ]

    async def run_single_test(model_id: str):
        start_time = time.time()
        try:
            # Use make_llm_api_call with stream=False
            # If disable_fallbacks is True, we pass empty fallbacks list
            fallbacks = [] if request.disable_fallbacks else None
            
            response = await make_llm_api_call(
                messages=messages,
                model_name=model_id,
                stream=False,
                max_tokens=20,
                fallbacks=fallbacks
            )
            
            latency = (time.time() - start_time) * 1000
            content = response.choices[0].message.content
            
            return TestResult(
                model_id=model_id,
                status="PASS",
                latency_ms=latency,
                outcome=content or "Success (Empty Response)",
                provider=registry.get(model_id).provider.value
            )
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            return TestResult(
                model_id=model_id,
                status="FAIL",
                latency_ms=latency,
                outcome=str(e),
                provider=registry.get(model_id).provider.value if registry.get(model_id) else "unknown"
            )

    # Run tests sequentially to avoid overwhelming providers/hitting local rate limits
    results = []
    for m in target_models:
        results.append(await run_single_test(m.id))
        await asyncio.sleep(0.1)
        
    return results
