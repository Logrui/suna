"""
Utility functions for generating Daytona preview URLs through the Suna proxy.

This module provides a centralized way to construct preview URLs that bypass the
Daytona preview warning by routing requests through our backend proxy, which injects
the X-Daytona-Skip-Preview-Warning header.
"""

from core.utils.config import config


def get_proxy_preview_url(sandbox_id: str, port: int, path: str = "") -> str:
    """
    Generate a proxy URL for accessing a sandbox port through the Suna backend.
    
    This bypasses the Daytona preview warning by routing requests through our proxy
    endpoint which injects the X-Daytona-Skip-Preview-Warning header.
    
    Args:
        sandbox_id: The Daytona sandbox ID
        port: The port number (e.g., 6080 for VNC, 8080 for web)
        path: Optional path to append (default: "")
    
    Returns:
        Proxy URL in format: {WEBHOOK_BASE_URL}/api/sandboxes/{sandbox_id}/proxy/{port}/{path}
    
    Examples:
        >>> get_proxy_preview_url("sandbox-123", 8080)
        'https://kortix.syhc.dev/api/sandboxes/sandbox-123/proxy/8080/'
        
        >>> get_proxy_preview_url("sandbox-123", 8080, "index.html")
        'https://kortix.syhc.dev/api/sandboxes/sandbox-123/proxy/8080/index.html'
    """
    base_url = config.WEBHOOK_BASE_URL or "http://localhost:8000"
    
    # Ensure path starts with / if not empty
    if path and not path.startswith('/'):
        path = f"/{path}"
    
    return f"{base_url}/api/sandboxes/{sandbox_id}/proxy/{port}{path}"


def get_vnc_preview_url(sandbox_id: str) -> str:
    """
    Get VNC (Computer) preview URL for a sandbox.
    
    Args:
        sandbox_id: The Daytona sandbox ID
    
    Returns:
        Proxy URL for VNC access on configured VNC port (default 6080)
    """
    return get_proxy_preview_url(sandbox_id, config.DAYTONA_VNC_PORT)


def get_website_preview_url(sandbox_id: str) -> str:
    """
    Get website preview URL for a sandbox.
    
    Args:
        sandbox_id: The Daytona sandbox ID
    
    Returns:
        Proxy URL for website access on configured web port (default 8080)
    """
    return get_proxy_preview_url(sandbox_id, config.DAYTONA_WEB_PORT)
