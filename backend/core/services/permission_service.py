from typing import Optional, Dict, List, Any
from enum import Enum
from datetime import datetime, timezone
import json

from core.api_models.permissions import PermissionMode, ToolPermissionSettings, PermissionGrant
from core.utils.logger import logger

class PermissionResult(Enum):
    ALLOWED = "allowed"
    DENIED = "denied"
    REQUIRES_APPROVAL = "requires_approval"

class PermissionService:
    @staticmethod
    def check_permission(
        permission_settings: Optional[ToolPermissionSettings],
        tool_name: str,
        thread_metadata: Dict[str, Any] = None
    ) -> PermissionResult:
        """
        Check if a tool can be executed based on permission settings and thread state.

        Order of Precedence:
        1. Thread-level Temporary Grants (Approvals) -> ALLOWED
        2. Global Blacklist -> DENIED
        3. Global Whitelist -> ALLOWED
        4. Tool-Specific Overrides (if exists):
           - Mode check (Strict -> Approval, Turbo/Decide -> Allowed)
        5. Default Mode:
           - Strict -> Approval
           - Turbo/Decide -> Allowed
        """

        # 1. Check Temporary Thread Grants (Approvals)
        # This takes highest precedence because it represents an explicit user approval
        # for this specific thread session (until success)
        if thread_metadata:
            temp_permissions = thread_metadata.get('temporary_permissions', [])
            # Convert list of dicts to list of PermissionGrant objects if needed
            # (or just check the tool_name if stored as simpler structure)

            # Assuming stored as list of serialized PermissionGrant dicts
            for grant in temp_permissions:
                if isinstance(grant, dict) and grant.get('tool_name') == tool_name:
                    logger.debug(f"Permission check: '{tool_name}' allowed by temporary grant")
                    return PermissionResult.ALLOWED

        # If no settings provided, default to Turbo (ALLOWED)
        if not permission_settings:
            return PermissionResult.ALLOWED

        # 2. Global Blacklist
        if tool_name in permission_settings.global_blacklist:
            logger.debug(f"Permission check: '{tool_name}' blocked by global blacklist")
            return PermissionResult.DENIED

        # 3. Global Whitelist
        if tool_name in permission_settings.global_whitelist:
            logger.debug(f"Permission check: '{tool_name}' allowed by global whitelist")
            return PermissionResult.ALLOWED

        # 4. Tool-Specific Overrides
        # Check if there's an override for this specific tool
        override = permission_settings.tool_overrides.get(tool_name)
        mode = permission_settings.default_mode

        if override and override.mode:
            mode = override.mode

        # 5. Mode Check
        if mode == PermissionMode.STRICT:
            logger.debug(f"Permission check: '{tool_name}' requires approval (STRICT mode)")
            return PermissionResult.REQUIRES_APPROVAL

        # Turbo or Agent Decide modes allow execution by default (unless blacklisted)
        # Note: "Agent Decide" means the agent *can* ask, but if it calls the tool directly,
        # it means it decided to run it. So we allow it.
        return PermissionResult.ALLOWED

    @staticmethod
    def grant_temporary_permission(
        thread_metadata: Dict[str, Any],
        tool_name: str
    ) -> Dict[str, Any]:
        """
        Add a temporary permission grant to the thread metadata.
        Returns the updated metadata dict.
        """
        if 'temporary_permissions' not in thread_metadata:
            thread_metadata['temporary_permissions'] = []

        # Check if already granted
        existing = False
        for grant in thread_metadata['temporary_permissions']:
            if grant.get('tool_name') == tool_name:
                existing = True
                break

        if not existing:
            new_grant = PermissionGrant(
                tool_name=tool_name,
                granted_at=datetime.now(timezone.utc).isoformat(),
                expires_on_success=True
            )
            thread_metadata['temporary_permissions'].append(new_grant.dict())
            logger.info(f"Granted temporary permission for '{tool_name}'")

        return thread_metadata

    @staticmethod
    def consume_permission(
        thread_metadata: Dict[str, Any],
        tool_name: str,
        success: bool
    ) -> Dict[str, Any]:
        """
        Consume a permission grant if the tool execution was successful.
        Returns the updated metadata dict.
        """
        if not success:
            # If execution failed, we don't consume the permission (allow retry)
            return thread_metadata

        if 'temporary_permissions' not in thread_metadata:
            return thread_metadata

        original_count = len(thread_metadata['temporary_permissions'])

        # Remove the grant for this tool if expires_on_success is True
        thread_metadata['temporary_permissions'] = [
            grant for grant in thread_metadata['temporary_permissions']
            if not (grant.get('tool_name') == tool_name and grant.get('expires_on_success', True))
        ]

        if len(thread_metadata['temporary_permissions']) < original_count:
            logger.info(f"Consumed permission for '{tool_name}' after successful execution")

        return thread_metadata
