/**
 * Streaming Manager for Kortix Extension
 * 
 * Manages high-frequency tab capture and pushes frames to the backend.
 * 
 * REFACTORED: Now uses chrome.debugger + Page.captureScreenshot to capture
 * any tab in the Kortix group WITHOUT requiring it to be active/visible.
 * This solves two critical issues:
 * 1. Can now stream background tabs
 * 2. No longer forces tab switching when streaming
 */

import { wsClient, StreamChunkMessage } from './websocket-client';
import { tabGroupManager } from './tab-group-manager';
import { debuggerCapture } from './debugger-capture';

export class StreamingManager {
    private isStreaming: boolean = false;
    private streamInterval: ReturnType<typeof setInterval> | null = null;
    private targetFps: number = 10;
    private lastFrameHash: string | null = null;
    private targetTabId: number | null = null;

    /**
     * Start streaming a specific tab (or default to first tab in Kortix group).
     * The tab does NOT need to be active - we can stream background tabs.
     * 
     * @param tabId - Optional specific tab ID to stream. If not provided,
     *                uses the first tab in the Kortix group.
     */
    async start(tabId?: number): Promise<void> {
        if (this.isStreaming) {
            console.log('[Kortix Extension - Stream] Already streaming');
            return;
        }

        // Determine which tab to stream
        if (tabId) {
            this.targetTabId = tabId;
        } else {
            // Default: first tab in Kortix group
            const groupTabs = await tabGroupManager.getGroupTabs();
            if (groupTabs.length > 0) {
                this.targetTabId = groupTabs[0].id!;
            } else {
                // Fallback: try to get/create group and use that tab
                await tabGroupManager.getOrCreateGroup();
                const tab = await tabGroupManager.getActiveTab();
                if (tab?.id) {
                    this.targetTabId = tab.id;
                }
            }
        }

        if (!this.targetTabId) {
            console.error('[Kortix Extension - Stream] No target tab to stream');
            return;
        }

        try {
            // Pre-attach debugger for performance (persistent connection)
            await debuggerCapture.attach(this.targetTabId);
        } catch (error) {
            console.error('[Kortix Extension - Stream] Failed to attach debugger:', error);
            // Try to continue anyway - captureTab will attempt attach
        }

        this.isStreaming = true;
        this.lastFrameHash = null;
        console.log(`[Kortix Extension - Stream] Starting stream for tab ${this.targetTabId}...`);

        const intervalMs = 1000 / this.targetFps;
        this.streamInterval = setInterval(() => {
            this.captureAndPush();
        }, intervalMs);
    }

    /**
     * Switch streaming to a different tab.
     * No tab activation needed - the new tab can be in the background.
     */
    async switchTab(tabId: number): Promise<void> {
        console.log(`[Kortix Extension - Stream] Switching from tab ${this.targetTabId} to ${tabId}`);

        // Detach from old tab (optional - can keep multiple attached)
        if (this.targetTabId && this.targetTabId !== tabId) {
            await debuggerCapture.detach(this.targetTabId);
        }

        this.targetTabId = tabId;
        this.lastFrameHash = null; // Reset delta detection for new tab

        // Pre-attach to new tab
        await debuggerCapture.attach(tabId);
        console.log(`[Kortix Extension - Stream] Now streaming tab ${tabId}`);
    }

    /**
     * Stop streaming and clean up.
     */
    stop(): void {
        this.isStreaming = false;

        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }

        // Detach debugger from target tab
        if (this.targetTabId) {
            debuggerCapture.detach(this.targetTabId).catch(console.error);
            this.targetTabId = null;
        }

        this.lastFrameHash = null;
        console.log('[Kortix Extension - Stream] Stream stopped');
    }

    /**
     * Set the target FPS for streaming.
     */
    setFps(fps: number): void {
        this.targetFps = Math.max(1, Math.min(30, fps)); // Clamp to 1-30 FPS

        // If already streaming, restart with new FPS
        if (this.isStreaming && this.targetTabId) {
            const tabId = this.targetTabId;
            this.stop();
            this.start(tabId);
        }
    }

    /**
     * Capture screenshot and push to backend via WebSocket.
     * Uses debugger API - NO TAB ACTIVATION REQUIRED.
     */
    private async captureAndPush(): Promise<void> {
        if (!wsClient.isConnected || !this.targetTabId) return;

        try {
            // Get tab info (this does NOT activate the tab)
            let tab: chrome.tabs.Tab;
            try {
                tab = await chrome.tabs.get(this.targetTabId);
            } catch (e) {
                // Tab was closed - stop streaming
                console.warn('[Kortix Extension - Stream] Target tab was closed');
                this.stop();
                return;
            }

            // Relaxed URL checks: debugger can often capture about:blank or restricted URLs.
            // We'll proceed to capture regardless of URL.
            // If the URL is restricted, the debugger API might fail, but we'll catch that below.

            // Use debugger API to capture - NO TAB ACTIVATION!
            const screenshotBase64 = await debuggerCapture.captureTab(this.targetTabId, 'png');

            // Simple hash for delta detection (first 100 chars)
            // This saves bandwidth when the page is static
            const frameHash = screenshotBase64.substring(0, 100);
            if (frameHash === this.lastFrameHash) {
                return; // Skip duplicate frame
            }
            this.lastFrameHash = frameHash;

            const message: StreamChunkMessage = {
                type: 'stream_chunk',
                browser_id: wsClient.currentSessionId || 'unknown',
                screenshot_base64: screenshotBase64, // Already clean base64 from debugger
                url: tab.url || '',
                title: tab.title || '',
                timestamp: Date.now()
            };

            wsClient.send(message);
        } catch (error) {
            // Don't spam console on every frame error
            if (this.isStreaming) {
                console.error('[Kortix Extension - Stream] Capture error:', error);
            }
        }
    }

    // ========== Getters ==========

    /**
     * Get the currently streaming tab ID.
     */
    get currentTargetTabId(): number | null {
        return this.targetTabId;
    }

    /**
     * Check if currently streaming.
     */
    get streaming(): boolean {
        return this.isStreaming;
    }

    /**
     * Get current FPS setting.
     */
    get fps(): number {
        return this.targetFps;
    }
}

// Export singleton instance
export const streamingManager = new StreamingManager();
