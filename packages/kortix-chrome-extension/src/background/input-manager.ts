/**
 * Input Manager for Kortix Extension
 * 
 * Uses chrome.debugger API to dispatch hardware-level events
 * to bypass "isTrusted" check and complex UI barriers.
 */

export class InputManager {
    private attachedTabs: Set<number> = new Set();

    /**
     * Attach debugger to a tab if not already attached
     */
    private async ensureAttached(tabId: number): Promise<void> {
        if (this.attachedTabs.has(tabId)) return;

        return new Promise((resolve, reject) => {
            chrome.debugger.attach({ tabId }, '1.3', () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    this.attachedTabs.add(tabId);
                    // Enable necessary domains
                    chrome.debugger.sendCommand({ tabId }, 'Input.enable', {}, () => {
                        resolve();
                    });
                }
            });
        });
    }

    /**
     * Dispatch a mouse event
     */
    async dispatchMouseEvent(tabId: number, params: any): Promise<void> {
        await this.ensureAttached(tabId);

        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', params, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Dispatch a keyboard event
     */
    async dispatchKeyEvent(tabId: number, params: any): Promise<void> {
        await this.ensureAttached(tabId);

        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', params, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Detach from a tab
     */
    async detach(tabId: number): Promise<void> {
        if (!this.attachedTabs.has(tabId)) return;

        return new Promise((resolve) => {
            chrome.debugger.detach({ tabId }, () => {
                this.attachedTabs.delete(tabId);
                resolve();
            });
        });
    }

    /**
     * Detach from all tabs
     */
    async detachAll(): Promise<void> {
        const detachPromises = Array.from(this.attachedTabs).map(tabId => this.detach(tabId));
        await Promise.all(detachPromises);
    }
}

export const inputManager = new InputManager();
