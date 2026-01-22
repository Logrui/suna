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

def get_worker_id():
    """Get a unique ID for the current process/worker."""
    hostname = os.getenv("HOSTNAME", "worker")
    return f"{hostname}_{os.getpid()}"

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


class StreamChunkMessage(BaseModel):
    """Extension → Backend: Real-time screenshot frame."""
    type: str = "stream_chunk"
    browser_id: str
    screenshot_base64: str
    url: Optional[str] = None
    title: Optional[str] = None
    timestamp: int


class InteractionCommand(BaseModel):
    """Backend → Extension: Real-time user interaction (click, key, etc.)."""
    type: str = "interaction"
    id: str
    session_id: str
    action: str  # click, key_down, key_up, mouse_move, scroll
    params: Dict[str, Any]
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
        self._relay_task: Optional[asyncio.Task] = None
        self._is_running = False
        self.worker_id = get_worker_id()

    async def start(self):
        """Start the session manager and its background tasks."""
        if self._is_running:
            return
        self._is_running = True
        # Ensure worker_id is correct for this process (eval again at startup)
        self.worker_id = get_worker_id()
        self._relay_task = asyncio.create_task(self._listen_for_relayed_commands())
        logger.info(f"🔌 [SESSION_MGR] Manager started (worker_id={self.worker_id})")

    async def stop(self):
        """Stop the session manager and its background tasks."""
        self._is_running = False
        if self._relay_task:
            self._relay_task.cancel()
            try:
                await self._relay_task
            except asyncio.CancelledError:
                pass
        logger.info(f"🔌 [SESSION_MGR] Manager stopped (worker_id={self.worker_id})")

    async def _listen_for_relayed_commands(self):
        """Listen for commands from other workers via Redis Pub/Sub."""
        channel = f"browser:relay:commands:{self.worker_id}"
        logger.debug(f"🔌 [SESSION_MGR] Listening for relayed commands on {channel}")
        
        while self._is_running:
            try:
                client = await redis_service.get_client()
                pubsub = client.pubsub()
                await pubsub.subscribe(channel)
                
                async for message in pubsub.listen():
                    if not self._is_running:
                        break
                    
                    if message['type'] == 'message':
                        try:
                            data = json.loads(message['data'])
                            asyncio.create_task(self._handle_relayed_command(data))
                        except Exception as e:
                            logger.error(f"🔌 [SESSION_MGR] Error processing relayed command message: {e}")
                
                await pubsub.unsubscribe(channel)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"🔌 [SESSION_MGR] Command relay subscription failed, retrying: {e}")
                await asyncio.sleep(5)

    async def _handle_relayed_command(self, data: dict):
        """Process a command received via relay and publish result back."""
        browser_id = data.get("browser_id")
        relay_id = data.get("relay_id")
        action = data.get("action")
        params = data.get("params")
        timeout_ms = data.get("timeout_ms", COMMAND_TIMEOUT_MS)
        
        logger.debug(f"🔌 [SESSION_MGR] Handling relayed command {relay_id} for browser_id={browser_id}")
        
        session = self.get_session_by_browser_id(browser_id)
        if not session:
            logger.warning(f"🔌 [SESSION_MGR] Relayed command {relay_id}: No local session for browser {browser_id}")
            return # Should we notify the sender? The sender has its own timeout.
            
        try:
            command = BrowserCommand(
                type="command",
                id=str(uuid.uuid4()),
                session_id=session.session_id,
                action=action,
                params=params or {},
                timeout_ms=timeout_ms,
                timestamp=int(time.time() * 1000),
            )
            
            result = await session.send_command(command)
            
            # Send result back via another Pub/Sub channel
            client = await redis_service.get_client()
            await client.publish(f"browser:relay:results:{relay_id}", result.model_dump_json())
            logger.debug(f"🔌 [SESSION_MGR] Published result for relayed command {relay_id}")
            
        except Exception as e:
            logger.error(f"🔌 [SESSION_MGR] Error executing relayed command {relay_id}: {e}")
            # If we fail, we could publish an error result, but the sender's wait_for will time out anyway.
    
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
                "worker_id": self.worker_id,
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

    async def get_browser_worker_id(self, browser_id: str) -> Optional[str]:
        """Get the ID of the worker that currently handles this browser's session."""
        try:
            key = f"browser:session:{browser_id}"
            client = await redis_service.get_client()
            data = await client.hgetall(key)
            return data.get("worker_id") if data else None
        except Exception as e:
            logger.warning(f"🔌 [SESSION_MGR] Failed to get worker_id from Redis: {e}")
            return None


# Global session manager singleton
session_manager = ExtensionSessionManager()

@router.on_event("startup")
async def startup_session_manager():
    await session_manager.start()

@router.on_event("shutdown")
async def shutdown_session_manager():
    await session_manager.stop()


# ========== Command Sending Utility ==========

async def send_browser_command(
    browser_id: str,
    action: str,
    params: Dict[str, Any] = None,
    timeout_ms: int = COMMAND_TIMEOUT_MS
) -> Optional[CommandResult]:
    """
    Send a command to a connected browser extension, potentially across workers.
    """
    # 1. Try local session first (optimization)
    session = session_manager.get_session_by_browser_id(browser_id)
    if session:
        command = BrowserCommand(
            type="command",
            id=str(uuid.uuid4()),
            session_id=session.session_id,
            action=action,
            params=params or {},
            timeout_ms=timeout_ms,
            timestamp=int(time.time() * 1000),
        )
        
        logger.info(f"🔌 Sending command {command.id} ({action}) to browser {browser_id} (local)")
        result = await session.send_command(command)
        logger.info(f"🔌 Command {command.id} completed: success={result.success}")
        return result
    
    # 2. Not local? Try relaying via Redis Pub/Sub
    target_worker_id = await session_manager.get_browser_worker_id(browser_id)
    if not target_worker_id:
        logger.warning(f"🔌 No active session found in Redis for browser_id: {browser_id}")
        return None
        
    local_worker_id = get_worker_id()
    if target_worker_id == local_worker_id:
        # Redis says it's ours, but local check failed - must be disconnecting
        logger.warning(f"🔌 Redis says browser {browser_id} is on this worker ({local_worker_id}), but no local session found.")
        return None

    # Relay command to the target worker
    relay_id = str(uuid.uuid4())
    command_data = {
        "relay_id": relay_id,
        "browser_id": browser_id,
        "action": action,
        "params": params or {},
        "timeout_ms": timeout_ms
    }
    
    logger.info(f"🔌 Relaying command {relay_id} ({action}) to browser {browser_id} on worker {target_worker_id}")
    
    client = await redis_service.get_client()
    pubsub = client.pubsub()
    result_channel = f"browser:relay:results:{relay_id}"
    await pubsub.subscribe(result_channel)
    
    try:
        # Publish command to target worker
        await client.publish(f"browser:relay:commands:{target_worker_id}", json.dumps(command_data))
        
        # Wait for result message
        timeout_seconds = (timeout_ms / 1000) + 1.0 # Buffer for relay
        start_time = time.time()
        
        while time.time() - start_time < timeout_seconds:
            # Check for message with short sleep to avoid CPU spinning but responsiveness
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=timeout_seconds)
            if message and message['type'] == 'message':
                result_data = json.loads(message['data'])
                result = CommandResult(**result_data)
                logger.info(f"🔌 Relayed command {relay_id} completed: success={result.success}")
                return result
            
        logger.warning(f"🔌 Relayed command {relay_id} timed out waiting for response from worker {target_worker_id}")
        raise TimeoutError(f"Relayed command timed out after {timeout_ms}ms")
        
    finally:
        await pubsub.unsubscribe(result_channel)
        await pubsub.close()


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

@router.websocket("/ws/browser/{browser_id}/stream")
async def browser_stream_websocket(websocket: WebSocket, browser_id: str):
    """Frontend WebSocket for receiving real-time browser stream frames."""
    await websocket.accept()
    
    # Optional: Verify user session here (from cookie or token)
    
    logger.info(f"📹 Frontend connected to stream for browser {browser_id}")
    
    pubsub = None
    listen_task = None
    frame_count = 0
    
    try:
        client = await redis_service.get_client()
        pubsub = client.pubsub()
        channel = f"browser:stream:{browser_id}"
        await pubsub.subscribe(channel)
        logger.debug(f"📹 Subscribed to Redis channel: {channel}")
        
        # Binary or text relay loop
        async def listen_to_redis():
            nonlocal frame_count
            try:
                async for message in pubsub.listen():
                    if message['type'] == 'message':
                        frame_count += 1
                        if frame_count <= 5 or frame_count % 100 == 0:
                            logger.debug(f"📹 Relaying frame #{frame_count} to frontend for browser {browser_id}")
                        await websocket.send_text(message['data'])
            except asyncio.CancelledError:
                logger.debug(f"📹 Redis listener cancelled for browser {browser_id}")
                raise
            except Exception as e:
                logger.error(f"📹 Error in Redis listener for browser {browser_id}: {e}")
        
        # Start listening in background
        listen_task = asyncio.create_task(listen_to_redis())
        
        # Listen for messages from frontend (interactions and pings)
        while True:
            try:
                # Use timeout to detect stale connections
                data = await asyncio.wait_for(websocket.receive_json(), timeout=60.0)
                msg_type = data.get("type")
                
                if msg_type == "ping":
                    # Respond to keepalive ping
                    await websocket.send_json({"type": "pong"})
                elif msg_type == "interaction":
                    # Route interaction to the extension
                    logger.debug(f"📹 Routing interaction to extension for browser {browser_id}")
                    await send_browser_command(
                        browser_id=browser_id,
                        action="interaction",
                        params=data.get("params", {})
                    )
            except asyncio.TimeoutError:
                # No message from frontend in 60s, send a ping to keep connection alive
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    # Connection dead
                    break
                
    except WebSocketDisconnect:
        logger.info(f"📹 Frontend disconnected from stream for browser {browser_id} (frames sent: {frame_count})")
    except Exception as e:
        logger.error(f"📹 Error in browser stream WebSocket for {browser_id}: {e}")
    finally:
        if listen_task:
            listen_task.cancel()
            try:
                await listen_task
            except asyncio.CancelledError:
                pass
        if pubsub:
            await pubsub.unsubscribe()
            await pubsub.close()


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
            
            elif msg_type == "stream_chunk":
                # Real-time frame from extension - broadcast via Redis
                browser_id = session.browser_id
                logger.debug(f"📹 Received stream_chunk from extension for browser {browser_id}")
                client = await redis_service.get_client()
                await client.publish(f"browser:stream:{browser_id}", json.dumps(message))
            
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
    
    # Update thread metadata (merging to preserve existing keys)
    client = await _get_db_client()
    
    # Fetch current metadata
    thread_res = await client.table("threads").select("metadata").eq("thread_id", thread_id).maybe_single().execute()
    current_metadata = {}
    if thread_res and thread_res.data:
        current_metadata = thread_res.data.get("metadata") or {}
    
    # Update metadata with new browser_id
    new_metadata = {**current_metadata, "browser_id": request.browser_id}
    
    await client.table("threads").update({
        "metadata": new_metadata
    }).eq("thread_id", thread_id).execute()
    
    return {"success": True, "browser_id": request.browser_id}


@router.delete("/threads/{thread_id}/browser")
async def clear_thread_browser_endpoint(
    thread_id: str,
    user: dict = Depends(get_current_user),
):
    """Clear the browser selection for a thread."""
    # Fetch current metadata
    client = await _get_db_client()
    thread_res = await client.table("threads").select("metadata").eq("thread_id", thread_id).maybe_single().execute()
    
    if thread_res and thread_res.data:
        current_metadata = thread_res.data.get("metadata") or {}
        if "browser_id" in current_metadata:
            # Remove browser_id
            new_metadata = {k: v for k, v in current_metadata.items() if k != "browser_id"}
            
            await client.table("threads").update({
                "metadata": new_metadata
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
            timeout_ms=10000, # Increased timeout
        )
        
        if result and result.success:
            data = result.data or {}
            
            # Optionally store in Supabase for persistence if base64 is present
            screenshot_base64 = data.get("screenshot_base64") or data.get("screenshot")
            if screenshot_base64:
                try:
                    from core.utils.s3_upload_utils import upload_base64_image
                    image_url = await upload_base64_image(
                        base64_data=screenshot_base64,
                        bucket_name="browser-screenshots"
                    )
                    data["image_url"] = image_url
                    logger.debug(f"📸 Live screenshot stored: {image_url}")
                except Exception as upload_err:
                    logger.warning(f"⚠️ Failed to store live screenshot: {upload_err}")
            
            return data
        
        error_msg = result.error if result else "Failed to get screenshot (timeout)"
        
        # Handle specific common errors from extension gracefully
        if "No active tab" in error_msg:
            logger.info(f"🔌 Browser {browser_id} has no active tab to capture")
            raise HTTPException(status_code=404, detail="No active tab in browser")
            
        logger.error(f"❌ Screenshot command failed for browser {browser_id}: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Extension error: {error_msg}")
            
    except HTTPException:
        # Re-raise HTTP exceptions so FastAPI handles them correctly
        raise
    except asyncio.TimeoutError:
        logger.error(f"⌛ Screenshot command timed out for browser {browser_id}")
        raise HTTPException(status_code=504, detail="Browser extension timed out while taking screenshot")
    except Exception as e:
        logger.error(f"💥 Error relaying screenshot from extension: {e}")
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
