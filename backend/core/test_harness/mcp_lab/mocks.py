from typing import Dict, Any, Optional
from mcp import ClientSession

class MockDBConnection:
    def __init__(self, secrets: Dict[str, Any] = None):
        self.secrets = secrets or {}
    
    async def initialize(self):
        pass
        
    async def get_credential(self, account_id: str, qualified_name: str):
        # Return a mock object mimicking the credential service response
        secret = self.secrets.get(qualified_name)
        if secret:
            return MockCredential(secret)
        return None

class MockCredential:
    def __init__(self, config: Dict[str, Any]):
        self.config = config

class MockVersionService:
    def __init__(self, agent_config: Dict[str, Any]):
        self.agent_config = agent_config
        
    async def get_current_mcp_config(self, agent_id: str, user_id: str):
        return self.agent_config

class MockEncryptionService:
    def decrypt(self, encrypted_value: str) -> str:
        # Pass-through for testing
        return encrypted_value
