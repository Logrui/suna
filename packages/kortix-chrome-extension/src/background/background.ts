/**
 * Kortix AI Browser Operator - Background Service Worker
 *
 * Main entry point for the extension. Handles:
 * - WebSocket connection to Kortix backend
 * - Command execution via tab group manager
 * - State persistence
 */

import {
  wsClient,
  BrowserCommand,
  CommandResult,
  InteractionCommand,
} from "./websocket-client";
import { tabGroupManager } from "./tab-group-manager";
import { getConnectBrowserUrl } from "../config";
import { inputManager } from "./input-manager";
import { streamingManager } from "./streaming-manager";

// ========== Types ==========

interface ExtensionState {
  isConnected: boolean;
  sessionId: string | null;
  extensionId: string | null;
  commandCount: number;
  lastError: string | null;
  overlayState: "hidden" | "ongoing" | "takeover";
}

// ========== State ==========

let state: ExtensionState = {
  isConnected: false,
  sessionId: null,
  extensionId: null,
  commandCount: 0,
  lastError: null,
  overlayState: "hidden",
};

// ========== Command Handlers ==========

/**
 * Handle commands from the backend
 */
async function handleBackendCommand(
  command: BrowserCommand | InteractionCommand,
): Promise<CommandResult> {
  console.log(
    "[Kortix Extension - Background] Handling command:",
    command.action,
  );
  state.commandCount++;

  try {
    // Ensure the Kortix tab group and dedicated window exist when any command is issued
    await tabGroupManager.getOrCreateGroup();

    // Ensure streaming is active when commands are flowing
    if (!streamingManager.streaming) {
      await streamingManager.start();
      await broadcastOverlayState("ongoing");
    }

    let data: Record<string, any> = {};

    switch (command.action) {
      case "navigate":
        await handleNavigate(command.params);
        data = await getPageState();
        break;

      case "click":
        await handleClick(command.params);
        data = await getPageState();
        break;

      case "type":
        await handleType(command.params);
        data = await getPageState();
        break;

      case "scroll_down":
        await handleScroll({ direction: "down" });
        data = await getPageState();
        break;

      case "scroll_up":
        await handleScroll({ direction: "up" });
        data = await getPageState();
        break;

      case "screenshot":
        const screenshot = await tabGroupManager.captureScreenshot();
        const tab = await tabGroupManager.getActiveTab();
        data = {
          screenshot_base64: screenshot,
          url: tab?.url || "",
          title: tab?.title || "",
        };
        break;

      case "new_tab":
        await tabGroupManager.createTab(command.params.url || "");
        data = await getPageState();
        break;

      case "close_tab":
        await tabGroupManager.closeActiveTab();
        data = await getPageState();
        break;

      case "switch_tab":
        const tabId = command.params.tabId || command.params.tab_id;
        if (!tabId) throw new Error("Missing tabId parameter");
        await tabGroupManager.switchTab(Number(tabId));
        data = await getPageState();
        break;

      case "interaction":
        await handleInteraction(command as any);
        return {
          type: "result",
          id: command.id,
          session_id: command.session_id,
          success: true,
          timestamp: Date.now(),
        };

      case "press_key":
        await handlePressKey(command.params);
        data = await getPageState();
        break;

      case "set_file_input_files":
        await handleSetFileInputFiles(command.params);
        data = await getPageState();
        break;

      case "hover":
        await handleHover(command.params);
        data = await getPageState();
        break;

      default:
        throw new Error(`Unknown action: ${command.action}`);
    }

    return {
      type: "result",
      id: command.id,
      session_id: command.session_id,
      success: true,
      data,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("[Kortix Extension - Background] Command error:", error);
    return {
      type: "result",
      id: command.id,
      session_id: command.session_id,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Helper: Wait for tab to reach 'complete' status with safety timeout
 */
function waitForTabLoad(tabId: number, timeoutMs: number = 15000): Promise<void> {
  return new Promise((resolve) => {
    let isResolved = false;
    let timerId: any;

    const cleanup = () => {
      if (isResolved) return;
      isResolved = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timerId);
      resolve();
    };

    const listener = (tid: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (tid === tabId && changeInfo.status === "complete") {
        cleanup();
      }
    };

    // 1. Setup listener first to ensure we don't miss event
    chrome.tabs.onUpdated.addListener(listener);

    // 2. Check current status
    chrome.tabs.get(tabId, (tab) => {
      // Handle case where tab closed or error
      if (chrome.runtime.lastError || !tab) {
        cleanup();
        return;
      }
      if (tab.status === "complete") {
        cleanup();
      }
    });

    // 3. Safety timeout
    timerId = setTimeout(() => {
      if (!isResolved) {
        console.warn(`[Kortix] Tab load wait timed out (${timeoutMs}ms)`);
        cleanup();
      }
    }, timeoutMs);
  });
}

/**
 * Navigate to a URL
 */
async function handleNavigate(params: Record<string, any>): Promise<void> {
  const { url } = params;
  if (!url) throw new Error("Missing url parameter");

  const tab = await tabGroupManager.navigate(url);

  if (tab && tab.id) {
    // Wait for native load event (max 15s)
    await waitForTabLoad(tab.id, 15000);
    // Add hydration buffer for frameworks (React/Vue) to render
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } else {
    // Fallback if no tab ID (unlikely)
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Click an element
 */
async function handleClick(params: Record<string, any>): Promise<void> {
  const { selector, x, y } = params;

  if (selector) {
    // Click by selector - send to content script
    await tabGroupManager.sendToActiveTab({
      type: "executeCommand",
      command: { action: "click", params: { selector } },
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
    throw new Error("Missing selector or coordinates");
  }
}

/**
 * Type text into an element
 */
async function handleType(params: Record<string, any>): Promise<void> {
  const { selector, text, clear = true } = params;
  if (!selector) throw new Error("Missing selector parameter");
  if (!text) throw new Error("Missing text parameter");

  await tabGroupManager.sendToActiveTab({
    type: "executeCommand",
    command: { action: "type", params: { selector, text, clear } },
  });
}

/**
 * Press a specific key (Enter, Tab, etc.)
 */
async function handlePressKey(params: Record<string, any>): Promise<void> {
  const { key } = params;
  if (!key) throw new Error("Missing key parameter");

  const tab = await tabGroupManager.getActiveTab();
  if (!tab || !tab.id) return;

  await inputManager.dispatchKeyEvent(tab.id, {
    type: "keyDown",
    key: key,
  });
  await inputManager.dispatchKeyEvent(tab.id, {
    type: "keyUp",
    key: key,
  });
}

/**
 * Handle file upload by setting files on an input element
 */
async function handleSetFileInputFiles(params: Record<string, any>): Promise<void> {
  const { files, selector, nodeId } = params;
  if (!files || !Array.isArray(files)) throw new Error("Missing or invalid files array");

  const tab = await tabGroupManager.getActiveTab();
  if (!tab || !tab.id) return;

  await inputManager.setFileInputFiles(tab.id, {
    files,
    selector,
    nodeId
  });
}

/**
 * Hover over an element
 */
async function handleHover(params: Record<string, any>): Promise<void> {
  const { selector } = params;
  if (!selector) throw new Error("Missing selector parameter");

  await tabGroupManager.sendToActiveTab({
    type: "executeCommand",
    command: { action: "hover", params: { selector } },
  });
}

/**
 * Handle user interaction from the backend (Live Stream)
 */
async function handleInteraction(command: InteractionCommand): Promise<void> {
  const { action, params } = command;
  const tab = await tabGroupManager.getActiveTab();
  if (!tab || !tab.id) return;

  switch (params.type) {
    case "click":
      await inputManager.dispatchMouseEvent(tab.id, {
        type: "mousePressed",
        x: params.x,
        y: params.y,
        button: params.button || "left",
        clickCount: 1,
      });
      await inputManager.dispatchMouseEvent(tab.id, {
        type: "mouseReleased",
        x: params.x,
        y: params.y,
        button: params.button || "left",
        clickCount: 1,
      });
      break;

    case "mouse_move":
      await inputManager.dispatchMouseEvent(tab.id, {
        type: "mouseMoved",
        x: params.x,
        y: params.y,
      });
      break;

    case "key_down":
      await inputManager.dispatchKeyEvent(tab.id, {
        type: "keyDown",
        text: params.key,
        unmodifiedText: params.key,
        key: params.key,
      });
      break;

    case "key_up":
      await inputManager.dispatchKeyEvent(tab.id, {
        type: "keyUp",
        key: params.key,
      });
      break;

    case "scroll":
      await inputManager.dispatchMouseEvent(tab.id, {
        type: "mouseWheel",
        x: 0,
        y: 0,
        deltaX: params.deltaX || 0,
        deltaY: params.deltaY || 0,
      });
      break;
  }
}

/**
 * Scroll the page
 */
async function handleScroll(params: Record<string, any>): Promise<void> {
  const { direction, amount = 500 } = params;

  await tabGroupManager.sendToActiveTab({
    type: "executeCommand",
    command: { action: "scroll", params: { direction, amount } },
  });

  // Wait for scroll animation
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/**
 * Get current page state (URL, title, screenshot)
 * We use a 'dirty' screenshot (clean: false) here to avoid flickering the overlay
 * after every action, since the live video stream already provide clarity.u
 */
async function getPageState(): Promise<Record<string, any>> {
  const tab = await tabGroupManager.getActiveTab();
  const screenshot = await tabGroupManager.captureScreenshot(undefined, false);

  return {
    url: tab?.url || "",
    title: tab?.title || "",
    screenshot_base64: screenshot,
  };
}

// ========== Extension Messaging ==========

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type } = request;

  if (type === "getStatus") {
    sendResponse({
      isConnected: wsClient.isConnected,
      state: wsClient.currentState,
      sessionId: wsClient.currentSessionId,
      extensionId: wsClient.currentExtensionId,
      commandCount: state.commandCount,
      tabGroup: tabGroupManager.state,
      overlayState: state.overlayState,
    });
    return true;
  }

  if (type === "GET_OVERLAY_STATE") {
    // Restrict overlay state to tabs within the Kortix group
    const isInGroup = sender.tab?.id && tabGroupManager.state.tabIds.includes(sender.tab.id);
    sendResponse({ state: isInGroup ? state.overlayState : "hidden" });
    return true;
  }

  if (type === "connect") {
    const { token } = request;
    if (token) {
      wsClient
        .connect(token)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
    } else {
      sendResponse({ success: false, error: "No token provided" });
    }
    return true;
  }

  if (type === "disconnect") {
    wsClient.disconnect();
    sendResponse({ success: true });
    return true;
  }

  if (type === "openLoginPage") {
    chrome.tabs.create({ url: getConnectBrowserUrl() });
    sendResponse({ success: true });
    return true;
  }

  // Legacy command execution (for testing)
  if (type === "executeCommand") {
    const { command, commandId } = request;
    handleLegacyCommand(command, commandId)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          commandId,
          success: false,
          error: error.message,
          timestamp: Date.now(),
        }),
      );
    return true;
  }

  sendResponse({ success: false, error: "Unknown message type" });
  return true;
});

/**
 * Handle legacy command format (for backward compatibility)
 */
async function handleLegacyCommand(
  command: { action: string; params?: Record<string, any> },
  commandId: string,
): Promise<any> {
  const backendCommand: BrowserCommand = {
    type: "command",
    id: commandId,
    session_id: "local",
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

// ========== UI Helpers ==========

/**
 * Broadcast the overlay state to all tabs in the Kortix window
 * @param mode - The overlay state to apply
 */
async function broadcastOverlayState(
  mode: "hidden" | "ongoing" | "takeover",
): Promise<void> {
  // Update state regardless of group existence so new tabs inherit it
  state.overlayState = mode;

  const groupState = tabGroupManager.state;
  if (!groupState.groupId) return;

  try {
    const tabs = await tabGroupManager.getGroupTabs();
    const promises = tabs.map((tab) => {
      if (tab.id) {
        return chrome.tabs
          .sendMessage(tab.id, {
            type: "SET_OVERLAY_STATE",
            state: mode,
          })
          .catch(() => {
            // Ignore errors for tabs that don't have the content script loaded yet
          });
      }
    });
    await Promise.all(promises);
  } catch (e) {
    console.error(
      "[Kortix Extension - Background] Failed to broadcast overlay state:",
      e,
    );
  }
}

/**
 * Update the overlay visibility specifically for stream capture (hiding it from snapshots)
 */
async function setStreamVisibility(visible: boolean): Promise<void> {
  const groupState = tabGroupManager.state;
  if (!groupState.groupId) return;

  try {
    const tabs = await tabGroupManager.getGroupTabs();
    const promises = tabs.map((tab) => {
      if (tab.id) {
        return chrome.tabs
          .sendMessage(tab.id, {
            type: "SET_OVERLAY_VISIBILITY",
            visible,
          })
          .catch(() => { });
      }
    });
    await Promise.all(promises);
  } catch (e) {
    console.error(
      "[Kortix Extension - Background] Failed to set stream visibility:",
      e,
    );
  }
}

// ========== Lifecycle ==========

/**
 * Initialize extension
 */
async function initialize(): Promise<void> {
  console.log("[Kortix Extension - Background] Initializing extension...");

  // Handle takeover and resume messages from content script overlay
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "USER_TAKEOVER") {
      console.log(
        "[Kortix Extension - Background] Takeover requested by user (Pausing stream)",
      );
      // Update global state and broadcast to all tabs
      broadcastOverlayState("takeover").catch(console.error);

      // Notify backend that user has taken over
      if (wsClient.isConnected) {
        wsClient.send({
          type: "user_takeover",
          session_id: wsClient.currentSessionId || "unknown",
          timestamp: Date.now(),
        });
      }
    }

    if (message.type === "RESUME_TASK") {
      console.log("[Kortix Extension - Background] Resume requested by user");
      const { summary } = message;

      // Update global overlay state
      state.overlayState = "ongoing";

      // Restart streaming
      streamingManager
        .start()
        .then(() => {
          broadcastOverlayState("ongoing").catch(console.error);
        })
        .catch(console.error);

      // Send resume message to backend with user's summary
      if (wsClient.isConnected) {
        wsClient.send({
          type: "user_resume",
          session_id: wsClient.currentSessionId || "unknown",
          summary: summary || "",
          timestamp: Date.now(),
        });
      }

      console.log(
        "[Kortix Extension - Background] Sent resume with summary:",
        summary,
      );
    }

    // Handle high-performance video chunks from offscreen document
    if (message.type === "VIDEO_CHUNK") {
      const { data, isKeyFrame, timestamp } = message;
      // Relay to WebSocket as a binary frame/message
      // We'll need a new message type for binary video frames
      wsClient.sendVideoFrame(data, isKeyFrame, timestamp);
    }
  });

  // Initialize WebSocket client with command handler
  await wsClient.initialize({
    onCommand: handleBackendCommand,
    onStateChange: (connectionState) => {
      state.isConnected = connectionState === "authenticated";
      state.sessionId = wsClient.currentSessionId;
      state.extensionId = wsClient.currentExtensionId;
      console.log(
        "[Kortix Extension - Background] Connection state:",
        connectionState,
      );

      // Start/stop stream based on connection - REMOVED AUTO-START
      // We only want to stream when the user/agent is actually performing browser actions
      if (!state.isConnected) {
        streamingManager.stop();
        broadcastOverlayState("hidden").catch(console.error);
      }
    },
  });

  console.log("[Kortix Extension - Background] Extension initialized");
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Kortix Extension - Background] onInstalled event:", details);

  const isDev = !chrome.runtime.getManifest().update_url;
  const shouldOpen =
    details.reason === "install" || (isDev && details.reason === "update");

  if (shouldOpen) {
    console.log(
      "[Kortix Extension - Background] Opening connect page (Reason: " +
      details.reason +
      ")",
    );

    // Open welcome/login page
    const url = getConnectBrowserUrl();
    console.log("[Kortix Extension - Background] Connect URL:", url);
    chrome.tabs.create({ url });
  }

  if (details.reason === "update") {
    console.log(
      "[Kortix Extension - Background] Extension updated to version",
      chrome.runtime.getManifest().version,
    );
  }
});

/**
 * Handle browser startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log(
    "[Kortix Extension - Background] Browser started, reinitializing...",
  );
  initialize().catch(console.error);
});

// Initialize on load
initialize().catch(console.error);

// ========== Exports (for testing) ==========

export { state, handleBackendCommand, tabGroupManager };
