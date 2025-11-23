"""
Notification System Type Definitions

Defines all types, enums, and Pydantic models used in the notification system.
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class NotificationType(str, Enum):
    """Type of notification indicating severity/purpose."""
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    AGENT_COMPLETE = "agent_complete"


class NotificationCategory(str, Enum):
    """Category for organizing notifications."""
    SYSTEM = "system"
    AGENT = "agent"
    BILLING = "billing"
    ADMIN = "admin"
    WORKFLOW = "workflow"


class NotificationChannel(str, Enum):
    """Delivery channel for notifications."""
    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"
    SLACK = "slack"
    DISCORD = "discord"
    WEBHOOK = "webhook"


class TriggerSource(str, Enum):
    """Source that can trigger notifications."""
    BACKEND = "backend"
    FRONTEND = "frontend"
    WORKFLOW = "workflow"
    WEBHOOK = "webhook"
    CRON = "cron"


class NotificationPriority(str, Enum):
    """Priority level for notification processing."""
    CRITICAL = "critical"
    NORMAL = "normal"
    LOW = "low"


class NotificationKey(str, Enum):
    """
    Registry keys for all system notifications.

    Add new notification types here when creating new system notifications.
    """
    ADMIN_LOCAL_MODEL_RESTRICTION = "admin_local_model_restriction"
    # Add more notification keys as they are implemented
    # WORKFLOW_TASK_ASSIGNED = "workflow_task_assigned"
    # WORKFLOW_APPROVAL_REQUIRED = "workflow_approval_required"
    # etc.


class SystemNotificationDefinition(BaseModel):
    """
    Definition for a system notification template.

    This model defines the structure of notification templates stored in the registry.
    """
    key: str = Field(..., description="Unique identifier for this notification type")
    title: str = Field(..., description="Notification title (supports {variable} substitution)")
    message: str = Field(..., description="Notification message (supports {variable} substitution)")
    type: NotificationType = Field(..., description="Type of notification")
    category: NotificationCategory = Field(..., description="Category for organization")
    allowed_triggers: List[TriggerSource] = Field(
        default=[TriggerSource.BACKEND, TriggerSource.FRONTEND],
        description="Sources allowed to trigger this notification"
    )
    channels: List[NotificationChannel] = Field(
        default=[NotificationChannel.IN_APP],
        description="Delivery channels for this notification"
    )
    default_send_email: bool = Field(
        default=False,
        description="Default value for send_email parameter"
    )
    default_send_push: bool = Field(
        default=False,
        description="Default value for send_push parameter"
    )
    rate_limit: Optional[str] = Field(
        default=None,
        description="Rate limit (e.g., '1_per_hour', '5_per_day')"
    )
    deduplicate_window: Optional[int] = Field(
        default=None,
        description="Seconds to deduplicate identical notifications"
    )
    priority: NotificationPriority = Field(
        default=NotificationPriority.NORMAL,
        description="Processing priority"
    )
    metadata_schema: Optional[Dict[str, Any]] = Field(
        default=None,
        description="JSON schema for validating context metadata"
    )

    class Config:
        use_enum_values = True


class NotificationContext(BaseModel):
    """
    Context data passed when triggering a notification.

    Used for template variable substitution and metadata.
    """
    variables: Dict[str, Any] = Field(
        default_factory=dict,
        description="Variables for template substitution"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (stored with notification)"
    )

    class Config:
        extra = "allow"  # Allow additional fields for flexibility


class NotificationTriggerRequest(BaseModel):
    """
    Request model for triggering a system notification.

    Used internally by trigger functions.
    """
    user_id: str = Field(..., description="Target user ID")
    notification_key: str = Field(..., description="Notification type key from registry")
    context: Optional[NotificationContext] = Field(
        default=None,
        description="Context data for template substitution"
    )
    source: TriggerSource = Field(
        default=TriggerSource.BACKEND,
        description="Source triggering the notification"
    )
    send_email: Optional[bool] = Field(
        default=None,
        description="Override default email setting"
    )
    send_push: Optional[bool] = Field(
        default=None,
        description="Override default push setting"
    )


class NotificationTriggerResult(BaseModel):
    """
    Result from triggering a notification.

    Returned by trigger functions to indicate success/failure.
    """
    success: bool = Field(..., description="Whether notification was triggered successfully")
    notification_id: Optional[str] = Field(None, description="Created notification ID")
    error: Optional[str] = Field(None, description="Error message if failed")
    channels_used: List[NotificationChannel] = Field(
        default_factory=list,
        description="Channels notification was sent to"
    )
    email_sent: bool = Field(default=False, description="Whether email was sent")
    push_sent: bool = Field(default=False, description="Whether push was sent")
