/**
 * Kortix WebSocket Client
 * 
 * Handles the WebSocket connection to the Kortix backend with:
 * - Automatic reconnection with exponential backoff
 * - Token-based authentication
 * - Heartbeat/keepalive
 * - Message routing
 */

import ReconnectingWebSocket from 'reconnecting-websocket';
import { getConfig } from '../config';

// ========== Types ==========

export interface HelloMessage {
    type: 'hello';
    token: string;
    extension_id: string;
    extension_version: string;
    browser: string;
    timestamp: number;
}

export interface WelcomeMessage {
    type: 'welcome';
    session_id: string;
    server_time: number;
    heartbeat_interval_ms: number;
}

export interface BrowserCommand {
    type: 'command';
    id: string;
    session_id: string;
    action: string;
    params: Record<string, any>;
    timeout_ms: number;
    timestamp: number;
}

export interface InteractionCommand {
    type: 'command';
    id: string;
    session_id: string;
    action: 'interaction';
    params: {
        type: 'click' | 'mousedown' | 'mouseup' | 'key_down' | 'key_up' | 'mouse_move' | 'scroll';
        x?: number;
        y?: number;
        key?: string;
        code?: string;
        deltaX?: number;
        deltaY?: number;
        button?: 'left' | 'right' | 'middle';
        shift?: boolean;
        ctrl?: boolean;
        alt?: boolean;
        meta?: boolean;
    };
    timestamp: number;
}

export interface CommandResult {
    type: 'result';
    id: string;
    session_id: string;
    success: boolean;
    data?: Record<string, any>;
    error?: string;
    timestamp: number;
}

export interface StreamChunkMessage {
    type: 'stream_chunk';
    browser_id: string;
    screenshot_base64: string;
    url?: string;
    title?: string;
    timestamp: number;
}

export interface HeartbeatMessage {
    type: 'heartbeat';
    timestamp: number;
}

export type WebSocketMessage = WelcomeMessage | BrowserCommand | HeartbeatMessage | InteractionCommand;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

export interface WebSocketClientOptions {
    onCommand: (command: BrowserCommand | InteractionCommand) => Promise<CommandResult>;
    onStateChange?: (state: ConnectionState) => void;
}

// ========== WebSocket Client ==========

class KortixWebSocketClient {
    private ws: ReconnectingWebSocket | null = null;
    private sessionId: string | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private heartbeatIntervalMs: number = 30000;
    private state: ConnectionState = 'disconnected';
    private options: WebSocketClientOptions | null = null;
    private extensionId: string | null = null;

    /**
     * Initialize the WebSocket client
     */
    async initialize(options: WebSocketClientOptions): Promise<void> {
        this.options = options;

        // Generate or retrieve extension ID
        const stored = await chrome.storage.local.get(['extensionId', 'browserToken']);
        this.extensionId = stored.extensionId || this.generateExtensionId();

        if (!stored.extensionId) {
            await chrome.storage.local.set({ extensionId: this.extensionId });
        }

        console.log('[Kortix Extension - WS] Initialized with extension ID:', this.extensionId);

        // Auto-connect if we have a token
        if (stored.browserToken) {
            this.connect(stored.browserToken);
        }
    }

    /**
     * Connect to the WebSocket server
     */
    async connect(token: string): Promise<void> {
        if (this.ws) {
            this.disconnect();
        }

        const config = getConfig();
        const wsUrl = config.wsUrl;

        console.log('[Kortix Extension - WS] Connecting to:', wsUrl);
        this.setState('connecting');

        this.ws = new ReconnectingWebSocket(wsUrl, [], {
            maxReconnectionDelay: 30000,
            minReconnectionDelay: 1000,
            reconnectionDelayGrowFactor: 1.5,
            connectionTimeout: 10000,
            maxRetries: Infinity,
        });

        this.ws.onopen = () => {
            console.log('[Kortix Extension - WS] Connection opened, sending hello');
            this.sendHello(token);
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
            console.log('[Kortix Extension - WS] Connection closed:', event.code, event.reason);
            this.setState('disconnected');
            this.stopHeartbeat();
        };

        this.ws.onerror = (error) => {
            console.error('[Kortix Extension - WS] Connection error:', error);
        };

        // Store token for reconnect
        await chrome.storage.local.set({ browserToken: token });
    }

    /**
     * Disconnect from the server
     */
    disconnect(): void {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.sessionId = null;
        this.setState('disconnected');
        console.log('[Kortix Extension - WS] Disconnected');
    }

    /**
     * Send hello message to authenticate
     */
    private sendHello(token: string): void {
        const hello: HelloMessage = {
            type: 'hello',
            token,
            extension_id: this.extensionId!,
            extension_version: chrome.runtime.getManifest().version,
            browser: navigator.userAgent,
            timestamp: Date.now(),
        };

        this.send(hello);
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data) as WebSocketMessage;

            switch (message.type) {
                case 'welcome':
                    this.handleWelcome(message);
                    break;

                case 'command':
                    this.handleCommand(message);
                    break;

                case 'heartbeat':
                    // Server acknowledged our heartbeat
                    console.log('[Kortix Extension - WS] Heartbeat acknowledged');
                    break;

                default:
                    console.warn('[Kortix Extension - WS] Unknown message type:', (message as any).type);
            }
        } catch (error) {
            console.error('[Kortix Extension - WS] Failed to parse message:', error);
        }
    }

    /**
     * Handle welcome message (auth success)
     */
    private handleWelcome(message: WelcomeMessage): void {
        console.log('[Kortix Extension - WS] Authenticated, session:', message.session_id);
        this.sessionId = message.session_id;
        this.heartbeatIntervalMs = message.heartbeat_interval_ms;
        this.setState('authenticated');
        this.startHeartbeat();
    }

    /**
     * Handle command from backend
     */
    private async handleCommand(command: BrowserCommand | InteractionCommand): Promise<void> {
        console.log('[Kortix Extension - WS] Received command:', command.action, command.id);

        if (!this.options?.onCommand) {
            console.error('[Kortix Extension - WS] No command handler registered');
            return;
        }

        try {
            const result = await this.options.onCommand(command);
            this.send(result);
        } catch (error) {
            const errorResult: CommandResult = {
                type: 'result',
                id: command.id,
                session_id: command.session_id,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
            };
            this.send(errorResult);
        }
    }

    /**
     * Start heartbeat timer
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatIntervalMs);
    }

    /**
     * Stop heartbeat timer
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Send heartbeat message
     */
    private sendHeartbeat(): void {
        const heartbeat: HeartbeatMessage = {
            type: 'heartbeat',
            timestamp: Date.now(),
        };
        this.send(heartbeat);
    }

    /**
     * Send message to server
     */
    public send(message: object): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('[Kortix Extension - WS] Cannot send, WebSocket not open');
        }
    }

    /**
     * Send an encoded video frame to the backend.
     * Uses base64 for now to maintain compatibility with JSON protocol,
     * but much more efficient than full screenshots.
     */
    public sendVideoFrame(data: ArrayBuffer, isKeyFrame: boolean, timestamp: number): void {
        if (!this.isConnected || !this.ws) return;

        // Convert ArrayBuffer to Base64
        const bytes = new Uint8Array(data);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const message = {
            type: 'video_frame',
            browser_id: this.sessionId || 'unknown',
            data: base64,
            is_keyframe: isKeyFrame,
            timestamp: timestamp
        };

        this.send(message);
    }

    /**
     * Update connection state
     */
    private setState(state: ConnectionState): void {
        if (this.state !== state) {
            this.state = state;
            this.options?.onStateChange?.(state);
            console.log('[Kortix Extension - WS] State changed:', state);
        }
    }

    /**
     * Generate unique extension ID
     */
    private generateExtensionId(): string {
        return `ext_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ========== Public Getters ==========

    get isConnected(): boolean {
        return this.state === 'authenticated';
    }

    get currentState(): ConnectionState {
        return this.state;
    }

    get currentSessionId(): string | null {
        return this.sessionId;
    }

    get currentExtensionId(): string | null {
        return this.extensionId;
    }
}

// Export singleton instance
export const wsClient = new KortixWebSocketClient();
