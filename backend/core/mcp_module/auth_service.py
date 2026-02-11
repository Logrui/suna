
import os
import secrets
import hashlib
import base64
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urlencode, quote

from core.utils.logger import logger
from core.credentials import EncryptionService
from core.utils.config import config as app_config
from core.services.supabase import DBConnection

class MCPAuthService:
    def __init__(self):
        self._encryption_service = EncryptionService()
        self._db = DBConnection()

    def generate_state(self, user_id: str, return_url: str) -> str:
        """
        Generates a secure state parameter containing the user_id and return_url.
        State = base64(encrypted(json(user_id, return_url, random_nonce)))
        """
        nonce = secrets.token_hex(16)
        state_data = {
            "user_id": user_id,
            "return_url": return_url,
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
            logger.error(f"State validation failed: {e}")
            raise ValueError("Invalid state parameter")

    async def discover_oauth_metadata(self, mcp_url: str) -> Dict[str, Any]:
        """
        Discover OAuth 2.0/2.1 metadata from /.well-known/oauth-authorization-server
        """
        clean_url = mcp_url.rstrip('/')
        metadata_url = f"{clean_url}/.well-known/oauth-authorization-server"
        
        # Fallback to OpenID config if the specific oauth one is missing? 
        # For now, strict adherence to MCP spec suggestion
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(metadata_url)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to discover OAuth metadata at {metadata_url}: {e}")
            raise ValueError(f"Could not discover OAuth configuration at {mcp_url}")

    def generate_code_verifier_challenge(self) -> Tuple[str, str]:
        """
        Generates PKCE Code Verifier and Code Challenge (S256).
        """
        code_verifier = secrets.token_urlsafe(64)
        
        # S256 transformation
        hashed = hashlib.sha256(code_verifier.encode('ascii')).digest()
        code_challenge = base64.urlsafe_b64encode(hashed).decode('ascii').rstrip('=')
        
        return code_verifier, code_challenge

mcp_auth_service = MCPAuthService()
