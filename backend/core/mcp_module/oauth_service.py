"""
MCP OAuth 2.1 Service

Implements OAuth 2.1 authentication for MCP servers following:
- RFC 8414 (OAuth 2.0 Authorization Server Metadata)
- RFC 7591 (OAuth 2.0 Dynamic Client Registration)
- PKCE (Proof Key for Code Exchange)
"""

import os
import json
import secrets
import hashlib
import base64
import time
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urlencode, urlparse

import httpx

from core.utils.logger import logger
from core.credentials import EncryptionService
from core.services import redis as redis_service


OAUTH_STATE_TTL = 600  # 10 minutes
OAUTH_STATE_PREFIX = "mcp_oauth_state:"


class MCPOAuthService:
    def __init__(self):
        self._encryption_service = EncryptionService()

    # ---- RFC 8414: Metadata Discovery ----

    async def discover_metadata(self, mcp_server_url: str) -> Optional[Dict[str, Any]]:
        """
        Probe /.well-known/oauth-authorization-server to discover OAuth endpoints.
        Returns metadata dict or None if the server doesn't advertise OAuth.
        """
        parsed = urlparse(mcp_server_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        well_known_url = f"{base_url}/.well-known/oauth-authorization-server"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(well_known_url)
                if resp.status_code == 200:
                    metadata = resp.json()
                    logger.info(f"OAuth metadata discovered for {base_url}: endpoints found")
                    return metadata
                else:
                    logger.debug(f"No OAuth metadata at {well_known_url} (status {resp.status_code})")
                    return None
        except Exception as e:
            logger.debug(f"OAuth metadata discovery failed for {base_url}: {e}")
            return None

    # ---- RFC 7591: Dynamic Client Registration ----

    async def register_client(
        self,
        registration_endpoint: str,
        redirect_uri: str,
        client_name: str = "Kortix Suna",
    ) -> Dict[str, Any]:
        """
        Dynamically register this application as an OAuth client.
        Returns dict with client_id and optionally client_secret.
        """
        payload = {
            "client_name": client_name,
            "redirect_uris": [redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",  # PKCE-based, no client secret required
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    registration_endpoint,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
                data = resp.json()
                logger.info(f"DCR successful: client_id={data.get('client_id')}")
                return data
        except Exception as e:
            logger.error(f"Dynamic Client Registration failed: {e}")
            raise

    # ---- PKCE ----

    @staticmethod
    def generate_pkce() -> Tuple[str, str]:
        """Generate PKCE code_verifier and code_challenge (S256)."""
        code_verifier = secrets.token_urlsafe(64)[:128]
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
        return code_verifier, code_challenge

    def build_authorization_url(
        self,
        authorization_endpoint: str,
        client_id: str,
        redirect_uri: str,
        state: str,
        code_challenge: str,
        scope: str = "",
    ) -> str:
        """Construct the authorization URL for the OAuth provider."""
        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        if scope:
            params["scope"] = scope
        return f"{authorization_endpoint}?{urlencode(params)}"

    # ---- Token Exchange ----

    async def exchange_code_for_tokens(
        self,
        token_endpoint: str,
        code: str,
        redirect_uri: str,
        client_id: str,
        code_verifier: str,
        client_secret: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens."""
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "code_verifier": code_verifier,
        }
        if client_secret:
            payload["client_secret"] = client_secret

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                token_endpoint,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("Token exchange successful")
            return data

    async def refresh_access_token(
        self,
        token_endpoint: str,
        refresh_token: str,
        client_id: str,
        client_secret: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Use refresh token to obtain a new access token."""
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
        }
        if client_secret:
            payload["client_secret"] = client_secret

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                token_endpoint,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("Token refresh successful")
            return data

    # ---- Redis State Management ----

    async def store_oauth_state(self, state: str, data: Dict[str, Any]) -> None:
        """Store OAuth state in Redis with TTL (single-use)."""
        key = f"{OAUTH_STATE_PREFIX}{state}"
        await redis_service.setex(key, OAUTH_STATE_TTL, json.dumps(data))

    async def get_oauth_state(self, state: str) -> Optional[Dict[str, Any]]:
        """Retrieve and delete OAuth state from Redis (single-use)."""
        key = f"{OAUTH_STATE_PREFIX}{state}"
        raw = await redis_service.get(key)
        if raw is None:
            return None
        # Delete immediately (single-use)
        await redis_service.delete(key)
        return json.loads(raw)

    # ---- Token Storage (DB) ----

    async def store_tokens(
        self,
        db,
        account_id: str,
        mcp_url: str,
        tokens: Dict[str, Any],
        client_id: str,
        client_secret: Optional[str] = None,
        token_endpoint: Optional[str] = None,
    ) -> None:
        """Encrypt and store OAuth tokens in user_mcp_credentials."""
        expires_in = tokens.get("expires_in", 3600)
        config_data = {
            "oauth_access_token": tokens["access_token"],
            "oauth_refresh_token": tokens.get("refresh_token"),
            "oauth_token_endpoint": token_endpoint,
            "oauth_token_expires_at": int(time.time()) + expires_in,
            "oauth_client_id": client_id,
            "oauth_client_secret": client_secret,
        }

        encrypted_config, config_hash = self._encryption_service.encrypt_config(config_data)
        qualified_name = f"oauth_{_url_to_qualified_name(mcp_url)}"

        # Upsert: deactivate existing, then insert
        try:
            # Deactivate existing credential for this MCP
            await db.from_("user_mcp_credentials").update(
                {"is_active": False}
            ).eq("account_id", account_id).eq(
                "mcp_qualified_name", qualified_name
            ).eq("is_active", True).execute()

            # Insert new credential
            await db.from_("user_mcp_credentials").insert({
                "account_id": account_id,
                "mcp_qualified_name": qualified_name,
                "display_name": f"OAuth Token ({mcp_url})",
                "encrypted_config": encrypted_config.decode("utf-8") if isinstance(encrypted_config, bytes) else encrypted_config,
                "config_hash": config_hash,
                "is_active": True,
            }).execute()

            logger.info(f"Stored OAuth tokens for {qualified_name} (account {account_id})")
        except Exception as e:
            logger.error(f"Failed to store OAuth tokens: {e}")
            raise

    async def get_valid_access_token(
        self,
        db,
        account_id: str,
        mcp_url: str,
    ) -> Optional[str]:
        """
        Retrieve a valid access token for the MCP server.
        Auto-refreshes if expired and refresh_token is available.
        """
        qualified_name = f"oauth_{_url_to_qualified_name(mcp_url)}"

        try:
            result = await db.from_("user_mcp_credentials").select(
                "encrypted_config, config_hash"
            ).eq("account_id", account_id).eq(
                "mcp_qualified_name", qualified_name
            ).eq("is_active", True).order(
                "created_at", desc=True
            ).limit(1).execute()

            if not result.data:
                return None

            row = result.data[0]
            config_data = self._encryption_service.decrypt_config(
                row["encrypted_config"].encode("utf-8") if isinstance(row["encrypted_config"], str) else row["encrypted_config"],
                row["config_hash"],
            )

            # Check expiry
            expires_at = config_data.get("oauth_token_expires_at", 0)
            if time.time() < expires_at - 60:  # 60s buffer
                return config_data["oauth_access_token"]

            # Try refresh
            refresh_token = config_data.get("oauth_refresh_token")
            token_endpoint = config_data.get("oauth_token_endpoint")
            client_id = config_data.get("oauth_client_id")
            client_secret = config_data.get("oauth_client_secret")

            if not refresh_token or not token_endpoint or not client_id:
                logger.warning(f"Cannot refresh token for {qualified_name}: missing refresh data")
                return None

            new_tokens = await self.refresh_access_token(
                token_endpoint, refresh_token, client_id, client_secret
            )

            # Store refreshed tokens
            await self.store_tokens(
                db, account_id, mcp_url, new_tokens,
                client_id, client_secret, token_endpoint,
            )

            return new_tokens["access_token"]

        except Exception as e:
            logger.error(f"Failed to get valid access token for {qualified_name}: {e}")
            return None

    async def has_valid_token(self, db, account_id: str, mcp_url: str) -> bool:
        """Check if user has a stored (possibly expired but refreshable) token for this MCP."""
        qualified_name = f"oauth_{_url_to_qualified_name(mcp_url)}"
        try:
            result = await db.from_("user_mcp_credentials").select(
                "credential_id"
            ).eq("account_id", account_id).eq(
                "mcp_qualified_name", qualified_name
            ).eq("is_active", True).limit(1).execute()
            return bool(result.data)
        except Exception:
            return False


def _url_to_qualified_name(url: str) -> str:
    """Convert MCP URL to a safe qualified name for DB storage."""
    parsed = urlparse(url)
    host = parsed.netloc.replace(":", "_").replace(".", "_")
    path = parsed.path.strip("/").replace("/", "_")
    return f"{host}_{path}" if path else host


# Singleton
mcp_oauth_service = MCPOAuthService()
