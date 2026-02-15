"""
Isolated Agent Harness - CLI for E2E verification of worker infrastructure and MCP tool calls.

This script executes agent runs in a clean, isolated setting using existing backend infrastructure logic.
It uses mocks for Supabase/DB but keeps the core agent logic (AgentRunner, ToolManager, MCPToolWrapper) real.

Usage:
  python backend/core/test_harness/mcp_lab/agent_harness.py run --script backend/core/test_harness/mcp_lab/scripts/test_valyu.json
"""
import json
import asyncio
import argparse
import sys
import os
import time
import traceback
from typing import Dict, Any, Optional, List, Union
from unittest.mock import MagicMock, AsyncMock

# Ensure /app is on path
APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

# --- Paths ---
LAB_DIR = os.path.dirname(os.path.abspath(__file__))
LAYOUTS_DIR = os.path.join(LAB_DIR, "layouts")
LAYOUT_FILE = os.path.join(LAYOUTS_DIR, "local_lab.json")
SECRETS_FILE = os.path.join(LAYOUTS_DIR, "secrets.json")

def _load_json(path: str) -> Dict[str, Any]:
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  Error loading {path}: {e}")
    return {}

# ============================================================
# Mock Services
# ============================================================

class MockDBConnection:
    _instance = None
    def __new__(cls, *a, **kw):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
            cls._instance._client = AsyncMock()
        return cls._instance
    async def initialize(self): self._initialized = True
    @property
    async def client(self): return self._client

class MockCredential:
    def __init__(self, config_data: Dict[str, Any]):
        self.config = config_data
        self.credential_id = "harness-mock"
        self.account_id = "harness_user"
        self.mcp_qualified_name = "mock"
        self.display_name = "Harness Mock"
        self.is_active = True

class MockCredentialService:
    def __init__(self, *a, **kw):
        self._secrets = _load_json(SECRETS_FILE).get('credentials', {})
    async def get_credential(self, account_id, qualified_name):
        if not qualified_name: return None
        if qualified_name in self._secrets: return MockCredential(self._secrets[qualified_name])
        # Fuzzy match logic from runner.py
        clean_qn = qualified_name.lower().replace("_", "").replace(".", "").replace("/", "")
        for slug, cred in self._secrets.items():
            clean_slug = slug.lower().replace("_", "").replace(".", "").replace("/", "")
            if clean_slug in clean_qn or clean_qn in clean_slug:
                return MockCredential(cred)
        return None
    async def list_credentials(self, account_id):
        return [MockCredential(v) for v in self._secrets.values()]

class MockVersionService:
    def __init__(self, *a, **kw):
        self._config = _load_json(LAYOUT_FILE)
    async def get_current_mcp_config(self, agent_id, user_id):
        return self._config.copy()
    async def get_active_version(self, agent_id):
        return MagicMock(
            configured_mcps=self._config.get('configured_mcps', []),
            custom_mcps=self._config.get('custom_mcp', []),
            system_prompt="You are a helpful assistant.",
            model="gpt-4",
            version_id="v1",
            agentpress_tools={}
        )

class MockThreadManager:
    def __init__(self, *args, **kwargs):
        self.db = MockDBConnection()
        self.messages = []
        self.thread_id = kwargs.get('thread_id', 'harness_thread')
        self.account_id = kwargs.get('account_id', 'harness_user')
        self.project_id = kwargs.get('project_id', 'harness_project')
        self.agent_config = kwargs.get('agent_config', {})
        self.jit_config = kwargs.get('jit_config')
        self.trace = kwargs.get('trace')
        
        from core.agentpress.tool_registry import ToolRegistry
        self.tool_registry = ToolRegistry()
        
        # Register core tools needed for discovery/execution
        from core.tools.expand_msg_tool import ExpandMessageTool
        self.add_tool(ExpandMessageTool, thread_id=self.thread_id, thread_manager=self)
        
        from core.agentpress.response_processor import ResponseProcessor
        self.response_processor = ResponseProcessor(
            tool_registry=self.tool_registry,
            add_message_callback=self.add_message,
            trace=self.trace,
            agent_config=self.agent_config,
            jit_config=self.jit_config,
            thread_manager=self,
            project_id=self.project_id
        )

    def add_tool(self, tool_class, function_names=None, **kwargs):
        self.tool_registry.register_tool(tool_class, function_names, **kwargs)

    async def add_message(self, thread_id, type, content, **kwargs):
        msg = {"thread_id": thread_id, "type": type, "content": content, **kwargs}
        self.messages.append(msg)
        print(f"\n[MESSAGE] {type.upper()}: {content}")
        # Return a mock message object that can be awaited if needed
        mock_msg = MagicMock()
        mock_msg.get = lambda k, d=None: {"message_id": "mock_msg_id"}.get(k, d)
        mock_msg.__getitem__ = lambda s, k: {"message_id": "mock_msg_id"}[k]
        return mock_msg

    async def get_messages(self, thread_id, limit=None):
        return self.messages

# ============================================================
# Environment Patching
# ============================================================

def setup_harness_environment():
    import logging
    logging.basicConfig(level=logging.INFO, stream=sys.stdout, force=True)
    print("🛠️  Patching environment...")
    
    # Mock heavy services and prevent side effects
    sys.modules['core.ai_models.ollama_client'] = MagicMock()
    sys.modules['core.ai_models.lmstudio_client'] = MagicMock()
    sys.modules['core.ai_models.local_registry'] = MagicMock()
    sys.modules['core.services.llm'] = MagicMock()
    sys.modules['core.services.langfuse'] = MagicMock()
    sys.modules['core.ai_models.model_manager'] = MagicMock()
    
    # Mock litellm and its sub-modules to prevent heavy init/side-effects
    mock_litellm = MagicMock()
    sys.modules['litellm'] = mock_litellm
    sys.modules['litellm.utils'] = MagicMock()
    sys.modules['litellm.router'] = MagicMock()
    sys.modules['litellm.files'] = MagicMock()
    sys.modules['litellm.files.main'] = MagicMock()
    
    sys.modules['langfuse'] = MagicMock()
    sys.modules['langfuse.client'] = MagicMock()
    
    redis_mock = MagicMock()
    redis_mock.get_client = AsyncMock()
    sys.modules['core.services.redis'] = redis_mock
    
    import core.services.supabase as sb_mod
    sb_mod.DBConnection = MockDBConnection
    
    import core.credentials as cred_mod
    cred_mod.get_credential_service = lambda db=None: MockCredentialService()
    
    import core.versioning.version_service as vs_mod
    mock_vs = MockVersionService()
    vs_mod.get_version_service = AsyncMock(return_value=mock_vs)
    vs_mod.version_service = mock_vs
    
    import core.agentpress.thread_manager as tm_mod
    tm_mod.ThreadManager = MockThreadManager

    print("✅ Environment patched.")

# ============================================================
# Script Execution
# ============================================================

async def run_script(script_path: str):
    if not os.path.exists(script_path):
        print(f"❌ Script not found: {script_path}")
        return

    with open(script_path, 'r') as f:
        script = json.load(f)

    setup_harness_environment()
    
    # Deferred imports to ensure patching is effective
    from core.run.config import AgentConfig
    from core.run.agent_runner import AgentRunner
    
    layout = _load_json(LAYOUT_FILE)
    
    config = AgentConfig(
        thread_id="harness_thread",
        project_id="harness_project",
        account_id="harness_user",
        agent_config=layout
    )
    
    runner = AgentRunner(config)
    await runner.setup_bootstrap()
    
    print(f"\n🚀 Starting Scripted Run: {script.get('name', 'Unnamed Script')}")
    
    for turn in script.get('turns', []):
        turn_id = turn.get('id', '?')
        turn_type = turn.get('type')
        print(f"\n--- Turn {turn_id} [{turn_type}] ---")
        
        if turn_type == 'message':
            await runner.thread_manager.add_message(
                runner.config.thread_id, 
                "user", 
                turn.get('content')
            )
        elif turn_type == 'tool_call':
            tool_name = turn.get('tool_name')
            args = turn.get('args', {})
            print(f"🛠️  Agent calling: {tool_name} with {args}")
            
            try:
                # Format for ResponseProcessor._execute_tool
                tool_call = {
                    "function_name": tool_name,
                    "arguments": args,
                    "tool_call_id": f"call_{int(time.time())}"
                }
                result = await runner.thread_manager.response_processor._execute_tool(tool_call)
                print(f"✅ Tool Result: {result.success}")
                if not result.success:
                    print(f"❌ Error: {result.output}")
                else:
                    output_str = str(result.output)
                    if len(output_str) > 500:
                        print(f"📄 Output (truncated): {output_str[:500]}...")
                    else:
                        print(f"📄 Output: {output_str}")
            except Exception as e:
                print(f"❌ Execution failed: {e}")
                traceback.print_exc()

    print("\n✅ Script completed.")
    
    # Save Trace
    trace_path = os.path.join(LAB_DIR, "latest_run_trace.json")
    with open(trace_path, 'w') as f:
        json.dump(runner.thread_manager.messages, f, indent=2, default=str)
    print(f"💾 Trace saved to {trace_path}")

# ============================================================
# Main
# ============================================================

async def main():
    parser = argparse.ArgumentParser(description="Agent Harness")
    sub = parser.add_subparsers(dest="command", required=True)
    
    p_run = sub.add_parser("run", help="Run scripted agent session")
    p_run.add_argument("--script", required=True, help="Path to JSON script")
    
    a = parser.parse_args()
    if a.command == "run":
        await run_script(a.script)

if __name__ == "__main__":
    asyncio.run(main())
