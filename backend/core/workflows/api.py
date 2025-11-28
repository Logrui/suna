"""
Workflow API Router

Provides REST endpoints for workflow management:
- CRUD operations (list, get, create, update, delete)
- Validation endpoints
- Compilation endpoints
- Execution endpoints

Feature: Advanced Visual Workflow Builder
Version: 1.0.0
Created: 2025-11-27
"""

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
import logging

from backend.core.services.supabase import get_supabase_client
from backend.core.auth import get_current_user
from backend.core.workflows.models import Workflow
from backend.core.workflows.types import CompiledLogic
from backend.core.workflows.validator import GraphValidator
from backend.core.workflows.compiler import GraphCompiler
from backend.core.workflows.executor import GraphExecutor
from fastapi.responses import StreamingResponse
from backend.core.agentpress.thread_manager import ThreadManager
from core.services import redis
import json
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/workflows",
    tags=["Workflows"]
)

@router.get("/agents/{agent_id}/workflows", response_model=List[Workflow])
async def list_agent_workflows(
    agent_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """List all workflows for an agent"""
    supabase = get_supabase_client()
    
    # RLS policies will handle permission checks based on current_user context
    # In a real implementation, we'd ensure the client is authenticated with the user's token
    # or use a service role client if we check permissions manually.
    # Assuming get_supabase_client() returns a client with RLS context if configured,
    # or we might need to set the session.
    
    response = supabase.table("agent_workflows") \
        .select("*") \
        .eq("agent_id", str(agent_id)) \
        .order("created_at", desc=True) \
        .execute()
        
    return response.data

@router.get("/agents/{agent_id}/workflows/{workflow_id}", response_model=Workflow)
async def get_workflow(
    agent_id: UUID,
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific workflow"""
    supabase = get_supabase_client()
    
    response = supabase.table("agent_workflows") \
        .select("*") \
        .eq("id", str(workflow_id)) \
        .eq("agent_id", str(agent_id)) \
        .single() \
        .execute()
        
    if not response.data:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    return response.data

@router.post("/agents/{agent_id}/workflows", response_model=Workflow)
async def create_workflow(
    agent_id: UUID,
    workflow_data: Workflow,
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow"""
    supabase = get_supabase_client()
    
    # Exclude ID and timestamps to let DB handle them
    data = workflow_data.model_dump(exclude={"id", "created_at", "updated_at"}, exclude_unset=True)
    data["agent_id"] = str(agent_id)
    
    response = supabase.table("agent_workflows") \
        .insert(data) \
        .execute()
        
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create workflow")
        
    return response.data[0]

@router.put("/agents/{agent_id}/workflows/{workflow_id}", response_model=Workflow)
async def update_workflow(
    agent_id: UUID,
    workflow_id: UUID,
    workflow_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Update an existing workflow"""
    supabase = get_supabase_client()
    
    # Verify existence first
    # (RLS handles auth)
    
    data = workflow_data.copy()
    data["updated_at"] = datetime.now().isoformat()
    
    response = supabase.table("agent_workflows") \
        .update(data) \
        .eq("id", str(workflow_id)) \
        .eq("agent_id", str(agent_id)) \
        .execute()
        
    if not response.data:
        raise HTTPException(status_code=404, detail="Workflow not found or update failed")
        
    return response.data[0]

@router.delete("/agents/{agent_id}/workflows/{workflow_id}")
async def delete_workflow(
    agent_id: UUID,
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete a workflow"""
    supabase = get_supabase_client()

    response = supabase.table("agent_workflows") \
        .delete() \
        .eq("id", str(workflow_id)) \
        .eq("agent_id", str(agent_id)) \
        .execute()

    return {"message": "Workflow deleted successfully"}


# ============================================================================
# Advanced Workflow Endpoints
# ============================================================================

@router.post("/agents/{agent_id}/workflows/{workflow_id}/validate")
async def validate_workflow(
    agent_id: UUID,
    workflow_id: UUID,
    graph_definition: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Validate graph definition without saving.
    Maps to: FR-041 (Validation engine)
    """
    validator = GraphValidator()
    result = validator.validate(graph_definition)

    return result


@router.post("/agents/{agent_id}/workflows/{workflow_id}/compile")
async def compile_workflow(
    agent_id: UUID,
    workflow_id: UUID,
    graph_definition: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Compile graph_definition to compiled_logic without saving.
    Maps to: FR-BC-005 (Dual-state storage)
    """
    # First validate
    validator = GraphValidator()
    validation = validator.validate(graph_definition)

    if not validation['valid']:
        raise HTTPException(
            status_code=400,
            detail={
                'error': 'VALIDATION_ERROR',
                'message': 'Graph validation failed before compilation',
                'validation_errors': validation['errors']
            }
        )

    # Compile
    compiler = GraphCompiler()
    try:
        compiled_logic = compiler.compile(graph_definition)
        return {
            'compiled_logic': compiled_logic,
            'compilation_warnings': validation['warnings']
        }
    except Exception as e:
        logger.error(f"Compilation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                'error': 'COMPILATION_ERROR',
                'message': str(e)
            }
        )


@router.post("/agents/{agent_id}/workflows/{workflow_id}/execute")
async def execute_workflow(
    agent_id: UUID,
    workflow_id: UUID,
    trigger_context: Dict[str, Any] = Body(..., alias='trigger_context'),
    thread_id: Optional[str] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Execute workflow with trigger context.
    Maps to: FR-027 (Start execution), FR-BC-007 (Router)
    """
    supabase = get_supabase_client()

    # Get workflow
    workflow_response = supabase.table("agent_workflows") \
        .select("*") \
        .eq("id", str(workflow_id)) \
        .eq("agent_id", str(agent_id)) \
        .single() \
        .execute()

    if not workflow_response.data:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow = workflow_response.data
    mode = workflow.get('mode', 'simple')

    # Mode detection router
    if mode == 'simple':
        # TODO: Use existing simple workflow execution
        raise HTTPException(
            status_code=501,
            detail="Simple mode execution not yet integrated"
        )

    elif mode == 'advanced':
        # Advanced mode execution
        compiled_logic = workflow.get('compiled_logic')
        if not compiled_logic:
            raise HTTPException(
                status_code=422,
                detail="Advanced workflow missing compiled_logic"
            )

        # Create thread if not provided
        if not thread_id:
            import uuid
            thread_id = str(uuid.uuid4())

        # Execute workflow
        thread_manager = ThreadManager()
        redis_client = await redis.get_client()
        executor = GraphExecutor(thread_manager=thread_manager, redis_client=redis_client)
        try:
            result = await executor.execute(
                workflow_id=str(workflow_id),
                thread_id=thread_id,
                compiled_logic=compiled_logic,
                trigger_context=trigger_context
            )

            return {
                'execution_id': result['execution_id'],
                'thread_id': result['thread_id'],
                'status': result['status'],
                'started_at': result['started_at'],
                'monitor_url': f"/api/workflows/executions/{result['execution_id']}/stream"
            }

        except Exception as e:
            logger.error(f"Execution failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={
                    'error': 'EXECUTION_ERROR',
                    'message': str(e)
                }
            )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown workflow mode: {mode}"
        )


@router.get("/executions/{execution_id}")
async def get_execution_status(
    execution_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get execution status and history.
    Maps to: FR-028 (View execution status)
    """
    # TODO: Implement execution storage and retrieval
    # For now, return placeholder
@router.get("/executions/{execution_id}/stream")
async def stream_execution_events(
    execution_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Stream execution events via SSE.
    Maps to: FR-030 (Real-time monitoring)
    """
    async def event_generator():
        redis_client = await redis.get_client()
        pubsub = redis_client.pubsub()
        channel = f"workflow:execution:{execution_id}"
        await pubsub.subscribe(channel)

        try:
            # Send initial connection message
            yield f"data: {json.dumps({'event_type': 'connected', 'timestamp': datetime.utcnow().isoformat() + 'Z'})}\n\n"

            async for message in pubsub.listen():
                if message['type'] == 'message':
                    data = message['data']
                    yield f"data: {data}\n\n"
                    
                    # Check for completion event to close stream
                    try:
                        event_data = json.loads(data)
                        if event_data.get('event_type') in ['execution_completed', 'execution_failed']:
                            break
                    except:
                        pass
        except asyncio.CancelledError:
            logger.info(f"Stream cancelled for execution {execution_id}")
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class ExecutionControlRequest(BaseModel):
    action: Literal['pause', 'resume', 'stop']

@router.post("/executions/{execution_id}/control")
async def control_execution(
    execution_id: str,
    control: ExecutionControlRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Control execution state (pause, resume, stop).
    Maps to: FR-029 (Execution control)
    """
    redis_client = await redis.get_client()
    key = f"workflow:execution:{execution_id}:control"
    
    await redis_client.set(key, control.action)
    
    return {"status": "success", "action": control.action}


@router.get("/workflows/{workflow_id}/variables")
async def get_workflow_variables(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all variables available in workflow.
    Maps to: FR-031 (Autocomplete system)
    """
    supabase = get_supabase_client()

    # Get workflow
    workflow_response = supabase.table("agent_workflows") \
        .select("*") \
        .eq("id", str(workflow_id)) \
        .single() \
        .execute()

    if not workflow_response.data:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow = workflow_response.data
    compiled_logic = workflow.get('compiled_logic')

    if not compiled_logic:
        return {'variables': []}

    variables = compiled_logic.get('variables', [])


# ============================================================================
# Root-Level Workflow Endpoints (Frontend Compatibility)
# ============================================================================

@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow_by_id(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific workflow by ID"""
    supabase = get_supabase_client()
    
    response = supabase.table("agent_workflows") \
        .select("*") \
        .eq("id", str(workflow_id)) \
        .single() \
        .execute()
        
    if not response.data:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    return response.data

@router.put("/{workflow_id}", response_model=Workflow)
async def update_workflow_by_id(
    workflow_id: UUID,
    workflow_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Update an existing workflow by ID"""
    supabase = get_supabase_client()
    
    data = workflow_data.copy()
    data["updated_at"] = datetime.now().isoformat()
    
    response = supabase.table("agent_workflows") \
        .update(data) \
        .eq("id", str(workflow_id)) \
        .execute()
        
    if not response.data:
        raise HTTPException(status_code=404, detail="Workflow not found or update failed")
        
    return response.data[0]

@router.patch("/{workflow_id}", response_model=Workflow)
async def patch_workflow_by_id(
    workflow_id: UUID,
    workflow_data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Partial update of an existing workflow by ID"""
    supabase = get_supabase_client()
    
    data = workflow_data.copy()
    data["updated_at"] = datetime.now().isoformat()
    
    response = supabase.table("agent_workflows") \
        .update(data) \
        .eq("id", str(workflow_id)) \
        .execute()
        
    if not response.data:
        raise HTTPException(status_code=404, detail="Workflow not found or update failed")
        
    return response.data[0]

@router.post("/{workflow_id}/validate")
async def validate_workflow_by_id(
    workflow_id: UUID,
    graph_definition: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Validate graph definition without saving"""
    validator = GraphValidator()
    result = validator.validate(graph_definition)
    return result

@router.post("/{workflow_id}/compile")
async def compile_workflow_by_id(
    workflow_id: UUID,
    graph_definition: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Compile graph_definition to compiled_logic without saving"""
    # First validate
    validator = GraphValidator()
    validation = validator.validate(graph_definition)

    if not validation['valid']:
        raise HTTPException(
            status_code=400,
            detail={
                'error': 'VALIDATION_ERROR',
                'message': 'Graph validation failed before compilation',
                'validation_errors': validation['errors']
            }
        )

    # Compile
    compiler = GraphCompiler()
    try:
        compiled_logic = compiler.compile(graph_definition)
        return {
            'compiled_logic': compiled_logic,
            'compilation_warnings': validation['warnings']
        }
    except Exception as e:
        logger.error(f"Compilation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                'error': 'COMPILATION_ERROR',
                'message': str(e)
            }
        )

@router.post("/{workflow_id}/execute")
async def execute_workflow_by_id(
    workflow_id: UUID,
    trigger_context: Dict[str, Any] = Body(..., alias='trigger_context'),
    thread_id: Optional[str] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """Execute workflow with trigger context"""
    supabase = get_supabase_client()

    # Get workflow
    workflow_response = supabase.table("agent_workflows") \
        .select("*") \
        .eq("id", str(workflow_id)) \
        .single() \
        .execute()

    if not workflow_response.data:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow = workflow_response.data
    mode = workflow.get('mode', 'simple')

    # Mode detection router
    if mode == 'simple':
        raise HTTPException(
            status_code=501,
            detail="Simple mode execution not yet integrated"
        )

    elif mode == 'advanced':
        compiled_logic = workflow.get('compiled_logic')
        if not compiled_logic:
            raise HTTPException(
                status_code=422,
                detail="Advanced workflow missing compiled_logic"
            )

        if not thread_id:
            import uuid
            thread_id = str(uuid.uuid4())

        thread_manager = ThreadManager()
        redis_client = await redis.get_client()
        executor = GraphExecutor(thread_manager=thread_manager, redis_client=redis_client)
        try:
            result = await executor.execute(
                workflow_id=str(workflow_id),
                thread_id=thread_id,
                compiled_logic=compiled_logic,
                trigger_context=trigger_context
            )

            return {
                'execution_id': result['execution_id'],
                'thread_id': result['thread_id'],
                'status': result['status'],
                'started_at': result['started_at'],
                'monitor_url': f"/api/workflows/executions/{result['execution_id']}/stream"
            }

        except Exception as e:
            logger.error(f"Execution failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={
                    'error': 'EXECUTION_ERROR',
                    'message': str(e)
                }
            )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown workflow mode: {mode}"
        )

@router.get("/{workflow_id}/variables")
async def get_workflow_variables_by_id(
    workflow_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get all variables available in workflow"""
    supabase = get_supabase_client()

    workflow_response = supabase.table("agent_workflows") \
        .select("*") \
        .eq("id", str(workflow_id)) \
        .single() \
        .execute()

    if not workflow_response.data:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow = workflow_response.data
    compiled_logic = workflow.get('compiled_logic')

    if not compiled_logic:
        return {'variables': []}

    variables = compiled_logic.get('variables', [])

    return {'variables': variables}
