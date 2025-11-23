"""
Notification System Package

This package provides a modularized, event-driven notification system for Suna Kortix.

Components:
- types.py: Pydantic models and type definitions
- registry.py: Central notification template registry
- triggers.py: Helper functions to trigger notifications

Usage:
    from core.notifications.triggers import trigger_system_notification

    await trigger_system_notification(
        user_id="123",
        notification_key="admin_local_model_restriction",
        context={"model_id": "ollama/llama3"}
    )

See NOTIFICATION_SYSTEM_PLAN.md for complete architecture documentation.
"""

from .types import (
    NotificationKey,
    NotificationType,
    NotificationCategory,
    NotificationChannel,
    SystemNotificationDefinition,
)
from .registry import SYSTEM_NOTIFICATIONS, get_notification_template
from .triggers import trigger_system_notification

__all__ = [
    # Types
    "NotificationKey",
    "NotificationType",
    "NotificationCategory",
    "NotificationChannel",
    "SystemNotificationDefinition",
    # Registry
    "SYSTEM_NOTIFICATIONS",
    "get_notification_template",
    # Triggers
    "trigger_system_notification",
]
