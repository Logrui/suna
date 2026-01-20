/**
 * Kortix AI Browser Operator - Popup Script
 * 
 * UI for:
 * - Displaying connection status
 * - Login/logout
 * - Command statistics
 * - Tab group info
 */

// ========== Types ==========

interface PopupState {
  isConnected: boolean;
  connectionState: string;
  sessionId: string | null;
  extensionId: string | null;
  commandCount: number;
  tabGroup: {
    groupId: number | null;
    activeTabId: number | null;
    tabIds: number[];
  } | null;
}

let state: PopupState = {
  isConnected: false,
  connectionState: 'disconnected',
  sessionId: null,
  extensionId: null,
  commandCount: 0,
  tabGroup: null,
};

// ========== Initialization ==========

async function initialize(): Promise<void> {
  renderUI();
  await updateStatus();
  startAutoRefresh();
}

// ========== Status ==========

async function updateStatus(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getStatus' });

    state.isConnected = response.isConnected;
    state.connectionState = response.state || 'disconnected';
    state.sessionId = response.sessionId;
    state.extensionId = response.extensionId;
    state.commandCount = response.commandCount || 0;
    state.tabGroup = response.tabGroup || null;

    updateUI();
  } catch (error) {
    console.error('[Kortix Extension - Popup] Failed to get status:', error);
    state.isConnected = false;
    state.connectionState = 'error';
    updateUI();
  }
}

// ========== UI Rendering ==========

function renderUI(): void {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <div class="popup-container">
      <header class="popup-header">
        <div class="logo">
          <span class="logo-icon">🤖</span>
          <span class="logo-text">Kortix</span>
        </div>
        <div id="statusBadge" class="status-badge disconnected">
          <span class="status-dot"></span>
          <span id="statusText">Disconnected</span>
        </div>
      </header>
      
      <main class="popup-main">
        <div id="loginSection" class="section login-section">
          <p class="section-description">Connect to Kortix to enable AI browser control</p>
          <button id="loginBtn" class="btn btn-primary">
            Connect to Kortix
          </button>
        </div>
        
        <div id="connectedSection" class="section connected-section" style="display: none;">
          <div class="stat-row">
            <span class="stat-label">Session</span>
            <span id="sessionId" class="stat-value">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Commands</span>
            <span id="commandCount" class="stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Tab Group</span>
            <span id="tabGroupStatus" class="stat-value">-</span>
          </div>
          <button id="disconnectBtn" class="btn btn-secondary">
            Disconnect
          </button>
        </div>
      </main>
      
      <footer class="popup-footer">
        <span class="version">v${chrome.runtime.getManifest().version}</span>
      </footer>
    </div>
    
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: #ffffff;
        min-width: 300px;
        min-height: 200px;
      }
      
      .popup-container {
        padding: 16px;
      }
      
      .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .logo-icon {
        font-size: 24px;
      }
      
      .logo-text {
        font-size: 18px;
        font-weight: 600;
        background: linear-gradient(90deg, #a855f7, #ec4899);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      .status-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
      }
      
      .status-badge.connected {
        background: rgba(34, 197, 94, 0.2);
        color: #22c55e;
      }
      
      .status-badge.connecting {
        background: rgba(234, 179, 8, 0.2);
        color: #eab308;
      }
      
      .status-badge.disconnected {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
      }
      
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .popup-main {
        margin-bottom: 16px;
      }
      
      .section {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 16px;
      }
      
      .section-description {
        color: rgba(255, 255, 255, 0.7);
        font-size: 13px;
        margin-bottom: 12px;
        text-align: center;
      }
      
      .stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .stat-row:last-of-type {
        border-bottom: none;
        margin-bottom: 12px;
      }
      
      .stat-label {
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
      }
      
      .stat-value {
        color: #ffffff;
        font-size: 13px;
        font-weight: 500;
        font-family: monospace;
      }
      
      .btn {
        width: 100%;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: linear-gradient(90deg, #a855f7, #ec4899);
        color: white;
      }
      
      .btn-primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      
      .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.8);
      }
      
      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      
      .popup-footer {
        text-align: center;
        color: rgba(255, 255, 255, 0.4);
        font-size: 11px;
      }
    </style>
  `;

  // Setup event listeners
  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('disconnectBtn')?.addEventListener('click', handleDisconnect);
}

function updateUI(): void {
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const loginSection = document.getElementById('loginSection');
  const connectedSection = document.getElementById('connectedSection');

  // Update status badge
  if (statusBadge && statusText) {
    statusBadge.className = `status-badge ${state.isConnected ? 'connected' : state.connectionState === 'connecting' ? 'connecting' : 'disconnected'}`;
    statusText.textContent = state.isConnected ? 'Connected' : state.connectionState === 'connecting' ? 'Connecting...' : 'Disconnected';
  }

  // Toggle sections
  if (loginSection && connectedSection) {
    if (state.isConnected) {
      loginSection.style.display = 'none';
      connectedSection.style.display = 'block';
    } else {
      loginSection.style.display = 'block';
      connectedSection.style.display = 'none';
    }
  }

  // Update stats
  const sessionIdEl = document.getElementById('sessionId');
  if (sessionIdEl) {
    sessionIdEl.textContent = state.sessionId ? state.sessionId.slice(0, 12) + '...' : '-';
  }

  const commandCountEl = document.getElementById('commandCount');
  if (commandCountEl) {
    commandCountEl.textContent = String(state.commandCount);
  }

  const tabGroupStatusEl = document.getElementById('tabGroupStatus');
  if (tabGroupStatusEl) {
    if (state.tabGroup && state.tabGroup.groupId !== null) {
      tabGroupStatusEl.textContent = `${state.tabGroup.tabIds.length} tabs`;
    } else {
      tabGroupStatusEl.textContent = 'Not active';
    }
  }
}

// ========== Actions ==========

async function handleLogin(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'openLoginPage' });
    // Close popup after opening login page
    window.close();
  } catch (error) {
    console.error('[Kortix Extension - Popup] Failed to open login page:', error);
  }
}

async function handleDisconnect(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'disconnect' });
    await updateStatus();
  } catch (error) {
    console.error('[Kortix Extension - Popup] Failed to disconnect:', error);
  }
}

// ========== Auto Refresh ==========

function startAutoRefresh(): void {
  setInterval(async () => {
    await updateStatus();
  }, 2000);
}

// ========== Initialize ==========

document.addEventListener('DOMContentLoaded', initialize);
