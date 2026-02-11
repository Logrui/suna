class MCPException(Exception):
    """Base exception for all MCP related errors"""
    pass

class MCPConnectionError(MCPException):
    """Raised when connection to an MCP server fails"""
    pass

class MCPToolNotFoundError(MCPException):
    """Raised when a requested tool is not found on the MCP server"""
    pass

class MCPToolExecutionError(MCPException):
    """Raised when tool execution fails"""
    pass

class MCPProviderError(MCPException):
    """Raised when there is an issue with the MCP provider (e.g. Composio)"""
    pass

class MCPConfigurationError(MCPException):
    """Raised when MCP configuration is invalid"""
    pass

class MCPAuthenticationError(MCPException):
    """Raised when MCP authentication fails"""
    pass

class CustomMCPError(MCPException):
    """Raised for errors specific to custom MCP integrations"""
    pass
