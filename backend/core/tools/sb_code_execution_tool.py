"""
Sandbox Code Execution Tool

Execute Python, Node.js, and terminal commands in isolated sandbox sessions.
Supports multiple concurrent sessions with persistent state.

Based on Agent Zero's code_execution_tool with adaptations for Daytona PTY.
"""

from typing import Optional
from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.thread_manager import ThreadManager
from core.sandbox.pty_manager import DaytonaPTYManager
from core.sandbox.runtime_executor import RuntimeExecutor
from core.utils.logger import logger


@tool_metadata(
    display_name="Code Execution",
    description="Execute Python, Node.js, or terminal commands with session management and interactive capabilities",
    icon="Terminal",
    color="bg-green-100 dark:bg-green-800/50",
    weight=15,
    visible=True,
    usage_guide="""
    Execute code in multiple runtimes with session persistence:

    **Runtimes:**
    - python: Run Python code via ipython REPL
    - nodejs: Execute Node.js/JavaScript code
    - terminal: Run shell commands
    - output: Poll output from long-running processes
    - reset: Restart a session

    **Sessions:**
    Use session parameter (0-9) to maintain independent execution contexts.
    Each session preserves working directory, environment, and shell state.

    **Examples:**

    Execute Python:
    ```json
    {
      "runtime": "python",
      "code": "import os\\nprint(os.getcwd())",
      "session": 0
    }
    ```

    Execute Node.js:
    ```json
    {
      "runtime": "nodejs",
      "code": "console.log('Hello from Node')",
      "session": 0
    }
    ```

    Execute terminal command:
    ```json
    {
      "runtime": "terminal",
      "code": "ls -la /workspace",
      "session": 0
    }
    ```

    Poll long-running process:
    ```json
    {
      "runtime": "output",
      "session": 0
    }
    ```

    Reset session:
    ```json
    {
      "runtime": "reset",
      "session": 0
    }
    ```
    """
)
class SandboxCodeExecutionTool(SandboxToolsBase):
    """
    Execute code in Python, Node.js, or terminal runtimes within a Daytona sandbox.

    Uses PTY (pseudo-terminal) sessions for interactive execution and maintains
    state between commands within the same session.
    """

    def __init__(self, project_id: str, thread_manager: Optional[ThreadManager] = None):
        super().__init__(project_id, thread_manager)
        self._pty_manager: Optional[DaytonaPTYManager] = None
        self._runtime_executor: Optional[RuntimeExecutor] = None

    async def _ensure_infrastructure(self) -> tuple[DaytonaPTYManager, RuntimeExecutor]:
        """
        Ensure PTY manager and runtime executor are initialized.

        Returns:
            Tuple of (pty_manager, runtime_executor)
        """
        if not self._pty_manager or not self._runtime_executor:
            # Ensure sandbox is available
            await self._ensure_sandbox()

            # Initialize infrastructure
            self._pty_manager = DaytonaPTYManager(self.sandbox)
            self._runtime_executor = RuntimeExecutor(self.sandbox)

            logger.debug(f"Initialized code execution infrastructure for project {self.project_id}")

        return self._pty_manager, self._runtime_executor

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "execute_code",
            "description": "Execute code in Python, Node.js, or terminal runtime with session management",
            "parameters": {
                "type": "object",
                "properties": {
                    "runtime": {
                        "type": "string",
                        "enum": ["python", "nodejs", "terminal", "output", "reset"],
                        "description": "Runtime to execute code in. Use 'output' to poll long-running processes, 'reset' to restart a session."
                    },
                    "code": {
                        "type": "string",
                        "description": "Code to execute. Not required for 'output' and 'reset' runtimes."
                    },
                    "session": {
                        "type": "integer",
                        "description": "Session number (0-9) for concurrent execution. Each session maintains independent state.",
                        "default": 0,
                        "minimum": 0,
                        "maximum": 9
                    }
                },
                "required": ["runtime"]
            }
        }
    })
    async def execute_code(
        self,
        runtime: str,
        code: Optional[str] = None,
        session: int = 0
    ) -> ToolResult:
        """
        Execute code in the specified runtime.

        Args:
            runtime: Runtime to use (python, nodejs, terminal, output, reset)
            code: Code to execute (not needed for output/reset)
            session: Session number (0-9)

        Returns:
            ToolResult with execution output and status
        """
        # Validate runtime
        runtime = runtime.lower().strip()
        valid_runtimes = ["python", "nodejs", "terminal", "output", "reset"]

        if runtime not in valid_runtimes:
            return self.error_response(
                f"Invalid runtime: {runtime}",
                {"valid_runtimes": valid_runtimes}
            )

        # Validate session number
        if not (0 <= session <= 9):
            return self.error_response(
                f"Invalid session number: {session}. Must be 0-9.",
                {"session": session}
            )

        # Validate code parameter
        if runtime not in ["output", "reset"] and not code:
            return self.error_response(
                f"Code parameter is required for '{runtime}' runtime",
                {"runtime": runtime}
            )

        try:
            # Initialize infrastructure
            pty_manager, runtime_executor = await self._ensure_infrastructure()

            # Get or create PTY session
            pty_session = await pty_manager.get_or_create_session(session)

            # Execute based on runtime
            if runtime == "python":
                output, status = await runtime_executor.execute_python(pty_session, code)
                return self._format_response(output, status, runtime, session, code)

            elif runtime == "nodejs":
                output, status = await runtime_executor.execute_nodejs(pty_session, code)
                return self._format_response(output, status, runtime, session, code)

            elif runtime == "terminal":
                output, status = await runtime_executor.execute_terminal(pty_session, code)
                return self._format_response(output, status, runtime, session, code)

            elif runtime == "output":
                output, status = await runtime_executor.poll_output(pty_session)
                return self._format_response(output, status, runtime, session, None)

            elif runtime == "reset":
                await pty_manager.reset_session(session)
                return self.success_response({
                    "message": f"Session {session} reset successfully",
                    "session": session
                })

        except Exception as e:
            logger.error(f"Code execution error: {str(e)}", exc_info=True)
            return self.error_response(
                f"Execution failed: {str(e)}",
                {
                    "runtime": runtime,
                    "session": session,
                    "code": code[:100] if code else None
                }
            )

    def _format_response(
        self,
        output: str,
        status: dict,
        runtime: str,
        session: int,
        code: Optional[str]
    ) -> ToolResult:
        """
        Format execution response with proper status indicators.

        Args:
            output: Execution output
            status: Status dict from OutputProcessor
            runtime: Runtime that was used
            session: Session number
            code: Code that was executed

        Returns:
            Formatted ToolResult
        """
        # Determine overall status
        if status.get("waiting_input"):
            status_str = "waiting_input"
            message = "Command is waiting for interactive input. Use input_tool to respond."
        elif status.get("completed"):
            status_str = "completed"
            message = "Command completed successfully"
        elif status.get("timeout"):
            status_str = f"timeout_{status['timeout']}"
            message = f"Command paused or timed out ({status['timeout']})"
        elif status.get("has_error"):
            status_str = "error"
            message = "Command completed with errors"
        else:
            status_str = "unknown"
            message = "Command status unknown"

        # Build response data
        response_data = {
            "output": output,
            "status": status_str,
            "message": message,
            "session": session,
            "runtime": runtime,
            "completed": status.get("completed", False),
            "waiting_input": status.get("waiting_input", False),
            "has_error": status.get("has_error", False)
        }

        # Add error message if present
        if status.get("error_message"):
            response_data["error_details"] = status["error_message"]

        # Add code context if provided
        if code:
            response_data["code_snippet"] = code[:100] + ("..." if len(code) > 100 else "")

        # Return success even if command had errors (the tool executed successfully)
        return self.success_response(response_data)

    async def cleanup(self):
        """Cleanup all PTY sessions when tool is destroyed."""
        if self._pty_manager:
            try:
                await self._pty_manager.cleanup_all_sessions()
                logger.info(f"Cleaned up code execution sessions for project {self.project_id}")
            except Exception as e:
                logger.warning(f"Error cleaning up sessions: {e}")
