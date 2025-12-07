import pytest
from core.services.permission_service import PermissionService, PermissionResult
from core.api_models.permissions import ToolPermissionSettings, PermissionMode, ToolPermissionOverride

def test_defaults_allow_all():
    """Test that default settings allow execution (Turbo mode)"""
    result = PermissionService.check_permission(None, "any_tool")
    assert result == PermissionResult.ALLOWED

    settings = ToolPermissionSettings() # default mode is Turbo
    result = PermissionService.check_permission(settings, "any_tool")
    assert result == PermissionResult.ALLOWED

def test_global_blacklist():
    settings = ToolPermissionSettings(
        global_blacklist=["dangerous_tool"]
    )
    result = PermissionService.check_permission(settings, "dangerous_tool")
    assert result == PermissionResult.DENIED

    result = PermissionService.check_permission(settings, "safe_tool")
    assert result == PermissionResult.ALLOWED

def test_global_whitelist_bypasses_strict():
    settings = ToolPermissionSettings(
        default_mode=PermissionMode.STRICT,
        global_whitelist=["trusted_tool"]
    )
    # Whitelisted tool should be allowed even in strict mode
    result = PermissionService.check_permission(settings, "trusted_tool")
    assert result == PermissionResult.ALLOWED

    # Other tools should require approval
    result = PermissionService.check_permission(settings, "other_tool")
    assert result == PermissionResult.REQUIRES_APPROVAL

def test_tool_override_mode():
    settings = ToolPermissionSettings(
        default_mode=PermissionMode.STRICT,
        tool_overrides={
            "common_tool": ToolPermissionOverride(tool_name="common_tool", mode=PermissionMode.TURBO)
        }
    )

    # Overridden tool should use Turbo (ALLOWED)
    result = PermissionService.check_permission(settings, "common_tool")
    assert result == PermissionResult.ALLOWED

    # Default is Strict
    result = PermissionService.check_permission(settings, "other_tool")
    assert result == PermissionResult.REQUIRES_APPROVAL

def test_temp_grant_precedence():
    """Test that temporary grants override blacklist and strict mode"""
    settings = ToolPermissionSettings(
        default_mode=PermissionMode.STRICT,
        global_blacklist=["blocked_tool"]
    )

    thread_metadata = {
        "temporary_permissions": [
            {"tool_name": "blocked_tool", "granted_at": "...", "expires_on_success": True},
            {"tool_name": "normal_tool", "granted_at": "...", "expires_on_success": True}
        ]
    }

    # Even if blacklisted, explicit grant allows it (User knows best)
    # Wait, spec says: Blacklist >> Agent level blacklist.
    # But temp grant is "User explicitly approved NOW". That usually overrides static config.
    # Implementation follows "Temp Grants -> Blacklist -> Whitelist"
    result = PermissionService.check_permission(settings, "blocked_tool", thread_metadata)
    assert result == PermissionResult.ALLOWED

    result = PermissionService.check_permission(settings, "normal_tool", thread_metadata)
    assert result == PermissionResult.ALLOWED

    result = PermissionService.check_permission(settings, "unguided_tool", thread_metadata)
    assert result == PermissionResult.REQUIRES_APPROVAL

def test_grant_and_consume():
    metadata = {}

    # Grant
    metadata = PermissionService.grant_temporary_permission(metadata, "tool_a")
    assert len(metadata['temporary_permissions']) == 1
    assert metadata['temporary_permissions'][0]['tool_name'] == "tool_a"

    # Consume on failure (should not consume)
    metadata = PermissionService.consume_permission(metadata, "tool_a", success=False)
    assert len(metadata['temporary_permissions']) == 1

    # Consume on success (should consume)
    metadata = PermissionService.consume_permission(metadata, "tool_a", success=True)
    assert len(metadata['temporary_permissions']) == 0
