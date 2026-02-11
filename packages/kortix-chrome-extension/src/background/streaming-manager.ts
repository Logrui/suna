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
        }

        this.isStreaming = true;
        this.lastFrameHash = null;
        console.log(`[Kortix Extension - Stream] Starting stream for tab ${this.targetTabId}...`);

        // Ensure Offscreen Document for capture (New Refactor Path)
        await this.ensureOffscreenDocument();

        // Start the capture loop (Legacy Path - will be replaced in Phase B/C)
        this.captureLoop();
    }

    /**
     * Ensure the offscreen document is created for video processing
     */
    private async ensureOffscreenDocument() {
        if (await chrome.offscreen.hasDocument()) {
            return;
        }

        console.log('[Kortix Extension - Stream] Creating offscreen document...');
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
            justification: 'Recording tab for high-performance video streaming to Kortix Worker.'
        });
    }

    private isVideoStreamingStarted: boolean = false;

    /**
     * Initialize the high-performance video pipeline
     */
    private async initializeVideoStreaming() {
        if (this.isVideoStreamingStarted || !this.targetTabId) return;
        this.isVideoStreamingStarted = true;

        try {
            console.log('[Kortix Extension - Stream] Initializing video pipeline...');

            const tab = await chrome.tabs.get(this.targetTabId);

            // 1. Get Stream ID for the target tab
            const streamId = await new Promise<string>((resolve, reject) => {
                chrome.tabCapture.getMediaStreamId({
                    targetTabId: this.targetTabId!
                }, (streamId) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(streamId);
                    }
                });
            });

            // 2. Send to Offscreen Document
            await chrome.runtime.sendMessage({
                type: 'START_STREAMING',
                streamId,
                tabId: this.targetTabId,
                url: tab.url,
                title: tab.title
            });

            console.log('[Kortix Extension - Stream] Video pipeline initialized in offscreen document');
        } catch (error) {
            console.error('[Kortix Extension - Stream] Failed to initialize video pipeline:', error);
            this.isVideoStreamingStarted = false; // Allow retry
        }
    }

    private lastUpdateTimestamp: number = 0;

    /**
     * Recursive capture loop for stable FPS and frame synchronization
     * This is a LEGACY fallback path. It will automatically pause if the 
     * high-performance video pipeline is active to prevent 'strobe' flickering.
     */
    private async captureLoop() {
        if (!this.isStreaming) return;

        // If high-performance video is running, we don't need the legacy screenshot loop
        // This saves bandwidth, CPU, and eliminates the overlay flicker.
        if (this.isVideoStreamingStarted) {
            // Keep the loop 'alive' but wait longer before checking again
            // This allows it to resume if video fails.
            this.streamInterval = setTimeout(() => this.captureLoop(), 2000) as any;
            return;
        }

        const startTime = Date.now();
        await this.captureAndPush();

        // Periodically update metadata if video stream is running (redundant here but safe)
        if (this.isVideoStreamingStarted && Date.now() - this.lastUpdateTimestamp > 5000) {
            this.updateVideoMetadata().catch(() => { });
            this.lastUpdateTimestamp = Date.now();
        }

        const duration = Date.now() - startTime;
        const intervalMs = 1000 / this.targetFps;
        const nextDelay = Math.max(0, intervalMs - duration);

        this.streamInterval = setTimeout(() => this.captureLoop(), nextDelay) as any;
    }

    private async updateVideoMetadata() {
        if (!this.targetTabId || !this.isVideoStreamingStarted) return;
        try {
            const tab = await chrome.tabs.get(this.targetTabId);
            await chrome.runtime.sendMessage({
                type: 'UPDATE_METADATA',
                url: tab.url,
                title: tab.title
            });
        } catch (e) { }
    }

    /**
     * Switch streaming to a different tab.
     */
    async switchTab(tabId: number): Promise<void> {
        console.log(`[Kortix Extension - Stream] Switching from tab ${this.targetTabId} to ${tabId}`);

        if (this.targetTabId && this.targetTabId !== tabId) {
            await debuggerCapture.detach(this.targetTabId);
        }

        this.targetTabId = tabId;
        this.lastFrameHash = null;

        await debuggerCapture.attach(tabId);
        console.log(`[Kortix Extension - Stream] Now streaming tab ${tabId}`);
    }

    /**
     * Stop streaming and clean up.
     */
    stop(): void {
        this.isStreaming = false;
        this.isVideoStreamingStarted = false;

        if (this.streamInterval) {
            clearTimeout(this.streamInterval as any);
            this.streamInterval = null;
        }

        // Close offscreen document
        chrome.offscreen.closeDocument().catch(() => { });

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
        this.targetFps = Math.max(1, Math.min(30, fps));
    }

    /**
     * Capture screenshot and push to backend via WebSocket.
     */
    private async captureAndPush(): Promise<void> {
        if (!wsClient.isConnected || !this.targetTabId) return;

        // NEW: Try to transition to video streaming if not already started
        this.initializeVideoStreaming().catch(console.error);

        try {
            // Get tab info
            let tab: chrome.tabs.Tab;
            try {
                tab = await chrome.tabs.get(this.targetTabId);
            } catch (e) {
                console.warn('[Kortix Extension - Stream] Target tab was closed');
                this.stop();
                return;
            }

            // Perform direct capture without toggling overlay
            // Live stream shots include the overlay (fixes the flicker!)
            const screenshotBase64 = await debuggerCapture.captureTab(this.targetTabId, 'png');

            if (!screenshotBase64) return;

            // Simple hash for delta detection
            const frameHash = screenshotBase64.substring(0, 100);
            if (frameHash === this.lastFrameHash) {
                return;
            }
            this.lastFrameHash = frameHash;

            const message: StreamChunkMessage = {
                type: 'stream_chunk',
                browser_id: wsClient.currentSessionId || 'unknown',
                screenshot_base64: screenshotBase64,
                url: tab.url || '',
                title: tab.title || '',
                timestamp: Date.now()
            };

            wsClient.send(message);
        } catch (error) {
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

    /**
     * Helper to toggle overlay visibility via messaging
     */
    private async setOverlayVisibility(visible: boolean) {
        if (!this.targetTabId) return;
        try {
            await chrome.tabs.sendMessage(this.targetTabId, {
                type: 'SET_OVERLAY_VISIBILITY',
                visible
            });
        } catch (e) {
            // Content script might not be ready
        }
    }
}

// Export singleton instance
export const streamingManager = new StreamingManager();
