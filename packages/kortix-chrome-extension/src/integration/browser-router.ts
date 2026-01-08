/**
 * Kortix AI Browser Router Integration
 * 
 * Provides utilities for the Kortix backend to communicate with the browser extension.
 * This module should be imported in the Kortix backend to enable browser control.
 */

export interface BrowserCommand {
  id: string;
  action: string;
  params?: Record<string, any>;
  timestamp: number;
}

export interface BrowserCommandResult {
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

export interface BrowserSession {
  sessionId: string;
  isActive: boolean;
  lastCommand?: BrowserCommand;
  commandCount: number;
  extractionCount: number;
}

/**
 * Browser Router Client
 * 
 * Handles communication with the Kortix Chrome extension.
 * Used by Kortix backend agents to control the user's browser.
 */
export class BrowserRouterClient {
  private sessionId: string = '';
  private isConnected: boolean = false;
  private commandQueue: BrowserCommand[] = [];
  private resultCallbacks: Map<string, (result: BrowserCommandResult) => void> =
    new Map();

  /**
   * Initialize connection to browser extension
   */
  async initialize(): Promise<void> {
    try {
      // In a real implementation, this would establish connection to extension
      // For now, this is a placeholder that would be called by the backend
      console.log('[BrowserRouter] Initializing connection to extension');

      this.isConnected = true;
    } catch (error) {
      console.error('[BrowserRouter] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Execute command in browser
   */
  async executeCommand(
    action: string,
    params?: Record<string, any>
  ): Promise<BrowserCommandResult> {
    if (!this.isConnected) {
      throw new Error('Browser extension not connected');
    }

    const command: BrowserCommand = {
      id: this.generateId(),
      action,
      params,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      // Store callback for result
      this.resultCallbacks.set(command.id, (result) => {
        resolve(result);
      });

      // Send command to extension
      this.sendToExtension(command).catch((error) => {
        this.resultCallbacks.delete(command.id);
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.resultCallbacks.has(command.id)) {
          this.resultCallbacks.delete(command.id);
          reject(new Error('Command execution timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<BrowserCommandResult> {
    return this.executeCommand('navigate', { url });
  }

  /**
   * Click element
   */
  async click(selector: string): Promise<BrowserCommandResult> {
    return this.executeCommand('click', { selector });
  }

  /**
   * Type text
   */
  async type(selector: string, text: string): Promise<BrowserCommandResult> {
    return this.executeCommand('type', { selector, text });
  }

  /**
   * Scroll page
   */
  async scroll(
    direction: 'up' | 'down' | 'top' | 'bottom',
    amount?: number
  ): Promise<BrowserCommandResult> {
    return this.executeCommand('scroll', { direction, amount });
  }

  /**
   * Extract emails from page
   */
  async extractEmails(): Promise<string[]> {
    const result = await this.executeCommand('extractEmails');

    if (result.success && result.data?.emails) {
      return result.data.emails;
    }

    return [];
  }

  /**
   * Extract page content
   */
  async extractContent(selector?: string): Promise<string> {
    const result = await this.executeCommand('extractContent', { selector });

    if (result.success && result.data?.content) {
      return result.data.content;
    }

    return '';
  }

  /**
   * Get page information
   */
  async getPageInfo(): Promise<Record<string, any>> {
    const result = await this.executeCommand('getPageInfo');

    if (result.success && result.data) {
      return result.data;
    }

    return {};
  }

  /**
   * Get interactive elements
   */
  async getElements(): Promise<any[]> {
    const result = await this.executeCommand('getElements');

    if (result.success && result.data?.elements) {
      return result.data.elements;
    }

    return [];
  }

  /**
   * Fill form fields
   */
  async fillForm(fields: Record<string, string>): Promise<BrowserCommandResult> {
    return this.executeCommand('fillForm', { fields });
  }

  /**
   * Submit form
   */
  async submitForm(selector?: string): Promise<BrowserCommandResult> {
    return this.executeCommand('submitForm', { selector });
  }

  /**
   * Take screenshot
   */
  async screenshot(): Promise<string | null> {
    const result = await this.executeCommand('screenshot');

    if (result.success && result.data?.screenshot) {
      return result.data.screenshot;
    }

    return null;
  }

  /**
   * Execute arbitrary script
   */
  async executeScript(code: string): Promise<any> {
    const result = await this.executeCommand('executeScript', { code });

    if (result.success) {
      return result.data?.result;
    }

    throw new Error(result.error || 'Script execution failed');
  }

  /**
   * Get session status
   */
  async getSessionStatus(): Promise<BrowserSession> {
    // This would be implemented to get status from extension
    return {
      sessionId: this.sessionId,
      isActive: this.isConnected,
      commandCount: this.commandQueue.length,
      extractionCount: 0,
    };
  }

  /**
   * Send command to extension
   */
  private async sendToExtension(command: BrowserCommand): Promise<void> {
    // This would be implemented to send message to extension
    // In the actual implementation, this would use the extension's message API
    console.log('[BrowserRouter] Sending command:', command);
  }

  /**
   * Handle result from extension
   */
  private _handleResult(result: BrowserCommandResult): void {
    const callback = this.resultCallbacks.get(result.commandId);

    if (callback) {
      callback(result);
      this.resultCallbacks.delete(result.commandId);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Disconnect from extension
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.resultCallbacks.clear();
    console.log('[BrowserRouter] Disconnected from extension');
  }
}

/**
 * Singleton instance for global access
 */
let browserRouterInstance: BrowserRouterClient | null = null;

/**
 * Get or create browser router instance
 */
export function getBrowserRouter(): BrowserRouterClient {
  if (!browserRouterInstance) {
    browserRouterInstance = new BrowserRouterClient();
  }

  return browserRouterInstance;
}

/**
 * Initialize browser router
 */
export async function initializeBrowserRouter(): Promise<BrowserRouterClient> {
  const router = getBrowserRouter();
  await router.initialize();
  return router;
}
