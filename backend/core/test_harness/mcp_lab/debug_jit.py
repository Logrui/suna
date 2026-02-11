import asyncio
import json
import os
import sys

# Add /app to path
sys.path.append('/app')

# Mock DB and Credentials so it doesn't try to connect to Supabase
from unittest.mock import MagicMock
import core.services.supabase as sb_mod
sb_mod.DBConnection = MagicMock

from core.jit.mcp_loader import MCPJITLoader

async def test():
    layout = {
        'account_id': 'harness_user',
        'custom_mcp': [{
            'name': 'mcp.context7.com',
            'url': 'https://mcp.context7.com/mcp',
            'type': 'http',
            'config': {}
        }]
    }
    print("🚀 Initializing MCPJITLoader...")
    loader = MCPJITLoader(layout)
    print("📡 Rebuilding tool map...")
    try:
        await loader.rebuild_tool_map(layout)
        print(f"✅ Build complete. Tools found: {list(loader.tool_map.keys())}")
    except Exception as e:
        print(f"❌ Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
