"""
MCP Lab Harness - CLI for testing MCP server integrations.

Runs INSIDE the Docker container where all Python deps are available.
Only infrastructure services (DB, credentials) are mocked.
All MCP code (JITLoader, MCPRegistry, MCPToolExecutor) runs REAL.

Usage (from host):
  docker exec suna-backend-1 /app/.venv/bin/python /app/core/test_harness/mcp_lab/runner.py add https://mcp.context7.com/mcp
  docker exec suna-backend-1 /app/.venv/bin/python /app/core/test_harness/mcp_lab/runner.py discover
  docker exec suna-backend-1 /app/.venv/bin/python /app/core/test_harness/mcp_lab/runner.py run --prompt "test"
"""
import json
import asyncio
import argparse
import sys
import os
import time
import traceback
import httpx
from urllib.parse import urlencode, urlparse, parse_qs
from core.utils.logger import logger
from typing import Dict, Any, Optional
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


def _save_json(path: str, data: Dict[str, Any]):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


# ============================================================
# Mock Services — only what's needed for offline testing
# ============================================================

class MockDBConnection:
    """Drop-in for core.services.supabase.DBConnection — no real DB."""
    _instance = None

    def __new__(cls, *a, **kw):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
            cls._instance._client = AsyncMock()
        return cls._instance

    async def initialize(self):
        self._initialized = True

    @property
    def client(self):
        return self._client


class MockCredential:
    """Mimics core.credentials.credential_service.MCPCredential"""
    def __init__(self, config_data: Dict[str, Any]):
        self.config = config_data
        self.credential_id = "harness-mock"
        self.account_id = "harness_user"
        self.mcp_qualified_name = "mock"
        self.display_name = "Harness Mock"
        self.is_active = True
        self.last_used_at = None
        self.created_at = None
        self.updated_at = None


class MockCredentialService:
    """Drop-in for core.credentials.CredentialService — reads secrets.json."""
    def __init__(self, *a, **kw):
        self._secrets = _load_json(SECRETS_FILE).get('credentials', {})

    async def get_credential(self, account_id, qualified_name):
        if not qualified_name:
            return None

        # Direct match
        if qualified_name in self._secrets:
            return MockCredential(self._secrets[qualified_name])

        # Fuzzy match
        clean_qn = qualified_name.lower().replace("_", "").replace(".", "").replace("/", "")
        for slug, cred in self._secrets.items():
            clean_slug = slug.lower().replace("_", "").replace(".", "").replace("/", "")
            if clean_slug in clean_qn or clean_qn in clean_slug:
                return MockCredential(cred)

        return None

    async def list_credentials(self, account_id):
        return [MockCredential(v) for v in self._secrets.values()]


class MockVersionService:
    """Drop-in for core.versioning.version_service — reads local_lab.json."""
    def __init__(self, *a, **kw):
        self._config = _load_json(LAYOUT_FILE)

    async def get_current_mcp_config(self, agent_id, user_id):
        return self._config.copy()

    async def get_active_version(self, agent_id):
        return MagicMock(
            configured_mcps=self._config.get('configured_mcps', []),
            custom_mcps=self._config.get('custom_mcp', []),
            system_prompt="You are a helpful assistant.",
            model="gpt-4"
        )


def _mock_get_credential_service(db=None):
    return MockCredentialService()


# ============================================================
# Environment Patching — runs ONCE before any command
# ============================================================

_patched = False

def setup_harness_environment(layout: Dict, secrets: Dict):
    global _patched
    if _patched: return
    _patched = True

    import logging, sys
    logging.basicConfig(level=logging.DEBUG, stream=sys.stdout, force=True)
    print("🛠️  Patching environment...", flush=True)
    from unittest.mock import MagicMock

    # Inject empty mocks for local model clients and heavy services
    sys.modules['core.ai_models.ollama_client'] = MagicMock()
    sys.modules['core.ai_models.lmstudio_client'] = MagicMock()
    sys.modules['core.ai_models.local_registry'] = MagicMock()
    sys.modules['core.services.llm'] = MagicMock()
    sys.modules['core.services.langfuse'] = MagicMock()
    sys.modules['core.ai_models.model_manager'] = MagicMock()
    
    # Mock litellm and its sub-modules to prevent heavy init/side-effects
    sys.modules['litellm'] = MagicMock()
    sys.modules['litellm.utils'] = MagicMock()
    sys.modules['litellm.router'] = MagicMock()
    sys.modules['litellm.files'] = MagicMock()
    sys.modules['litellm.files.main'] = MagicMock()
    sys.modules['langfuse'] = MagicMock()
    sys.modules['langfuse.client'] = MagicMock()
    sys.modules['core.utils.tool_discovery'] = MagicMock()
    redis_mock = MagicMock()
    redis_mock.get_client = AsyncMock()
    sys.modules['core.services.redis'] = redis_mock
    
    # Also mock registry to prevent LLM init
    mock_registry_mod = MagicMock()
    mock_registry_mod.registry = MagicMock()
    sys.modules['core.ai_models.registry'] = mock_registry_mod
    
    # 1. MCP Transports & Session mocks (MUST BE BEFORE ANY IMPORTS)
    try:
        import mcp
        import mcp.client.sse as sse_mod
        import mcp.client.streamable_http as sh_mod
        import contextlib

        print("   - REAL MCP Transports enabled (Mocks disabled)", flush=True)

        # We keep the probe logging but let it call the real transport
        orig_sse = sse_mod.sse_client
        orig_http = sh_mod.streamablehttp_client

        @contextlib.asynccontextmanager
        async def logged_sse_client(url, *args, **kwargs):
             print(f"       📡 REAL Discovery Probe [SSE]: {url}", flush=True)
             async with orig_sse(url, *args, **kwargs) as transport:
                 yield transport

        @contextlib.asynccontextmanager
        async def logged_http_client(url, *args, **kwargs):
             print(f"       📡 REAL Discovery Probe [HTTP]: {url}", flush=True)
             async with orig_http(url, *args, **kwargs) as transport:
                 yield transport

        # patch only the loggers, keep logic real
        # wait, if I patch sse_client it might break the import loop if not careful
        # but here we are inside setup_harness_environment which runs late
        # Actually, it's safer to just NOT patch them if we want REAL behavior.
        # Let's just remove the mocks entirely.
    except Exception as e:
        print(f"     ⚠️  MCP Transport patch error: {e}")

    from core.utils.logger import logger

    print("   - Patching DB & Credentials", flush=True)
    import core.services.supabase as sb_mod
    sb_mod.DBConnection = MockDBConnection

    import core.credentials as cred_mod
    cred_mod.get_credential_service = _mock_get_credential_service
    
    import core.credentials.credential_service as cs_mod
    cs_mod.DBConnection = MockDBConnection
    cs_mod.get_credential_service = _mock_get_credential_service

    # 3. Patch Version Service
    import core.versioning.version_service as vs_mod
    mock_vs = MockVersionService()
    vs_mod.DBConnection = MockDBConnection
    vs_mod.version_service = mock_vs
    vs_mod._service = mock_vs
    async def mock_get_vs(*a, **kw): return mock_vs
    vs_mod.get_version_service = mock_get_vs
    print("   - Patching Version Service (Thorough)", flush=True)

    # 4. Patch MCP modules (KEEP logic real, skip transport/session mocks)
    import core.mcp_module.mcp_service as svc_mod
    svc_mod.DBConnection = MockDBConnection
    if hasattr(svc_mod, 'get_credential_service'):
        svc_mod.get_credential_service = _mock_get_credential_service

    import core.jit.mcp_loader as loader_mod
    loader_mod.DBConnection = MockDBConnection
    if hasattr(loader_mod, 'get_credential_service'):
        loader_mod.get_credential_service = _mock_get_credential_service

    import core.agentpress.mcp_registry as reg_mod
    reg_mod.DBConnection = MockDBConnection

    import core.tools.utils.mcp_tool_executor as exec_mod
    
    import core.tools.utils.mcp_connection_manager as conn_mod

    print("   - Patching MCP Service, JIT Loader & Registry", flush=True)

    # 5. Patch ToolGuideRegistry to avoid loading all tools
    import core.tools.tool_guide_registry as tgr_mod
    mock_tgr = MagicMock()
    mock_tgr.get_minimal_index.return_value = "Mock Tool Index"
    tgr_mod._registry = mock_tgr
    tgr_mod.get_tool_guide_registry = lambda: mock_tgr
    print("   - Patching ToolGuideRegistry", flush=True)

    # 6. PromptManager will be patched inline in Step 4 to avoid early import hangs
    print("   - PromptManager patch deferred to Step 4", flush=True)

    # 7. Patch auth service to use secrets.json tokens
    try:
        import core.mcp_module.auth_service as auth_mod

        async def mock_get_auth_headers(self_ref, mcp_url_or_config=None, user_id=None):
            url = str(mcp_url_or_config.get('url', '') if isinstance(mcp_url_or_config, dict) else mcp_url_or_config)
            creds = secrets.get('credentials', {})
            for slug, cred in creds.items():
                if slug.lower() in url.lower():
                    token = cred.get('access_token')
                    if token:
                        print(f"       🔑 Using token for {slug}")
                        return {"Authorization": f"Bearer {token}"}
            return {}

        auth_mod.MCPAuthService.get_auth_headers = mock_get_auth_headers
        if hasattr(auth_mod, 'get_mcp_auth_service'):
            auth_mod.get_mcp_auth_service().get_auth_headers = mock_get_auth_headers
        print("   - Patching MCP Auth Service", flush=True)
    except Exception:
        pass

    print("🛠️  Harness patched (DB/creds mocked, MCP logic real)", flush=True)


# ============================================================
# CLI Commands
# ============================================================

async def cmd_add(args):
    """Add/probe an MCP server URL."""
    os.makedirs(LAYOUTS_DIR, exist_ok=True)
    print(f"🔍 Probing: {args.url}")

    secrets = _load_json(SECRETS_FILE)
    layout = _load_json(LAYOUT_FILE)
    setup_harness_environment(layout, secrets)

    import httpx
    from core.mcp_module.auth_service import mcp_auth_service
    from core.mcp_module.custom_mcp_registry_service import mcp_registry_service

    # 1. OAuth metadata check
    oauth_metadata = None
    try:
        oauth_metadata = await mcp_auth_service.discover_oauth_metadata(args.url)
        print("✨ OAuth capability detected.")
    except Exception:
        print("ℹ️  No OAuth metadata.")

    # 2. Probe transports
    res = None
    requires_auth = False
    discovered_type = "http"

    for p_type in ["sse", "http"]:
        try:
            print(f"📡 Probing {p_type}...")
            res = await mcp_registry_service.discover_custom_tools(p_type, {"url": args.url})
            if hasattr(res, 'success') and res.success:
                discovered_type = p_type
                requires_auth = False
                tool_count = len(res.tools) if hasattr(res, 'tools') else 0
                print(f"✅ {p_type} succeeded! {tool_count} tools found.")
                break

            if hasattr(res, 'requires_auth') and res.requires_auth:
                requires_auth = True
                if hasattr(res, 'oauth_metadata'):
                    oauth_metadata = res.oauth_metadata
                print(f"🔐 {p_type} requires auth.")
            else:
                msg = getattr(res, 'message', str(res))
                if "405" in str(msg).lower() or "method not allowed" in str(msg).lower():
                    print(f"ℹ️  {p_type} → 405, trying next...")
                    continue
                print(f"ℹ️  {p_type} failed: {msg}")
        except Exception as e:
            print(f"⚠️  {p_type} error: {e}")

    # 3. Query-param API key detection
    url_lower = args.url.lower()
    if any(k in url_lower for k in ["apikey", "valyuapikey", "token=", "key="]):
        print("✨ API key detected in URL.")
        if res and hasattr(res, 'success') and res.success:
            requires_auth = False

    # 4. OAuth flow (Scenario A)
    if requires_auth:
        if not oauth_metadata:
            print("❌ Auth required but no OAuth endpoints found.")
            return

        print("\n🔐 --- OAuth Flow ---")
        auth_ep = oauth_metadata.get("authorization_endpoint")
        token_ep = oauth_metadata.get("token_endpoint")
        if not auth_ep or not token_ep:
            print("❌ Incomplete OAuth metadata.")
            return

        verifier, challenge = mcp_auth_service.generate_code_verifier_challenge()
        client_id = args.client_id or "kortix-harness-cli"
        redirect_uri = args.redirect_uri or "http://localhost:8080/callback"

        params = {
            "response_type": "code", "client_id": client_id,
            "redirect_uri": redirect_uri, "scope": "mcp",
            "code_challenge": challenge, "code_challenge_method": "S256",
            "state": "harness"
        }
        auth_url = f"{auth_ep}?{httpx.QueryParams(params)}"
        print(f"\n1. Open: {auth_url}")
        code = input("\n2. Paste code: ").strip()
        if not code:
            return

        print("📡 Exchanging code...")
        try:
            async with httpx.AsyncClient() as client:
                token_res = await client.post(token_ep, data={
                    "grant_type": "authorization_code", "client_id": client_id,
                    "code": code, "redirect_uri": redirect_uri,
                    "code_verifier": verifier
                })
                token_res.raise_for_status()
                token_data = token_res.json()
                slug = args.url.split("//")[-1].replace("/", "_").replace(".", "_")
                secrets.setdefault("credentials", {})[slug] = token_data
                _save_json(SECRETS_FILE, secrets)
                print(f"💾 Token saved: {slug}")
        except Exception as e:
            print(f"❌ Exchange failed: {e}")
            return

    # 5. Save to layout
    layout.setdefault("custom_mcp", [])
    if not any(m.get("url") == args.url for m in layout["custom_mcp"]):
        from urllib.parse import urlparse
        name = urlparse(args.url).hostname or "unknown"
        layout["custom_mcp"].append({
            "name": name, "url": args.url,
            "type": discovered_type, "config": {}
        })
        _save_json(LAYOUT_FILE, layout)
        print(f"💾 Added to local_lab.json (type={discovered_type})")
    else:
        print("ℹ️  Already in local_lab.json")

    # 6. Summary
    if res and hasattr(res, 'success') and res.success and hasattr(res, 'tools'):
        tools = list(res.tools)
        print(f"\n📊 {len(tools)} tools:")
        for t in tools[:15]:
            n = getattr(t, 'name', str(t)) if not isinstance(t, dict) else t.get('name', str(t))
            print(f"   - {n}")
        if len(tools) > 15:
            print(f"   ... +{len(tools)-15} more")


async def cmd_discover(args):
    """Discover tools using REAL MCPJITLoader → MCPRegistry → get_discovery_info."""
    print("🚀 Starting Discovery...", flush=True)
    os.makedirs(LAYOUTS_DIR, exist_ok=True)
    layout = _load_json(LAYOUT_FILE)
    secrets = _load_json(SECRETS_FILE)

    if not layout.get("custom_mcp"):
        print("❌ No servers configured. Use 'add' first.")
        return

    setup_harness_environment(layout, secrets)

    from core.jit.mcp_loader import MCPJITLoader

    # Step 1: REAL JIT loader
    import sys as sys_orig
    sys_orig.stderr.write("\n📡 [HARNESS][1/4] MCPJITLoader.rebuild_tool_map()...\n")
    sys_orig.stderr.flush()
    try:
        layout.setdefault("account_id", "harness_user")
        custom_mcps = layout.get('custom_mcp', [])
        sys_orig.stderr.write(f"[HARNESS] Agent Config has {len(custom_mcps)} custom MCPs\n")
        sys_orig.stderr.flush()

        loader = MCPJITLoader(layout)
        sys_orig.stderr.write("DEBUG: [HARNESS] Calling rebuild_tool_map...\n")
        sys_orig.stderr.flush()
        await loader.rebuild_tool_map(layout)
        sys_orig.stderr.write("DEBUG: [HARNESS] rebuild_tool_map returned\n")
        sys_orig.stderr.flush()
    except Exception as e:
        logger.error(f"❌ [HARNESS] Step 1 failed: {e}")
        sys_orig.stderr.write(f"❌ [HARNESS] Step 1 failed: {e}\n")
        sys_orig.stderr.flush()
        traceback.print_exc()
        return

    print(f"\n📋 Full Tool Discovery Summary ({len(loader.tool_map)} tools):")
    for tool_name, info in loader.tool_map.items():
        print(f"   - {tool_name} (Toolkit: {info.toolkit_slug})")
    
    if not loader.tool_map:
        logger.warning("[HARNESS] ⚠️  No tools found in tool_map. Discovery might have failed.")
        sys_orig.stderr.write("[HARNESS] ⚠️  No tools found in tool_map.\n")
        sys_orig.stderr.flush()
        return

    # Step 2: REAL registry sync
    print("\n🔄 [2/4] init_mcp_registry_from_loader()...", flush=True)
    from core.agentpress.mcp_registry import init_mcp_registry_from_loader, get_mcp_registry
    registry = get_mcp_registry()
    init_mcp_registry_from_loader(loader)
    registry._initialized = True
    print(f"   ✅ Registry: {len(registry._tools)} tools", flush=True)

    # Step 3: REAL get_discovery_info (same as discover_mcp_tools agent tool)
    print("\n🔍 [3/4] MCPRegistry.get_discovery_info()...", flush=True)
    try:
        all_names = ",".join(loader.tool_map.keys())
        info = await registry.get_discovery_info(
            filter_pattern=all_names, load_schemas=True,
            account_id=layout.get("account_id")
        )
        tools = info.get('available_tools', {})
        total = info.get('total_count', len(tools))
        toolkit_names = info.get('toolkits', [])
        print(f"   ✅ {total} tools across {len(toolkit_names)} toolkits", flush=True)

        # Group tools by toolkit for display
        by_toolkit = {}
        for tn, ts in tools.items():
            tk = loader.tool_map.get(tn).toolkit_slug if tn in loader.tool_map else "unknown"
            by_toolkit.setdefault(tk, []).append(tn)

        for tk, tl in by_toolkit.items():
            print(f"\n   📦 {tk} ({len(tl)} tools):", flush=True)
            for tn in tl[:15]:
                print(f"      - {tn}", flush=True)
            if len(tl) > 15:
                print(f"      ... +{len(tl)-15} more", flush=True)
    except Exception as e:
        print(f"   ❌ Step 3 failed: {e}", flush=True)
        traceback.print_exc()

    # Step 4: REAL prompt injection
    import sys as sys_orig
    sys_orig.stderr.write("\n📝 [HARNESS][4/4] PromptManager._append_jit_mcp_info()...\n")
    sys_orig.stderr.flush()
    try:
        from core.run.prompt_manager import PromptManager
        import core.run.prompt_manager as pm_mod
        
        # Apply patch here
        mock_vs = MockVersionService()
        pm_mod.version_service = mock_vs
        sys_orig.stderr.write("DEBUG: [HARNESS] PromptManager patched\n")
        sys_orig.stderr.flush()

        prompt = await PromptManager._append_jit_mcp_info(
            "Base Prompt", loader, "user1", layout.get("account_id")
        )
        sys_orig.stderr.write(f"✅ [HARNESS] Prompt injection complete ({len(prompt)} chars)\n")
        sys_orig.stderr.flush()
        
        mcp_lines = [l for l in prompt.split("\n") if any(k in l.lower() for k in ["toolkit", "mcp", "tool"])]
        for line in mcp_lines[:15]:
            sys_orig.stderr.write(f"   {line}\n")
        sys_orig.stderr.flush()
    except Exception as e:
        logger.error(f"❌ [HARNESS] Step 4 failed: {e}")
        sys_orig.stderr.write(f"❌ [HARNESS] Step 4 failed: {e}\n")
        sys_orig.stderr.flush()
        traceback.print_exc()
async def cmd_auth(args):
    """Initiates OAuth handshake for a server."""
    layout = _load_json(LAYOUT_FILE)
    secrets = _load_json(SECRETS_FILE)
    
    server_name = args.server
    server = next((s for s in layout.get("custom_mcp", []) if s["name"] == server_name), None)
    if not server:
        print(f"❌ [HARNESS] Server '{server_name}' not found in local_lab.json")
        return

    mcp_url = server["url"]
    print(f"\n🚀 [HARNESS] Initiating OAuth for: {mcp_url}")

    from core.mcp_module.auth_service import mcp_auth_service
    
    # 1. Discover
    print("🔍 [HARNESS] Discovering OAuth metadata...")
    try:
        metadata = await mcp_auth_service.discover_oauth_metadata(mcp_url)
    except Exception as e:
        print(f"❌ [HARNESS] Discovery failed: {e}")
        return
        
    auth_endpoint = metadata.get("authorization_endpoint")
    token_endpoint = metadata.get("token_endpoint")
    reg_endpoint = metadata.get("registration_endpoint")
    
    if not auth_endpoint or not token_endpoint:
        print(f"❌ [HARNESS] Server missing OAuth endpoints. Metadata: {metadata}")
        return

    print(f"   ✅ Auth Endpoint: {auth_endpoint}")
    print(f"   ✅ Token Endpoint: {token_endpoint}")
    if reg_endpoint:
        print(f"   ✅ Registration Endpoint: {reg_endpoint}")

    # 1.5 Dynamic Client Registration (DCR)
    client_id = args.client_id
    redirect_uri = args.redirect_uri or os.getenv("SUNA_BACKEND_URL", "https://api.suna.syhc.dev/v1") + "/mcp/auth/callback"
    
    if not client_id and reg_endpoint:
        print("📝 [HARNESS] No Client ID provided. Attempting Dynamic Client Registration...")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                reg_payload = {
                    "client_name": f"Suna Harness ({server_name})",
                    "redirect_uris": [redirect_uri],
                    "grant_types": ["authorization_code", "refresh_token"],
                    "response_types": ["code"],
                    "token_endpoint_auth_method": "none"
                }
                reg_res = await client.post(reg_endpoint, json=reg_payload)
                if reg_res.status_code in (200, 201):
                    reg_data = reg_res.json()
                    client_id = reg_data.get("client_id")
                    print(f"   ✅ Registered! Client ID: {client_id}")
                else:
                    print(f"   ⚠️  Registration failed ({reg_res.status_code}): {reg_res.text}")
                    print("   Falling back to default client_id...")
        except Exception as e:
            print(f"   ⚠️  Registration error: {e}")

    if not client_id:
        client_id = os.getenv("SUNA_BACKEND_URL", "https://api.suna.syhc.dev/v1") + "/mcp/client-metadata.json"

    # 2. PKCE
    code_verifier, code_challenge = mcp_auth_service.generate_code_verifier_challenge()

    # 3. Build Auth URL
    # Use standard scope list from discovery if available, or fall back to 'mcp'
    scope_list = metadata.get("scopes_supported", ["mcp:tools", "mcp"])
    scope = scope_list[0] if scope_list else "mcp"
    
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "scope": scope,
        "state": "harness_state"
    }
    
    auth_url = f"{auth_endpoint}?{urlencode(params)}"
    print(f"\n👉 [HARNESS] Open this URL in your browser to authenticate:\n\n{auth_url}\n")
    
    # 4. Wait for code
    print("⌨️  [HARNESS] After authenticating, you will be redirected.")
    print("   Please paste the FINAL URL you were redirected to OR just the 'code' parameter:")
    
    try:
        input_str = await asyncio.to_thread(input, "> ")
        input_str = input_str.strip()
    except EOFError:
        return

    code = input_str
    if "code=" in input_str:
        parsed = urlparse(input_str)
        qs = parse_qs(parsed.query)
        code = qs.get("code", [None])[0]
    
    if not code:
        print("❌ [HARNESS] No code provided.")
        return

    # 5. Exchange
    print(f"🔑 [HARNESS] Exchanging code for token...")
    async with httpx.AsyncClient(timeout=10.0) as client:
        exchange_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "code_verifier": code_verifier
        }
        res = await client.post(token_endpoint, data=exchange_data)
        if res.status_code != 200:
            print(f"❌ [HARNESS] Token exchange failed ({res.status_code}): {res.text}")
            return
        
        token_data = res.json()
        print("✅ [HARNESS] Authentication successful!")
        
        # 6. Save
        secrets.setdefault("credentials", {})
        secrets["credentials"][server_name] = token_data
        _save_json(SECRETS_FILE, secrets)
        print(f"💾 [HARNESS] Saved tokens to secrets.json for '{server_name}'")



async def cmd_run(args):
    """Simulate agent turn using REAL MCPToolExecutor."""
    os.makedirs(LAYOUTS_DIR, exist_ok=True)
    layout = _load_json(LAYOUT_FILE)
    secrets = _load_json(SECRETS_FILE)
    setup_harness_environment(layout, secrets)

    print(f"🤖 Agent Run: '{args.prompt}'")

    from core.jit.mcp_loader import MCPJITLoader
    from core.run.prompt_manager import PromptManager
    from core.tools.utils.mcp_tool_executor import MCPToolExecutor
    from core.agentpress.mcp_registry import init_mcp_registry_from_loader, get_mcp_registry

    layout.setdefault("account_id", "harness_user")

    # Turn 1: JIT + Prompt
    print("\n[Turn 1] Build tool map + system prompt...")
    try:
        loader = MCPJITLoader(layout)
        await loader.rebuild_tool_map(layout)
        
        # Patch PromptManager inline
        import core.run.prompt_manager as pm_mod
        mock_vs = MockVersionService()
        pm_mod.version_service = mock_vs
        
        sys_prompt = await PromptManager._append_jit_mcp_info(
            "Base Prompt", loader, "user1", layout["account_id"]
        )
        print(f"   ✅ {len(sys_prompt)} chars, {len(loader.tool_map)} tools")
    except Exception as e:
        print(f"   ❌ Turn 1 failed: {e}")
        traceback.print_exc()
        return

    if not loader.tool_map:
        print("   ⚠️  No tools loaded.")
        return

    # Turn 2: discover_mcp_tools (REAL)
    print("\n[Turn 2] discover_mcp_tools (MCPRegistry)...")
    registry = get_mcp_registry()
    init_mcp_registry_from_loader(loader)
    registry._initialized = True
    try:
        all_names = ",".join(loader.tool_map.keys())
        info = await registry.get_discovery_info(
            filter_pattern=all_names, load_schemas=True,
            account_id=layout.get("account_id")
        )
        tools = info.get('available_tools', {})
        total = info.get('total_count', len(tools))
        print(f"   ✅ Discovered {total} tools")
    except Exception as e:
        print(f"   ⚠️  {e}")

    # Turn 3: execute_mcp_tool (REAL MCPToolExecutor)
    target = args.tool
    if not target:
        target = next(
            (t for t in loader.tool_map
             if any(k in t.lower() for k in ["list", "search", "get", "resolve"])),
            list(loader.tool_map.keys())[0]
        )
        print(f"\n   🤖 Auto-selected: '{target}'")

    print(f"\n[Turn 3] execute_mcp_tool('{target}')...")

    if target not in loader.tool_map:
        print(f"   ❌ '{target}' not in tool map!")
        print(f"   Available: {list(loader.tool_map.keys())}")
        return

    tool_info = loader.tool_map[target]
    mcp_config = tool_info.mcp_config
    custom_type = mcp_config.get("customType", mcp_config.get("type", "http")).lower()
    url = mcp_config.get("url") or mcp_config.get("config", {}).get("url")

    # URL fallback from layout
    if not url:
        search_key = tool_info.toolkit_slug or mcp_config.get('name')
        for c in layout.get('custom_mcp', []):
            if c.get('name') == search_key or (search_key and search_key in c.get('url', '')):
                url = c.get('url')
                print(f"   ✅ URL from layout: {url}")
                break

    if not url:
        print(f"   ❌ No URL for '{target}'")
        return

    # Build custom_tools dict — EXACT format MCPToolExecutor expects
    custom_tools = {
        target: {
            "custom_type": custom_type,
            "original_name": target,
            "custom_config": {
                "url": url,
                "headers": mcp_config.get("headers", {}),
                "access_token": mcp_config.get("access_token"),
                "external_user_id": layout.get("account_id"),
            }
        }
    }

    tool_args = {}
    if args.args:
        try:
            tool_args = json.loads(args.args)
        except json.JSONDecodeError as e:
            print(f"   ❌ Bad JSON: {e}")
            return

    # REAL MCPToolExecutor — production code path
    executor = MCPToolExecutor(custom_tools=custom_tools)

    print(f"   🚀 MCPToolExecutor ({custom_type}) → {url}")
    print(f"   📎 Args: {tool_args}")

    try:
        result = await executor.execute_tool(target, tool_args)

        ok = '✅' if (hasattr(result, 'success') and result.success) else '❌'
        print(f"\n{ok} Result:")
        print("-" * 50)
        content = getattr(result, 'content', str(result))
        if isinstance(content, str) and len(content) > 2000:
            print(content[:2000])
            print(f"\n... ({len(content)} chars total)")
        else:
            print(content)
        print("-" * 50)
    except Exception as e:
        print(f"   ❌ Execution failed: {e}")
        traceback.print_exc()


# ============================================================
# Main
# ============================================================

async def main():
    parser = argparse.ArgumentParser(description="MCP Lab Harness")
    sub = parser.add_subparsers(dest="command", required=True)

    p_add = sub.add_parser("add", help="Add/probe MCP server")
    p_add.add_argument("url", help="MCP endpoint URL")
    p_add.add_argument("--client-id", help="OAuth Client ID")
    p_add.add_argument("--redirect-uri", help="OAuth Redirect URI")

    sub.add_parser("discover", help="Discover tools (native flow)")

    p_run = sub.add_parser("run", help="Simulate agent turn")
    p_run.add_argument("--prompt", required=True)
    p_run.add_argument("--tool", help="Tool to execute")
    p_run.add_argument("--args", help="JSON tool args")

    p_auth = sub.add_parser("auth", help="Simulate OAuth flow")
    p_auth.add_argument("--server", required=True, help="Server name from local_lab.json")
    p_auth.add_argument("--client-id", help="Override Client ID")
    p_auth.add_argument("--redirect-uri", help="Override Redirect URI")

    a = parser.parse_args()
    if a.command == "add":
        await cmd_add(a)
    elif a.command == "discover":
        await cmd_discover(a)
    elif a.command == "run":
        await cmd_run(a)
    elif a.command == "auth":
        await cmd_auth(a)


if __name__ == "__main__":
    asyncio.run(main())
