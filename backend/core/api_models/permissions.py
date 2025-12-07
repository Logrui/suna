from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field

class PermissionMode(str, Enum):
    TURBO = "turbo"
    AGENT_DECIDE = "agent_decide"
    STRICT = "strict"

class ParameterConstraint(BaseModel):
    parameter_name: str
    constraint_type: str  # e.g., "regex", "exact_match", "list"
    constraint_value: Any

class ToolPermissionOverride(BaseModel):
    tool_name: str
    mode: Optional[PermissionMode] = None
    parameter_constraints: Optional[List[ParameterConstraint]] = None

class ToolPermissionSettings(BaseModel):
    default_mode: PermissionMode = Field(default=PermissionMode.TURBO)
    global_whitelist: List[str] = Field(default_factory=list)
    global_blacklist: List[str] = Field(default_factory=list)
    tool_overrides: Dict[str, ToolPermissionOverride] = Field(default_factory=dict)

class PermissionGrant(BaseModel):
    """
    Represents a temporary permission grant for a tool.
    Used in thread metadata to track approved tools.
    """
    tool_name: str
    granted_at: str  # ISO timestamp
    expires_on_success: bool = True
