/**
 * Kortix AI Browser Operator - Background Service Worker
 * 
 * Implements the listener/router pattern matching Manus "My Browser" architecture.
 * Receives commands from Kortix backend router and executes them in the browser.
 * 
 * Architecture:
 * Kortix Backend Router → Background Service Worker → Content Script → Browser DOM
 *                      ↓
 *              Storage (History & Config)
 */

interface Command {
  id: string;
  type: string;
  action: string;
  params?: Record<string, any>;
  timestamp: number;
}

interface CommandResult {
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

interface ExtensionState {
  isListening: boolean;
  sessionId: string;
  lastCommand: Command | null;
  commandHistory: Command[];
  extractionHistory: any[];
}

// Global state
let state: ExtensionState = {
  isListening: true,
  sessionId: generateSessionId(),
  lastCommand: null,
  commandHistory: [],
  extractionHistory: [],
};

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique command ID
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initialize extension state from storage
 */
async function initializeState(): Promise<void> {
  const stored = await chrome.storage.local.get([
    'sessionId',
    'commandHistory',
    'extractionHistory',
  ]);

  if (stored.sessionId) {
    state.sessionId = stored.sessionId;
  } else {
    await chrome.storage.local.set({ sessionId: state.sessionId });
  }

  if (stored.commandHistory) {
    state.commandHistory = stored.commandHistory;
  }

  if (stored.extractionHistory) {
    state.extractionHistory = stored.extractionHistory;
  }

  console.log('[Kortix] Extension initialized', {
    sessionId: state.sessionId,
    isListening: state.isListening,
  });
}

/**
 * Main listener for commands from Kortix backend
 * This is called by the router when a command needs to be executed
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, command, commandId } = request;

  if (type === 'executeCommand') {
    handleCommand(command, commandId, sender)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          commandId,
          success: false,
          error: error.message,
          timestamp: Date.now(),
        });
      });

    // Return true to indicate we'll send response asynchronously
    return true;
  }

  if (type === 'getStatus') {
    sendResponse({
      isListening: state.isListening,
      sessionId: state.sessionId,
      commandCount: state.commandHistory.length,
      extractionCount: state.extractionHistory.length,
    });
    return true;
  }

  if (type === 'getHistory') {
    sendResponse({
      commands: state.commandHistory.slice(-50), // Last 50 commands
      extractions: state.extractionHistory.slice(-50),
    });
    return true;
  }

  sendResponse({ success: false, error: 'Unknown message type' });
  return true;
});

/**
 * Handle command execution
 * Routes command to content script in active tab
 */
async function handleCommand(
  command: Command,
  commandId: string,
  _sender: chrome.runtime.MessageSender
): Promise<CommandResult> {
  try {
    // Store command in history
    state.lastCommand = command;
    state.commandHistory.push(command);

    // Keep only last 100 commands
    if (state.commandHistory.length > 100) {
      state.commandHistory = state.commandHistory.slice(-100);
    }

    // Save to storage
    await chrome.storage.local.set({
      commandHistory: state.commandHistory,
    });

    // Get active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    // Send command to content script
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: 'executeCommand',
      command,
      commandId,
      sessionId: state.sessionId,
    });

    // Store extraction results if applicable
    if (command.action === 'extractEmails' && result.data?.emails) {
      const extraction = {
        id: generateId(),
        command: command.action,
        url: tab.url,
        emails: result.data.emails,
        timestamp: Date.now(),
      };

      state.extractionHistory.unshift(extraction);

      // Keep only last 100 extractions
      if (state.extractionHistory.length > 100) {
        state.extractionHistory = state.extractionHistory.slice(0, 100);
      }

      await chrome.storage.local.set({
        extractionHistory: state.extractionHistory,
      });
    }

    return {
      commandId,
      success: true,
      data: result.data,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[Kortix] Command execution error:', error);

    return {
      commandId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, data } = request;

  if (type === 'extractionComplete') {
    // Store extraction result
    const extraction = {
      id: generateId(),
      command: 'extractEmails',
      url: sender.url,
      data: data,
      timestamp: Date.now(),
    };

    state.extractionHistory.unshift(extraction);

    // Keep only last 100
    if (state.extractionHistory.length > 100) {
      state.extractionHistory = state.extractionHistory.slice(0, 100);
    }

    chrome.storage.local.set({
      extractionHistory: state.extractionHistory,
    });

    sendResponse({ success: true });
    return true;
  }

  return true;
});

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[Kortix] Extension installed');
    await initializeState();

    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html'),
    });
  }

  if (details.reason === 'update') {
    console.log('[Kortix] Extension updated');
  }
});

/**
 * Initialize on startup
 */
initializeState().catch(console.error);

/**
 * Export for testing
 */
export { state, handleCommand, generateSessionId };
