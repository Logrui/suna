"""
Notification Registry

Central registry for all system notification templates.

This module defines all notification types with their templates, rules, and configuration.
Add new notification definitions here to make them available system-wide.

Usage:
    from core.notifications.registry import get_notification_template

    template = get_notification_template("admin_local_model_restriction")
"""

from typing import Dict, Optional
from core.notifications.types import (
    SystemNotificationDefinition,
    NotificationType,
    NotificationCategory,
    NotificationChannel,
    TriggerSource,
    NotificationPriority,
    NotificationKey,
)
from core.utils.logger import logger


# ============================================================================
# NOTIFICATION DEFINITIONS
# ============================================================================

ADMIN_LOCAL_MODEL_RESTRICTION = SystemNotificationDefinition(
    key=NotificationKey.ADMIN_LOCAL_MODEL_RESTRICTION.value,
    title="System Notification: Only Authorized Admins can Access Local Models",
    message="This is a self hosted server for Suna Kortix. Please request permissions from Server Host to use local models.",
    type=NotificationType.WARNING,
    category=NotificationCategory.SYSTEM,
    allowed_triggers=[TriggerSource.BACKEND, TriggerSource.FRONTEND],
    channels=[NotificationChannel.IN_APP],
    default_send_email=False,
    default_send_push=False,
    rate_limit="1_per_hour",  # Don't spam users
    deduplicate_window=300,  # 5 minutes
    priority=NotificationPriority.NORMAL,
    metadata_schema={
        "type": "object",
        "properties": {
            "model_id": {"type": "string", "description": "ID of the model user tried to access"},
            "action": {"type": "string", "enum": ["blocked"], "description": "Action taken"},
            "timestamp": {"type": "string", "format": "date-time", "description": "When the restriction occurred"}
        }
    }
)


# ============================================================================
# Add more notification definitions here as they are implemented
# ============================================================================

# Example for future workflow notifications:
#
# WORKFLOW_TASK_ASSIGNED = SystemNotificationDefinition(
#     key="workflow_task_assigned",
#     title="New Task Assigned: {task_name}",
#     message="You have been assigned a new task '{task_name}' in workflow '{workflow_name}'. Due date: {due_date}",
#     type=NotificationType.INFO,
#     category=NotificationCategory.WORKFLOW,
#     allowed_triggers=[TriggerSource.BACKEND, TriggerSource.WORKFLOW],
#     channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
#     default_send_email=True,
#     default_send_push=True,
#     priority=NotificationPriority.NORMAL,
# )


# ============================================================================
# REGISTRY MANAGEMENT
# ============================================================================

# Global registry of all system notifications
SYSTEM_NOTIFICATIONS: Dict[str, SystemNotificationDefinition] = {
    NotificationKey.ADMIN_LOCAL_MODEL_RESTRICTION.value: ADMIN_LOCAL_MODEL_RESTRICTION,
    # Add more notifications here as they are defined
}


def get_notification_template(notification_key: str) -> Optional[SystemNotificationDefinition]:
    """
    Get a notification template by key.

    Args:
        notification_key: The unique key for the notification type

    Returns:
        SystemNotificationDefinition if found, None otherwise

    Example:
        >>> template = get_notification_template("admin_local_model_restriction")
        >>> print(template.title)
        "System Notification: Only Authorized Admins can Access Local Models"
    """
    template = SYSTEM_NOTIFICATIONS.get(notification_key)

    if not template:
        logger.warning(f"Notification template not found: {notification_key}")
        logger.debug(f"Available templates: {list(SYSTEM_NOTIFICATIONS.keys())}")

    return template


def validate_notification_key(notification_key: str) -> bool:
    """
    Validate that a notification key exists in the registry.

    Args:
        notification_key: The key to validate

    Returns:
        True if key exists, False otherwise
    """
    return notification_key in SYSTEM_NOTIFICATIONS


def list_notification_keys() -> list[str]:
    """
    List all available notification keys.

    Returns:
        List of notification key strings

    Example:
        >>> keys = list_notification_keys()
        >>> print(keys)
        ['admin_local_model_restriction', ...]
    """
    return list(SYSTEM_NOTIFICATIONS.keys())


def get_notifications_by_category(category: NotificationCategory) -> list[SystemNotificationDefinition]:
    """
    Get all notifications for a specific category.

    Args:
        category: The notification category to filter by

    Returns:
        List of notification definitions in that category

    Example:
        >>> system_notifs = get_notifications_by_category(NotificationCategory.SYSTEM)
        >>> print(len(system_notifs))
        1
    """
    return [
        notif for notif in SYSTEM_NOTIFICATIONS.values()
        if notif.category == category
    ]


def register_notification(definition: SystemNotificationDefinition) -> bool:
    """
    Register a new notification template dynamically.

    This allows plugins or extensions to register their own notification types.

    Args:
        definition: The notification definition to register

    Returns:
        True if registered successfully, False if key already exists

    Example:
        >>> new_notif = SystemNotificationDefinition(
        ...     key="custom_notification",
        ...     title="Custom Alert",
        ...     message="This is a custom notification",
        ...     type=NotificationType.INFO,
        ...     category=NotificationCategory.SYSTEM,
        ... )
        >>> register_notification(new_notif)
        True
    """
    if definition.key in SYSTEM_NOTIFICATIONS:
        logger.warning(f"Notification key already registered: {definition.key}")
        return False

    SYSTEM_NOTIFICATIONS[definition.key] = definition
    logger.info(f"Registered new notification: {definition.key}")
    return True


# ============================================================================
# REGISTRY METADATA
# ============================================================================

def get_registry_stats() -> dict:
    """
    Get statistics about the notification registry.

    Returns:
        Dictionary with registry statistics

    Example:
        >>> stats = get_registry_stats()
        >>> print(stats)
        {
            "total_notifications": 1,
            "by_category": {"system": 1},
            "by_type": {"warning": 1},
            "by_priority": {"normal": 1}
        }
    """
    stats = {
        "total_notifications": len(SYSTEM_NOTIFICATIONS),
        "by_category": {},
        "by_type": {},
        "by_priority": {},
        "notification_keys": list(SYSTEM_NOTIFICATIONS.keys()),
    }

    for notif in SYSTEM_NOTIFICATIONS.values():
        # Count by category
        category = notif.category.value if hasattr(notif.category, 'value') else str(notif.category)
        stats["by_category"][category] = stats["by_category"].get(category, 0) + 1

        # Count by type
        notif_type = notif.type.value if hasattr(notif.type, 'value') else str(notif.type)
        stats["by_type"][notif_type] = stats["by_type"].get(notif_type, 0) + 1

        # Count by priority
        priority = notif.priority.value if hasattr(notif.priority, 'value') else str(notif.priority)
        stats["by_priority"][priority] = stats["by_priority"].get(priority, 0) + 1

    return stats
