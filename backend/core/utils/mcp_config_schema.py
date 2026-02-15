"""
Canonical MCP Configuration Schema & Normalization

Single source of truth for MCP config key names. Normalizes the
camelCase (frontend/stored) ↔ snake_case (backend runtime) mismatch.

Storage format (DB / agent configs):  camelCase  — enabledTools, customType, qualifiedName
Runtime format  (Python dataclasses): snake_case — enabled_tools, custom_type, qualified_name

Already consistent (no normalization needed): access_token, custom_headers
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


# ── Canonical key mapping ──────────────────────────────────────────
# Maps camelCase (storage) → snake_case (canonical runtime)
_CAMEL_TO_SNAKE = {
    "enabledTools": "enabled_tools",
    "customType": "custom_type",
    "qualifiedName": "qualified_name",
}

# Reverse: snake_case → camelCase (for writing back to storage)
_SNAKE_TO_CAMEL = {v: k for k, v in _CAMEL_TO_SNAKE.items()}


# ── Normalization helpers ──────────────────────────────────────────

def normalize_to_snake(config: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw MCP config dict: camelCase keys → snake_case.

    Keys not in the mapping are passed through unchanged.
    The 'type' key is treated as a fallback for 'customType'.
    """
    out = {}
    for k, v in config.items():
        canonical = _CAMEL_TO_SNAKE.get(k, k)
        out[canonical] = v

    # Fallback: bare 'type' → custom_type (if customType wasn't present)
    if "custom_type" not in out and "type" in out:
        out["custom_type"] = out["type"]

    return out


def normalize_to_camel(config: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a runtime config dict: snake_case keys → camelCase for storage.

    Keys not in the mapping are passed through unchanged.
    Ensures both 'customType' and 'type' are present for backward compat.
    """
    out = {}
    for k, v in config.items():
        storage_key = _SNAKE_TO_CAMEL.get(k, k)
        out[storage_key] = v

    # Ensure backward compat: also write 'type' alongside 'customType'
    if "customType" in out and "type" not in out:
        out["type"] = out["customType"]

    return out


def get_config_value(config: Dict[str, Any], canonical_key: str, default=None):
    """Read a value from a config dict using the canonical snake_case key,
    falling back to the camelCase variant if present.

    This is the recommended way to read keys in code that might receive
    either storage-format or runtime-format dicts.
    """
    if canonical_key in config:
        return config[canonical_key]
    camel = _SNAKE_TO_CAMEL.get(canonical_key)
    if camel and camel in config:
        return config[camel]
    # Extra fallback for custom_type ← "type"
    if canonical_key == "custom_type" and "type" in config:
        return config["type"]
    return default


# ── Typed config dataclass ─────────────────────────────────────────

@dataclass
class CanonicalMCPConfig:
    """Typed representation of an MCP server config (snake_case canonical)."""
    name: str = ""
    custom_type: str = "http"
    qualified_name: str = ""
    enabled_tools: List[str] = field(default_factory=list)
    config: Dict[str, Any] = field(default_factory=dict)
    # Already-consistent keys (pass through)
    access_token: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None
    # Composio-specific
    toolkit_slug: Optional[str] = None

    @classmethod
    def from_raw(cls, raw: Dict[str, Any]) -> "CanonicalMCPConfig":
        """Build from any raw config dict (handles both camelCase and snake_case)."""
        return cls(
            name=raw.get("name", ""),
            custom_type=get_config_value(raw, "custom_type", "http"),
            qualified_name=get_config_value(raw, "qualified_name", ""),
            enabled_tools=get_config_value(raw, "enabled_tools", []),
            config=raw.get("config", {}),
            access_token=raw.get("access_token"),
            custom_headers=raw.get("custom_headers"),
            toolkit_slug=raw.get("toolkit_slug"),
        )

    def to_storage(self) -> Dict[str, Any]:
        """Serialize back to camelCase dict for DB storage."""
        out: Dict[str, Any] = {"name": self.name}
        out["customType"] = self.custom_type
        out["type"] = self.custom_type  # backward compat
        if self.qualified_name:
            out["qualifiedName"] = self.qualified_name
        if self.enabled_tools:
            out["enabledTools"] = self.enabled_tools
        if self.config:
            out["config"] = self.config
        if self.access_token:
            out["access_token"] = self.access_token
        if self.custom_headers:
            out["custom_headers"] = self.custom_headers
        if self.toolkit_slug:
            out["toolkit_slug"] = self.toolkit_slug
        return out
