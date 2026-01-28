# Kortix Chrome Extension - Backend Integration Guide

This guide explains how to integrate the Kortix Chrome Extension with the Kortix backend to enable browser control for AI agents.

## Architecture Overview

The integration follows a listener/router pattern where the Kortix backend router determines whether to route commands to the user's local browser (via the extension) or to a sandbox/cloud browser.

```
┌─────────────────────────────────────────────────────────┐
│ Kortix AI Agent                                         │
│ (Requesting browser actions)                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Kortix Backend Router                                   │
│ (Decides: Local Browser vs Sandbox vs Cloud)           │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌──────────┐ ┌────────┐ ┌──────────┐
│ Chrome   │ │Sandbox │ │Cloud     │
│Extension │ │Browser │ │Browser   │
└──────────┘ └────────┘ └──────────┘
```

## Backend Implementation

### Step 1: Detect Extension Availability

First, detect if the user has the Kortix Chrome Extension installed:

```python
# In your Kortix backend router
from kortix_browser_extension import BrowserRouterClient

def is_extension_available() -> bool:
    """Check if Chrome extension is installed and available"""
    try:
        # Try to communicate with extension
        client = BrowserRouterClient()
        status = client.get_session_status()
        return status.is_active
    except Exception:
        return False

def get_browser_source() -> str:
    """Determine which browser to use"""
    if is_extension_available():
        return "local_browser"  # User's browser via extension
    elif has_sandbox_browser():
        return "sandbox_browser"  # Manus sandbox browser
    else:
        return "cloud_browser"  # Fallback cloud browser
```

### Step 2: Initialize Browser Router

Set up the browser router client in your backend:

```python
from kortix_browser_extension import BrowserRouterClient, initializeBrowserRouter

# In your agent initialization
async def initialize_agent(agent_config):
    # Initialize browser router if extension is available
    if is_extension_available():
        browser_router = await initializeBrowserRouter()
        agent_config.browser_router = browser_router
        print("✓ Local browser (Chrome extension) enabled")
    else:
        print("ℹ Using sandbox/cloud browser")
    
    return agent_config
```

### Step 3: Route Commands to Extension

In your browser control tool implementation:

```python
# In your Kortix backend browser tool
from kortix_browser_extension import BrowserRouterClient

class BrowserTool:
    def __init__(self, agent_config):
        self.browser_router = agent_config.get('browser_router')
        self.use_local_browser = self.browser_router is not None
    
    async def navigate(self, url: str) -> dict:
        """Navigate to URL"""
        if self.use_local_browser:
            # Route to local browser extension
            result = await self.browser_router.navigate(url)
            return {
                "success": result.success,
                "url": result.data.get("url"),
                "source": "local_browser"
            }
        else:
            # Fallback to sandbox/cloud browser
            return await self.navigate_sandbox(url)
    
    async def extract_emails(self) -> dict:
        """Extract emails from current page"""
        if self.use_local_browser:
            emails = await self.browser_router.extract_emails()
            return {
                "emails": emails,
                "count": len(emails),
                "source": "local_browser"
            }
        else:
            return await self.extract_emails_sandbox()
    
    async def click(self, selector: str) -> dict:
        """Click element"""
        if self.use_local_browser:
            result = await self.browser_router.click(selector)
            return {
                "success": result.success,
                "source": "local_browser"
            }
        else:
            return await self.click_sandbox(selector)
```

### Step 4: Handle Errors and Fallbacks

Implement proper error handling and fallback logic:

```python
async def execute_browser_command(command: str, **kwargs) -> dict:
    """Execute browser command with fallback"""
    try:
        if use_local_browser:
            # Try local browser first
            result = await browser_router.execute_command(command, **kwargs)
            
            if not result.success:
                logger.warning(f"Local browser command failed: {result.error}")
                # Fallback to sandbox
                return await execute_sandbox_command(command, **kwargs)
            
            return result
        else:
            # Use sandbox directly
            return await execute_sandbox_command(command, **kwargs)
    
    except TimeoutError:
        logger.error("Browser command timeout, using sandbox")
        return await execute_sandbox_command(command, **kwargs)
    
    except Exception as e:
        logger.error(f"Browser command error: {e}")
        return {"success": False, "error": str(e)}
```

## Agent Integration

### Using Browser Control in Agents

Here's how agents use the browser control:

```python
# In your agent implementation
class BrowserAgent:
    def __init__(self, config):
        self.browser_tool = BrowserTool(config)
    
    async def search_for_emails(self, query: str):
        """Search for emails on a website"""
        # Navigate to search page
        await self.browser_tool.navigate(f"https://example.com/search?q={query}")
        
        # Wait for page to load
        await asyncio.sleep(1)
        
        # Extract emails
        result = await self.browser_tool.extract_emails()
        
        return {
            "query": query,
            "emails": result["emails"],
            "source": result["source"]
        }
    
    async def fill_and_submit_form(self, form_data: dict):
        """Fill and submit a form"""
        # Fill form fields
        for selector, value in form_data.items():
            await self.browser_tool.type(selector, value)
        
        # Submit form
        await self.browser_tool.click("button[type='submit']")
        
        # Wait for response
        await asyncio.sleep(2)
        
        # Extract result
        content = await self.browser_tool.extract_content()
        
        return {"success": True, "content": content}
```

## Configuration

### Environment Variables

Configure the extension behavior with environment variables:

```bash
# .env
KORTIX_BROWSER_EXTENSION_ENABLED=true
KORTIX_BROWSER_TIMEOUT=30
KORTIX_BROWSER_MAX_RETRIES=3
KORTIX_BROWSER_FALLBACK=sandbox
```

### Configuration File

Or use a configuration file:

```yaml
# config.yaml
browser:
  extension:
    enabled: true
    timeout: 30
    max_retries: 3
    fallback: sandbox
  
  sandbox:
    enabled: true
    headless: true
  
  cloud:
    enabled: true
    provider: browserless
```

## Message Format

### Command Format

Commands sent to the extension follow this format:

```typescript
interface Command {
  id: string;                    // Unique command ID
  action: string;                // Action to perform
  params?: Record<string, any>;  // Action parameters
  timestamp: number;             // Unix timestamp
}
```

### Response Format

Responses from the extension:

```typescript
interface CommandResult {
  commandId: string;    // Matches command ID
  success: boolean;     // Whether command succeeded
  data?: any;          // Result data
  error?: string;      // Error message if failed
  timestamp: number;   // Unix timestamp
}
```

## Security Considerations

### Message Validation

Always validate messages from the extension:

```python
import hmac
import hashlib
import json

def sign_message(message: dict, secret: str) -> str:
    """Sign message with HMAC"""
    payload = json.dumps(message, sort_keys=True)
    signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature

def verify_message(message: dict, signature: str, secret: str) -> bool:
    """Verify message signature"""
    expected = sign_message(message, secret)
    return hmac.compare_digest(signature, expected)
```

### Secure Communication

Use HTTPS/WSS for all communication:

```python
# Secure WebSocket connection
BROWSER_ROUTER_URL = "wss://secure.kortix.ai/browser-control"

# Verify SSL certificates
VERIFY_SSL = True

# Use authentication tokens
AUTH_TOKEN = os.getenv("KORTIX_AUTH_TOKEN")
```

## Monitoring and Logging

### Command Logging

Log all browser commands for debugging:

```python
import logging

logger = logging.getLogger("kortix.browser")

async def execute_command(command: Command):
    logger.info(f"Executing command: {command.action}")
    logger.debug(f"Command params: {command.params}")
    
    try:
        result = await browser_router.execute_command(command)
        logger.info(f"Command succeeded: {command.action}")
        return result
    except Exception as e:
        logger.error(f"Command failed: {command.action} - {e}")
        raise
```

### Metrics Collection

Track browser command metrics:

```python
from prometheus_client import Counter, Histogram

browser_commands_total = Counter(
    'browser_commands_total',
    'Total browser commands executed',
    ['action', 'source', 'status']
)

browser_command_duration = Histogram(
    'browser_command_duration_seconds',
    'Browser command execution duration',
    ['action']
)

async def execute_with_metrics(command: Command):
    with browser_command_duration.labels(action=command.action).time():
        result = await browser_router.execute_command(command)
        
        status = "success" if result.success else "error"
        source = "local_browser" if use_local_browser else "sandbox"
        
        browser_commands_total.labels(
            action=command.action,
            source=source,
            status=status
        ).inc()
        
        return result
```

## Testing

### Unit Tests

Test browser tool with mock extension:

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_navigate():
    with patch('kortix_browser_extension.BrowserRouterClient') as mock:
        mock_router = AsyncMock()
        mock_router.navigate.return_value = {
            "success": True,
            "url": "https://example.com"
        }
        
        tool = BrowserTool({"browser_router": mock_router})
        result = await tool.navigate("https://example.com")
        
        assert result["success"] is True
        assert result["url"] == "https://example.com"

@pytest.mark.asyncio
async def test_extract_emails():
    with patch('kortix_browser_extension.BrowserRouterClient') as mock:
        mock_router = AsyncMock()
        mock_router.extract_emails.return_value = [
            "test@example.com",
            "admin@example.com"
        ]
        
        tool = BrowserTool({"browser_router": mock_router})
        result = await tool.extract_emails()
        
        assert result["count"] == 2
        assert "test@example.com" in result["emails"]
```

### Integration Tests

Test with actual extension:

```python
@pytest.mark.asyncio
async def test_full_workflow():
    """Test complete browser workflow"""
    browser_router = await initializeBrowserRouter()
    
    # Navigate
    nav_result = await browser_router.navigate("https://example.com")
    assert nav_result.success
    
    # Extract content
    content = await browser_router.extract_content()
    assert len(content) > 0
    
    # Extract emails
    emails = await browser_router.extract_emails()
    assert isinstance(emails, list)
```

## Troubleshooting

### Extension Not Detected

**Problem**: Backend can't detect extension

**Solution**:
- Verify extension is installed in Chrome
- Check extension is enabled
- Verify Chrome is running
- Check browser console for errors

### Commands Timing Out

**Problem**: Commands fail with timeout

**Solution**:
- Increase timeout value
- Check network connectivity
- Verify page is fully loaded
- Check for JavaScript errors on page

### Fallback Not Working

**Problem**: Fallback to sandbox browser fails

**Solution**:
- Verify sandbox browser is available
- Check sandbox configuration
- Verify fallback logic is correct
- Check error logs

## Best Practices

1. **Always implement fallback**: Have a fallback browser option
2. **Validate responses**: Check all responses from extension
3. **Log commands**: Log all browser commands for debugging
4. **Handle timeouts**: Implement proper timeout handling
5. **Monitor performance**: Track command execution times
6. **Secure communication**: Use HTTPS/WSS for all communication
7. **Test thoroughly**: Test with both local and fallback browsers
8. **Handle errors gracefully**: Provide meaningful error messages

## Examples

See `src/testing/example.test.ts` for complete integration examples.

## Support

For integration issues:

- **GitHub Issues**: https://github.com/kortix-ai/suna/issues
- **Discord**: https://discord.com/invite/RvFhXUdZ9H
- **Email**: dev@kortix.ai
