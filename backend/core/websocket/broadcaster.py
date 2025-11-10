"""
WebSocket event broadcaster for model loading/unloading status updates.

This module manages broadcasting real-time model status events to all connected
WebSocket clients, enabling real-time UI updates during model operations.
"""

from typing import Dict, Any, Set, Callable, Optional
import asyncio
import json
from core.utils.logger import logger
from datetime import datetime


class ModelEventBroadcaster:
    """Manages broadcasting model events to connected WebSocket clients."""
    
    def __init__(self):
        """Initialize broadcaster with empty client set."""
        self._connected_clients: Set[Any] = set()
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._lock = asyncio.Lock()
        
    async def register_client(self, send_callable: Callable) -> None:
        """
        Register a new WebSocket client for event broadcasts.
        
        Args:
            send_callable: Async function that sends messages to client
                          Example: websocket.send_text(message)
        """
        async with self._lock:
            self._connected_clients.add(send_callable)
            logger.debug(f"Client registered. Total clients: {len(self._connected_clients)}")
    
    async def unregister_client(self, send_callable: Callable) -> None:
        """
        Unregister a WebSocket client from event broadcasts.
        
        Args:
            send_callable: The send function to remove
        """
        async with self._lock:
            self._connected_clients.discard(send_callable)
            logger.debug(f"Client unregistered. Total clients: {len(self._connected_clients)}")
    
    async def broadcast_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """
        Broadcast an event to all connected clients.
        
        Args:
            event_type: Type of event (e.g., "model_loading", "model_loaded")
            data: Event payload dictionary
        """
        event = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            **data
        }
        
        message = json.dumps(event)
        logger.debug(f"Broadcasting {event_type} event to {len(self._connected_clients)} clients")
        
        # Send to all connected clients
        failed_clients = set()
        
        async with self._lock:
            for send_callable in self._connected_clients:
                try:
                    await send_callable(message)
                except Exception as e:
                    logger.error(f"Failed to send event to client: {e}")
                    failed_clients.add(send_callable)
        
        # Remove failed clients
        if failed_clients:
            async with self._lock:
                self._connected_clients -= failed_clients
                logger.debug(f"Removed {len(failed_clients)} failed clients")
    
    def get_connected_count(self) -> int:
        """Get number of currently connected clients."""
        return len(self._connected_clients)


# Global broadcaster instance
_broadcaster: Optional[ModelEventBroadcaster] = None


def get_broadcaster() -> ModelEventBroadcaster:
    """Get or create the global broadcaster instance."""
    global _broadcaster
    if _broadcaster is None:
        _broadcaster = ModelEventBroadcaster()
    return _broadcaster


# Convenience functions for broadcasting specific events

async def broadcast_model_loading(model_id: str, provider: str, estimated_time: int = 15) -> None:
    """Broadcast model_loading event."""
    broadcaster = get_broadcaster()
    await broadcaster.broadcast_event("model_loading", {
        "model_id": model_id,
        "provider": provider,
        "estimated_time": estimated_time
    })


async def broadcast_model_loaded(model_id: str, provider: str, load_time_ms: int) -> None:
    """Broadcast model_loaded event."""
    broadcaster = get_broadcaster()
    await broadcaster.broadcast_event("model_loaded", {
        "model_id": model_id,
        "provider": provider,
        "load_time_ms": load_time_ms
    })


async def broadcast_model_load_failed(model_id: str, provider: str, error: str, error_code: str = "UNKNOWN") -> None:
    """Broadcast model_load_failed event."""
    broadcaster = get_broadcaster()
    await broadcaster.broadcast_event("model_load_failed", {
        "model_id": model_id,
        "provider": provider,
        "error": error,
        "error_code": error_code
    })


async def broadcast_model_unloading(model_id: str, provider: str) -> None:
    """Broadcast model_unloading event."""
    broadcaster = get_broadcaster()
    await broadcaster.broadcast_event("model_unloading", {
        "model_id": model_id,
        "provider": provider
    })
