# Contributing to Kortix Chrome Extension

Thank you for your interest in contributing to the Kortix AI Browser Operator extension!

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Chrome browser (for testing)
- Git

### Getting Started

1. **Clone the repository**:
```bash
git clone https://github.com/kortix-ai/suna.git
cd suna
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Navigate to extension directory**:
```bash
cd packages/kortix-chrome-extension
```

4. **Build the extension**:
```bash
pnpm build
```

5. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dist` directory

## Project Structure

```
src/
├── background/
│   └── background.ts       # Service worker (listener)
├── content/
│   └── content.ts          # Content script (executor)
├── popup/
│   ├── index.html
│   ├── index.tsx
│   └── popup.ts
├── integration/
│   └── browser-router.ts   # Backend integration
└── types/
    └── index.ts            # TypeScript definitions
```

## Making Changes

### Adding a New Command

1. **Add to content script** (`src/content/content.ts`):

```typescript
case 'myNewAction':
  return handleMyNewAction(params);
```

2. **Implement handler**:

```typescript
async function handleMyNewAction(params: any): Promise<any> {
  // Implementation
  return { success: true, data: {...} };
}
```

3. **Add to types** (`src/types/index.ts`):

```typescript
export type CommandAction = 
  | 'navigate'
  | 'myNewAction'  // Add here
  | ...;
```

4. **Add to browser router** (`src/integration/browser-router.ts`):

```typescript
async function myNewAction(params: any): Promise<BrowserCommandResult> {
  return this.executeCommand('myNewAction', params);
}
```

5. **Update README.md** with documentation

### Code Style

- **TypeScript**: Use strict mode
- **Formatting**: Run `pnpm format` before committing
- **Linting**: Run `pnpm lint` to check for issues
- **Comments**: Add JSDoc comments to functions

Example:

```typescript
/**
 * Extract emails from page
 * 
 * @param params - Command parameters
 * @returns Email extraction result
 */
async function handleExtractEmails(params: any): Promise<EmailExtractionResult> {
  // Implementation
}
```

### Testing

1. **Manual testing**:
   - Load extension in Chrome
   - Open page with test content
   - Use browser console to test commands

2. **Example test**:

```javascript
// In browser console
chrome.runtime.sendMessage({
  type: 'executeCommand',
  command: {
    id: 'test-1',
    action: 'myNewAction',
    params: { /* test params */ }
  },
  commandId: 'test-1'
}, (response) => {
  console.log('Result:', response);
});
```

## Commit Guidelines

- **Format**: `[type] description`
- **Types**: feat, fix, docs, style, refactor, test, chore
- **Examples**:
  - `[feat] add new email extraction method`
  - `[fix] handle timeout errors in content script`
  - `[docs] update README with new commands`

## Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

3. **Make your changes**:
   - Write code
   - Add tests
   - Update documentation

4. **Commit your changes**:
   ```bash
   git commit -m "[feat] add my feature"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/my-feature
   ```

6. **Create a Pull Request**:
   - Describe your changes
   - Reference any related issues
   - Include screenshots if UI changes

7. **Address review feedback**:
   - Make requested changes
   - Push updates
   - Request re-review

## Reporting Issues

### Bug Reports

Include:
- Browser version and OS
- Extension version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/videos if applicable
- Browser console errors

### Feature Requests

Include:
- Use case description
- Proposed implementation
- Potential challenges
- Related issues or discussions

## Documentation

### Updating README

- Keep it concise and clear
- Include code examples
- Update table of contents if adding sections
- Test all code examples

### Adding JSDoc Comments

```typescript
/**
 * Brief description
 * 
 * Longer description if needed
 * 
 * @param param1 - Description of param1
 * @param param2 - Description of param2
 * @returns Description of return value
 * @throws Error description
 * 
 * @example
 * const result = await myFunction('value');
 */
function myFunction(param1: string, param2?: number): Promise<Result> {
  // Implementation
}
```

## Performance Considerations

- **Minimize DOM queries**: Cache selectors when possible
- **Batch operations**: Combine multiple operations
- **Avoid blocking**: Use async/await properly
- **Memory management**: Clean up event listeners
- **Message size**: Keep command payloads small

## Security Guidelines

- **Validate input**: Check all command parameters
- **Sanitize output**: Escape user-provided data
- **Avoid eval**: Never use eval() for code execution
- **Respect CSP**: Follow Content Security Policy
- **Secure storage**: Don't store sensitive data in plain text

## Building and Publishing

### Build for Testing

```bash
pnpm build
```

Output in `dist/` directory.

### Build for Distribution

```bash
pnpm pack
```

Creates `.zip` file for Chrome Web Store submission.

## Questions?

- **GitHub Discussions**: https://github.com/kortix-ai/suna/discussions
- **Discord**: https://discord.com/invite/RvFhXUdZ9H
- **Email**: dev@kortix.ai

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

Thank you for contributing! 🎉
