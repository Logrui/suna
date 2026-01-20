"""Browser Extension WebSocket Service.

This module handles WebSocket connections from Chrome extensions, manages sessions,
and provides command routing between the backend agent tools and connected extensions.
"""

import asyncio
import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from pydantic import BaseModel, Field

from core.utils.logger import logger
from core.services.supabase import DBConnection
from core.auth import get_current_user
from core.services import redis as redis_service

# ========== Configuration ==========

EXTENSION_WS_PATH = "/ws/extension"
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SUPABASE_JWT_SECRET", "your-jwt-secret"))
JWT_ALGORITHM = "HS256"
HEARTBEAT_INTERVAL_MS = 30000
COMMAND_TIMEOUT_MS = 30000

# Redis session management
REDIS_SESSION_TTL = 60  # seconds, refreshed on heartbeat
WORKER_ID = os.getenv("HOSTNAME", f"worker_{os.getpid()}")

# ========== Router ==========

router = APIRouter(tags=["browser-extension"])


# ========== Pydantic Models ==========

class HelloMessage(BaseModel):
    """Extension → Backend: Initial handshake message."""
    type: str = "hello"
    extension_id: str
    extension_version: str
    browser: str
    timestamp: int


class WelcomeMessage(BaseModel):
    """Backend → Extension: Handshake acknowledgment."""
    type: str = "welcome"
    session_id: str
    server_time: int
    heartbeat_interval_ms: int = HEARTBEAT_INTERVAL_MS


class BrowserCommand(BaseModel):
    """Backend → Extension: Command to execute."""
    type: str = "command"
    id: str
    session_id: str
    action: str  # navigate, click, type, screenshot
    params: Dict[str, Any] = Field(default_factory=dict)
    timeout_ms: int = COMMAND_TIMEOUT_MS
    timestamp: int


class CommandResult(BaseModel):
    """Extension → Backend: Command execution result."""
    type: str = "result"
    id: str
    session_id: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: int


class HeartbeatMessage(BaseModel):
    """Bidirectional: Keep-alive ping/pong."""
    type: str = "heartbeat"
    timestamp: int


# ========== Session Management ==========

class ExtensionSession:
    """Represents an active extension WebSocket connection."""
    
    def __init__(
        self,
        session_id: str,
        extension_id: str,
        user_id: str,
        browser_id: str,
        websocket: WebSocket,
    ):
        self.session_id = session_id
        self.extension_id = extension_id
        self.user_id = user_id
        self.browser_id = browser_id
        self.websocket = websocket
        self.connected_at = datetime.now(timezone.utc)
        self.last_heartbeat = datetime.now(timezone.utc)
        self.pending_commands: Dict[str, asyncio.Future] = {}
    
    async def send_command(self, command: BrowserCommand) -> CommandResult:
        """Send command to extension and wait for result."""
        # Create future for response
        future = asyncio.get_event_loop().create_future()
        self.pending_commands[command.id] = future
        
        try:
            # Send command
            await self.websocket.send_json(command.model_dump())
            
            # Wait for response with timeout
            timeout_seconds = command.timeout_ms / 1000
            result = await asyncio.wait_for(future, timeout=timeout_seconds)
            return result
        except asyncio.TimeoutError:
            self.pending_commands.pop(command.id, None)
            raise TimeoutError(f"Command {command.id} timed out after {command.timeout_ms}ms")
        except Exception as e:
            self.pending_commands.pop(command.id, None)
            raise
    
    def resolve_command(self, result: CommandResult):
        """Resolve a pending command with its result."""
        future = self.pending_commands.pop(result.id, None)
        if future and not future.done():
            future.set_result(result)


class ExtensionSessionManager:
    """Manages all active extension WebSocket sessions.
    
    Uses Redis for presence tracking across multiple workers, while keeping
    WebSocket references in local memory (unavoidable for actual connections).
    """
    
    def __init__(self):
        self._sessions: Dict[str, ExtensionSession] = {}  # session_id -> session (local only)
        self._extension_to_session: Dict[str, str] = {}  # extension_id -> session_id (local only)
        self._user_sessions: Dict[str, List[str]] = {}  # user_id -> [session_ids] (local only)
    
    async def add_session(self, session: ExtensionSession):
        """Register a new session (local + Redis)."""
        # Local storage (for WebSocket reference)
        self._sessions[session.session_id] = session
        self._extension_to_session[session.extension_id] = session.session_id
        
        if session.user_id not in self._user_sessions:
            self._user_sessions[session.user_id] = []
        self._user_sessions[session.user_id].append(session.session_id)
        
        # Redis presence registration
        await self._register_presence_redis(session)
        
        logger.info(f"Extension session added: {session.session_id} for user {session.user_id}")
    
    async def _register_presence_redis(self, session: ExtensionSession):
        """Register session presence in Redis."""
        try:
            key = f"browser:session:{session.browser_id}"
            data = {
                "session_id": session.session_id,
                "extension_id": session.extension_id,
                "user_id": session.user_id,
                "browser_id": session.browser_id,
                "worker_id": WORKER_ID,
                "connected_at": session.connected_at.isoformat(),
                "last_heartbeat": session.last_heartbeat.isoformat(),
            }
            client = await redis_service.get_client()
            await client.hset(key, mapping=data)
            await client.expire(key, REDIS_SESSION_TTL)
            
            # Add to user's session set
            user_key = f"browser:sessions:user:{session.user_id}"
            await client.sadd(user_key, session.browser_id)
            
            logger.debug(f"🔌 [SESSION_MGR] Registered presence in Redis for browser_id={session.browser_id}")
        except Exception as e:
            logger.warning(f"🔌 [SESSION_MGR] Failed to register presence in Redis: {e}")
    
    async def remove_session(self, session_id: str):
        """Remove a session on disconnect (local + Redis)."""
        session = self._sessions.pop(session_id, None)
        if session:
            self._extension_to_session.pop(session.extension_id, None)
            if session.user_id in self._user_sessions:
                self._user_sessions[session.user_id] = [
                    sid for sid in self._user_sessions[session.user_id]
                    if sid != session_id
                ]
            
            # Remove from Redis
            await self._unregister_presence_redis(session)
            
            logger.info(f"Extension session removed: {session_id}")
    
    async def _unregister_presence_redis(self, session: ExtensionSession):
        """Remove session presence from Redis."""
        try:
            key = f"browser:session:{session.browser_id}"
            client = await redis_service.get_client()
            await client.delete(key)
            
            # Remove from user's session set
            user_key = f"browser:sessions:user:{session.user_id}"
            await client.srem(user_key, session.browser_id)
            
            logger.debug(f"🔌 [SESSION_MGR] Removed presence from Redis for browser_id={session.browser_id}")
        except Exception as e:
            logger.warning(f"🔌 [SESSION_MGR] Failed to remove presence from Redis: {e}")
    
    async def refresh_heartbeat(self, session_id: str):
        """Refresh session TTL in Redis on heartbeat."""
        session = self._sessions.get(session_id)
        if session:
            try:
                key = f"browser:session:{session.browser_id}"
                client = await redis_service.get_client()
                await client.expire(key, REDIS_SESSION_TTL)
                await client.hset(key, "last_heartbeat", datetime.now(timezone.utc).isoformat())
                logger.debug(f"🔌 [SESSION_MGR] Refreshed heartbeat in Redis for browser_id={session.browser_id}")
            except Exception as e:
                logger.warning(f"🔌 [SESSION_MGR] Failed to refresh heartbeat in Redis: {e}")
    
    def get_session(self, session_id: str) -> Optional[ExtensionSession]:
        """Get session by ID (local only - for WebSocket operations)."""
        return self._sessions.get(session_id)
    
    def get_session_by_extension(self, extension_id: str) -> Optional[ExtensionSession]:
        """Get session by extension ID (local only)."""
        session_id = self._extension_to_session.get(extension_id)
        return self._sessions.get(session_id) if session_id else None
    
    def get_session_by_browser_id(self, browser_id: str) -> Optional[ExtensionSession]:
        """Get session by browser database ID (local only - for command routing)."""
        logger.debug(f"🔌 [SESSION_MGR] Looking up local session for browser_id={browser_id}")
        for session in self._sessions.values():
            if session.browser_id == browser_id:
                logger.debug(f"🔌 [SESSION_MGR] Found local session: {session.session_id} for browser_id={browser_id}")
                return session
        logger.debug(f"🔌 [SESSION_MGR] No local session found for browser_id={browser_id}")
        return None
    
    def get_user_sessions(self, user_id: str) -> List[ExtensionSession]:
        """Get all sessions for a user (local only)."""
        session_ids = self._user_sessions.get(user_id, [])
        return [self._sessions[sid] for sid in session_ids if sid in self._sessions]
    
    def is_extension_online(self, extension_id: str) -> bool:
        """Check if extension is currently connected (local only)."""
        return extension_id in self._extension_to_session
    
    async def is_browser_online(self, browser_id: str) -> bool:
        """Check if browser is currently connected (via Redis - works across workers)."""
        try:
            key = f"browser:session:{browser_id}"
            client = await redis_service.get_client()
            exists = await client.exists(key)
            is_online = exists > 0
            logger.debug(f"🔌 [SESSION_MGR] is_browser_online({browser_id}) = {is_online} (Redis)")
            return is_online
        except Exception as e:
            logger.warning(f"🔌 [SESSION_MGR] Redis check failed, falling back to local: {e}")
            # Fallback to local check if Redis fails
            is_online = self.get_session_by_browser_id(browser_id) is not None
            logger.debug(f"🔌 [SESSION_MGR] is_browser_online({browser_id}) = {is_online} (local fallback)")
            return is_online


# Global session manager singleton
session_manager = ExtensionSessionManager()


# ========== Command Sending Utility ==========

async def send_browser_command(
    browser_id: str,
    action: str,
    params: Dict[str, Any] = None,
    timeout_ms: int = COMMAND_TIMEOUT_MS
) -> Optional[CommandResult]:
    """
    Send a command to a connected browser extension.
    
    Args:
        browser_id: The database ID of the browser (user_browsers.id)
        action: The command action (navigate, click, type, screenshot)
        params: Command parameters
        timeout_ms: Timeout in milliseconds
        
    Returns:
        CommandResult if successful, None if browser not connected
        
    Raises:
        TimeoutError: If command times out
        Exception: For other errors
    """
    session = session_manager.get_session_by_browser_id(browser_id)
    if not session:
        logger.warning(f"No active session for browser_id: {browser_id}")
        return None
    
    command = BrowserCommand(
        type="command",
        id=str(uuid.uuid4()),
        session_id=session.session_id,
        action=action,
        params=params or {},
        timeout_ms=timeout_ms,
        timestamp=int(time.time() * 1000),
    )
    
    logger.info(f"Sending command {command.id} ({action}) to browser {browser_id}")
    result = await session.send_command(command)
    logger.info(f"Command {command.id} completed: success={result.success}")
    
    return result


# ========== Token Utilities ==========

def create_browser_token(user_id: str, browser_id: str, extension_id: str) -> str:
    """Create a signed JWT token for browser authentication."""
    payload = {
        "sub": user_id,
        "browser_id": browser_id,
        "extension_id": extension_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=365),  # 1 year expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_browser_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a browser token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Browser token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid browser token: {e}")
        return None


def hash_token(token: str) -> str:
    """Create SHA-256 hash of token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


# ========== Database Operations ==========

async def _get_db_client():
    """Get initialized database client."""
    db = DBConnection()
    return await db.client


async def get_browser_by_extension_id(extension_id: str) -> Optional[Dict]:
    """Fetch browser record by extension_id."""
    client = await _get_db_client()
    result = await client.table("user_browsers").select("*").eq("extension_id", extension_id).maybe_single().execute()
    logger.debug(f"🔌 [BROWSER_EXT] get_browser_by_extension_id result: {result}")
    if result is None:
        logger.error("🔌 [BROWSER_EXT] get_browser_by_extension_id: execute() returned None")
        return None
    return result.data if result.data else None


async def get_browser_by_id(browser_id: str) -> Optional[Dict]:
    """Fetch browser record by ID."""
    client = await _get_db_client()
    result = await client.table("user_browsers").select("*").eq("id", browser_id).maybe_single().execute()
    if result is None:
        logger.error(f"🔌 [BROWSER_EXT] get_browser_by_id({browser_id}): execute() returned None")
        return None
    return result.data if result.data else None


async def update_browser_online_status(browser_id: str, is_online: bool):
    """Update browser online status and last_seen_at."""
    client = await _get_db_client()
    await client.table("user_browsers").update({
        "is_online": is_online,
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", browser_id).execute()


async def register_browser(user_id: str, extension_id: str, browser_info: Dict, token_hash: str, name: Optional[str] = None) -> Dict:
    """Register a new browser for a user."""
    client = await _get_db_client()
    insert_data = {
        "user_id": user_id,
        "extension_id": extension_id,
        "browser_info": browser_info,
        "token_hash": token_hash,
        "is_online": False,
    }
    if name:
        insert_data["name"] = name
    result = await client.table("user_browsers").insert(insert_data).execute()
    logger.debug(f"🔌 [BROWSER_EXT] register_browser result: {result}")
    if result is None:
        logger.error("🔌 [BROWSER_EXT] register_browser: execute() returned None")
        return None
    return result.data[0] if result.data else None


async def get_user_browsers(user_id: str) -> List[Dict]:
    """Get all browsers for a user."""
    client = await _get_db_client()
    result = await client.table("user_browsers").select("*").eq("user_id", user_id).execute()
    if result is None:
        logger.error(f"🔌 [BROWSER_EXT] get_user_browsers({user_id}): execute() returned None")
        return []
    return result.data if result.data else []


async def get_thread_browser_id(thread_id: str) -> Optional[str]:
    """
    Get the browser_id for a thread from its metadata.
    
    This is used internally by tools to determine if a browser extension
    is configured for the current thread.
    
    Args:
        thread_id: The thread ID to look up
        
    Returns:
        The browser_id if set, None otherwise
    """
    logger.debug(f"🔌 [BROWSER_EXT] get_thread_browser_id: looking up thread_id={thread_id}")
    try:
        client = await _get_db_client()
        result = await client.table("threads").select("metadata").eq("thread_id", thread_id).maybe_single().execute()
        
        if result is None:
            logger.error(f"🔌 [BROWSER_EXT] get_thread_browser_id({thread_id}): execute() returned None")
            return None
            
        if result is None or result.data is None:
            logger.debug(f"🔌 [BROWSER_EXT] get_thread_browser_id: thread {thread_id} not found or no metadata")
            return None
        
        metadata = result.data.get("metadata") or {}
        browser_id = metadata.get("browser_id")
        
        if browser_id:
            logger.info(f"🔌 [BROWSER_EXT] get_thread_browser_id: found browser_id={browser_id} for thread {thread_id}")
        else:
            logger.debug(f"🔌 [BROWSER_EXT] get_thread_browser_id: no browser_id in thread {thread_id} metadata")
        
        return browser_id
    except Exception as e:
        logger.warning(f"🔌 [BROWSER_EXT] get_thread_browser_id failed for thread {thread_id}: {e}")
        return None


# ========== WebSocket Handler ==========

# router = APIRouter() # Removed duplicate definition


@router.websocket(EXTENSION_WS_PATH)
async def extension_websocket(websocket: WebSocket):
    """Handle Chrome extension WebSocket connections."""
    await websocket.accept()
    session: Optional[ExtensionSession] = None
    
    try:
        # Step 1: Wait for hello message with token
        hello_data = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        
        if hello_data.get("type") != "hello":
            await websocket.close(code=4001, reason="Expected hello message")
            return
        
        # Extract token from headers or hello message
        token = hello_data.get("token") or websocket.headers.get("x-browser-token")
        if not token:
            await websocket.close(code=4002, reason="Missing authentication token")
            return
        
        # Verify token
        payload = verify_browser_token(token)
        if not payload:
            await websocket.close(code=4003, reason="Invalid or expired token")
            return
        
        user_id = payload["sub"]
        browser_id = payload["browser_id"]
        extension_id = payload["extension_id"]
        
        # Verify extension_id matches
        if hello_data.get("extension_id") != extension_id:
            await websocket.close(code=4004, reason="Extension ID mismatch")
            return
        
        # Create session
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        session = ExtensionSession(
            session_id=session_id,
            extension_id=extension_id,
            user_id=user_id,
            browser_id=browser_id,
            websocket=websocket,
        )
        await session_manager.add_session(session)
        
        # Update browser online status
        await update_browser_online_status(browser_id, True)
        
        # Send welcome
        welcome = WelcomeMessage(
            session_id=session_id,
            server_time=int(time.time() * 1000),
        )
        await websocket.send_json(welcome.model_dump())
        
        logger.info(f"Extension connected: {extension_id} (session: {session_id})")
        
        # Step 2: Message loop
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")
            
            if msg_type == "heartbeat":
                session.last_heartbeat = datetime.now(timezone.utc)
                await session_manager.refresh_heartbeat(session.session_id)
                await websocket.send_json({
                    "type": "heartbeat",
                    "timestamp": int(time.time() * 1000),
                })
            
            elif msg_type == "result":
                # Command result from extension
                result = CommandResult(**message)
                session.resolve_command(result)
            
            elif msg_type == "error":
                logger.error(f"Extension error: {message.get('message')}")
            
            else:
                logger.warning(f"Unknown message type from extension: {msg_type}")
    
    except WebSocketDisconnect:
        logger.info(f"Extension disconnected: {session.extension_id if session else 'unknown'}")
    
    except asyncio.TimeoutError:
        logger.warning("Extension connection timed out waiting for hello")
        await websocket.close(code=4005, reason="Handshake timeout")
    
    except Exception as e:
        logger.error(f"Extension WebSocket error: {e}")
    
    finally:
        if session:
            await session_manager.remove_session(session.session_id)
            await update_browser_online_status(session.browser_id, False)


# ========== Pydantic Models for API ==========

class RegisterBrowserRequest(BaseModel):
    extension_id: str
    browser_info: Optional[Dict[str, Any]] = None
    name: Optional[str] = None


class RegisterBrowserResponse(BaseModel):
    browser: Dict[str, Any]
    token: str


class SetThreadBrowserRequest(BaseModel):
    browser_id: str


# ========== API Endpoints for Browser Management ==========

@router.get("/user/browsers")
async def list_user_browsers_endpoint(user: dict = Depends(get_current_user)):
    """List all browsers registered to the current user."""
    user_id = user["user_id"]
    browsers = await get_user_browsers(user_id)
    
    # Add real-time online status from session manager (Redis-backed)
    for browser in browsers:
        browser["is_online"] = await session_manager.is_browser_online(browser["id"])
    
    return {"browsers": browsers}


@router.get("/user/browsers/online")
async def list_online_browsers_endpoint(user: dict = Depends(get_current_user)):
    """List only online browsers for the current user."""
    user_id = user["user_id"]
    browsers = await get_user_browsers(user_id)
    online_browsers = []
    for b in browsers:
        if await session_manager.is_browser_online(b["id"]):
            online_browsers.append(b)
    return {"browsers": online_browsers}


@router.post("/user/browsers/register")
async def register_browser_endpoint(
    request: RegisterBrowserRequest,
    user: dict = Depends(get_current_user),
):
    """Register a new browser extension for the current user."""
    user_id = user["user_id"]
    
    # Check if extension_id already registered
    existing = await get_browser_by_extension_id(request.extension_id)
    if existing:
        if existing["user_id"] != user_id:
            raise HTTPException(status_code=400, detail="Extension already registered to another user")
        
        if not existing or "id" not in existing:
            raise HTTPException(status_code=500, detail="Found partial browser record but missing ID")
            
        # Generate new token for existing browser
        token = create_browser_token(user_id, existing["id"], request.extension_id)
        token_hashed = hash_token(token)
        
        # Update token hash
        client = await _get_db_client()
        await client.table("user_browsers").update({
            "token_hash": token_hashed,
            "browser_info": request.browser_info or existing.get("browser_info", {}),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", existing["id"]).execute()
        
        return RegisterBrowserResponse(browser=existing, token=token)
    
    # Create new browser record
    browser = await register_browser(
        user_id=user_id,
        extension_id=request.extension_id,
        browser_info=request.browser_info or {},
        token_hash="placeholder",  # Will update below
        name=request.name,
    )
    
    if not browser or "id" not in browser:
        logger.error(f"🔌 [BROWSER_EXT] register_browser_endpoint: register_browser returned None or missing ID for user {user_id}")
        raise HTTPException(status_code=500, detail="Failed to create browser record in database")
        
    # Generate token
    token = create_browser_token(user_id, browser["id"], request.extension_id)
    token_hashed = hash_token(token)
    
    # Update with real token hash
    client = await _get_db_client()
    await client.table("user_browsers").update({
        "token_hash": token_hashed,
    }).eq("id", browser["id"]).execute()
    
    browser["token_hash"] = token_hashed
    
    logger.info(f"Registered browser {browser['id']} for user {user_id}")
    
    return RegisterBrowserResponse(browser=browser, token=token)


@router.delete("/user/browsers/{browser_id}")
async def delete_browser_endpoint(
    browser_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a registered browser."""
    user_id = user["user_id"]
    
    # Verify ownership
    browser = await get_browser_by_id(browser_id)
    if not browser:
        raise HTTPException(status_code=404, detail="Browser not found")
    if browser["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete from database
    client = await _get_db_client()
    await client.table("user_browsers").delete().eq("id", browser_id).execute()
    
    # Remove session if connected
    session = session_manager.get_session_by_browser_id(browser_id)
    if session:
        session_manager.remove_session(session.session_id)
    
    logger.info(f"Deleted browser {browser_id}")
    
    return {"success": True}


class UpdateBrowserRequest(BaseModel):
    """Request to update browser details."""
    name: str


@router.patch("/user/browsers/{browser_id}")
async def update_browser_endpoint(
    browser_id: str,
    request: UpdateBrowserRequest,
    user: dict = Depends(get_current_user),
):
    """Update a registered browser's details."""
    user_id = user["user_id"]
    
    # Verify ownership
    browser = await get_browser_by_id(browser_id)
    if not browser:
        raise HTTPException(status_code=404, detail="Browser not found")
    if browser["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update in database
    client = await _get_db_client()
    result = await client.table("user_browsers").update({
        "name": request.name
    }).eq("id", browser_id).execute()
    
    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=500, detail="Failed to update browser")
    
    updated_browser = result.data[0]
    logger.info(f"Updated browser {browser_id} name to '{request.name}'")
    
    return {"browser": updated_browser}


@router.patch("/threads/{thread_id}/browser")
async def set_thread_browser_endpoint(
    thread_id: str,
    request: SetThreadBrowserRequest,
    user: dict = Depends(get_current_user),
):
    """Set the browser for a thread."""
    user_id = user["user_id"]
    
    # Verify browser ownership
    browser = await get_browser_by_id(request.browser_id)
    if not browser:
        raise HTTPException(status_code=404, detail="Browser not found")
    if browser["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update thread metadata
    client = await _get_db_client()
    await client.table("threads").update({
        "metadata": {"browser_id": request.browser_id}
    }).eq("thread_id", thread_id).execute()
    
    return {"success": True, "browser_id": request.browser_id}


@router.delete("/threads/{thread_id}/browser")
async def clear_thread_browser_endpoint(
    thread_id: str,
    user: dict = Depends(get_current_user),
):
    """Clear the browser selection for a thread."""
    # Update thread metadata to remove browser_id
    client = await _get_db_client()
    await client.table("threads").update({
        "metadata": {"browser_id": None}
    }).eq("thread_id", thread_id).execute()
    
    return {"success": True}


@router.get("/user/browsers/{browser_id}/screenshot")
async def get_browser_screenshot_endpoint(
    browser_id: str,
    user: dict = Depends(get_current_user),
):
    """Fetch a live screenshot from a connected browser extension."""
    user_id = user["user_id"]
    
    # Verify ownership
    browser = await get_browser_by_id(browser_id)
    if not browser:
        raise HTTPException(status_code=404, detail="Browser not found")
    if browser["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if online
    if not await session_manager.is_browser_online(browser_id):
        raise HTTPException(status_code=400, detail="Browser is offline")
    
    # Request screenshot
    try:
        result = await send_browser_command(
            browser_id=browser_id,
            action="screenshot",
            params={},
            timeout_ms=5000, # Fast timeout for UI polish
        )
        
        if result and result.success:
            return result.data
        else:
            error_msg = result.error if result else "Failed to get screenshot"
            raise HTTPException(status_code=500, detail=error_msg)
            
    except Exception as e:
        logger.error(f"Error relaying screenshot from extension: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/threads/{thread_id}/browser")
async def get_thread_browser_endpoint(
    thread_id: str,
    user: dict = Depends(get_current_user),
):
    """Get the browser ID for a thread."""
    client = await _get_db_client()
    result = await client.table("threads").select("metadata").eq("thread_id", thread_id).maybe_single().execute()
    
    if result is None:
        logger.error(f"🔌 [BROWSER_EXT] get_thread_browser_endpoint({thread_id}): execute() returned None")
        return {"browser_id": None}
        
    if result is None or result.data is None:
        return {"browser_id": None}
    
    metadata = result.data.get("metadata") or {}
    return {"browser_id": metadata.get("browser_id")}


# ========== Exports ==========

__all__ = [
    "router",
    "session_manager",
    "ExtensionSession",
    "ExtensionSessionManager",
    "send_browser_command",
    "create_browser_token",
    "verify_browser_token",
    "hash_token",
    "get_user_browsers",
    "register_browser",
    "BrowserCommand",
    "CommandResult",
]
