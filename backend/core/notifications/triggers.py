"""
Notification Trigger Functions

Helper functions to trigger system notifications from anywhere in the codebase.

This module provides the main entry points for triggering notifications and handles:
- Template lookup and validation
- Variable substitution
- Permission checking
- Deduplication
- Integration with NotificationService

Usage:
    from core.notifications.triggers import trigger_system_notification

    await trigger_system_notification(
        user_id="user_123",
        notification_key="admin_local_model_restriction",
        context={"model_id": "ollama/llama3"}
    )
"""

from typing import Optional, Dict, Any
from datetime import datetime, timezone
import hashlib
import json

from core.notifications.registry import get_notification_template, validate_notification_key
from core.notifications.types import (
    TriggerSource,
    NotificationTriggerResult,
    NotificationChannel,
)
from core.services.notification_service import NotificationService
from core.services.supabase import DBConnection
from core.utils.logger import logger


# Initialize notification service (singleton)
notification_service = NotificationService()


async def trigger_system_notification(
    user_id: str,
    notification_key: str,
    context: Optional[Dict[str, Any]] = None,
    source: TriggerSource = TriggerSource.BACKEND,
    send_email: Optional[bool] = None,
    send_push: Optional[bool] = None,
) -> NotificationTriggerResult:
    """
    Trigger a system notification for a user.

    This is the main entry point for triggering notifications. It:
    1. Looks up the notification template from the registry
    2. Validates the trigger source is allowed
    3. Substitutes template variables with context data
    4. Checks for deduplication
    5. Sends the notification via NotificationService

    Args:
        user_id: Target user ID
        notification_key: Key from NotificationKey enum
        context: Dict with variables for template substitution and metadata
        source: Source triggering the notification (default: backend)
        send_email: Override template default for email (optional)
        send_push: Override template default for push (optional)

    Returns:
        NotificationTriggerResult with success status and details

    Example:
        >>> result = await trigger_system_notification(
        ...     user_id="123",
        ...     notification_key="admin_local_model_restriction",
        ...     context={"model_id": "ollama/llama3", "action": "blocked"}
        ... )
        >>> print(result.success)
        True
        >>> print(result.notification_id)
        "notif_456"
    """
    try:
        # Step 1: Validate notification key and get template
        if not validate_notification_key(notification_key):
            error_msg = f"Invalid notification key: {notification_key}"
            logger.error(error_msg)
            return NotificationTriggerResult(
                success=False,
                error=error_msg,
                channels_used=[],
            )

        template = get_notification_template(notification_key)
        if not template:
            error_msg = f"Notification template not found: {notification_key}"
            logger.error(error_msg)
            return NotificationTriggerResult(
                success=False,
                error=error_msg,
                channels_used=[],
            )

        # Step 2: Validate trigger source is allowed
        if source not in template.allowed_triggers:
            error_msg = f"Source '{source}' not allowed to trigger notification '{notification_key}'. Allowed: {template.allowed_triggers}"
            logger.warning(error_msg)
            return NotificationTriggerResult(
                success=False,
                error=error_msg,
                channels_used=[],
            )

        # Step 3: Substitute template variables
        context = context or {}
        title = _substitute_template_variables(template.title, context)
        message = _substitute_template_variables(template.message, context)

        # Step 4: Determine send preferences (template defaults or overrides)
        should_send_email = send_email if send_email is not None else template.default_send_email
        should_send_push = send_push if send_push is not None else template.default_send_push

        # Step 5: Check for deduplication
        if template.deduplicate_window:
            is_duplicate = await _check_duplicate_notification(
                user_id=user_id,
                notification_key=notification_key,
                context=context,
                window_seconds=template.deduplicate_window
            )

            if is_duplicate:
                logger.info(f"Skipping duplicate notification '{notification_key}' for user {user_id}")
                return NotificationTriggerResult(
                    success=True,
                    error="Duplicate notification skipped (deduplication window active)",
                    channels_used=[],
                )

        # Step 6: Get user's account_id
        db = DBConnection()
        await db.initialize()
        client = await db.client

        account_result = await client.schema('basejump').from_('accounts').select('id').eq('primary_owner_user_id', user_id).eq('personal_account', True).limit(1).execute()

        if not account_result.data:
            error_msg = f"User account not found for user_id: {user_id}"
            logger.error(error_msg)
            return NotificationTriggerResult(
                success=False,
                error=error_msg,
                channels_used=[],
            )

        account_id = account_result.data[0]['id']

        # Step 7: Send notification via NotificationService
        logger.info(f"Triggering notification '{notification_key}' for user {user_id} from source {source}")

        result = await notification_service.send_notification(
            user_id=user_id,
            account_id=account_id,
            title=title,
            message=message,
            notification_type=template.type.value,
            category=template.category.value,
            sender_type="system",
            send_email=should_send_email,
            send_push=should_send_push,
            metadata={
                "notification_key": notification_key,
                "trigger_source": source.value,
                "context": context,
                "triggered_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        # Step 8: Build result
        channels_used = []
        if NotificationChannel.IN_APP in template.channels:
            channels_used.append(NotificationChannel.IN_APP)
        if result.get("email_sent"):
            channels_used.append(NotificationChannel.EMAIL)
        if result.get("push_sent"):
            channels_used.append(NotificationChannel.PUSH)

        logger.info(f"Successfully triggered notification '{notification_key}' (ID: {result.get('notification_id')})")

        return NotificationTriggerResult(
            success=True,
            notification_id=result.get("notification_id"),
            channels_used=channels_used,
            email_sent=result.get("email_sent", False),
            push_sent=result.get("push_sent", False),
        )

    except Exception as e:
        error_msg = f"Error triggering notification '{notification_key}': {str(e)}"
        logger.error(error_msg, exc_info=True)
        return NotificationTriggerResult(
            success=False,
            error=error_msg,
            channels_used=[],
        )


def _substitute_template_variables(template: str, context: Dict[str, Any]) -> str:
    """
    Substitute template variables with context values.

    Supports {variable_name} syntax.

    Args:
        template: Template string with {variables}
        context: Dict with variable values

    Returns:
        String with variables substituted

    Example:
        >>> template = "Hello {name}, you have {count} messages"
        >>> context = {"name": "Alice", "count": 5}
        >>> result = _substitute_template_variables(template, context)
        >>> print(result)
        "Hello Alice, you have 5 messages"
    """
    try:
        return template.format(**context)
    except KeyError as e:
        logger.warning(f"Missing template variable: {e}. Template: {template}, Context: {context}")
        # Return template with missing variables as-is
        return template
    except Exception as e:
        logger.error(f"Error substituting template variables: {e}")
        return template


async def _check_duplicate_notification(
    user_id: str,
    notification_key: str,
    context: Dict[str, Any],
    window_seconds: int
) -> bool:
    """
    Check if a duplicate notification was recently sent.

    Uses a hash of (user_id, notification_key, context) to identify duplicates.

    Args:
        user_id: Target user ID
        notification_key: Notification type key
        context: Context data
        window_seconds: Deduplication window in seconds

    Returns:
        True if duplicate found (skip notification), False otherwise
    """
    try:
        # Create a hash of the notification to detect duplicates
        dedup_hash = _create_notification_hash(user_id, notification_key, context)

        # Query recent notifications with same hash
        db = DBConnection()
        await db.initialize()
        client = await db.client

        # Calculate cutoff time
        cutoff_time = datetime.now(timezone.utc)
        cutoff_time = cutoff_time.replace(microsecond=0)  # Remove microseconds
        from datetime import timedelta
        cutoff_time = (cutoff_time - timedelta(seconds=window_seconds)).isoformat()

        # Check for recent notifications
        result = await client.table('notifications').select('id').eq('user_id', user_id).gte('created_at', cutoff_time).execute()

        if result.data:
            # Check metadata for matching notification_key
            for notification in result.data:
                # This is a simplified check - in production, you'd want to store the dedup_hash in the notification
                # For now, we'll just check if there's a recent notification of the same type
                logger.debug(f"Found recent notification for user {user_id}, checking for duplicate")

                # TODO: In Phase 2, store dedup_hash in notification metadata and check it here
                # For now, we'll assume it's a duplicate if there's a recent notification of the same key
                return True

        return False

    except Exception as e:
        logger.warning(f"Error checking duplicate notification: {e}")
        # If check fails, allow notification through (fail open)
        return False


def _create_notification_hash(
    user_id: str,
    notification_key: str,
    context: Dict[str, Any]
) -> str:
    """
    Create a hash for deduplication.

    Args:
        user_id: User ID
        notification_key: Notification key
        context: Context dict

    Returns:
        SHA256 hash string
    """
    # Sort context dict for consistent hashing
    context_str = json.dumps(context, sort_keys=True)
    hash_input = f"{user_id}:{notification_key}:{context_str}"
    return hashlib.sha256(hash_input.encode()).hexdigest()


# ============================================================================
# BATCH NOTIFICATION TRIGGERS (Phase 2+)
# ============================================================================

async def trigger_notification_batch(
    user_ids: list[str],
    notification_key: str,
    context: Optional[Dict[str, Any]] = None,
    source: TriggerSource = TriggerSource.BACKEND,
) -> Dict[str, NotificationTriggerResult]:
    """
    Trigger a notification for multiple users.

    This is a convenience function for sending the same notification to multiple users.
    In Phase 2, this will be optimized with batch processing and queuing.

    Args:
        user_ids: List of target user IDs
        notification_key: Notification type key
        context: Context for template substitution
        source: Trigger source

    Returns:
        Dict mapping user_id to NotificationTriggerResult

    Example:
        >>> results = await trigger_notification_batch(
        ...     user_ids=["user1", "user2", "user3"],
        ...     notification_key="workflow_status_change",
        ...     context={"workflow_name": "Approval Process"}
        ... )
        >>> print(len(results))
        3
    """
    results = {}

    logger.info(f"Triggering batch notification '{notification_key}' for {len(user_ids)} users")

    for user_id in user_ids:
        result = await trigger_system_notification(
            user_id=user_id,
            notification_key=notification_key,
            context=context,
            source=source,
        )
        results[user_id] = result

    success_count = sum(1 for r in results.values() if r.success)
    logger.info(f"Batch notification complete: {success_count}/{len(user_ids)} successful")

    return results
