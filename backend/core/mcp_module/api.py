from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import os
import re
import time

from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.logger import logger
import traceback
from urllib.parse import urlparse, quote, urlencode
from core.runtime_cache import invalidate_agent_config_cache
from .mcp_service import mcp_service, MCPException
from .custom_mcp_registry_service import mcp_registry_service
from .exceptions import MCPAuthenticationError
import httpx
import hashlib
from core.utils.mcp_helpers import get_custom_mcp_qualified_name

router = APIRouter(tags=["mcp"])


class CustomMCPConnectionRequest(BaseModel):
    url: str
    config: Optional[Dict[str, Any]] = None

    # OAuth Configuration Fields (for documentation & validation)
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    
    # Custom Headers Configuration
    custom_headers: Optional[Dict[str, str]] = None


class CustomMCPConnectionResponse(BaseModel):
    success: bool
    qualified_name: str
    display_name: str
    tools: List[Dict[str, Any]]
    config: Dict[str, Any]
    url: str
    message: str
    oauth_metadata: Optional[Dict[str, Any]] = None
    requires_auth: bool = False


class CustomMCPDiscoverRequest(BaseModel):
    type: str
    config: Dict[str, Any] # This still accepts the raw config dict, validation happens inside service layer or via Pydantic model usage if we typed it strictly.

    # We can explicitly add the optional fields here too if we want them to show up in the schema for Discovery
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None


@router.post("/mcp/discover-custom-tools", summary="Discover Custom MCP Tools", operation_id="discover_custom_mcp_tools")
async def discover_custom_mcp_tools(request: CustomMCPDiscoverRequest, user_id: str = Depends(verify_and_get_user_id_from_jwt)):
    try:
        # Merge optional top-level fields into config for the service layer
        service_config = request.config.copy()
        
        if request.custom_headers:
            service_config["custom_headers"] = request.custom_headers
            
        if request.oauth_client_id:
            service_config["oauth_client_id"] = request.oauth_client_id
            
        if request.oauth_client_secret:
            service_config["oauth_client_secret"] = request.oauth_client_secret

        logger.info(f"🔍 [MCP API] Discovering {request.type} tools for URL: {service_config.get('url', 'N/A')}")
        logger.debug(f"⚙️ [MCP API] Request Config: { {k: '***' if k.lower() in ('access_token', 'oauth_client_secret', 'oauth_client_id') else v for k, v in service_config.items()} }")
        
        start_time = time.time()
        result = await mcp_registry_service.discover_custom_tools(request.type, service_config, user_id=user_id)
        elapsed = (time.time() - start_time) * 1000
        
        if result.success:
            logger.info(f"✅ [MCP API] Discovery successful for {result.display_name} in {elapsed:.1f}ms. Found {len(result.tools)} tools.")
        else:
            logger.error(f"❌ [MCP API] Discovery failed for {service_config.get('url', 'N/A')}: {result.message}")
        
        return CustomMCPConnectionResponse(
            success=result.success,
            qualified_name=result.qualified_name,
            display_name=result.display_name,
            tools=result.tools,
            config=result.config,
            url=result.url,
            message=result.message,
            oauth_metadata=result.oauth_metadata,
            requires_auth=result.requires_auth
        )
        
    except MCPException as e:
        logger.error(f"Error discovering custom MCP tools: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# OAuth 2.1 Handshake Endpoints
# ==========================================

from .auth_service import mcp_auth_service
from core.credentials import get_credential_service, get_profile_service

@router.get("/mcp/auth/start", summary="Initiate MCP OAuth Flow")
async def mcp_auth_start(
    url: str = Query(..., description="The MCP server URL"),
    return_url: str = Query(..., description="Where to return user after auth"),
    agent_id: Optional[str] = Query(None, description="Optional agent ID to update"),
    name: Optional[str] = Query(None, description="Optional custom display name"),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """
    Initiates the OAuth 2.1 handshake for a given MCP server URL.
    Follows SEP-985 (Discovery), SEP-991 (Client URL Identity), and RFC 8707 (Resource Param).
    """
    logger.info(f"🚀 [MCP AUTH] Initiating OAuth flow for URL: {url}")
    logger.debug(f"📝 [MCP AUTH] Start Params: return_url={return_url}, agent_id={agent_id}, name={name}")
    
    try:
        # 1. Discover Metadata
        logger.info(f"🔍 [MCP AUTH] Discovering OAuth metadata for {url}")
        metadata = await mcp_auth_service.discover_oauth_metadata(url)
        auth_endpoint = metadata.get("authorization_endpoint")
        token_endpoint = metadata.get("token_endpoint")
        
        if not auth_endpoint or not token_endpoint:
            logger.error(f"❌ [MCP AUTH] OAuth metadata missing endpoints for {url}. Auth: {auth_endpoint}, Token: {token_endpoint}")
            raise HTTPException(status_code=400, detail="MCP server does not support advanced OAuth (missing endpoints)")

        logger.debug(f"✅ [MCP AUTH] Metadata discovered. Auth Endpoint: {auth_endpoint}, Token Endpoint: {token_endpoint}")

        # 2. Generate PKCE Challenge
        code_verifier, code_challenge = mcp_auth_service.generate_code_verifier_challenge()
        logger.debug("🔐 [MCP AUTH] PKCE code verifier and challenge generated.")

        # 3. Generate State (binds user session, return_url, and exchange context)
        state = mcp_auth_service.generate_state(
            user_id=user_id, 
            return_url=return_url, 
            mcp_url=url, 
            code_verifier=code_verifier,
            token_endpoint=token_endpoint,
            agent_id=agent_id,
            display_name=name
        )
        logger.debug("📦 [MCP AUTH] State parameter generated and stored.")

        # 4. Construct Redirect URL following standards
        # SEP-991: Using URL-based client_id
        backend_base = os.getenv('SUNA_BACKEND_URL', 'https://api.suna.syhc.dev/v1')
        client_id = f"{backend_base}/mcp/client-metadata.json"
        
        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": f"{backend_base}/mcp/auth/callback",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "scope": "mcp:tools", # Standard MCP scope
            "resource": url # RFC 8707: Point back to the MCP resource
        }

        redirect_url = f"{auth_endpoint}?{urlencode(params)}"
        logger.info(f"➡️ [MCP AUTH] Redirecting user to authorization endpoint: {auth_endpoint} (params: {len(params)} items)")
        logger.debug(f"➡️ [MCP AUTH] Full redirect URL: {redirect_url}")
        
        return {"redirect_url": redirect_url}

    except HTTPException:
        raise
    except (MCPAuthenticationError, MCPException) as e:
        logger.warning(f"⚠️ [MCP AUTH] MCP OAuth discovery failed for {url}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        logger.error(f"❌ [MCP AUTH] Error initiating MCP OAuth flow for {url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/mcp/client-metadata.json", summary="Suna Client Identity Document (SEP-991)")
async def mcp_client_metadata():
    """
    Returns the Suna identity document for SEP-991 URL-based client registration.
    """
    backend_base = os.getenv('SUNA_BACKEND_URL', 'https://api.suna.syhc.dev/v1')
    metadata_url = f"{backend_base}/mcp/client-metadata.json"
    
    logger.info(f"📄 [MCP AUTH] Serving client metadata from {metadata_url}")
    return {
        "client_id": metadata_url,
        "client_name": "Suna AI Agent Worker",
        "client_uri": "https://suna.syhc.dev",
        "logo_uri": "https://suna.syhc.dev/logo.png",
        "redirect_uris": [f"{backend_base}/mcp/auth/callback"],
        "response_types": ["code"],
        "grant_types": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_method": "none",
        "application_type": "web"
    }


@router.get("/mcp/auth/callback", summary="Handle MCP OAuth Callback")
async def mcp_auth_callback(
    code: str,
    state: str,
):
    """
    Handles the callback, exchanges code for token, and stores it.
    Redirects user back to frontend.
    """
    logger.info(f"🔗 [MCP AUTH] OAuth Callback received. Code: {code[:10]}..., State: {state[:10]}...")
    try:
        # 1. Validate State & Extract Context
        logger.debug(f"📝 [MCP AUTH] Validating state parameter...")
        state_data = mcp_auth_service.validate_state(state)
        user_id = state_data["user_id"]
        return_url = state_data["return_url"]
        mcp_url = state_data["mcp_url"]
        code_verifier = state_data["code_verifier"]
        token_endpoint = state_data["token_endpoint"]
        agent_id = state_data.get("agent_id")
        display_name = state_data.get("display_name")
        
        logger.info(f"✅ [MCP AUTH] State validated for user {user_id}. MCP URL: {mcp_url}, Agent ID: {agent_id}, Display Name: {display_name}")
        
        # 2. Exchange Code for Token
        logger.info(f"🔑 [MCP AUTH] Exchanging authorization code for access token with {token_endpoint}...")
        # Use URL-based client_id following SEP-991
        backend_base = os.getenv('SUNA_BACKEND_URL', 'https://api.suna.syhc.dev/v1')
        client_id = f"{backend_base}/mcp/client-metadata.json"
        redirect_uri = f"{backend_base}/mcp/auth/callback"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            exchange_data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "code_verifier": code_verifier
            }
            
            response = await client.post(token_endpoint, data=exchange_data)
            
            if response.status_code != 200:
                logger.error(f"❌ [MCP AUTH] Token exchange failed with status {response.status_code}: {response.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange authorization code for token")
            
            token_data = response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                logger.error(f"❌ [MCP AUTH] Token exchange successful but no access_token found in response: {token_data}")
                raise HTTPException(status_code=400, detail="MCP server did not return an access token")

            logger.info(f"✅ [MCP AUTH] Access token successfully obtained. Expires in: {token_data.get('expires_in')}s")

        # 3. Store Credentials
        from core.services.supabase import DBConnection
        db = DBConnection()
        credential_service = get_credential_service(db)
        profile_service = get_profile_service(db)
        
        # 3. Refine display name
        if not display_name:
            domain = urlparse(mcp_url).netloc
            display_name = f"MCP: {domain}"
            if not domain:
                 display_name = f"MCP: {mcp_url.split('/')[-1]}"
        logger.debug(f"📝 [MCP AUTH] Determined display name: {display_name}")
             
        # The configuration for the MCP server now includes the OAuth tokens
        config_payload = {
            "url": mcp_url,
            "type": "http", # Default, will be refined by discovery
            "auth_type": "oauth2",
            "access_token": access_token,
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in")
        }
        sanitized_config_payload = {k: '***' if k.lower() in ('access_token', 'refresh_token') else v for k, v in config_payload.items()}
        logger.debug(f"⚙️ [MCP AUTH] Config payload for storage: {sanitized_config_payload}")

        # 3.5 Fallback for missing agent_id: Try to extract from return_url if possible
        if not agent_id and return_url:
            logger.debug(f"🔍 [MCP AUTH] Attempting to extract agent_id from return_url: {return_url}")
            # Look for /agents/config/<id> or similar patterns
            match = re.search(r'/agents/config/([a-zA-Z0-9-]+)', return_url)
            if match:
                agent_id = match.group(1)
                logger.info(f"✅ [MCP AUTH] Extracted agent_id {agent_id} from return_url path")
            else:
                # Also check common query params if any
                from urllib.parse import parse_qs
                parsed_return = urlparse(return_url)
                qs = parse_qs(parsed_return.query)
                if 'agent_id' in qs:
                    agent_id = qs['agent_id'][0]
                    logger.info(f"✅ [MCP AUTH] Extracted agent_id {agent_id} from return_url query params")
                elif 'agentId' in qs:
                    agent_id = qs['agentId'][0]
                    logger.info(f"✅ [MCP AUTH] Extracted agent_id {agent_id} from return_url query params (camelCase)")
        if agent_id:
            logger.debug(f"🤖 [MCP AUTH] Final agent_id for association: {agent_id}")
        else:
            logger.debug(f"🤖 [MCP AUTH] No agent_id found for association.")

        # 4. Proactive Tool Discovery
        # We try to discover tools immediately so they are available to the worker right away
        discovered_tools = []
        discovery_type = "http"
        
        try:
            logger.info(f"🔍 [MCP AUTH] Proactively discovering tools for {mcp_url} via HTTP...")
            discovery_result = await mcp_service.discover_custom_tools("http", config_payload)
            if discovery_result.success and discovery_result.tools:
                discovered_tools = discovery_result.tools
                discovery_type = "http"
                # Refine URL if probing found a specific path
                if discovery_result.url != mcp_url:
                    logger.info(f"🔄 [MCP AUTH] Refining MCP URL from {mcp_url} to {discovery_result.url}")
                    mcp_url = discovery_result.url
                    config_payload["url"] = mcp_url
                    
                logger.info(f"✅ [MCP AUTH] Discovered {len(discovered_tools)} tools via HTTP for {mcp_url}")
            else:
                logger.info(f"🔄 [MCP AUTH] HTTP discovery failed or no tools, trying SSE fallback for {mcp_url}...")
                sse_result = await mcp_service.discover_custom_tools("sse", config_payload)
                if sse_result.success and sse_result.tools:
                    discovered_tools = sse_result.tools
                    discovery_type = "sse"
                    config_payload["type"] = "sse"
                    
                    # Refine URL if probing found a specific path
                    if sse_result.url != mcp_url:
                        logger.info(f"🔄 [MCP AUTH] Refining SSE MCP URL from {mcp_url} to {sse_result.url}")
                        mcp_url = sse_result.url
                        config_payload["url"] = mcp_url
                        
                    logger.info(f"✅ [MCP AUTH] Discovered {len(discovered_tools)} tools via SSE for {mcp_url}")
                else:
                    logger.warning(f"⚠️ [MCP AUTH] No tools discovered via HTTP or SSE for {mcp_url}.")
        except Exception as e:
            logger.warning(f"⚠️ [MCP AUTH] Proactive tool discovery failed during OAuth callback for {mcp_url}: {e}")

        logger.debug(f"📊 [MCP AUTH] Discovery complete. Type={discovery_type}, Tools={len(discovered_tools)}")
        qualified_name = get_custom_mcp_qualified_name(mcp_url, discovery_type)
        logger.info(f"💾 [MCP AUTH] Storing credentials for qualified_name={qualified_name}")
        
        await credential_service.store_credential(
            account_id=user_id,
            mcp_qualified_name=qualified_name,
            display_name=display_name,
            config=config_payload
        )

        # 3.1 ALSO store as a Profile so Agent Tools can discover it
        # This is critical for the Agent Builder system to see this authenticated server
        logger.info(f"💾 [MCP AUTH] Storing profile for auth lookup: {qualified_name} (Display: {display_name})")
        await profile_service.store_profile(
            account_id=user_id,
            mcp_qualified_name=qualified_name,
            profile_name=display_name,
            display_name=display_name,
            config=config_payload,
            is_default=True
        )

        # 5. Update Agent if agent_id was provided
        if agent_id:
            logger.info(f"🤖 [MCP AUTH] Attempting to associate server with agent: {agent_id}")
            from core.versioning.version_service import get_version_service
            version_service = await get_version_service()
            
            # Fetch current config
            current_config = await version_service.get_current_mcp_config(agent_id, user_id)
            if current_config:
                logger.debug(f"📄 [MCP AUTH] Current agent config has {len(current_config.get('custom_mcp', []))} custom servers")
            else:
                logger.warning(f"⚠️  [MCP AUTH] No existing config found for agent {agent_id}")
            try:
                from core.agent_loader import get_agent_loader
                from core.utils.mcp_helpers import merge_custom_mcps
                
                loader = await get_agent_loader()
                agent_data = await loader.load_agent(agent_id, user_id, load_config=True)
                logger.debug(f"📄 [MCP AUTH] Agent data loaded for {agent_id}. Current MCPs: {len(agent_data.custom_mcps or [])}")
                
                if not discovered_tools:
                    logger.warning(f"No tools discovered for {mcp_url} during proactive sync. The MCP will be added but might appear empty.")

                # By default, enable all discovered tools
                enabled_tool_names = [t["name"] for t in discovered_tools]

                new_custom_mcp = {
                    "name": display_name,
                    "qualifiedName": qualified_name,
                    "type": discovery_type,
                    "config": config_payload,
                    "enabledTools": enabled_tool_names,
                    "isCustom": True,
                    "customType": discovery_type,
                    "tools": discovered_tools # Cache tools list in the config for UI immediate display
                }
                
                updated_custom_mcps = merge_custom_mcps(agent_data.custom_mcps or [], [new_custom_mcp])
                
                version_service = await get_version_service()
                new_version = await version_service.create_version(
                    agent_id=agent_id,
                    user_id=user_id,
                    system_prompt=agent_data.system_prompt or "You are a helpful AI assistant.",
                    model=agent_data.model or "kortix/basic",
                    configured_mcps=agent_data.configured_mcps or [],
                    custom_mcps=updated_custom_mcps,
                    agentpress_tools=agent_data.agentpress_tools or {},
                    change_description=f"Added MCP Server: {display_name} ({discovery_type}) via OAuth"
                )
                
                # Update agent's current version link in the agents table
                client_db = await db.client
                await client_db.table('agents').update({
                    "current_version_id": new_version.version_id,
                    "version_count": new_version.version_number
                }).eq("agent_id", agent_id).execute()
                
                # 5.3 Invalidate cache so the worker/UI sees the update immediately
                await invalidate_agent_config_cache(agent_id)
                
                logger.info(f"Successfully associated OAuth MCP {display_name} ({len(enabled_tool_names)} tools) with agent {agent_id}")
            except Exception as e:
                logger.error(f"Failed to automatically associate MCP with agent {agent_id}: {str(e)}")
                import traceback
                traceback.print_exc()
        else:
            logger.info("No agent_id provided or found for association. Skipping auto-link.")
        
        # 6. Redirect to Frontend
        from fastapi.responses import RedirectResponse
        frontend_base = os.getenv('SUNA_FRONTEND_URL', 'https://suna.syhc.dev')
        
        # Append success flag to return_url
        final_redirect = return_url
        
        # Better UX: If we have an agent_id and we're just going to the dashboard, 
        # redirect to the specific config page instead.
        if agent_id and ("/dashboard" in final_redirect or final_redirect.endswith("/")):
            final_redirect = f"{frontend_base}/agents/config/{agent_id}"
            
        # Ensure mcp_auth flag is present
        if "?" in final_redirect:
            if "mcp_auth=success" not in final_redirect:
                final_redirect += "&mcp_auth=success"
        else:
            final_redirect += "?mcp_auth=success"
            
        # Ensure agent_id is present for dashboard success handler to work
        if agent_id and f"agent_id={agent_id}" not in final_redirect:
            final_redirect += f"&agent_id={agent_id}"
            
        print(f"DEBUG: [MCP-AUTH] Final redirect URL: {final_redirect}")
        return RedirectResponse(url=final_redirect, status_code=303)

    except Exception as e:
        traceback.print_exc()
        logger.error(f"OAuth Callback failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
