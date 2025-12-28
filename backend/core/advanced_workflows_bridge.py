"""
Advanced Workflows Integration Bridge

This module provides an authentication bridge between Suna Kortix and Advanced Workflows.
When a user accesses the Advanced Workflow Editor in Suna, this bridge:
1. Verifies the user's Suna JWT
2. Exchanges it for an Advanced Workflows session token via their external auth endpoint
3. Ensures the project (agent) and flow (workflow) exist in Langflow with matching IDs
4. Returns the token and flow URL for iframe authentication

Environment Variables:
- ADVANCED_WORKFLOWS_BACKEND_URL: URL of the Advanced Workflows backend (e.g., http://localhost:7860)
- ADVANCED_WORKFLOWS_FRONTEND_URL: URL of the Advanced Workflows frontend (for iframe src)
- ADVANCED_WORKFLOWS_INTEGRATION_SECRET: Shared secret for secure token exchange

See: Option_A_iframe_implementation_plan.md for full integration details.
"""

import os
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.services.supabase import DBConnection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/advanced-workflows", tags=["advanced-workflows"])


class AdvancedWorkflowsTokenResponse(BaseModel):
    """Response model for Advanced Workflows token exchange."""
    access_token: str
    refresh_token: Optional[str] = None
    advanced_workflows_url: str
    expires_in: int = 3600  # Token expiry in seconds


class AdvancedWorkflowsSessionResponse(BaseModel):
    """Response model for the full session setup including project/flow sync."""
    access_token: str
    refresh_token: Optional[str] = None
    advanced_workflows_url: str
    flow_url: str  # Direct URL to the flow editor
    project_id: str  # Langflow project ID (same as Suna agent ID)
    flow_id: str  # Langflow flow ID (same as Suna workflow ID)
    project_created: bool  # True if project was newly created
    flow_created: bool  # True if flow was newly created
    expires_in: int = 3600


class AdvancedWorkflowsConfig:
    """Configuration for Advanced Workflows integration."""
    
    @staticmethod
    def get_backend_url() -> Optional[str]:
        """Get Advanced Workflows backend URL from environment."""
        return os.getenv("ADVANCED_WORKFLOWS_BACKEND_URL")
    
    @staticmethod
    def get_frontend_url() -> Optional[str]:
        """Get Advanced Workflows frontend URL from environment."""
        # Default to backend URL if not separately configured
        return os.getenv("ADVANCED_WORKFLOWS_FRONTEND_URL") or os.getenv("ADVANCED_WORKFLOWS_BACKEND_URL")
    
    @staticmethod
    def get_integration_secret() -> Optional[str]:
        """Get the shared secret for Advanced Workflows integration."""
        return os.getenv("ADVANCED_WORKFLOWS_INTEGRATION_SECRET")
    
    @staticmethod
    def is_configured() -> bool:
        """Check if Advanced Workflows integration is properly configured."""
        return bool(
            AdvancedWorkflowsConfig.get_backend_url() and 
            AdvancedWorkflowsConfig.get_integration_secret()
        )


async def get_user_email(user_id: str) -> Optional[str]:
    """Fetch user email from the database."""
    try:
        db = DBConnection()
        await db.initialize()
        client = await db.client
        
        result = await client.table('accounts').select('email').eq('user_id', user_id).limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0].get('email')
        return None
    except Exception as e:
        logger.warning(f"Could not fetch user email: {e}")
        return None


async def get_agent_name(agent_id: str) -> str:
    """Fetch agent name from the database."""
    try:
        db = DBConnection()
        await db.initialize()
        client = await db.client
        
        result = await client.table('agents').select('name').eq('agent_id', agent_id).limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0].get('name', f"Agent {agent_id[:8]}")
        return f"Agent {agent_id[:8]}"
    except Exception as e:
        logger.warning(f"Could not fetch agent name: {e}")
        return f"Agent {agent_id[:8]}"


async def get_workflow_name(workflow_id: str) -> str:
    """Fetch workflow name from the database.
    
    Note: The agent_workflows table uses 'id' as the primary key and may not have a name column.
    In the future, a dedicated 'kortix_workflows' table will be created for general advanced workflows.
    """
    try:
        db = DBConnection()
        await db.initialize()
        client = await db.client
        
        # Query agent_workflows table - uses 'id' column, not 'workflow_id'
        result = await client.table('agent_workflows').select('id, name').eq('id', workflow_id).limit(1).execute()
        if result.data and len(result.data) > 0:
            # Try to get name, fallback to generated name
            workflow_data = result.data[0]
            name = workflow_data.get('name')
            if name:
                return name
            return f"Advanced Workflow {workflow_id[:8]}"
        return f"Advanced Workflow {workflow_id[:8]}"
    except Exception as e:
        logger.warning(f"Could not fetch workflow name: {e}")
        return f"Advanced Workflow {workflow_id[:8]}"


async def exchange_suna_token_for_advanced_workflows(
    suna_user_id: str,
    suna_user_email: Optional[str],
) -> dict:
    """
    Exchange Suna user credentials for an Advanced Workflows session token.
    
    This calls their external auth endpoint to obtain a token
    that can be used to authenticate the user in the iframe.
    
    Args:
        suna_user_id: The authenticated Suna user's ID
        suna_user_email: The authenticated Suna user's email (optional)
        
    Returns:
        dict with access_token and optional refresh_token
        
    Raises:
        HTTPException: If token exchange fails
    """
    backend_url = AdvancedWorkflowsConfig.get_backend_url()
    integration_secret = AdvancedWorkflowsConfig.get_integration_secret()
    
    if not backend_url or not integration_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Advanced Workflows integration not configured"
        )
    
    # Call Advanced Workflows's external auth endpoint
    external_auth_url = f"{backend_url.rstrip('/')}/api/v1/external-auth/issue-token"
    logger.info(f"[Token Exchange] Calling external auth endpoint: {external_auth_url}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                external_auth_url,
                json={
                    "external_user_id": suna_user_id,
                    "email": suna_user_email,
                    "username": f"suna_{suna_user_id[:8]}",
                    "source": "suna-kortix",
                },
                headers={
                    "X-Integration-Key": integration_secret,
                    "Content-Type": "application/json",
                }
            )
            
            logger.info(f"[Token Exchange] Response status: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                logger.error("Advanced Workflows rejected integration secret")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Advanced Workflows authentication failed - check integration secret"
                )
            else:
                logger.error(f"Advanced Workflows external auth failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Advanced Workflows service error: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        logger.error("Timeout connecting to Advanced Workflows")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Advanced Workflows service timeout"
        )
    except httpx.RequestError as e:
        logger.error(f"Error connecting to Advanced Workflows: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to connect to Advanced Workflows service"
        )


async def ensure_project_exists(
    access_token: str,
    agent_id: str,
    agent_name: str,
) -> dict:
    """
    Ensure a project exists in Langflow with the Suna agent ID.
    
    Args:
        access_token: The Advanced Workflows access token for authentication
        agent_id: Suna agent ID (becomes Langflow project ID)
        agent_name: Name for the project
        
    Returns:
        dict with project details including 'created' boolean
    """
    backend_url = AdvancedWorkflowsConfig.get_backend_url()
    integration_secret = AdvancedWorkflowsConfig.get_integration_secret()
    
    suna_ensure_url = f"{backend_url.rstrip('/')}/api/v1/suna/ensure-project"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                suna_ensure_url,
                json={
                    "suna_agent_id": agent_id,
                    "name": agent_name,
                    "description": f"Project synced from Suna Kortix agent: {agent_name}",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Integration-Key": integration_secret,
                    "Content-Type": "application/json",
                }
            )
            
            if response.status_code in (200, 201):
                return response.json()
            else:
                logger.error(f"Failed to ensure project: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to sync project with Advanced Workflows: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        logger.error("Timeout ensuring project in Advanced Workflows")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Advanced Workflows project sync timeout"
        )
    except httpx.RequestError as e:
        logger.error(f"Error ensuring project in Advanced Workflows: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to sync project with Advanced Workflows"
        )


async def ensure_flow_exists(
    access_token: str,
    workflow_id: str,
    agent_id: str,
    workflow_name: str,
) -> dict:
    """
    Ensure a flow exists in Langflow with the Suna workflow ID.
    
    Args:
        access_token: The Advanced Workflows access token for authentication
        workflow_id: Suna workflow ID (becomes Langflow flow ID)
        agent_id: Suna agent ID (becomes Langflow folder_id)
        workflow_name: Name for the flow
        
    Returns:
        dict with flow details including 'created' boolean
    """
    backend_url = AdvancedWorkflowsConfig.get_backend_url()
    integration_secret = AdvancedWorkflowsConfig.get_integration_secret()
    
    suna_ensure_url = f"{backend_url.rstrip('/')}/api/v1/suna/ensure-flow"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                suna_ensure_url,
                json={
                    "suna_workflow_id": workflow_id,
                    "suna_agent_id": agent_id,
                    "name": workflow_name,
                    "description": f"Advanced workflow synced from Suna Kortix: {workflow_name}",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Integration-Key": integration_secret,
                    "Content-Type": "application/json",
                }
            )
            
            if response.status_code in (200, 201):
                return response.json()
            else:
                logger.error(f"Failed to ensure flow: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to sync flow with Advanced Workflows: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        logger.error("Timeout ensuring flow in Advanced Workflows")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Advanced Workflows flow sync timeout"
        )
    except httpx.RequestError as e:
        logger.error(f"Error ensuring flow in Advanced Workflows: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to sync flow with Advanced Workflows"
        )


@router.get("/token", response_model=AdvancedWorkflowsTokenResponse)
async def get_advanced_workflows_token(
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> AdvancedWorkflowsTokenResponse:
    """
    Get an Advanced Workflows session token for the authenticated user.
    
    This endpoint:
    1. Verifies the user is authenticated via Suna's JWT
    2. Exchanges the user's identity for a token
    3. Returns the token and URL for iframe authentication
    
    The frontend uses this token to authenticate the Advanced Workflows iframe.
    
    NOTE: For full project/flow sync, use /session endpoint instead.
    """
    # Check if configured
    if not AdvancedWorkflowsConfig.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Advanced Workflows integration not configured. Set ADVANCED_WORKFLOWS_BACKEND_URL and ADVANCED_WORKFLOWS_INTEGRATION_SECRET."
        )
    
    # Get user email from database
    user_email = await get_user_email(user_id)
    
    # Exchange for token
    token_data = await exchange_suna_token_for_advanced_workflows(
        suna_user_id=str(user_id),
        suna_user_email=user_email,
    )
    
    return AdvancedWorkflowsTokenResponse(
        access_token=token_data.get("access_token", ""),
        refresh_token=token_data.get("refresh_token"),
        advanced_workflows_url=AdvancedWorkflowsConfig.get_frontend_url() or "",
        expires_in=token_data.get("expires_in", 3600),
    )


@router.get("/session", response_model=AdvancedWorkflowsSessionResponse)
async def get_advanced_workflows_session(
    agent_id: str = Query(..., description="Suna agent ID (becomes Langflow project ID)"),
    workflow_id: str = Query(..., description="Suna workflow ID (becomes Langflow flow ID)"),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
) -> AdvancedWorkflowsSessionResponse:
    """
    Get a complete Advanced Workflows session with project/flow sync.
    
    This endpoint:
    1. Verifies the user is authenticated via Suna's JWT
    2. Exchanges the user's identity for an Advanced Workflows token
    3. Ensures the project (Suna Agent) exists in Langflow with the same ID
    4. Ensures the flow (Suna Workflow) exists in Langflow with the same ID
    5. Returns the token and direct URL to the flow editor
    
    This enables 1:1 mapping:
    - Suna Agent ID == Langflow Project ID
    - Suna Workflow ID == Langflow Flow ID
    """
    logger.info(f"[Advanced Workflows Session] Starting session for user={user_id}, agent={agent_id}, workflow={workflow_id}")
    
    # Check if configured
    if not AdvancedWorkflowsConfig.is_configured():
        logger.error("[Advanced Workflows Session] Integration not configured - missing environment variables")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Advanced Workflows integration not configured. Set ADVANCED_WORKFLOWS_BACKEND_URL and ADVANCED_WORKFLOWS_INTEGRATION_SECRET."
        )
    
    logger.info(f"[Advanced Workflows Session] Backend URL: {AdvancedWorkflowsConfig.get_backend_url()}")
    
    # Get user email from database
    user_email = await get_user_email(user_id)
    logger.info(f"[Advanced Workflows Session] User email resolved: {user_email or '(not found)'}")
    
    # Exchange for token
    logger.info("[Advanced Workflows Session] Exchanging Suna token for Advanced Workflows token...")
    token_data = await exchange_suna_token_for_advanced_workflows(
        suna_user_id=str(user_id),
        suna_user_email=user_email,
    )
    
    access_token = token_data.get("access_token", "")
    logger.info(f"[Advanced Workflows Session] Token exchange successful, expires_in={token_data.get('expires_in', 'N/A')}")
    
    # Get names for project and flow
    agent_name = await get_agent_name(agent_id)
    workflow_name = await get_workflow_name(workflow_id)
    logger.info(f"[Advanced Workflows Session] Agent name: {agent_name}, Workflow name: {workflow_name}")
    
    # Ensure project exists
    logger.info(f"[Advanced Workflows Session] Ensuring project exists: agent_id={agent_id}")
    project_result = await ensure_project_exists(
        access_token=access_token,
        agent_id=agent_id,
        agent_name=agent_name,
    )
    logger.info(f"[Advanced Workflows Session] Project result: id={project_result.get('id')}, created={project_result.get('created')}")
    
    # Ensure flow exists
    logger.info(f"[Advanced Workflows Session] Ensuring flow exists: workflow_id={workflow_id}")
    flow_result = await ensure_flow_exists(
        access_token=access_token,
        workflow_id=workflow_id,
        agent_id=agent_id,
        workflow_name=workflow_name,
    )
    logger.info(f"[Advanced Workflows Session] Flow result: id={flow_result.get('id')}, created={flow_result.get('created')}")
    
    # Build direct URL to the flow editor
    frontend_url = AdvancedWorkflowsConfig.get_frontend_url() or ""
    flow_url = f"{frontend_url.rstrip('/')}/flow/{workflow_id}"
    
    logger.info(f"[Advanced Workflows Session] Session complete. Flow URL: {flow_url}")
    
    return AdvancedWorkflowsSessionResponse(
        access_token=access_token,
        refresh_token=token_data.get("refresh_token"),
        advanced_workflows_url=frontend_url,
        flow_url=flow_url,
        project_id=str(project_result.get("id", agent_id)),
        flow_id=str(flow_result.get("id", workflow_id)),
        project_created=project_result.get("created", False),
        flow_created=flow_result.get("created", False),
        expires_in=token_data.get("expires_in", 3600),
    )


@router.get("/status")
async def get_advanced_workflows_status() -> dict:
    """
    Check Advanced Workflows integration status.
    
    Returns configuration status (without exposing secrets).
    Useful for debugging and admin dashboards.
    """
    backend_url = AdvancedWorkflowsConfig.get_backend_url()
    is_configured = AdvancedWorkflowsConfig.is_configured()
    
    status_info = {
        "configured": is_configured,
        "backend_url": backend_url if backend_url else None,
        "frontend_url": AdvancedWorkflowsConfig.get_frontend_url() if is_configured else None,
        "integration_secret_set": bool(AdvancedWorkflowsConfig.get_integration_secret()),
    }
    
    # If configured, try to check if reachable
    if is_configured and backend_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{backend_url.rstrip('/')}/health")
                status_info["service_reachable"] = response.status_code == 200
                
                # Also check Suna integration endpoint health
                suna_health_response = await client.get(f"{backend_url.rstrip('/')}/api/v1/suna/health")
                status_info["suna_integration_available"] = suna_health_response.status_code == 200
        except Exception as e:
            status_info["service_reachable"] = False
            status_info["service_error"] = str(e)
    
    return status_info


