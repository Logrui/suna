/**
 * Streaming Manager for Kortix Extension
 * 
 * Manages high-frequency tab capture and pushes frames to the backend.
 */

import { wsClient, StreamChunkMessage } from './websocket-client';
import { tabGroupManager } from './tab-group-manager';

export class StreamingManager {
    private isStreaming: boolean = false;
    private streamInterval: ReturnType<typeof setInterval> | null = null;
    private targetFps: number = 10;
    private lastFrameBase64: string | null = null;

    /**
     * Start streaming the active tab
     */
    async start(): Promise<void> {
        if (this.isStreaming) return;
        this.isStreaming = true;

        console.log('[Kortix Extension - Stream] Starting stream...');

        const intervalMs = 1000 / this.targetFps;
        this.streamInterval = setInterval(() => {
            this.captureAndPush();
        }, intervalMs);
    }

    /**
     * Stop streaming
     */
    stop(): void {
        this.isStreaming = false;
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }
        console.log('[Kortix Extension - Stream] Stream stopped');
    }

    /**
     * Capture active tab and push via WebSocket
     */
    private async captureAndPush(): Promise<void> {
        if (!wsClient.isConnected) return;

        try {
            const tab = await tabGroupManager.getActiveTab();
            if (!tab || !tab.id) return;

            // Capture using captureVisibleTab (most common extension method)
            // Note: In manifest V3, service workers don't have access to high-perf capture APIs 
            // easily without an offscreen document, but captureVisibleTab works in background.
            // Using PNG as requested for higher quality (quality param is ignored for PNG)
            const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
                format: 'png'
            });

            // Simple delta check to save bandwidth
            if (screenshot === this.lastFrameBase64) return;
            this.lastFrameBase64 = screenshot;

            const message: StreamChunkMessage = {
                type: 'stream_chunk',
                browser_id: wsClient.currentSessionId || 'unknown',
                screenshot_base64: screenshot.replace(/^data:image\/(png|jpeg|webp);base64,/, ''),
                url: tab.url || '',
                title: tab.title || '',
                timestamp: Date.now()
            };
            console.log(`[Kortix Extension - Stream] Sending frame: ${message.screenshot_base64.length} bytes for ${message.browser_id}`);
            wsClient.send(message);
        } catch (error) {
            console.error('[Kortix Extension - Stream] Capture error:', error);
        }
    }
}

export const streamingManager = new StreamingManager();
