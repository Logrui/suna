"""
Development Authentication API

Provides admin-only endpoints for local development and testing.
Allows admins to authenticate as any user without going through the normal auth flow.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from core.utils.config import config, EnvMode
from core.utils.logger import logger
import httpx
import os

router = APIRouter(prefix="/dev", tags=["dev-auth"])


class DevLoginRequest(BaseModel):
    """Request model for dev login."""
    email: EmailStr
    admin_password: str


class DevLoginResponse(BaseModel):
    """Response model for dev login."""
    success: bool
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in: int | None = None
    message: str | None = None


@router.post("/admin-login", response_model=DevLoginResponse)
async def dev_admin_login(request: DevLoginRequest) -> DevLoginResponse:
    """
    Developer login endpoint - allows admins to log in as any user.
    
    Returns session tokens directly instead of a magic link redirect.
    The frontend can use setSession() to establish the session.
    """
    # Security: Only allow in local mode
    if config.ENV_MODE != EnvMode.LOCAL:
        raise HTTPException(
            status_code=403, 
            detail="Dev auth is only available in local development mode"
        )
    
    # Verify admin password
    master_password = os.getenv("MASTER_ADMIN_PASSWORD")
    if not master_password:
        raise HTTPException(
            status_code=500,
            detail="MASTER_ADMIN_PASSWORD not configured on server"
        )
    
    if request.admin_password != master_password:
        raise HTTPException(
            status_code=401,
            detail="Invalid admin password"
        )
    
    try:
        supabase_url = config.SUPABASE_URL
        service_role_key = config.SUPABASE_SERVICE_ROLE_KEY
        
        if not service_role_key:
            raise HTTPException(
                status_code=500,
                detail="SUPABASE_SERVICE_ROLE_KEY not configured"
            )
        
        logger.info(f"Dev login: Generating session tokens for {request.email}")
        
        # Use Supabase Admin API to generate a magic link, then extract the tokens
        # We'll use the "generate_link" API which returns tokens we can use
        async with httpx.AsyncClient() as client:
            # First, generate a magic link to get the hashed token
            response = await client.post(
                f"{supabase_url}/auth/v1/admin/generate_link",
                headers={
                    "apikey": service_role_key,
                    "Authorization": f"Bearer {service_role_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "type": "magiclink",
                    "email": request.email,
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"Supabase generate_link failed: {error_detail}")
                
                if "User not found" in error_detail or response.status_code == 404:
                    return DevLoginResponse(
                        success=False,
                        message=f"User with email '{request.email}' does not exist."
                    )
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to generate link: {error_detail}"
                )
            
            data = response.json()
            
            # The generate_link response includes the hashed_token which we can verify
            hashed_token = data.get("hashed_token")
            action_link = data.get("properties", {}).get("action_link") or data.get("action_link")
            
            logger.info(f"Generated magic link, hashed_token: {hashed_token[:20] if hashed_token else 'None'}...")
            
            # Use the hashed_token directly with token_hash parameter
            if hashed_token:
                # Verify using token_hash parameter (correct way for admin-generated tokens)
                verify_response = await client.post(
                    f"{supabase_url}/auth/v1/verify",
                    headers={
                        "apikey": service_role_key,
                        "Content-Type": "application/json"
                    },
                    json={
                        "type": "magiclink",
                        "token_hash": hashed_token,
                        "email": request.email,
                    }
                )
                
                if verify_response.status_code == 200:
                    session_data = verify_response.json()
                    
                    access_token = session_data.get("access_token")
                    refresh_token = session_data.get("refresh_token")
                    expires_in = session_data.get("expires_in", 3600)
                    
                    if access_token:
                        logger.info(f"Successfully generated session tokens for {request.email}")
                        
                        return DevLoginResponse(
                            success=True,
                            access_token=access_token,
                            refresh_token=refresh_token,
                            expires_in=expires_in,
                            message=f"Session created for {request.email}"
                        )
                else:
                    logger.error(f"Token verification failed: {verify_response.text}")
            
            # Fallback: return error if we couldn't get session tokens
            return DevLoginResponse(
                success=False,
                message="Could not generate session tokens. Check backend logs."
            )
            
    except httpx.RequestError as e:
        logger.error(f"Network error: {e}")
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate session: {str(e)}")
