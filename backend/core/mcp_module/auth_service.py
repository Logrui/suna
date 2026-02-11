
import os
import secrets
import hashlib
import base64
import json
import httpx
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urlencode, quote, urlparse

from core.utils.logger import logger
from core.credentials import EncryptionService
from core.utils.config import config as app_config
from core.services.supabase import DBConnection

from .exceptions import MCPAuthenticationError

class MCPAuthService:
    def __init__(self):
        self._encryption_service = EncryptionService()
        self._db = DBConnection()

    def generate_state(self, user_id: str, return_url: str, mcp_url: str, code_verifier: str, token_endpoint: str, agent_id: Optional[str] = None, display_name: Optional[str] = None) -> str:
        """
        Generates a secure state parameter containing context for the callback.
        """
        nonce = secrets.token_hex(16)
        state_data = {
            "user_id": user_id,
            "return_url": return_url,
            "mcp_url": mcp_url,
            "code_verifier": code_verifier,
            "token_endpoint": token_endpoint,
            "agent_id": agent_id,
            "display_name": display_name,
            "nonce": nonce,
            "timestamp": secrets.token_hex(8) # Add randomness
        }
        
        # We use the existing encryption service to secure the state payload
        # This prevents tampering with the return_url or user_id
        encrypted_state, state_hash = self._encryption_service.encrypt_config(state_data)
        
        # Combine encryption and hash to ensure integrity
        payload = {
            "d": base64.b64encode(encrypted_state).decode('utf-8'),
            "h": state_hash
        }
        
        return base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('utf-8')

    def validate_state(self, state: str) -> Dict[str, Any]:
        """
        Decodes and validates the state parameter.
        Returns the original state data dict if valid, raises ValueError if invalid.
        """
        try:
            decoded_wrapper = json.loads(base64.urlsafe_b64decode(state).decode('utf-8'))
            encrypted_data = base64.b64decode(decoded_wrapper['d'])
            data_hash = decoded_wrapper['h']
            
            state_data = self._encryption_service.decrypt_config(encrypted_data, data_hash)
            return state_data
        except Exception as e:
            raise MCPAuthenticationError("Invalid state parameter")

    async def discover_oauth_metadata(self, mcp_url: str) -> Dict[str, Any]:
        """
        Discover OAuth 2.0/2.1 metadata following SEP-985 and RFC 9419.
        First tries oauth-protected-resource, then resolves authorization servers.
        Probes both the specific URL and the root origin.
        """
        parsed = urlparse(mcp_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        
        # Base path without query parameters for discovery
        path_base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip('/')
        
        # We try discovery on both the origin and the specific path base
        urls_to_try = [origin]
        if path_base != origin:
            urls_to_try.append(path_base)
            
        async with httpx.AsyncClient(timeout=10.0) as client:
            for base in urls_to_try:
                # 1. Try Protected Resource Metadata (SEP-985 priority)
                resource_metadata_url = f"{base}/.well-known/oauth-protected-resource"
                try:
                    logger.debug(f"Attempting to discover Protected Resource Metadata at {resource_metadata_url}")
                    res = await client.get(resource_metadata_url)
                    if res.status_code == 200:
                        resource_data = res.json()
                        auth_servers = resource_data.get("authorization_servers", [])
                        if auth_servers:
                            # Follow the first auth server
                            as_url = auth_servers[0].rstrip('/')
                            as_metadata_url = f"{as_url}/.well-known/oauth-authorization-server"
                            logger.debug(f"Found AS from resource metadata: {as_metadata_url}")
                            res_as = await client.get(as_metadata_url)
                            if res_as.status_code == 200:
                                return res_as.json()
                except Exception as e:
                    logger.debug(f"Protected Resource Metadata discovery failed at {base}: {e}")

                # 2. Fallback to direct Authorization Server Metadata on base URL
                as_metadata_url = f"{base}/.well-known/oauth-authorization-server"
                try:
                    logger.debug(f"Attempting Authorization Server Metadata at {as_metadata_url}")
                    res = await client.get(as_metadata_url)
                    if res.status_code == 200:
                        return res.json()
                except Exception as e:
                    logger.debug(f"Direct AS metadata discovery failed at {base}: {e}")

                # 3. Last fallback: OpenID configuration (common for many servers)
                oidc_url = f"{base}/.well-known/openid-configuration"
                try:
                    res = await client.get(oidc_url)
                    if res.status_code == 200:
                        return res.json()
                except Exception:
                    pass

        raise MCPAuthenticationError(f"Could not discover any OAuth/OIDC metadata for {mcp_url} (probed {', '.join(urls_to_try)}). Ensure the server supports MCP Authorization SEPs.")

    def generate_code_verifier_challenge(self) -> Tuple[str, str]:
        """
        Generates PKCE Code Verifier and Code Challenge (S256).
        """
        code_verifier = secrets.token_urlsafe(64)
        
        # S256 transformation
        hashed = hashlib.sha256(code_verifier.encode('ascii')).digest()
        code_challenge = base64.urlsafe_b64encode(hashed).decode('ascii').rstrip('=')
        
        return code_verifier, code_challenge
        
    async def get_auth_headers(self, mcp_url: str, user_id: Optional[str] = None) -> Dict[str, str]:
        """
        Retrieve existing auth headers for an MCP URL if registered.
        Used primarily during discovery updates.
        """
        if not user_id:
            return {}
            
        try:
            from core.credentials import get_credential_service
            from core.utils.mcp_helpers import get_custom_mcp_qualified_name
            
            # Try to match existing credential. We'll need to check various types.
            service = get_credential_service(self._db)
            
            # Check SSE first as it's most common for discovery-based custom MCPs
            qualified_name = get_custom_mcp_qualified_name(mcp_url, "sse")
            credential = await service.get_credential(user_id, qualified_name)
            
            if not credential:
                # Try HTTP
                qualified_name = get_custom_mcp_qualified_name(mcp_url, "http")
                credential = await service.get_credential(user_id, qualified_name)
            
            if credential and credential.config and "access_token" in credential.config:
                return {"Authorization": f"Bearer {credential.config['access_token']}"}
        except Exception as e:
            logger.debug(f"Failed to fetch existing MCP auth headers for discovery: {e}")
            
        return {}

mcp_auth_service = MCPAuthService()
