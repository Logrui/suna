/**
 * Kortix AI Browser Operator - Background Service Worker
 * 
 * Main entry point for the extension. Handles:
 * - WebSocket connection to Kortix backend
 * - Command execution via tab group manager
 * - State persistence
 */

import { wsClient, BrowserCommand, CommandResult } from './websocket-client';
import { tabGroupManager } from './tab-group-manager';
import { getConnectBrowserUrl } from '../config';

// ========== Types ==========

interface ExtensionState {
  isConnected: boolean;
  sessionId: string | null;
  extensionId: string | null;
  commandCount: number;
  lastError: string | null;
}

// ========== State ==========

let state: ExtensionState = {
  isConnected: false,
  sessionId: null,
  extensionId: null,
  commandCount: 0,
  lastError: null,
};

// ========== Command Handlers ==========

/**
 * Handle commands from the backend
 */
async function handleBackendCommand(command: BrowserCommand): Promise<CommandResult> {
  console.log('[Kortix Extension - Background] Handling command:', command.action, command.params);
  state.commandCount++;

  try {
    // Lazily ensure the Kortix tab group and a tab exist when any command is issued
    await tabGroupManager.getOrCreateGroup();

    let data: Record<string, any> = {};

    switch (command.action) {
      case 'navigate':
        await handleNavigate(command.params);
        data = await getPageState();
        break;

      case 'click':
        await handleClick(command.params);
        data = await getPageState();
        break;

      case 'type':
        await handleType(command.params);
        data = await getPageState();
        break;

      case 'scroll_down':
        await handleScroll({ direction: 'down' });
        data = await getPageState();
        break;

      case 'scroll_up':
        await handleScroll({ direction: 'up' });
        data = await getPageState();
        break;

      case 'screenshot':
        const screenshot = await tabGroupManager.captureScreenshot();
        const tab = await tabGroupManager.getActiveTab();
        data = {
          screenshot_base64: screenshot,
          url: tab?.url || '',
          title: tab?.title || '',
        };
        break;

      case 'new_tab':
        await tabGroupManager.createTab(command.params.url || '');
        data = await getPageState();
        break;

      case 'close_tab':
        await tabGroupManager.closeActiveTab();
        data = await getPageState();
        break;

      case 'switch_tab':
        const tabId = command.params.tabId || command.params.tab_id;
        if (!tabId) throw new Error('Missing tabId parameter');
        await tabGroupManager.switchTab(Number(tabId));
        data = await getPageState();
        break;

      default:
        throw new Error(`Unknown action: ${command.action}`);
    }


    return {
      type: 'result',
      id: command.id,
      session_id: command.session_id,
      success: true,
      data,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[Kortix Extension - Background] Command error:', error);
    return {
      type: 'result',
      id: command.id,
      session_id: command.session_id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}

/**
 * Navigate to a URL
 */
async function handleNavigate(params: Record<string, any>): Promise<void> {
  const { url } = params;
  if (!url) throw new Error('Missing url parameter');

  await tabGroupManager.navigate(url);

  // Wait for page to load
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Click an element
 */
async function handleClick(params: Record<string, any>): Promise<void> {
  const { selector, x, y } = params;

  if (selector) {
    // Click by selector - send to content script
    await tabGroupManager.sendToActiveTab({
      type: 'executeCommand',
      command: { action: 'click', params: { selector } },
    });
  } else if (x !== undefined && y !== undefined) {
    // Click by coordinates
    await tabGroupManager.executeInActiveTab(() => {
      const element = document.elementFromPoint(x, y);
      if (element instanceof HTMLElement) {
        element.click();
      }
    });
  } else {
    throw new Error('Missing selector or coordinates');
  }
}

/**
 * Type text into an element
 */
async function handleType(params: Record<string, any>): Promise<void> {
  const { selector, text, clear = true } = params;
  if (!selector) throw new Error('Missing selector parameter');
  if (!text) throw new Error('Missing text parameter');

  await tabGroupManager.sendToActiveTab({
    type: 'executeCommand',
    command: { action: 'type', params: { selector, text, clear } },
  });
}

/**
 * Scroll the page
 */
async function handleScroll(params: Record<string, any>): Promise<void> {
  const { direction, amount = 500 } = params;

  await tabGroupManager.sendToActiveTab({
    type: 'executeCommand',
    command: { action: 'scroll', params: { direction, amount } },
  });

  // Wait for scroll animation
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/**
 * Get current page state (URL, title, screenshot)
 */
async function getPageState(): Promise<Record<string, any>> {
  const tab = await tabGroupManager.getActiveTab();
  const screenshot = await tabGroupManager.captureScreenshot();

  return {
    url: tab?.url || '',
    title: tab?.title || '',
    screenshot_base64: screenshot,
  };
}


// ========== Extension Messaging ==========

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type } = request;

  if (type === 'getStatus') {
    sendResponse({
      isConnected: wsClient.isConnected,
      state: wsClient.currentState,
      sessionId: wsClient.currentSessionId,
      extensionId: wsClient.currentExtensionId,
      commandCount: state.commandCount,
      tabGroup: tabGroupManager.state,
    });
    return true;
  }

  if (type === 'connect') {
    const { token } = request;
    if (token) {
      wsClient.connect(token).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    } else {
      sendResponse({ success: false, error: 'No token provided' });
    }
    return true;
  }

  if (type === 'disconnect') {
    wsClient.disconnect();
    sendResponse({ success: true });
    return true;
  }

  if (type === 'openLoginPage') {
    chrome.tabs.create({ url: getConnectBrowserUrl() });
    sendResponse({ success: true });
    return true;
  }

  // Legacy command execution (for testing)
  if (type === 'executeCommand') {
    const { command, commandId } = request;
    handleLegacyCommand(command, commandId)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({
        commandId,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      }));
    return true;
  }

  sendResponse({ success: false, error: 'Unknown message type' });
  return true;
});

/**
 * Handle legacy command format (for backward compatibility)
 */
async function handleLegacyCommand(
  command: { action: string; params?: Record<string, any> },
  commandId: string
): Promise<any> {
  const backendCommand: BrowserCommand = {
    type: 'command',
    id: commandId,
    session_id: 'local',
    action: command.action,
    params: command.params || {},
    timeout_ms: 30000,
    timestamp: Date.now(),
  };

  const result = await handleBackendCommand(backendCommand);
  return {
    commandId,
    success: result.success,
    data: result.data,
    error: result.error,
    timestamp: result.timestamp,
  };
}

// ========== Lifecycle ==========

/**
 * Initialize extension
 */
async function initialize(): Promise<void> {
  console.log('[Kortix Extension - Background] Initializing extension...');

  // Initialize WebSocket client with command handler
  await wsClient.initialize({
    onCommand: handleBackendCommand,
    onStateChange: (connectionState) => {
      state.isConnected = connectionState === 'authenticated';
      state.sessionId = wsClient.currentSessionId;
      state.extensionId = wsClient.currentExtensionId;
      console.log('[Kortix Extension - Background] Connection state:', connectionState);
    },
  });

  console.log('[Kortix Extension - Background] Extension initialized');
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[Kortix Extension - Background] Extension installed');

    // Open welcome/login page
    chrome.tabs.create({ url: getConnectBrowserUrl() });
  }

  if (details.reason === 'update') {
    console.log('[Kortix Extension - Background] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

/**
 * Handle browser startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[Kortix Extension - Background] Browser started, reinitializing...');
  initialize().catch(console.error);
});

// Initialize on load
initialize().catch(console.error);

// ========== Exports (for testing) ==========

export { state, handleBackendCommand, tabGroupManager };
