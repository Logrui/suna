import secrets
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.logger import logger
from core.utils.config import config as app_config
from core.services.supabase import DBConnection
from .mcp_service import mcp_service, MCPException
from .oauth_service import mcp_oauth_service

router = APIRouter(tags=["mcp"])

_db: Optional[DBConnection] = None


def initialize(db: DBConnection):
    global _db
    _db = db


# ---- Request/Response Models ----

class CustomMCPConnectionRequest(BaseModel):
    url: str
    config: Optional[Dict[str, Any]] = {}


class CustomMCPConnectionResponse(BaseModel):
    success: bool
    qualified_name: str
    display_name: str
    tools: List[Dict[str, Any]]
    config: Dict[str, Any]
    url: str
    message: str
    requires_auth: bool = False
    oauth_metadata: Optional[Dict[str, Any]] = None


class CustomMCPDiscoverRequest(BaseModel):
    type: str
    config: Dict[str, Any]
    custom_headers: Optional[Dict[str, str]] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None


class OAuthStatusResponse(BaseModel):
    status: str  # "pending" | "completed" | "error"
    message: str


# ---- Existing Endpoint (Updated) ----

@router.post("/mcp/discover-custom-tools", summary="Discover Custom MCP Tools", operation_id="discover_custom_mcp_tools")
async def discover_custom_mcp_tools(
    request: CustomMCPDiscoverRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    try:
        config = dict(request.config)

        # Merge custom headers into config
        if request.custom_headers:
            existing_headers = config.get("headers", {})
            existing_headers.update(request.custom_headers)
            config["headers"] = existing_headers

        # Check for stored OAuth token and inject it
        mcp_url = config.get("url", "")
        if mcp_url and _db:
            access_token = await mcp_oauth_service.get_valid_access_token(
                _db, user_id, mcp_url
            )
            if access_token:
                headers = config.get("headers", {})
                headers["Authorization"] = f"Bearer {access_token}"
                config["headers"] = headers

        # Probe OAuth metadata
        oauth_metadata = None
        requires_auth = False
        if mcp_url:
            oauth_metadata = await mcp_oauth_service.discover_metadata(mcp_url)

        # Attempt discovery
        result = await mcp_service.discover_custom_tools(request.type, config)

        # If discovery failed and OAuth metadata exists, signal auth required
        if not result.success and oauth_metadata:
            requires_auth = True

        # If discovery succeeded but OAuth is available, note it for reference
        if result.success and oauth_metadata:
            requires_auth = False  # Already connected

        return CustomMCPConnectionResponse(
            success=result.success,
            qualified_name=result.qualified_name,
            display_name=result.display_name,
            tools=result.tools,
            config=result.config,
            url=result.url,
            message=result.message,
            requires_auth=requires_auth,
            oauth_metadata=oauth_metadata,
        )

    except MCPException as e:
        logger.error(f"Error discovering custom MCP tools: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ---- OAuth Endpoints ----

@router.get("/mcp/auth/start", summary="Start MCP OAuth Flow", operation_id="mcp_oauth_start")
async def mcp_oauth_start(
    mcp_url: str = Query(..., description="MCP server URL"),
    user_id: str = Query(..., description="User account ID"),
    agent_id: str = Query(default="", description="Agent ID for redirect after auth"),
    oauth_client_id: Optional[str] = Query(default=None, description="Pre-registered OAuth Client ID"),
    oauth_client_secret: Optional[str] = Query(default=None, description="Pre-registered OAuth Client Secret"),
):
    """Initiate MCP OAuth 2.1 flow. Redirects browser to the OAuth provider."""
    try:
        # Discover OAuth metadata
        metadata = await mcp_oauth_service.discover_metadata(mcp_url)
        if not metadata:
            raise HTTPException(
                status_code=400,
                detail=f"No OAuth metadata found at {mcp_url}. This server may not require OAuth.",
            )

        authorization_endpoint = metadata.get("authorization_endpoint")
        token_endpoint = metadata.get("token_endpoint")
        registration_endpoint = metadata.get("registration_endpoint")

        if not authorization_endpoint or not token_endpoint:
            raise HTTPException(
                status_code=400,
                detail="OAuth metadata missing required endpoints (authorization_endpoint, token_endpoint).",
            )

        # Build callback URL
        backend_url = app_config.BACKEND_URL
        redirect_uri = f"{backend_url}/v1/mcp/auth/callback"

        client_id = oauth_client_id
        client_secret = oauth_client_secret

        # Dynamic Client Registration if no client_id provided
        if not client_id and registration_endpoint:
            try:
                dcr_result = await mcp_oauth_service.register_client(
                    registration_endpoint, redirect_uri
                )
                client_id = dcr_result.get("client_id")
                client_secret = dcr_result.get("client_secret") or client_secret
            except Exception as e:
                logger.error(f"DCR failed: {e}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Dynamic Client Registration failed: {e}. Please provide a Client ID manually.",
                )

        if not client_id:
            raise HTTPException(
                status_code=400,
                detail="No Client ID available. Server does not support DCR. Please provide a Client ID in Advanced Settings.",
            )

        # Generate PKCE
        code_verifier, code_challenge = mcp_oauth_service.generate_pkce()

        # Generate state token
        state = secrets.token_urlsafe(32)

        # Store state in Redis
        await mcp_oauth_service.store_oauth_state(state, {
            "user_id": user_id,
            "mcp_url": mcp_url,
            "agent_id": agent_id,
            "code_verifier": code_verifier,
            "client_id": client_id,
            "client_secret": client_secret,
            "token_endpoint": token_endpoint,
            "redirect_uri": redirect_uri,
        })

        # Build authorization URL
        scope = metadata.get("scopes_supported", [""])
        scope_str = " ".join(scope) if isinstance(scope, list) else str(scope)

        auth_url = mcp_oauth_service.build_authorization_url(
            authorization_endpoint=authorization_endpoint,
            client_id=client_id,
            redirect_uri=redirect_uri,
            state=state,
            code_challenge=code_challenge,
            scope=scope_str,
        )

        return RedirectResponse(url=auth_url, status_code=302)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth start failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate OAuth flow: {e}")


@router.get("/mcp/auth/callback", summary="MCP OAuth Callback", operation_id="mcp_oauth_callback")
async def mcp_oauth_callback(
    code: str = Query(..., description="Authorization code"),
    state: str = Query(..., description="State parameter"),
):
    """Handle OAuth callback from the MCP provider. Exchanges code for tokens and redirects to frontend."""
    try:
        # Retrieve state from Redis (single-use)
        state_data = await mcp_oauth_service.get_oauth_state(state)
        if not state_data:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired OAuth state. Please try connecting again.",
            )

        user_id = state_data["user_id"]
        mcp_url = state_data["mcp_url"]
        agent_id = state_data.get("agent_id", "")
        code_verifier = state_data["code_verifier"]
        client_id = state_data["client_id"]
        client_secret = state_data.get("client_secret")
        token_endpoint = state_data["token_endpoint"]
        redirect_uri = state_data["redirect_uri"]

        # Exchange code for tokens
        tokens = await mcp_oauth_service.exchange_code_for_tokens(
            token_endpoint=token_endpoint,
            code=code,
            redirect_uri=redirect_uri,
            client_id=client_id,
            code_verifier=code_verifier,
            client_secret=client_secret,
        )

        # Store tokens securely
        if _db:
            await mcp_oauth_service.store_tokens(
                db=_db,
                account_id=user_id,
                mcp_url=mcp_url,
                tokens=tokens,
                client_id=client_id,
                client_secret=client_secret,
                token_endpoint=token_endpoint,
            )

        # Redirect back to frontend
        frontend_url = app_config.FRONTEND_URL
        if agent_id:
            redirect_to = f"{frontend_url}/agents/config/{agent_id}?mcp_auth=success&mcp_url={mcp_url}"
        else:
            redirect_to = f"{frontend_url}?mcp_auth=success&mcp_url={mcp_url}"

        return RedirectResponse(url=redirect_to, status_code=302)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        # Redirect to frontend with error
        frontend_url = app_config.FRONTEND_URL
        return RedirectResponse(
            url=f"{frontend_url}?mcp_auth=error&message={str(e)}",
            status_code=302,
        )


@router.get("/mcp/auth/status", summary="Check MCP OAuth Status", operation_id="mcp_oauth_status")
async def mcp_oauth_status(
    mcp_url: str = Query(..., description="MCP server URL"),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """Check if user has valid OAuth tokens for an MCP server."""
    if not _db:
        raise HTTPException(status_code=500, detail="Database not initialized")

    has_token = await mcp_oauth_service.has_valid_token(_db, user_id, mcp_url)

    if has_token:
        return OAuthStatusResponse(
            status="completed",
            message="OAuth tokens are stored and valid.",
        )
    else:
        return OAuthStatusResponse(
            status="pending",
            message="No OAuth tokens found. Please complete the OAuth flow.",
        )
