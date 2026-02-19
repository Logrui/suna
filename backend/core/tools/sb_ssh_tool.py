import asyncio
import json
import base64
import time
import re
from uuid import uuid4
from typing import Optional, Dict, Any, List

from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.agentpress.thread_manager import ThreadManager
from core.tool_output_streaming_context import stream_tool_output, get_tool_output_streaming_context, get_current_tool_call_id
from core.utils.logger import logger

@tool_metadata(
    display_name="SSH Terminal",
    description="Connect to remote servers via SSH from the sandbox",
    icon="Terminal",
    color="bg-slate-800 dark:bg-slate-900",
    is_core=False,
    weight=50,
    visible=True,
    usage_guide="""
### SSH REMOTE ACCESS

**CONNECTING:**
- Use `ssh_connect` to establish a persistent connection
- Supports password and private key authentication
- Returns a `connection_id` to use for subsequent commands

**EXECUTING COMMANDS:**
- Use `ssh_execute` with the `connection_id`
- Commands are executed in a persistent session (cwd is preserved)
- Environment variables are NOT preserved (use explicit exports or source files)
- Output is streamed in real-time

**BEST PRACTICES:**
- Always disconnect when finished using `ssh_disconnect`
- Use `sudo -S` with piped password if root access is needed
- For complex file editing, use `sed` or `echo` to write files
"""
)
class SandboxSSHTool(SandboxToolsBase):
    """Tool for managing SSH connections from the sandbox."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self._dependencies_checked = False

    async def _ensure_dependencies(self):
        """Ensure sshpass and ssh client are installed in the sandbox."""
        if self._dependencies_checked:
            return

        await self._ensure_sandbox()

        # Check if sshpass is installed
        check_cmd = "which sshpass"
        result = await self._execute_simple_command(check_cmd)

        if result['exit_code'] != 0:
            logger.info("Installing sshpass in sandbox...")
            # Try installing sshpass
            # We assume Debian/Ubuntu based image which is standard for Daytona
            install_cmd = "sudo apt-get update && sudo apt-get install -y sshpass openssh-client"
            await self._execute_simple_command(install_cmd)

        self._dependencies_checked = True

    async def _execute_simple_command(self, command: str) -> Dict[str, Any]:
        """Execute a simple non-streaming command in the sandbox."""
        from daytona_sdk import SessionExecuteRequest

        session_id = f"ssh_setup_{str(uuid4())[:8]}"
        try:
            await self.sandbox.process.create_session(session_id)
            req = SessionExecuteRequest(
                command=command,
                var_async=False,
                cwd=self.workspace_path
            )
            response = await self.sandbox.process.execute_session_command(
                session_id=session_id,
                req=req,
                timeout=120
            )
            logs = await self.sandbox.process.get_session_command_logs(
                session_id=session_id,
                command_id=response.cmd_id
            )
            return {
                "output": logs.output if logs else "",
                "exit_code": response.exit_code
            }
        finally:
            try:
                await self.sandbox.process.delete_session(session_id)
            except:
                pass

    async def _save_state(self, connection_id: str, state: Dict):
        """Save connection state to a file in the sandbox."""
        state_file = f"/tmp/ssh_state_{connection_id}.json"
        content = json.dumps(state)
        # Escape single quotes for shell
        content_escaped = content.replace("'", "'\\''")
        cmd = f"echo '{content_escaped}' > {state_file}"
        await self._execute_simple_command(cmd)

    async def _load_state(self, connection_id: str) -> Optional[Dict]:
        """Load connection state from the sandbox."""
        state_file = f"/tmp/ssh_state_{connection_id}.json"
        cmd = f"cat {state_file}"
        result = await self._execute_simple_command(cmd)
        if result['exit_code'] == 0 and result['output'].strip():
            try:
                return json.loads(result['output'])
            except:
                return None
        return None

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "ssh_connect",
            "description": "Establish a new persistent SSH connection to a remote host.",
            "parameters": {
                "type": "object",
                "properties": {
                    "host": {
                        "type": "string",
                        "description": "Hostname or IP address of the remote server"
                    },
                    "username": {
                        "type": "string",
                        "description": "Username for authentication"
                    },
                    "password": {
                        "type": "string",
                        "description": "Password for authentication (optional if using private key)"
                    },
                    "private_key": {
                        "type": "string",
                        "description": "Private key content (PEM format) for authentication (optional)"
                    },
                    "port": {
                        "type": "integer",
                        "description": "SSH port (default: 22)",
                        "default": 22
                    }
                },
                "required": ["host", "username"],
                "additionalProperties": False
            }
        }
    })
    async def ssh_connect(
        self,
        host: str,
        username: str,
        password: Optional[str] = None,
        private_key: Optional[str] = None,
        port: int = 22
    ) -> ToolResult:
        try:
            await self._ensure_dependencies()

            connection_id = str(uuid4())[:8]
            socket_path = f"/tmp/ssh_mux_{connection_id}"

            # Setup command parts
            cmd_parts = []

            # Handle Private Key
            if private_key:
                key_file = f"/tmp/ssh_key_{connection_id}"
                # Write key file
                # Use base64 to avoid quoting issues
                b64_key = base64.b64encode(private_key.encode()).decode()
                write_key_cmd = f"echo {b64_key} | base64 -d > {key_file} && chmod 600 {key_file}"
                await self._execute_simple_command(write_key_cmd)
                cmd_parts.extend(["-i", key_file])

            # Common SSH options
            # -M: Master mode for connection sharing
            # -S: Control socket path
            # -f: Fork to background
            # -N: No command (just connection)
            # -o StrictHostKeyChecking=no: Auto-accept keys
            # -o UserKnownHostsFile=/dev/null: Don't clutter known_hosts
            ssh_opts = f"-M -S {socket_path} -f -N -p {port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

            target = f"{username}@{host}"
            ssh_cmd = f"ssh {ssh_opts} {target}"

            if private_key:
                 ssh_cmd = f"ssh {ssh_opts} -i /tmp/ssh_key_{connection_id} {target}"

            # Handle Password with sshpass
            if password:
                # Use environment variable to pass password safely to sshpass
                # But to run it in sandbox we need to construct the command carefully
                # sshpass -p 'password' ssh ...
                # Escape single quotes in password
                pass_escaped = password.replace("'", "'\\''")
                full_cmd = f"sshpass -p '{pass_escaped}' {ssh_cmd}"
            else:
                full_cmd = ssh_cmd

            logger.info(f"Establishing SSH connection to {target}...")
            result = await self._execute_simple_command(full_cmd)

            # Verify connection by checking if socket exists
            check_socket = f"test -S {socket_path} && echo EXISTS"
            check_result = await self._execute_simple_command(check_socket)

            if "EXISTS" not in check_result['output']:
                # Attempt to get error details
                return self.fail_response(f"Failed to establish connection. Exit code: {result['exit_code']}. Output: {result['output']}. Ensure credentials and host are correct.")

            # Initial State
            state = {
                "host": host,
                "username": username,
                "port": port,
                "cwd": "~",  # Start at home
                "socket_path": socket_path,
                "key_file": f"/tmp/ssh_key_{connection_id}" if private_key else None
            }
            await self._save_state(connection_id, state)

            return self.success_response({
                "connection_id": connection_id,
                "status": "connected",
                "target": target
            })

        except Exception as e:
            return self.fail_response(f"Error connecting: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "ssh_execute",
            "description": "Execute a command on an active SSH connection.",
            "parameters": {
                "type": "object",
                "properties": {
                    "connection_id": {
                        "type": "string",
                        "description": "The ID of the active SSH connection"
                    },
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute"
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Timeout in seconds (default: 300)",
                        "default": 300
                    }
                },
                "required": ["connection_id", "command"],
                "additionalProperties": False
            }
        }
    })
    async def ssh_execute(
        self,
        connection_id: str,
        command: str,
        timeout: int = 300
    ) -> ToolResult:
        try:
            state = await self._load_state(connection_id)
            if not state:
                return self.fail_response("Connection ID not found or session expired. Please reconnect.")

            cwd = state.get('cwd', '~')
            socket_path = state.get('socket_path')

            # Verify socket exists
            check_socket = f"test -S {socket_path}"
            check_result = await self._execute_simple_command(check_socket)
            if check_result['exit_code'] != 0:
                return self.fail_response("SSH connection lost. Please reconnect.")

            # Construct remote command
            # We want to run: cd {cwd} && {command}
            # And then capture the new CWD
            # We use base64 for the user command to avoid any quoting hell
            b64_cmd = base64.b64encode(command.encode()).decode()

            # The remote script:
            # 1. cd to current working dir
            # 2. Decode and eval the command
            # 3. Print the new PWD marker
            remote_script = (
                f"cd {cwd} && "
                f"echo {b64_cmd} | base64 -d | bash; "
                f"echo __SSH_PWD: $(pwd)"
            )

            # We wrap the whole thing in base64 again to pass it cleanly to ssh
            # ssh -S socket host "echo {remote_script_b64} | base64 -d | bash"
            b64_remote_script = base64.b64encode(remote_script.encode()).decode()

            target = f"{state['username']}@{state['host']}"
            full_ssh_cmd = f"ssh -S {socket_path} {target} \"echo {b64_remote_script} | base64 -d | bash\""

            # Execute with streaming (similar to SandboxShellTool)
            result = await self._execute_streaming(full_ssh_cmd, timeout, connection_id)

            if not result['success']:
                return self.fail_response(result['error'])

            output = result['output']

            # Parse new CWD
            new_cwd = cwd
            if "__SSH_PWD: " in output:
                parts = output.split("__SSH_PWD: ")
                new_cwd = parts[-1].strip()
                # Remove the marker line from output
                output = parts[0].strip()

            # Update state
            state['cwd'] = new_cwd
            await self._save_state(connection_id, state)

            return self.success_response({
                "output": output,
                "cwd": new_cwd,
                "exit_code": result['exit_code']
            })

        except Exception as e:
            return self.fail_response(f"Error executing SSH command: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "ssh_disconnect",
            "description": "Close an active SSH connection.",
            "parameters": {
                "type": "object",
                "properties": {
                    "connection_id": {
                        "type": "string",
                        "description": "The ID of the connection to close"
                    }
                },
                "required": ["connection_id"],
                "additionalProperties": False
            }
        }
    })
    async def ssh_disconnect(self, connection_id: str) -> ToolResult:
        try:
            state = await self._load_state(connection_id)
            if not state:
                return self.fail_response("Connection ID not found.")

            socket_path = state.get('socket_path')
            target = f"{state['username']}@{state['host']}"

            # Close connection
            cmd = f"ssh -S {socket_path} -O exit {target}"
            await self._execute_simple_command(cmd)

            # Cleanup key file
            if state.get('key_file'):
                await self._execute_simple_command(f"rm {state['key_file']}")

            # Cleanup state file
            await self._execute_simple_command(f"rm /tmp/ssh_state_{connection_id}.json")

            return self.success_response("Disconnected successfully.")

        except Exception as e:
            return self.fail_response(f"Error disconnecting: {str(e)}")

    async def _execute_streaming(self, command: str, timeout: int, connection_id: str) -> Dict[str, Any]:
        """Execute command using PTY for streaming."""
        tool_output_ctx = get_tool_output_streaming_context()
        tool_call_id = get_current_tool_call_id() or f"ssh_{str(uuid4())[:8]}"

        output_buffer = []

        async def on_pty_data(data: bytes):
            try:
                text = data.decode("utf-8", errors="replace")
                output_buffer.append(text)
                if tool_output_ctx:
                    await stream_tool_output(
                        tool_call_id=tool_call_id,
                        output_chunk=text,
                        is_final=False,
                        tool_name="ssh_execute"
                    )
            except Exception:
                pass

        try:
            from daytona_sdk.common.pty import PtySize
            pty_id = f"ssh-pty-{str(uuid4())[:8]}"

            pty_handle = await self.sandbox.process.create_pty_session(
                id=pty_id,
                on_data=on_pty_data,
                pty_size=PtySize(cols=120, rows=40)
            )

            marker = f"__CMD_DONE_{str(uuid4())[:8]}__"
            full_command = f"{command}; echo '{marker}' $?\n"

            await pty_handle.send_input(full_command)

            # Wait for completion
            start_time = time.time()
            exit_code = 0
            completed = False

            while (time.time() - start_time) < timeout:
                await asyncio.sleep(0.1)
                current_output = "".join(output_buffer)
                if current_output.count(marker) >= 2:
                    # Extract exit code
                    try:
                        marker_idx = current_output.rfind(marker)
                        after = current_output[marker_idx + len(marker):].strip().split()[0]
                        exit_code = int(after) if after.isdigit() else 0
                    except:
                        pass
                    completed = True
                    break

            if not completed:
                await pty_handle.kill()
                return {"success": False, "error": "Command timed out"}

            await pty_handle.kill()

            # Clean output
            final = "".join(output_buffer)
            # Remove command echo and marker
            # The logic here is tricky because we wrapped everything.
            # We trust the output buffer mostly.

            # Remove marker line
            if marker in final:
                marker_idx = final.rfind(marker)
                line_start = final.rfind('\n', 0, marker_idx)
                if line_start != -1:
                    final = final[:line_start]

            # Strip ANSI
            ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
            final = ansi_escape.sub('', final)

            # Stream final empty chunk
            if tool_output_ctx:
                await stream_tool_output(
                    tool_call_id=tool_call_id,
                    output_chunk="",
                    is_final=True,
                    tool_name="ssh_execute"
                )

            return {
                "success": True,
                "output": final.strip(),
                "exit_code": exit_code
            }

        except Exception as e:
            return {"success": False, "error": str(e)}
