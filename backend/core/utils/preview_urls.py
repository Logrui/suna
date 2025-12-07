"""
Utility functions for generating Daytona preview URLs through the Suna proxy.

This module provides a centralized way to construct preview URLs that bypass the
Daytona preview warning by routing requests through our backend proxy, which injects
the X-Daytona-Skip-Preview-Warning header.
"""

from core.utils.config import config
from core.utils.logger import logger


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

    # Ensure path starts with / if not empty, or is / if empty
    if not path:
        path = "/"
    elif not path.startswith('/'):
        path = f"/{path}"

    result_url = f"{base_url}/api/sandboxes/{sandbox_id}/proxy/{port}{path}"
    logger.debug(f"[Preview URL] Generated proxy URL: {result_url} (sandbox={sandbox_id}, port={port}, path={path})")

    return result_url


def get_vnc_preview_url(sandbox_id: str) -> str:
    """
    Get VNC (Computer) preview URL for a sandbox.

    Args:
        sandbox_id: The Daytona sandbox ID

    Returns:
        Proxy URL for VNC access on configured VNC port (default 6080)
    """
    logger.info(f"[VNC Preview URL] Generating VNC preview URL for sandbox={sandbox_id} on port={config.DAYTONA_VNC_PORT}")
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
