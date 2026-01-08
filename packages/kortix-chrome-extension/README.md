# Kortix AI Browser Operator

A headless Chrome extension that implements a listener/router pattern for Kortix AI agents to control your browser. This extension receives commands from the Kortix backend and executes them in your browser context.

## Architecture

The extension follows the same listener/router pattern as Manus "My Browser":

```
Kortix Backend Router
         ↓
    (WebSocket/HTTP)
         ↓
Background Service Worker (Listener)
         ↓
Content Script (Executor)
         ↓
Browser DOM
```

## Features

- **Command Execution**: Execute arbitrary commands in browser context
- **Email Extraction**: Extract emails from web pages
- **DOM Interaction**: Click, type, scroll, fill forms
- **Content Extraction**: Extract text and structured data
- **Screenshot Capture**: Capture page screenshots
- **Session Management**: Track commands and extraction history
- **Minimal UI**: Status display and debugging interface

## Installation

### Development

1. Clone the suna repository:
```bash
git clone https://github.com/kortix-ai/suna.git
cd suna
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the extension:
```bash
cd packages/kortix-chrome-extension
pnpm build
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `packages/kortix-chrome-extension/dist`

### Production

The extension is packaged for Chrome Web Store deployment. See `DEPLOYMENT.md` for details.

## Command API

The extension accepts commands from the Kortix backend router with the following structure:

```typescript
interface Command {
  id: string;
  action: string;
  params?: Record<string, any>;
  timestamp: number;
}
```

### Supported Actions

#### Navigation
- `navigate` - Navigate to URL
  - `params.url` - Target URL

#### DOM Interaction
- `click` - Click element
  - `params.selector` or `params.index` - Element selector or index
- `type` - Type text into input
  - `params.selector` or `params.index` - Element selector or index
  - `params.text` - Text to type
- `scroll` - Scroll page
  - `params.direction` - 'up', 'down', 'top', 'bottom'
  - `params.amount` - Scroll distance (default: 500px)

#### Data Extraction
- `extractEmails` - Extract emails from page
  - Returns: `{ emails: string[], count: number, sources: {...} }`
- `extractContent` - Extract page content
  - `params.selector` - Optional CSS selector
  - Returns: `{ content: string, length: number }`
- `getElements` - Get interactive elements
  - Returns: `{ elements: [...], total: number }`
- `getPageInfo` - Get page metadata
  - Returns: `{ title, url, domain, scrollY, ... }`

#### Form Interaction
- `fillForm` - Fill multiple form fields
  - `params.fields` - Object mapping selectors to values
- `submitForm` - Submit form
  - `params.selector` - Optional form selector

#### Utilities
- `screenshot` - Capture page screenshot
  - Returns: `{ screenshot: base64_png, width, height }`
- `executeScript` - Execute arbitrary JavaScript
  - `params.code` - JavaScript code to execute

## Response Format

All commands return a response with this structure:

```typescript
interface CommandResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}
```

## Storage

The extension stores:
- **Session ID**: Unique identifier for the current session
- **Command History**: Last 100 commands executed
- **Extraction History**: Last 100 extraction results

Access via Chrome storage API:
```javascript
chrome.storage.local.get(['sessionId', 'commandHistory', 'extractionHistory'])
```

## Integration with Kortix Backend

The Kortix backend router should:

1. Detect when the extension is installed and available
2. Route browser commands to the extension via `chrome.runtime.sendMessage()`
3. Handle responses asynchronously
4. Store results for agent processing

Example backend integration:

```python
# In Kortix backend router
def route_browser_command(command: Command) -> CommandResult:
    # Check if My Browser extension is available
    if is_extension_available():
        # Send command to extension
        result = send_to_extension(command)
        return result
    else:
        # Fallback to sandbox browser or cloud browser
        return execute_in_sandbox(command)
```

## Development

### Project Structure

```
packages/kortix-chrome-extension/
├── src/
│   ├── background/
│   │   └── background.ts       # Service worker (listener)
│   ├── content/
│   │   └── content.ts          # Content script (executor)
│   └── popup/
│       ├── index.html
│       ├── index.tsx
│       └── popup.ts
├── public/
│   ├── manifest.json
│   └── popup.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Building

```bash
pnpm build
```

Output is in `dist/` directory.

### Testing

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Security Considerations

1. **Permissions**: The extension requests `<all_urls>` permission to work on any website
2. **Content Scripts**: Run in page context with full DOM access
3. **Message Validation**: All messages should be validated and signed
4. **Data Isolation**: Sensitive data is stored in extension storage, not in page context
5. **CORS**: Extension can bypass CORS for backend communication

## Limitations

- Cannot access cross-origin iframes
- Cannot execute code in other extensions
- Cannot access browser history or bookmarks
- Cannot modify Chrome settings
- Limited to browser automation capabilities

## Troubleshooting

### Extension not loading
- Check `chrome://extensions/` for errors
- Verify manifest.json syntax
- Check browser console for errors

### Commands not executing
- Verify content script is injected (check page console)
- Check command format matches specification
- Verify element selectors are correct

### Emails not extracting
- Check page has visible email addresses
- Verify regex pattern matches email format
- Check for dynamically loaded content

## Contributing

See `CONTRIBUTING.md` in the suna repository root.

## License

MIT - See LICENSE file in suna repository root.

## Support

For issues and questions:
- GitHub Issues: https://github.com/kortix-ai/suna/issues
- Discord: https://discord.com/invite/RvFhXUdZ9H
