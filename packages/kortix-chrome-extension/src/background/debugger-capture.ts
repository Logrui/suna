/**
 * Debugger Capture for Kortix Extension
 * 
 * Uses chrome.debugger API with Page.captureScreenshot to capture
 * any tab without requiring it to be active/visible.
 * 
 * This solves the limitation of captureVisibleTab() which only
 * works on the currently visible tab.
 */

export class DebuggerCapture {
    private attachedTabs: Set<number> = new Set();

    /**
     * Capture screenshot of a specific tab without activating it.
     * Uses CDP Page.captureScreenshot command.
     * 
     * @param tabId - The tab ID to capture
     * @param format - Image format: 'png', 'jpeg', or 'webp'
     * @returns Base64 encoded screenshot data (no data URL prefix)
     */
    async captureTab(tabId: number, format: 'png' | 'jpeg' | 'webp' = 'png'): Promise<string> {
        const debuggee = { tabId };

        // Ensure debugger is attached
        if (!this.attachedTabs.has(tabId)) {
            await this.attach(tabId);
        }

        try {
            // Capture using CDP - works for background tabs!
            console.log(`[DebuggerCapture] Sending Page.captureScreenshot for tab ${tabId}...`);
            const result = await new Promise<{ data: string }>((resolve, reject) => {
                chrome.debugger.sendCommand(
                    debuggee,
                    'Page.captureScreenshot',
                    {
                        format,
                        quality: format === 'jpeg' ? 80 : undefined,
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response as { data: string });
                        }
                    }
                );
            });

            if (!result || !result.data) {
                console.warn(`[DebuggerCapture] Received empty screenshot data for tab ${tabId}`);
                throw new Error('Empty screenshot data');
            }

            console.log(`[DebuggerCapture] Successfully captured screenshot for tab ${tabId} (${result.data.length} bytes)`);
            return result.data; // Already base64, no data URL prefix
        } catch (error) {
            console.error(`[DebuggerCapture] Failed to capture tab ${tabId}:`, error);
            throw error;
        }
    }

    /**
     * Attach debugger to a tab (persistent for streaming session).
     * Multiple calls with the same tabId are idempotent.
     */
    async attach(tabId: number): Promise<void> {
        if (this.attachedTabs.has(tabId)) {
            console.log(`[DebuggerCapture] Already attached to tab ${tabId}`);
            return;
        }

        return new Promise((resolve, reject) => {
            chrome.debugger.attach({ tabId }, '1.3', () => {
                if (chrome.runtime.lastError) {
                    // Check if already attached (race condition)
                    if (chrome.runtime.lastError.message?.includes('already attached')) {
                        this.attachedTabs.add(tabId);
                        console.log(`[DebuggerCapture] Tab ${tabId} was already attached`);
                        resolve();
                    } else {
                        reject(new Error(chrome.runtime.lastError.message));
                    }
                } else {
                    this.attachedTabs.add(tabId);
                    console.log(`[DebuggerCapture] Attached to tab ${tabId}`);

                    // Enable Page domain for screenshots
                    chrome.debugger.sendCommand({ tabId }, 'Page.enable', {}, () => {
                        resolve();
                    });
                }
            });
        });
    }

    /**
     * Detach debugger from a tab.
     */
    async detach(tabId: number): Promise<void> {
        if (!this.attachedTabs.has(tabId)) {
            return;
        }

        return new Promise((resolve) => {
            chrome.debugger.detach({ tabId }, () => {
                this.attachedTabs.delete(tabId);
                console.log(`[DebuggerCapture] Detached from tab ${tabId}`);
                // Ignore errors during detach (tab might be closed)
                resolve();
            });
        });
    }

    /**
     * Detach from all tabs.
     */
    async detachAll(): Promise<void> {
        const detachPromises = Array.from(this.attachedTabs).map(tabId => this.detach(tabId));
        await Promise.all(detachPromises);
    }

    /**
     * Check if debugger is attached to a tab.
     */
    isAttached(tabId: number): boolean {
        return this.attachedTabs.has(tabId);
    }

    /**
     * Get all attached tab IDs.
     */
    get attachedTabIds(): number[] {
        return Array.from(this.attachedTabs);
    }
}

// Export singleton instance
export const debuggerCapture = new DebuggerCapture();
