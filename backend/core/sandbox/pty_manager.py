"""
PTY Session Manager for Daytona Sandboxes

Manages multiple concurrent PTY (pseudo-terminal) sessions within a Daytona sandbox.
Each session maintains independent state, working directory, and shell environment.
"""

import asyncio
from typing import Dict, Optional
from dataclasses import dataclass
from daytona_sdk import AsyncSandbox
from daytona.common.pty import PtySize
from core.utils.logger import logger


@dataclass
class PTYSession:
    """Represents a single PTY session with its state"""
    session_id: int
    pty_handle: any  # Daytona PTY handle
    buffer: str = ""
    running: bool = False
    cwd: str = "/workspace"


class DaytonaPTYManager:
    """
    Manages multiple PTY sessions for a Daytona sandbox.

    Features:
    - Multiple concurrent sessions (0-9)
    - Session persistence across commands
    - Interactive input/output
    - Configurable terminal size
    """

    DEFAULT_COLS = 120
    DEFAULT_ROWS = 40

    def __init__(self, sandbox: AsyncSandbox):
        """
        Initialize PTY manager for a sandbox.

        Args:
            sandbox: AsyncSandbox instance to manage PTYs for
        """
        self.sandbox = sandbox
        self.sessions: Dict[int, PTYSession] = {}

    async def get_or_create_session(
        self,
        session_id: int,
        cols: int = DEFAULT_COLS,
        rows: int = DEFAULT_ROWS
    ) -> PTYSession:
        """
        Get existing PTY session or create new one.

        Args:
            session_id: Session identifier (0-9 typically)
            cols: Terminal columns
            rows: Terminal rows

        Returns:
            PTYSession instance
        """
        if session_id not in self.sessions:
            logger.info(f"Creating new PTY session {session_id}")

            # Create PTY session in Daytona
            pty_handle = await self.sandbox.process.create_pty_session(
                id=f"code-exec-session-{session_id}",
                pty_size=PtySize(cols=cols, rows=rows)
            )

            # Create session object
            session = PTYSession(
                session_id=session_id,
                pty_handle=pty_handle,
                buffer="",
                running=False,
                cwd="/workspace"
            )

            self.sessions[session_id] = session

            # Wait for shell to initialize
            await asyncio.sleep(0.5)

            # Clear initial shell output
            await self._drain_initial_output(session)

            logger.debug(f"PTY session {session_id} created successfully")

        return self.sessions[session_id]

    async def _drain_initial_output(self, session: PTYSession):
        """Drain initial shell prompt and startup messages"""
        try:
            # Try to read initial output with short timeout
            async def read_with_timeout():
                chunks = []
                async for chunk in session.pty_handle:
                    chunks.append(chunk)
                    # Break after getting some output
                    if len(''.join(chunks)) > 50:
                        break
                return ''.join(chunks)

            # Read for up to 1 second
            try:
                initial = await asyncio.wait_for(read_with_timeout(), timeout=1.0)
                logger.debug(f"Drained initial output: {len(initial)} chars")
            except asyncio.TimeoutError:
                logger.debug("No initial output to drain")
        except Exception as e:
            logger.warning(f"Error draining initial output: {e}")

    async def send_input(self, session_id: int, text: str) -> None:
        """
        Send input to PTY session.

        Args:
            session_id: Session to send input to
            text: Text to send (will append newline if not present)
        """
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} does not exist")

        session = self.sessions[session_id]

        # Ensure text ends with newline
        if not text.endswith('\n'):
            text += '\n'

        await session.pty_handle.send_input(text)
        session.running = True

        logger.debug(f"Sent input to session {session_id}: {text[:50]}...")

    async def read_output(
        self,
        session_id: int,
        timeout: float = 30.0,
        idle_timeout: float = 1.0
    ) -> str:
        """
        Read output from PTY session until idle or timeout.

        Args:
            session_id: Session to read from
            timeout: Maximum time to wait for output (seconds)
            idle_timeout: Time to wait for next chunk (seconds)

        Returns:
            Collected output string
        """
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} does not exist")

        session = self.sessions[session_id]
        output_chunks = []
        start_time = asyncio.get_event_loop().time()
        last_output_time = start_time

        try:
            async for chunk in session.pty_handle:
                output_chunks.append(chunk)
                last_output_time = asyncio.get_event_loop().time()

                # Check max timeout
                if last_output_time - start_time > timeout:
                    logger.debug(f"Session {session_id}: Max timeout reached")
                    break

                # Check idle timeout
                await asyncio.sleep(0.1)
                if asyncio.get_event_loop().time() - last_output_time > idle_timeout:
                    logger.debug(f"Session {session_id}: Idle timeout reached")
                    break
        except Exception as e:
            logger.error(f"Error reading output from session {session_id}: {e}")

        output = ''.join(output_chunks)
        session.buffer += output
        session.running = False if output else session.running

        logger.debug(f"Read {len(output)} chars from session {session_id}")
        return output

    async def reset_session(self, session_id: int) -> None:
        """
        Reset (kill and remove) a PTY session.

        Args:
            session_id: Session to reset
        """
        if session_id not in self.sessions:
            logger.warning(f"Cannot reset non-existent session {session_id}")
            return

        session = self.sessions[session_id]

        try:
            # Kill the PTY
            await session.pty_handle.kill()
            logger.info(f"Killed PTY session {session_id}")
        except Exception as e:
            logger.warning(f"Error killing session {session_id}: {e}")

        # Remove from tracking
        del self.sessions[session_id]
        logger.debug(f"Session {session_id} reset successfully")

    async def resize_session(
        self,
        session_id: int,
        cols: int,
        rows: int
    ) -> None:
        """
        Resize PTY session terminal.

        Args:
            session_id: Session to resize
            cols: New column count
            rows: New row count
        """
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} does not exist")

        session = self.sessions[session_id]
        await session.pty_handle.resize(PtySize(cols=cols, rows=rows))

        logger.debug(f"Resized session {session_id} to {cols}x{rows}")

    async def cleanup_all_sessions(self) -> None:
        """Cleanup all PTY sessions."""
        session_ids = list(self.sessions.keys())

        for session_id in session_ids:
            await self.reset_session(session_id)

        logger.info(f"Cleaned up {len(session_ids)} PTY sessions")

    def get_session_info(self, session_id: int) -> Optional[dict]:
        """
        Get information about a session.

        Args:
            session_id: Session to get info for

        Returns:
            Dict with session info or None if not found
        """
        if session_id not in self.sessions:
            return None

        session = self.sessions[session_id]
        return {
            "session_id": session.session_id,
            "running": session.running,
            "cwd": session.cwd,
            "buffer_size": len(session.buffer)
        }

    def list_sessions(self) -> list[int]:
        """
        List all active session IDs.

        Returns:
            List of session IDs
        """
        return list(self.sessions.keys())
