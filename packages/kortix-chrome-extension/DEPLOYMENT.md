# Kortix Chrome Extension - Deployment Guide

## Overview

This guide covers deploying the Kortix AI Browser Operator extension to production environments.

## Development Deployment

### Local Testing

1. **Build the extension**:
```bash
cd packages/kortix-chrome-extension
pnpm build
```

2. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select `packages/kortix-chrome-extension/dist`

3. **Verify installation**:
   - Extension should appear in `chrome://extensions/`
   - Icon should appear in Chrome toolbar
   - Click icon to open popup

### Testing Commands

Use the browser console to test commands:

```javascript
// Test status
chrome.runtime.sendMessage({
  type: 'getStatus'
}, (response) => {
  console.log('Status:', response);
});

// Test command execution
chrome.runtime.sendMessage({
  type: 'executeCommand',
  command: {
    id: 'test-1',
    action: 'getPageInfo'
  },
  commandId: 'test-1'
}, (response) => {
  console.log('Result:', response);
});

// Test email extraction
chrome.runtime.sendMessage({
  type: 'executeCommand',
  command: {
    id: 'test-2',
    action: 'extractEmails'
  },
  commandId: 'test-2'
}, (response) => {
  console.log('Emails:', response.data);
});
```

## Chrome Web Store Deployment

### Prerequisites

1. **Chrome Web Store Developer Account**:
   - Go to https://chrome.google.com/webstore/devconsole
   - Pay $5 registration fee
   - Verify email address

2. **Assets**:
   - 128x128 icon (PNG)
   - 1280x800 screenshot (PNG)
   - 440x280 promotional image (PNG)
   - Privacy policy URL
   - Support email

### Submission Process

1. **Prepare extension**:
```bash
cd packages/kortix-chrome-extension
pnpm build
pnpm pack
```

This creates a `.zip` file ready for submission.

2. **Upload to Web Store**:
   - Go to https://chrome.google.com/webstore/devconsole
   - Click "New item"
   - Upload the `.zip` file
   - Fill in extension details:
     - Name: "Kortix AI Browser Operator"
     - Description: "Enable Kortix AI agents to control your browser"
     - Category: "Productivity"
     - Language: English
     - Detailed description
     - Screenshots and promotional images
     - Privacy policy
     - Support email

3. **Review and publish**:
   - Submit for review
   - Google reviews within 24-72 hours
   - Extension published to Chrome Web Store

### Versioning

Update version in `package.json` before each release:

```json
{
  "version": "1.0.1"
}
```

Version format: `MAJOR.MINOR.PATCH`

## Backend Integration

### Kortix Backend Setup

1. **Install browser router client**:

In your Kortix backend code:

```python
# In requirements.txt or pyproject.toml
kortix-browser-extension>=1.0.0
```

2. **Initialize browser router**:

```python
from kortix_browser_extension import BrowserRouterClient

# Initialize in your agent setup
browser_router = BrowserRouterClient()
await browser_router.initialize()
```

3. **Use in agents**:

```python
# In your agent code
emails = await browser_router.extract_emails()
content = await browser_router.extract_content()
await browser_router.navigate('https://example.com')
```

### Router Configuration

Configure the router in your Kortix backend:

```python
# config.py
BROWSER_EXTENSION_CONFIG = {
    'enabled': True,
    'timeout': 30,  # Command timeout in seconds
    'max_history': 100,  # Max stored commands
    'retry_attempts': 3,
    'retry_delay': 1000,  # ms
}
```

## Monitoring and Debugging

### Extension Logs

View extension logs in Chrome:

1. Open `chrome://extensions/`
2. Find "Kortix AI Browser Operator"
3. Click "Details"
4. Click "Errors" to see any errors

### Background Script Logs

View background script logs:

1. Open `chrome://extensions/`
2. Find "Kortix AI Browser Operator"
3. Click "Inspect views" → "background page"
4. View console output

### Content Script Logs

View content script logs on any page:

1. Open page where extension is active
2. Open Developer Tools (F12)
3. Check Console tab for `[Kortix]` messages

## Troubleshooting

### Extension Not Loading

**Problem**: Extension doesn't appear in `chrome://extensions/`

**Solution**:
- Check manifest.json syntax (use JSON validator)
- Verify all file paths are correct
- Check browser console for errors
- Try removing and re-adding extension

### Commands Not Executing

**Problem**: Commands timeout or fail

**Solution**:
- Verify content script is injected (check page console)
- Check command format matches specification
- Verify element selectors are correct
- Check for JavaScript errors in content script

### Email Extraction Not Working

**Problem**: No emails extracted from page

**Solution**:
- Verify page has visible email addresses
- Check regex pattern matches email format
- Verify page is fully loaded before extraction
- Check for dynamically loaded content (use scroll first)

### High Memory Usage

**Problem**: Extension uses excessive memory

**Solution**:
- Clear history: Click "Clear History" in popup
- Check for memory leaks in custom scripts
- Limit extraction history size
- Monitor background script memory usage

## Security Considerations

### Permissions

The extension requests these permissions:

- `scripting` - Execute scripts in pages
- `tabs` - Access tab information
- `storage` - Store extension data
- `activeTab` - Access current tab
- `webRequest` - Monitor web requests
- `<all_urls>` - Work on any website

These are necessary for browser control functionality.

### Data Privacy

- Extension data is stored locally in Chrome storage
- No data is sent to external servers (except Kortix backend)
- User can clear history at any time
- Extension respects page's Content Security Policy

### Secure Communication

When integrating with Kortix backend:

1. **Use HTTPS only**
2. **Validate all messages**
3. **Sign commands** with backend secret
4. **Verify responses** before processing
5. **Log all commands** for audit trail

Example secure integration:

```python
import hmac
import hashlib

def sign_command(command: dict, secret: str) -> str:
    """Sign command with HMAC"""
    message = json.dumps(command, sort_keys=True)
    signature = hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature

def verify_command(command: dict, signature: str, secret: str) -> bool:
    """Verify command signature"""
    expected = sign_command(command, secret)
    return hmac.compare_digest(signature, expected)
```

## Performance Optimization

### Tips for Better Performance

1. **Batch commands**: Send multiple commands together
2. **Use selectors**: Prefer CSS selectors over full page extraction
3. **Limit history**: Clear old entries regularly
4. **Cache results**: Store extraction results locally
5. **Optimize scripts**: Keep injected scripts minimal

### Benchmarks

Typical command execution times:

- Navigate: 1-3 seconds
- Click: 100-500ms
- Type: 50-200ms
- Scroll: 100-300ms
- Extract emails: 200-800ms
- Screenshot: 500-2000ms

## Rollback Procedure

If an update causes issues:

1. **Disable extension**:
   - Open `chrome://extensions/`
   - Toggle extension off

2. **Downgrade**:
   - Remove current version
   - Install previous version from backup

3. **Report issue**:
   - File GitHub issue with error details
   - Include browser version and OS
   - Provide reproduction steps

## Support

For deployment issues:

- **GitHub Issues**: https://github.com/kortix-ai/suna/issues
- **Discord**: https://discord.com/invite/RvFhXUdZ9H
- **Email**: support@kortix.ai

## Changelog

### v1.0.0 (Initial Release)

- Initial release
- Support for all core commands
- Minimal popup UI
- History tracking
- Email extraction
- Content extraction
