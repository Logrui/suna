"""
Internal Service Authentication for Langflow → Kortix communication.

This module provides authentication for service-to-service calls from 
Advanced Workflows (Langflow) backend to Kortix backend.

Usage:
    Headers from Langflow:
        X-Internal-Secret: <shared secret>
        X-User-Id: <user_id to impersonate>
        X-Project-Id: <optional project context>
    
    In endpoint:
        @router.get("/some-endpoint")
        async def endpoint(
            internal_auth: InternalAuthContext = Depends(verify_internal_request)
        ):
            user_id = internal_auth.user_id
"""

import os
import hmac
from typing import Optional
from dataclasses import dataclass
from fastapi import Header, HTTPException, status
from core.utils.logger import logger


@dataclass
class InternalAuthContext:
    """Context from verified internal service request."""
    user_id: str
    project_id: Optional[str] = None
    source: str = "advanced-workflows"
    is_internal: bool = True


def _constant_time_compare(a: str, b: str) -> bool:
    """Constant-time string comparison to prevent timing attacks."""
    return hmac.compare_digest(a.encode('utf-8'), b.encode('utf-8'))


async def verify_internal_request(
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id"),
    x_source: Optional[str] = Header("advanced-workflows", alias="X-Source"),
) -> InternalAuthContext:
    """
    Verify internal service-to-service requests from Langflow.
    
    This dependency validates that the request comes from a trusted internal
    service (Langflow) by checking the shared secret.
    
    Headers:
        X-Internal-Secret: Must match ADVANCED_WORKFLOWS_INTEGRATION_SECRET
        X-User-Id: The user ID to impersonate (required)
        X-Project-Id: Optional project context
        X-Source: Identifier of the calling service (default: "advanced-workflows")
    
    Returns:
        InternalAuthContext with user_id and optional project_id
        
    Raises:
        HTTPException 401: If secret is missing or invalid
        HTTPException 400: If user_id is missing
    """
    internal_secret = os.getenv("ADVANCED_WORKFLOWS_INTEGRATION_SECRET")
    
    if not internal_secret:
        logger.error("ADVANCED_WORKFLOWS_INTEGRATION_SECRET not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal authentication not configured"
        )
    
    if not x_internal_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Internal-Secret header required for internal requests"
        )
    
    if not _constant_time_compare(x_internal_secret, internal_secret):
        logger.warning(f"Invalid internal secret from source: {x_source}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal secret"
        )
    
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-User-Id header required for internal requests"
        )
    
    logger.debug(f"Internal request authenticated: user={x_user_id[:8]}..., source={x_source}")
    
    return InternalAuthContext(
        user_id=x_user_id,
        project_id=x_project_id,
        source=x_source or "advanced-workflows",
        is_internal=True
    )


async def get_optional_internal_auth(
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_project_id: Optional[str] = Header(None, alias="X-Project-Id"),
    x_source: Optional[str] = Header(None, alias="X-Source"),
) -> Optional[InternalAuthContext]:
    """
    Optionally verify internal service-to-service requests.
    
    Returns InternalAuthContext if valid internal headers are present,
    None otherwise. Does not raise exceptions.
    
    Use this when an endpoint supports BOTH regular user auth AND internal auth.
    """
    internal_secret = os.getenv("ADVANCED_WORKFLOWS_INTEGRATION_SECRET")
    
    if not internal_secret or not x_internal_secret or not x_user_id:
        return None
    
    if not _constant_time_compare(x_internal_secret, internal_secret):
        return None
    
    return InternalAuthContext(
        user_id=x_user_id,
        project_id=x_project_id,
        source=x_source or "advanced-workflows",
        is_internal=True
    )
