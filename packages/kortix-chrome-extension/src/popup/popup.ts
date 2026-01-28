/**
 * Kortix AI Browser Operator - Popup Script
 * 
 * Minimal UI for:
 * - Displaying connection status
 * - Showing command/extraction statistics
 * - Debugging and history
 */

interface PopupState {
  isListening: boolean;
  sessionId: string;
  commandCount: number;
  extractionCount: number;
  recentActivity: string[];
}

let state: PopupState = {
  isListening: false,
  sessionId: '',
  commandCount: 0,
  extractionCount: 0,
  recentActivity: [],
};

/**
 * Initialize popup
 */
async function initialize(): Promise<void> {
  await updateStatus();
  setupEventListeners();
  startAutoRefresh();
}

/**
 * Update status from background script
 */
async function updateStatus(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'getStatus',
    });

    state.isListening = true;
    state.sessionId = response.sessionId;
    state.commandCount = response.commandCount || 0;
    state.extractionCount = response.extractionCount || 0;

    updateUI();
  } catch (error) {
    console.error('[Kortix] Failed to get status:', error);
    state.isListening = false;
    updateUI();
  }
}

/**
 * Update UI elements
 */
function updateUI(): void {
  // Update status indicator
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  if (statusIndicator) {
    statusIndicator.className = state.isListening
      ? 'status-indicator active'
      : 'status-indicator error';
  }

  if (statusText) {
    statusText.textContent = state.isListening
      ? 'Listening for commands'
      : 'Disconnected';
  }

  // Update stats
  const commandCountEl = document.getElementById('commandCount');
  if (commandCountEl) {
    commandCountEl.textContent = String(state.commandCount);
  }

  const extractionCountEl = document.getElementById('extractionCount');
  if (extractionCountEl) {
    extractionCountEl.textContent = String(state.extractionCount);
  }

  // Update history
  updateHistory();
}

/**
 * Update activity history display
 */
async function updateHistory(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'getHistory',
    });

    const historyEl = document.getElementById('history');
    if (!historyEl) return;

    const commands = response.commands || [];
    const extractions = response.extractions || [];

    if (commands.length === 0 && extractions.length === 0) {
      historyEl.innerHTML = '<div class="history-empty">No activity yet</div>';
      return;
    }

    // Combine and sort by timestamp
    const allActivity = [
      ...commands.map((c: any) => ({
        type: 'command',
        action: c.action,
        timestamp: c.timestamp,
      })),
      ...extractions.map((e: any) => ({
        type: 'extraction',
        action: 'extractEmails',
        timestamp: e.timestamp,
        count: e.data?.emails?.length || 0,
      })),
    ].sort((a, b) => b.timestamp - a.timestamp);

    historyEl.innerHTML = allActivity
      .slice(0, 10)
      .map((item) => {
        const time = new Date(item.timestamp).toLocaleTimeString();
        const label =
          item.type === 'extraction'
            ? `Extracted ${item.count} emails`
            : `Command: ${item.action}`;

        return `<div class="history-item"><strong>${label}</strong><br><small>${time}</small></div>`;
      })
      .join('');
  } catch (error) {
    console.error('[Kortix] Failed to get history:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', clearHistory);
  }

  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }
}

/**
 * Clear history
 */
async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({
    commandHistory: [],
    extractionHistory: [],
  });

  state.commandCount = 0;
  state.extractionCount = 0;
  updateUI();
}

/**
 * Open settings (placeholder)
 */
function openSettings(): void {
  alert('Settings coming soon');
}

/**
 * Auto-refresh status every 2 seconds
 */
function startAutoRefresh(): void {
  setInterval(async () => {
    await updateStatus();
  }, 2000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initialize);
