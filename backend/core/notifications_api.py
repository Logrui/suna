from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timezone

from core.services.supabase import DBConnection
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.logger import logger

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"]
)

# --- Pydantic Models ---

class Notification(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    read_at: Optional[str] = None
    created_at: str
    metadata: Optional[Dict[str, Any]] = None
    category: Optional[str] = None

class NotificationListResponse(BaseModel):
    notifications: List[Notification]
    pagination: Dict[str, Any]
    unread_count: int

class MarkAsReadRequest(BaseModel):
    notification_ids: List[str]
    is_read: bool = True

class NotificationPreferences(BaseModel):
    email_notifications: bool = True
    push_notifications: bool = True
    categories: Dict[str, bool] = {}

class PushTokenRequest(BaseModel):
    token: str
    platform: str = "web"

class CreateNotificationRequest(BaseModel):
    title: str
    message: str
    notification_type: str = "info"  # info, success, warning, error
    category: Optional[str] = "system"
    link: Optional[str] = None
    sender_type: str = "system"  # system, agent, user
    sender_id: Optional[str] = None
    send_email: bool = False
    send_push: bool = False
    metadata: Optional[Dict[str, Any]] = None

# --- Endpoints ---

@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_read: Optional[bool] = None,
    category: Optional[str] = None,
    notification_type: Optional[str] = None,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """
    Get user's notifications with pagination and filtering.
    """
    try:
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
    request: MarkAsReadRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """
    Mark notifications as read/unread.
    """
    try:
        db = DBConnection()
        
        # Update notifications
        update_data = {
            "is_read": request.is_read,
            "read_at": datetime.now(timezone.utc).isoformat() if request.is_read else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        result = (
            db.table("notifications")
            .update(update_data)
            .in_("id", request.notification_ids)
            .eq("user_id", user_id)
            .execute()
        )
        
        return {"success": True, "updated": len(result.data or [])}
    except Exception as e:
        logger.error(f"Error marking notifications as read: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to mark notifications as read")

@router.get("/preferences", response_model=NotificationPreferences)
async def get_notification_preferences(user_id: str = Depends(verify_and_get_user_id_from_jwt)):
    """
    Get user's notification preferences.
    """
    try:
        db = DBConnection()
        
        result = (
            db.table("user_notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        
        if result.data:
            return NotificationPreferences(**result.data)
        
        # Return defaults if no preferences found
        return NotificationPreferences()
    except Exception as e:
        logger.error(f"Error fetching notification preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch notification preferences")

@router.post("/preferences", response_model=NotificationPreferences)
async def update_notification_preferences(
    preferences: NotificationPreferences,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """
    Update user's notification preferences.
    """
    try:
        db = DBConnection()
        
        data = preferences.dict()
        data["user_id"] = user_id
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = (
            db.table("user_notification_preferences")
            .upsert(data)
            .execute()
        )
        
        if result.data:
            return NotificationPreferences(**result.data[0])
            
        return preferences
    except Exception as e:
        logger.error(f"Error updating notification preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update notification preferences")

@router.post("/push-token")
async def register_push_token(
    request: PushTokenRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """
    Register a push notification token.
    """
    try:
        db = DBConnection()
        
        data = {
            "user_id": user_id,
            "token": request.token,
            "platform": request.platform,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # We'll try to upsert to 'user_push_tokens'
        try:
            db.table("user_push_tokens").upsert(data).execute()
        except Exception:
            # If table doesn't exist, we just log and ignore for now as this is a shadow API
            logger.warning(f"Could not save push token for user {user_id} - table might be missing")
            
        return {"success": True}
    except Exception as e:
        logger.error(f"Error registering push token: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to register push token")

@router.post("/create")
async def create_notification(
    request: CreateNotificationRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """
    Create a new notification for the authenticated user.
    This endpoint allows creating system notifications or user-configured notifications.
    """
    try:
        from core.services.notification_service import notification_service
        from core.services.supabase import DBConnection
        
        db = DBConnection()
        await db.initialize()
        client = await db.client
        
        # Get user's account_id
        account_result = await client.schema('basejump').from_('accounts').select('id').eq('primary_owner_user_id', user_id).eq('personal_account', True).limit(1).execute()
        
        if not account_result.data:
            raise HTTPException(status_code=404, detail="User account not found")
        
        account_id = account_result.data[0]['id']
        
        # Send notification using the notification service
        result = await notification_service.send_notification(
            user_id=user_id,
            account_id=account_id,
            title=request.title,
            message=request.message,
            notification_type=request.notification_type,
            category=request.category,
            sender_type=request.sender_type,
            sender_id=request.sender_id,
            send_email=request.send_email,
            send_push=request.send_push,
            metadata=request.metadata
        )
        
        return {
            "success": True,
            "notification_id": result.get("notification_id"),
            "email_sent": result.get("email_sent", False),
            "push_sent": result.get("push_sent", False)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating notification: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create notification")
