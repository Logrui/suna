/**
 * Kortix AI Browser Operator - Premium Popup Script v4
 * 
 * THE FORTRESS VERSION: Redundant event binding + Visual verification.
 * Absolutely NO inline handlers (MV3 compatible).
 */

import { getConfig } from '../config';

// ========== Global State ==========
const state = {
  activeTab: 'overview',
  isConnected: false,
  connectionState: 'idle',
  sessionId: '-',
  commandCount: 0,
  initialized: false
};

// ========== Initialization ==========

function initialize() {
  if (state.initialized) return;

  console.log('🚀 [Kortix] Fortress Initializing...');
  try {
    injectStyles();
    renderApp();
    bindEvents();
    startSyncLoop();
    state.initialized = true;
    console.log('✅ [Kortix] Fortress Ready');
  } catch (err) {
    console.error('❌ [Kortix] Init failed:', err);
  }
}

// ========== Background Sync ==========

async function syncStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getStatus' });
    if (response) {
      state.isConnected = response.isConnected;
      state.connectionState = response.state || (response.isConnected ? 'connected' : 'idle');
      state.sessionId = response.sessionId || '-';
      state.commandCount = response.commandCount || 0;
      updateDynamicUI();
    }
  } catch (err) {
    state.connectionState = 'error';
    updateDynamicUI();
  }
}

function startSyncLoop() {
  syncStatus();
  setInterval(syncStatus, 1500);
}

// ========== UI Engine ==========

function injectStyles() {
  const style = document.createElement('style');
  style.id = 'kortix-fortress-styles';
  style.textContent = `
    @font-face {
      font-family: 'Roobert';
      src: url('fonts/roobert/Roobert-Medium.woff2') format('woff2');
      font-weight: 500;
      font-display: swap;
    }

    :root {
      --background: oklch(0.185 0.005 285.823);
      --foreground: oklch(0.985 0 0);
      --card: oklch(0.2 0.005 285.823);
      --primary: oklch(0.985 0 0);
      --secondary: oklch(54.65% 0.246 262.87);
      --muted: oklch(0.31 0 0);
      --muted-foreground: oklch(0.708 0 0);
      --border: oklch(0.2565 0.0019 286.27);
      --radius: 1rem;
      --font-sans: 'Roobert', -apple-system, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      width: 360px;
      height: 520px;
      font-family: var(--font-sans);
      background: var(--background);
      color: var(--foreground);
      overflow: hidden;
      position: relative;
    }

    /* Premium Effects */
    .orb-container { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
    .orb { position: absolute; border-radius: 50%; filter: blur(80px); animation: float 20s ease-in-out infinite; }
    .orb-1 { width: 400px; height: 400px; background: radial-gradient(circle, oklch(1 0 0 / 0.1) 0%, transparent 70%); top: -10%; left: -10%; }
    .orb-2 { width: 300px; height: 300px; background: radial-gradient(circle, oklch(1 0 0 / 0.1) 0%, transparent 70%); bottom: -10%; right: -10%; animation-delay: 7s; }
    @keyframes float { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(20px, -20px); } }
    .grain { position: fixed; inset: 0; background-image: url('grain-texture.png'); opacity: 0.05; pointer-events: none; z-index: 100; mix-blend-mode: overlay; }
    .brandmark-bg { position: fixed; inset: 0; opacity: 0.1; pointer-events: none; display: flex; align-items: center; justify-content: center; z-index: 0; }

    /* Layout */
    .container { position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; padding: 24px; }
    header { display: flex; flex-direction: column; align-items: center; margin-bottom: 24px; text-align: center; }
    .logo-wrapper { position: relative; width: 112px; height: 96px; margin-bottom: 8px; }
    .logo-symbol { position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:60px; filter:invert(1); }
    h1 { font-size: 24px; font-weight:600; letter-spacing:-0.02em; margin:0; }
    .divider { height:1px; width:100%; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 16px 0; }

    /* Tabs Control - THE TARGETS */
    .tabs { display: flex; gap: 4px; background: oklch(0.25 0.01 285 / 0.5); padding: 4px; border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--border); }
    .tab-btn { 
      flex: 1; 
      padding: 10px; 
      border: none; 
      background: transparent; 
      color: var(--muted-foreground); 
      font-size: 13px; 
      font-weight: 500; 
      cursor: pointer; 
      border-radius: 8px; 
      transition: 0.2s;
    }
    .tab-btn.active { 
      background: var(--card); 
      color: var(--foreground); 
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
      border: 1px solid var(--border); 
    }

    /* Content */
    .content-area { flex: 1; display: flex; flex-direction: column; }
    .glass-card { background: oklch(0.2 0.01 285 / 0.8); backdrop-filter: blur(12px); border: 1px solid var(--border); border-radius: 20px; padding: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .stat-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { font-size: 13px; color: var(--muted-foreground); }
    .stat-value { font-size: 13px; font-weight: 600; font-family: monospace; }

    .status-indicator { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 4px 10px; border-radius: 8px; margin-bottom: 12px; }
    .status-indicator.connected { color: #4ade80; background: oklch(0.7 0.2 150 / 0.1); }
    .status-indicator.disconnected { color: #f87171; background: oklch(0.6 0.2 25 / 0.1); }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    /* Action Button */
    .btn { width: 100%; height: 48px; border-radius: 12px; border: none; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; margin-top: auto; }
    .btn-primary { background: var(--foreground); color: var(--background); }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--foreground); }

    /* Settings View */
    .settings-group { margin-bottom: 16px; }
    .settings-label { font-size: 11px; color: var(--muted-foreground); margin-bottom: 4px; text-transform: uppercase; display: block; }
    .settings-box { background: rgba(0,0,0,0.2); border: 1px solid var(--border); padding: 10px; border-radius: 8px; font-size: 11px; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .hidden { display: none !important; }

    /* Visual Confirmation Pulse */
    .click-feedback { animation: click-pulse 0.3s ease-out; }
    @keyframes click-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(0.95); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function renderApp() {
  const root = document.getElementById('root');
  if (!root) return;
  const config = getConfig();

  root.innerHTML = `
    <div class="orb-container">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
    </div>
    <div class="brandmark-bg">
      <img src="kortix-brandmark-bg.svg" alt="">
    </div>
    <div class="grain"></div>
    
    <div class="container">
      <header>
        <div class="logo-wrapper">
          <img src="kortix-symbol.svg" class="logo-symbol">
        </div>
        <h1>Browser Operator</h1>
        <div class="divider"></div>
      </header>

      <div class="tabs">
        <button id="nav-overview" class="tab-btn active">Overview</button>
        <button id="nav-settings" class="tab-btn">Settings</button>
      </div>

      <div id="view-overview" class="content-area">
        <div class="glass-card">
          <div id="status-badge" class="status-indicator disconnected">
            <span class="dot"></span>
            <span id="status-text">Disconnected</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Session ID</span>
            <span id="stat-session" class="stat-value">-</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Commands</span>
            <span id="stat-cmds" class="stat-value">0</span>
          </div>
        </div>
        <button id="btn-action" class="btn btn-primary">Connect Browser</button>
      </div>

      <div id="view-settings" class="content-area hidden">
        <div class="glass-card">
          <div class="settings-group">
            <span class="settings-label">Backend API</span>
            <div class="settings-box">${config.apiUrl}</div>
          </div>
          <div class="settings-group">
            <span class="settings-label">Frontend</span>
            <div class="settings-box">${config.frontendUrl}</div>
          </div>
        </div>
      </div>

      <footer style="margin-top:20px; display:flex; justify-content:space-between; font-size:11px; color:var(--muted-foreground)">
        <span>v${chrome.runtime.getManifest().version}</span>
        <span style="color:var(--secondary)">SYHC.DEV</span>
      </footer>
    </div>
  `;
}

// ========== The Fortress Event System ==========

function bindEvents() {
  console.log('🔗 [Kortix] Binding events...');

  const setupBtn = (id: string, callback: () => void) => {
    const el = document.getElementById(id);
    if (el) {
      // Remove any existing listeners by cloning (extreme safety)
      const newEl = el.cloneNode(true) as HTMLElement;
      el.parentNode?.replaceChild(newEl, el);

      newEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🎯 Clicked: ${id}`);

        // Add visual feedback
        newEl.classList.add('click-feedback');
        setTimeout(() => newEl.classList.remove('click-feedback'), 300);

        callback();
      });
    } else {
      console.warn(`⚠️ [Kortix] Could not find element: ${id}`);
    }
  };

  setupBtn('nav-overview', () => switchTab('overview'));
  setupBtn('nav-settings', () => switchTab('settings'));
  setupBtn('btn-action', () => handleMainAction());

  // Also add a global delegation as the ultimate fallback
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('button');
    if (!btn) return;

    if (btn.id === 'nav-overview' && state.activeTab !== 'overview') switchTab('overview');
    if (btn.id === 'nav-settings' && state.activeTab !== 'settings') switchTab('settings');
    if (btn.id === 'btn-action') handleMainAction();
  });
}

function switchTab(t: 'overview' | 'settings') {
  if (state.activeTab === t) return;

  console.log(`🔄 Switching to ${t}`);
  state.activeTab = t;

  const bOv = document.getElementById('nav-overview');
  const bSe = document.getElementById('nav-settings');
  const vOv = document.getElementById('view-overview');
  const vSe = document.getElementById('view-settings');

  if (t === 'overview') {
    bOv?.classList.add('active');
    bSe?.classList.remove('active');
    vOv?.classList.remove('hidden');
    vSe?.classList.add('hidden');
  } else {
    bOv?.classList.remove('active');
    bSe?.classList.add('active');
    vOv?.classList.add('hidden');
    vSe?.classList.remove('hidden');
  }
}

async function handleMainAction() {
  console.log('⚡ Action: Connect/Disconnect');
  if (state.isConnected) {
    chrome.runtime.sendMessage({ type: 'disconnect' });
  } else {
    chrome.runtime.sendMessage({ type: 'openLoginPage' });
    window.close();
  }
}

// ========== Dynamic Updates ==========

function updateDynamicUI() {
  const badge = document.getElementById('status-badge');
  const txt = document.getElementById('status-text');
  const btn = document.getElementById('btn-action');
  const sess = document.getElementById('stat-session');
  const cmds = document.getElementById('stat-cmds');

  if (badge) badge.className = `status-indicator ${state.isConnected ? 'connected' : 'disconnected'}`;
  if (txt) txt.textContent = state.connectionState.toUpperCase();
  if (btn) {
    btn.textContent = state.isConnected ? 'Disconnect Extension' : 'Connect Browser';
    btn.className = `btn ${state.isConnected ? 'btn-outline' : 'btn-primary'}`;
  }
  if (sess) sess.textContent = state.sessionId !== '-' ? state.sessionId.slice(0, 10) + '...' : '-';
  if (cmds) cmds.textContent = state.commandCount.toString();
}

// ========== Auto-Start ==========
initialize();

// Fallback for document states
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  setTimeout(initialize, 100); // Tiny delay to ensure DOM is truly interactive
}
