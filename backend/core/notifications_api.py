"""
User Notifications API
Handles user-facing notification operations: retrieving, marking as read, preferences, etc.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
from core.auth import get_current_user
from core.services.supabase import DBConnection
from core.utils.logger import logger

router = APIRouter(prefix="/notifications", tags=["notifications"])

# ============================================================================
# MODELS
# ============================================================================

class Notification(BaseModel):
    id: str
    account_id: str
    user_id: str
    title: str
    message: str
    type: str
    category: Optional[str] = None
    thread_id: Optional[str] = None
    agent_run_id: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    is_global: bool
    created_by: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    email_sent: bool
    email_sent_at: Optional[str] = None
    email_error: Optional[str] = None
    push_sent: bool
    push_sent_at: Optional[str] = None
    push_error: Optional[str] = None
    retry_count: int
    last_retry_at: Optional[str] = None
    is_read: bool
    read_at: Optional[str] = None
    created_at: str
    updated_at: str


class NotificationListResponse(BaseModel):
    notifications: List[Notification]
    pagination: Dict[str, Any]
    unread_count: Optional[int] = None


class NotificationPreferences(BaseModel):
    user_id: str
    account_id: str
    email_enabled: bool
    push_enabled: bool
    email_categories: Dict[str, bool]
    push_categories: Dict[str, bool]
    push_token: Optional[str] = None
    push_token_updated_at: Optional[str] = None
    created_at: str
    updated_at: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_read: Optional[bool] = None,
    category: Optional[str] = None,
    notification_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get user's notifications with pagination and filtering.
    """
    try:
        user_id = current_user["user_id"]
        db = DBConnection()
        
        # Build query
        query = db.table("notifications").select("*")
        query = query.eq("user_id", user_id)
        
        # Apply filters
        if is_read is not None:
            query = query.eq("is_read", is_read)
        if category:
            query = query.eq("category", category)
        if notification_type:
            query = query.eq("type", notification_type)
        
        # Get total count
        count_result = db.table("notifications").select("id", count="exact").eq("user_id", user_id)
        if is_read is not None:
            count_result = count_result.eq("is_read", is_read)
        if category:
            count_result = count_result.eq("category", category)
        if notification_type:
            count_result = count_result.eq("type", notification_type)
        
        total = count_result.execute().count
        
        # Get unread count
        unread_count_result = db.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("is_read", False)
        unread_count = unread_count_result.execute().count
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.order("created_at", desc=True).range(offset, offset + page_size - 1)
        
        result = query.execute()
        notifications = result.data or []
        
        pages = (total + page_size - 1) // page_size
        
        return NotificationListResponse(
            notifications=notifications,
            pagination={
                "page": page,
                "limit": page_size,
                "total": total,
                "pages": pages,
            },
            unread_count=unread_count
        )
    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications")


@router.post("/mark-as-read")
async def mark_notifications_as_read(
    notification_ids: List[str],
    is_read: bool = True,
    current_user: dict = Depends(get_current_user),
):
    """
    Mark notifications as read/unread.
    """
    try:
        user_id = current_user["user_id"]
        db = DBConnection()
        
        # Update notifications
        update_data = {
            "is_read": is_read,
            "read_at": datetime.now(timezone.utc).isoformat() if is_read else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        result = (
            db.table("notifications")
            .update(update_data)
            .in_("id", notification_ids)
            .eq("user_id", user_id)
            .execute()
        )
        
        return {"success": True, "updated": len(result.data or [])}
    except Exception as e:
        logger.error(f"Error marking notifications as read: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to mark notifications as read")


@router.get("/preferences", response_model=NotificationPreferences)
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """
    Get user's notification preferences.
    """
    try:
        user_id = current_user["user_id"]
        db = DBConnection()
        
        result = (
            db.table("user_notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        
        if not result.data:
            # Return default preferences if none exist
            return NotificationPreferences(
                user_id=user_id,
                account_id="",
                email_enabled=True,
                push_enabled=True,
                email_categories={},
                push_categories={},
                created_at=datetime.now(timezone.utc).isoformat(),
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
        
        return result.data
    except Exception as e:
        logger.error(f"Error fetching notification preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch notification preferences")


@router.post("/preferences")
async def update_notification_preferences(
    preferences: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    """
    Update user's notification preferences.
    """
    try:
        user_id = current_user["user_id"]
        db = DBConnection()
        
        update_data = {
            **preferences,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Try to update existing preferences
        result = (
            db.table("user_notification_preferences")
            .update(update_data)
            .eq("user_id", user_id)
            .execute()
        )
        
        # If no rows updated, insert new preferences
        if not result.data:
            insert_data = {
                "user_id": user_id,
                **preferences,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            result = db.table("user_notification_preferences").insert(insert_data).execute()
        
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Error updating notification preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update notification preferences")


@router.post("/push-token")
async def register_push_token(
    push_token: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Register or update user's push notification token.
    """
    try:
        user_id = current_user["user_id"]
        db = DBConnection()
        
        update_data = {
            "push_token": push_token,
            "push_token_updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Try to update existing preferences
        result = (
            db.table("user_notification_preferences")
            .update(update_data)
            .eq("user_id", user_id)
            .execute()
        )
        
        # If no rows updated, insert new preferences with token
        if not result.data:
            insert_data = {
                "user_id": user_id,
                "push_token": push_token,
                "push_token_updated_at": datetime.now(timezone.utc).isoformat(),
                "email_enabled": True,
                "push_enabled": True,
                "email_categories": {},
                "push_categories": {},
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            result = db.table("user_notification_preferences").insert(insert_data).execute()
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error registering push token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to register push token")
