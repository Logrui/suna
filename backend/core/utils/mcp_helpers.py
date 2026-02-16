"""Helper utilities for managing MCP (Model Context Protocol) configurations."""
import hashlib
import re
from typing import List, Dict, Any, Optional


def merge_custom_mcps(existing_mcps: List[Dict[str, Any]], new_mcps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merge new custom MCP configurations with existing ones.

    If an MCP with the same name exists, it will be replaced with the new configuration.
    Otherwise, the new MCP is appended to the list.

    Args:
        existing_mcps: List of existing MCP configurations
        new_mcps: List of new MCP configurations to merge in

    Returns:
        Merged list of MCP configurations
    """
    if not new_mcps:
        return existing_mcps

    merged_mcps = existing_mcps.copy()

    for new_mcp in new_mcps:
        new_mcp_qn = new_mcp.get('qualifiedName')
        existing_index = None

        # Find if this MCP already exists (use qualifiedName for uniqueness)
        for i, existing_mcp in enumerate(merged_mcps):
            if existing_mcp.get('qualifiedName') == new_mcp_qn:
                existing_index = i
                break

        # Also fall back to name comparison if qualifiedName is missing (legacy)
        if existing_index is None:
            new_mcp_name = new_mcp.get('name')
            for i, existing_mcp in enumerate(merged_mcps):
                if existing_mcp.get('name') == new_mcp_name:
                    existing_index = i
                    break

        # Replace or append
        if existing_index is not None:
            merged_mcps[existing_index] = new_mcp
        else:
            merged_mcps.append(new_mcp)

    return merged_mcps


# ---------------------------------------------------------------------------
# qualifiedName generation: canonical (new) + legacy (backward compat)
# ---------------------------------------------------------------------------

def generate_custom_mcp_qualified_name(display_name: str, url: str) -> str:
    """
    Generate a stable, human-readable qualifiedName for a custom MCP server.

    Format: custom_mcp_{normalized_name}_{url_hash[:6]}

    Example:
        "Desktop Commander" + "https://dc.example.com/mcp"
        → "custom_mcp_desktop_commander_f7a3b1"

    The format is:
    - Human-readable: easy to spot in logs
    - Unique: URL hash prevents collisions for same-name servers at different URLs
    - Transport-agnostic: no sse/http in the name (avoids breakage on auto-detect)
    - Deterministic: same (name, url) always produces the same result

    Args:
        display_name: User-provided display name (e.g. "Desktop Commander")
        url: The base URL of the MCP server

    Returns:
        A unique, human-readable qualifiedName string
    """
    # Normalize name: lowercase, non-alphanumeric → underscore, collapse, trim
    normalized = re.sub(r'[^a-z0-9]+', '_', display_name.lower()).strip('_')
    # Truncate to 40 chars to keep qualifiedName reasonable
    if len(normalized) > 40:
        normalized = normalized[:40].rstrip('_')
    # Hash the cleaned URL for uniqueness
    clean_url = url.rstrip('/')
    url_hash = hashlib.md5(clean_url.encode()).hexdigest()[:6]
    return f"custom_mcp_{normalized}_{url_hash}"


def _legacy_url_hash_qualified_name(url: str, transport_type: str) -> str:
    """
    Legacy qualifiedName format: custom_{type}_{md5(url)[:8]}

    Kept for backward-compatible credential lookups. New code should use
    generate_custom_mcp_qualified_name() instead.
    """
    clean_url = url.rstrip('/')
    h = hashlib.md5(clean_url.encode()).hexdigest()[:8]
    return f"custom_{transport_type}_{h}"


# Keep old name as alias for callers that haven't been updated yet
get_custom_mcp_qualified_name = _legacy_url_hash_qualified_name


def resolve_qualified_name_from_config(config: Dict[str, Any]) -> str:
    """
    Resolve the qualifiedName for a custom MCP config dict.

    Priority:
    1. Explicit qualifiedName/qualified_name in config (from previous save)
    2. Generate from display name + URL using canonical function
    3. Fall back to display name as-is (last resort)

    Args:
        config: MCP configuration dictionary

    Returns:
        The resolved qualifiedName string
    """
    from core.utils.mcp_config_schema import get_config_value

    # 1. Try explicit qualifiedName from config
    qn = get_config_value(config, "qualified_name")
    if qn:
        return qn

    # 2. Generate from name + URL
    name = config.get('name', 'unnamed')
    url = config.get('url') or config.get('config', {}).get('url', '')
    if url:
        return generate_custom_mcp_qualified_name(name, url)

    # 3. Last resort: name-based slug (no URL available)
    return f"custom_mcp_{re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')}"
