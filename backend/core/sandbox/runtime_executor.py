"""
Runtime Executor for Multi-Language Code Execution

Handles execution of Python, Node.js, and terminal commands via PTY sessions.
"""

import shlex
import asyncio
import time
from typing import Tuple
from daytona_sdk import AsyncSandbox
from core.sandbox.pty_manager import PTYSession
from core.sandbox.output_processor import OutputProcessor
from core.utils.logger import logger


# Node.js evaluation script (based on Agent Zero's implementation)
NODE_EVAL_SCRIPT = """#!/usr/bin/env node

const vm = require('vm');
const path = require('path');
const Module = require('module');

// Enhance `require` to search CWD first, then globally
function customRequire(moduleName) {
  try {
    // Try resolving from CWD's node_modules
    const cwdPath = require.resolve(moduleName, { paths: [path.join(process.cwd(), 'node_modules')] });
    return require(cwdPath);
  } catch (cwdErr) {
    try {
      // Try resolving as a global module
      return require(moduleName);
    } catch (globalErr) {
      console.error(`Cannot find module: ${moduleName}`);
      throw globalErr;
    }
  }
}

// Create the VM context
const context = vm.createContext({
  ...global,
  require: customRequire,
  __filename: path.join(process.cwd(), 'eval.js'),
  __dirname: process.cwd(),
  module: { exports: {} },
  exports: module.exports,
  console: console,
  process: process,
  Buffer: Buffer,
  setTimeout: setTimeout,
  setInterval: setInterval,
  setImmediate: setImmediate,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval,
  clearImmediate: clearImmediate,
});

// Retrieve the code from the command-line argument
const code = process.argv[2];

const wrappedCode = `
  (async function() {
    try {
      const __result__ = await eval(${JSON.stringify(code)});
      if (__result__ !== undefined) console.log('Out[1]:', __result__);
    } catch (error) {
      console.error(error);
    }
  })();
`;

vm.runInContext(wrappedCode, context, {
  filename: 'eval.js',
  lineOffset: -2,
  columnOffset: 0,
}).catch(console.error);
"""


# Timeout configurations
CODE_EXEC_TIMEOUTS = {
    "first_output_timeout": 30,    # Wait for first output
    "idle_timeout": 2.0,            # Time between output chunks
    "max_exec_timeout": 180,        # Hard cap on execution
}

OUTPUT_POLL_TIMEOUTS = {
    "first_output_timeout": 90,
    "idle_timeout": 5.0,
    "max_exec_timeout": 300,
}


class RuntimeExecutor:
    """
    Execute code in different runtimes (Python, Node.js, Terminal).

    Uses PTY sessions for interactive execution and maintains state between calls.
    """

    def __init__(self, sandbox: AsyncSandbox):
        """
        Initialize runtime executor.

        Args:
            sandbox: Daytona sandbox to execute code in
        """
        self.sandbox = sandbox
        self._ipython_checked = False
        self._node_eval_created = False

    async def execute_python(
        self,
        session: PTYSession,
        code: str
    ) -> Tuple[str, dict]:
        """
        Execute Python code via ipython.

        Args:
            session: PTY session to use
            code: Python code to execute

        Returns:
            Tuple of (output, status_dict)
        """
        # Ensure ipython is available
        await self._ensure_ipython(session)

        # Escape code for shell
        escaped_code = shlex.quote(code)

        # Send command
        command = f"ipython -c {escaped_code}"
        await session.pty_handle.send_input(f"{command}\n")

        logger.debug(f"Executing Python code: {code[:100]}...")

        # Collect output
        output, status = await self._collect_output(
            session,
            prefix=f"python> {code[:80]}\n\n",
            timeouts=CODE_EXEC_TIMEOUTS
        )

        return output, status

    async def execute_nodejs(
        self,
        session: PTYSession,
        code: str
    ) -> Tuple[str, dict]:
        """
        Execute Node.js code via eval script.

        Args:
            session: PTY session to use
            code: JavaScript/TypeScript code to execute

        Returns:
            Tuple of (output, status_dict)
        """
        # Ensure node eval script exists
        await self._ensure_node_eval_script()

        # Escape code for shell
        escaped_code = shlex.quote(code)

        # Send command
        command = f"node /tmp/node_eval.js {escaped_code}"
        await session.pty_handle.send_input(f"{command}\n")

        logger.debug(f"Executing Node.js code: {code[:100]}...")

        # Collect output
        output, status = await self._collect_output(
            session,
            prefix=f"node> {code[:80]}\n\n",
            timeouts=CODE_EXEC_TIMEOUTS
        )

        return output, status

    async def execute_terminal(
        self,
        session: PTYSession,
        command: str
    ) -> Tuple[str, dict]:
        """
        Execute terminal command.

        Args:
            session: PTY session to use
            command: Shell command to execute

        Returns:
            Tuple of (output, status_dict)
        """
        # Send command directly
        await session.pty_handle.send_input(f"{command}\n")

        logger.debug(f"Executing terminal command: {command[:100]}...")

        # Collect output
        output, status = await self._collect_output(
            session,
            prefix=f"$ {command[:80]}\n\n",
            timeouts=CODE_EXEC_TIMEOUTS
        )

        return output, status

    async def poll_output(
        self,
        session: PTYSession
    ) -> Tuple[str, dict]:
        """
        Poll output from a running session (for long-running processes).

        Args:
            session: PTY session to poll

        Returns:
            Tuple of (output, status_dict)
        """
        logger.debug(f"Polling output from session {session.session_id}")

        output, status = await self._collect_output(
            session,
            prefix="",
            timeouts=OUTPUT_POLL_TIMEOUTS
        )

        return output, status

    async def _collect_output(
        self,
        session: PTYSession,
        prefix: str = "",
        timeouts: dict = None
    ) -> Tuple[str, dict]:
        """
        Collect output from PTY session with intelligent timeout handling.

        Args:
            session: PTY session to read from
            prefix: Prefix to add to output
            timeouts: Timeout configuration dict

        Returns:
            Tuple of (output_string, status_dict)
        """
        timeouts = timeouts or CODE_EXEC_TIMEOUTS
        start_time = time.time()
        last_output_time = start_time
        full_output = ""
        got_output = False

        try:
            while True:
                await asyncio.sleep(0.1)

                # Try to read output with short timeout
                try:
                    chunk = await asyncio.wait_for(
                        self._read_chunk(session),
                        timeout=0.5
                    )

                    if chunk:
                        full_output += chunk
                        last_output_time = time.time()
                        got_output = True

                        # Check for shell prompt (command completed)
                        if OutputProcessor.detect_prompt(full_output):
                            cleaned = OutputProcessor.normalize_output(full_output)
                            status = OutputProcessor.get_command_status(cleaned)
                            return prefix + cleaned, status

                except asyncio.TimeoutError:
                    # No chunk available
                    pass

                now = time.time()

                # Check max execution timeout
                if now - start_time > timeouts["max_exec_timeout"]:
                    cleaned = OutputProcessor.normalize_output(full_output)
                    status = OutputProcessor.get_command_status(cleaned)
                    status["timeout"] = "max_execution"
                    return prefix + cleaned, status

                # Check first output timeout
                if not got_output and now - start_time > timeouts["first_output_timeout"]:
                    cleaned = OutputProcessor.normalize_output(full_output)
                    status = OutputProcessor.get_command_status(cleaned)
                    status["timeout"] = "no_output"
                    return prefix + cleaned, status

                # Check idle timeout
                if got_output and now - last_output_time > timeouts["idle_timeout"]:
                    # Check for dialog prompt
                    if OutputProcessor.detect_dialog(full_output):
                        cleaned = OutputProcessor.normalize_output(full_output)
                        status = OutputProcessor.get_command_status(cleaned)
                        status["timeout"] = "idle"
                        return prefix + cleaned, status

                    # Otherwise, command completed or paused
                    cleaned = OutputProcessor.normalize_output(full_output)
                    status = OutputProcessor.get_command_status(cleaned)
                    status["timeout"] = "idle"
                    return prefix + cleaned, status

        except Exception as e:
            logger.error(f"Error collecting output: {e}")
            cleaned = OutputProcessor.normalize_output(full_output)
            status = OutputProcessor.get_command_status(cleaned)
            status["error"] = str(e)
            return prefix + cleaned, status

    async def _read_chunk(self, session: PTYSession) -> str:
        """
        Read a single chunk of output from PTY.

        Args:
            session: PTY session to read from

        Returns:
            Output chunk (may be empty)
        """
        chunks = []

        # Use async iteration with a short read
        async def read_one():
            async for chunk in session.pty_handle:
                chunks.append(chunk)
                break  # Read just one chunk

        try:
            await asyncio.wait_for(read_one(), timeout=0.1)
        except asyncio.TimeoutError:
            pass

        return ''.join(chunks)

    async def _ensure_ipython(self, session: PTYSession):
        """
        Ensure ipython is installed in the sandbox.

        Args:
            session: PTY session to use for installation
        """
        if self._ipython_checked:
            return

        logger.info("Checking ipython installation...")

        # Check if ipython is available
        await session.pty_handle.send_input("which ipython || echo 'NOT_INSTALLED'\n")

        # Wait for response
        await asyncio.sleep(1.0)

        output = await self._read_chunk(session)

        if "NOT_INSTALLED" in output:
            logger.info("Installing ipython...")

            # Install ipython
            await session.pty_handle.send_input("pip install -q ipython\n")

            # Wait for installation to complete
            await asyncio.sleep(5.0)

            # Drain installation output
            await self._read_chunk(session)

            logger.info("ipython installed successfully")

        self._ipython_checked = True

    async def _ensure_node_eval_script(self):
        """
        Ensure Node.js eval script exists in sandbox at /tmp/node_eval.js.
        """
        if self._node_eval_created:
            return

        logger.info("Creating Node.js eval script...")

        try:
            # Write the eval script to sandbox filesystem
            await self.sandbox.fs.write_file(
                "/tmp/node_eval.js",
                NODE_EVAL_SCRIPT
            )

            # Make it executable
            from daytona_sdk import SessionExecuteRequest
            session_id = "temp-setup"

            # Create temporary session
            await self.sandbox.process.create_session(session_id)

            # Make script executable
            req = SessionExecuteRequest(
                command="chmod +x /tmp/node_eval.js",
                var_async=False
            )

            await self.sandbox.process.execute_session_command(
                session_id=session_id,
                req=req
            )

            # Cleanup temp session
            await self.sandbox.process.delete_session(session_id)

            self._node_eval_created = True
            logger.info("Node.js eval script created successfully")

        except Exception as e:
            logger.error(f"Error creating Node.js eval script: {e}")
            raise
