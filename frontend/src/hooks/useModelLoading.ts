'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface ModelLoadingState {
  isLoading: boolean;
  currentModel: string | null;
  previousModel: string | null;
  error: string | null;
  loadTimeMs: number | null;
  status: 'idle' | 'loading' | 'loaded' | 'error' | 'unloading';
}

export interface ModelLoadingEvent {
  type: 'model_loading' | 'model_loaded' | 'model_load_failed' | 'model_unloading';
  model_id: string;
  provider?: string;
  estimated_time?: number;
  load_time_ms?: number;
  error?: string;
  error_code?: string;
  timestamp?: string;
}

/**
 * Hook for listening to WebSocket model loading events
 * Broadcasts real-time status updates during model loading/unloading
 */
export function useModelLoading() {
  const [state, setState] = useState<ModelLoadingState>({
    isLoading: false,
    currentModel: null,
    previousModel: null,
    error: null,
    loadTimeMs: null,
    status: 'idle'
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionSentRef = useRef(false);

  const connectWebSocket = useCallback(() => {
    // Determine WebSocket URL based on current environment
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected for model events');
        
        // Subscribe to model_events channel
        const subscriptionMessage = JSON.stringify({
          type: 'subscribe',
          channel: 'model_events'
        });
        
        ws.send(subscriptionMessage);
        subscriptionSentRef.current = true;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ModelLoadingEvent;
          
          console.log('📡 Model event received:', data.type, data.model_id);

          switch (data.type) {
            case 'model_loading':
              setState(prev => ({
                ...prev,
                isLoading: true,
                currentModel: data.model_id,
                status: 'loading',
                error: null
              }));
              toast.loading(`⏳ Loading ${data.model_id}...`, {
                description: `Estimated time: ${data.estimated_time || 15}s`
              });
              break;

            case 'model_loaded':
              setState(prev => ({
                ...prev,
                isLoading: false,
                status: 'loaded',
                loadTimeMs: data.load_time_ms || null,
                error: null
              }));
              toast.success(`✅ ${data.model_id} ready!`, {
                description: `Loaded in ${data.load_time_ms || '?'}ms`
              });
              break;

            case 'model_load_failed':
              setState(prev => ({
                ...prev,
                isLoading: false,
                status: 'error',
                error: data.error || 'Unknown error',
                currentModel: null
              }));
              toast.error(`❌ Failed to load ${data.model_id}`, {
                description: data.error || 'Unknown error occurred'
              });
              break;

            case 'model_unloading':
              setState(prev => ({
                ...prev,
                previousModel: data.model_id,
                status: 'unloading'
              }));
              // Quiet unload - no toast
              break;

            default:
              console.warn('Unknown event type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        toast.error('Connection Error', {
          description: 'Failed to connect to model status updates'
        });
      };

      ws.onclose = () => {
        console.log('⚠️ WebSocket disconnected');
        wsRef.current = null;
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect WebSocket...');
          connectWebSocket();
        }, 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      currentModel: null,
      previousModel: null,
      error: null,
      loadTimeMs: null,
      status: 'idle'
    });
  }, []);

  return {
    ...state,
    resetState,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}
