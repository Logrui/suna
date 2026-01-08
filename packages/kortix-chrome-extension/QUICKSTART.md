# Kortix Chrome Extension - Quick Start Guide

Get up and running with the Kortix Chrome Extension in 5 minutes.

## Installation

### 1. Build the Extension

```bash
cd packages/kortix-chrome-extension
pnpm install
pnpm build
```

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select `packages/kortix-chrome-extension/dist`

### 3. Verify Installation

- Extension appears in `chrome://extensions/`
- Icon appears in Chrome toolbar
- Click icon to open popup (shows "Listening for commands")

## First Command

### Test in Browser Console

```javascript
// Get extension status
chrome.runtime.sendMessage({
  type: 'getStatus'
}, (response) => {
  console.log('Extension status:', response);
});
```

### Expected Response

```javascript
{
  isListening: true,
  sessionId: "session_1704xxx_abc123",
  commandCount: 0,
  extractionCount: 0
}
```

## Common Commands

### Navigate to URL

```javascript
chrome.runtime.sendMessage({
  type: 'executeCommand',
  command: {
    id: 'cmd-1',
    action: 'navigate',
    params: { url: 'https://example.com' }
  },
  commandId: 'cmd-1'
}, (response) => {
  console.log('Navigated:', response.data);
});
```

### Extract Emails

```javascript
chrome.runtime.sendMessage({
  type: 'executeCommand',
  command: {
    id: 'cmd-2',
    action: 'extractEmails'
  },
  commandId: 'cmd-2'
}, (response) => {
  console.log('Emails:', response.data.emails);
});
```

### Get Page Info

```javascript
chrome.runtime.sendMessage({
  type: 'executeCommand',
  command: {
    id: 'cmd-3',
    action: 'getPageInfo'
  },
  commandId: 'cmd-3'
}, (response) => {
  console.log('Page info:', response.data);
});
```

### Click Element

```javascript
chrome.runtime.sendMessage({
  type: 'executeCommand',
  command: {
    id: 'cmd-4',
    action: 'click',
    params: { selector: 'button.submit' }
  },
  commandId: 'cmd-4'
}, (response) => {
  console.log('Clicked:', response.success);
});
```

### Type Text

```javascript
chrome.runtime.sendMessage({
  type: 'executeCommand',
  command: {
    id: 'cmd-5',
    action: 'type',
    params: { 
      selector: 'input[type="email"]',
      text: 'user@example.com'
    }
  },
  commandId: 'cmd-5'
}, (response) => {
  console.log('Typed:', response.success);
});
```

## Backend Integration

### Python Example

```python
from kortix_browser_extension import BrowserRouterClient

# Initialize
client = BrowserRouterClient()
await client.initialize()

# Navigate
result = await client.navigate('https://example.com')
print(f"Navigated to: {result.data['url']}")

# Extract emails
emails = await client.extract_emails()
print(f"Found {len(emails)} emails: {emails}")

# Get page info
info = await client.get_page_info()
print(f"Page title: {info['title']}")

# Click element
await client.click('button.submit')

# Type text
await client.type('input[name="email"]', 'test@example.com')
```

## Debugging

### View Extension Logs

1. Open `chrome://extensions/`
2. Find "Kortix AI Browser Operator"
3. Click "Details"
4. Click "Errors" to see any errors

### View Content Script Logs

1. Open any webpage
2. Press F12 to open Developer Tools
3. Check Console for `[Kortix]` messages

### Check Popup Status

1. Click extension icon in toolbar
2. View status indicator (green = listening)
3. See command and extraction counts

## Troubleshooting

### Extension Not Showing

**Problem**: Extension doesn't appear in `chrome://extensions/`

**Solution**:
```bash
# Rebuild extension
pnpm build

# Clear Chrome cache
# Go to chrome://settings/clearBrowserData
# Select "All time" and "Extensions"

# Reload extension
# Go to chrome://extensions/ and click reload icon
```

### Commands Not Working

**Problem**: Commands fail or timeout

**Solution**:
- Verify content script is injected (check page console)
- Check command format is correct
- Verify element selectors exist on page
- Try on a different website

### Emails Not Extracting

**Problem**: No emails found on page with emails

**Solution**:
- Verify page has visible email addresses
- Check email format (must match: `user@domain.com`)
- Try scrolling first to load dynamic content
- Check page source for email patterns

## Next Steps

1. **Read full documentation**: See `README.md`
2. **Learn integration**: See `INTEGRATION.md`
3. **Explore examples**: See `src/testing/example.test.ts`
4. **Deploy to production**: See `DEPLOYMENT.md`

## Getting Help

- **GitHub Issues**: https://github.com/kortix-ai/suna/issues
- **Discord**: https://discord.com/invite/RvFhXUdZ9H
- **Email**: support@kortix.ai

## What's Next?

- Integrate with your Kortix backend
- Build agents that use browser control
- Deploy to Chrome Web Store
- Contribute improvements

Happy building! 🚀
