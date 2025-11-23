"""
User Profile API

Provides endpoints for fetching minimal user profile information for display purposes.
Only returns avatar_url, name, and user ID - no sensitive data like email.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.services.supabase import DBConnection
from core.utils.auth_utils import verify_and_get_user_id_from_jwt

router = APIRouter(prefix="/users", tags=["users"])


class UserProfileResponse(BaseModel):
    id: str
    avatar_url: Optional[str] = None
    name: Optional[str] = None


@router.get("/{user_id}/profile", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: str,
    current_user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """
    Get minimal public profile information for a user.
    
    Requires authentication. Returns only avatar_url and name for privacy.
    Used by notification system to display user avatars.
    
    Security: Does not expose email or other sensitive user data.
    """
    db = DBConnection()
    client = await db.client
    
    try:
        # Use admin API to fetch user data (requires service role)
        response = await client.auth.admin.get_user_by_id(user_id)
        
        if not response.user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = response.user
        user_metadata = user.user_metadata or {}
        
        return UserProfileResponse(
            id=user.id,
            avatar_url=user_metadata.get("avatar_url"),
            name=user_metadata.get("name") or user_metadata.get("full_name")
        )
        
    except Exception as e:
        if "User not found" in str(e):
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user profile: {str(e)}")
