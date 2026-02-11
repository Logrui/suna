"""Helper utilities for managing MCP (Model Context Protocol) configurations."""
from typing import List, Dict, Any


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


def get_custom_mcp_qualified_name(url: str, transport_type: str) -> str:
    """
    Generate a consistent qualified name for a custom MCP server.
    
    Args:
        url: The base URL of the MCP server
        transport_type: The transport type ('http', 'sse', etc.)
        
    Returns:
        A unique string in the format custom_{type}_{hash}
    """
    import hashlib
    # Clean URL to avoid naming issues with trailing slashes
    clean_url = url.rstrip('/')
    h = hashlib.md5(clean_url.encode()).hexdigest()[:8]
    return f"custom_{transport_type}_{h}"
