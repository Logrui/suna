// TypeScript interfaces for stable rendering and streaming
// Generated from OpenAPI spec for frontend consumption
// Note: React imports will resolve when used in actual Suna project

import { ComponentType, ErrorInfo } from 'react';

export interface StreamingContentBatch {
  type: 'content_batch';
  sequence: number;
  batch_id: string;
  content_chunks: string[];
  combined_content: string;
  timestamp: string;
  batch_size: number;
}

export interface StreamingToolCall {
  type: 'tool_call';
  sequence: number;
  tool_call: ToolCallData;
  timestamp: string;
}

export interface StreamingStatus {
  type: 'status';
  status: 'connecting' | 'streaming' | 'paused' | 'completed' | 'failed';
  message?: string;
  retry_count?: number;
  timestamp: string;
}

export interface ToolCallData {
  id: string;
  name: string;
  arguments?: object;
  status: 'started' | 'running' | 'completed' | 'failed' | 'malformed';
  result?: object;
  error?: string;
  is_malformed: boolean;
  malformation_details?: object;
  render_safe: boolean;
  start_timestamp: string;
  end_timestamp?: string;
}

export interface StreamingSessionStatus {
  session_id: string;
  thread_id: string;
  status: 'connecting' | 'streaming' | 'paused' | 'completed' | 'failed';
  start_timestamp: string;
  last_token_timestamp?: string;
  retry_count: number;
  total_tokens: number;
  batch_size: number;
  throttling_flag: boolean;
  keep_alive_interval: number;
}

export interface RenderMetrics {
  component_name: string;
  render_count: number;
  render_duration?: number;
  timestamp: string;
  thread_id?: string;
  session_id?: string;
  warning_threshold_exceeded: boolean;
  error_threshold_exceeded: boolean;
  throttled: boolean;
}

export interface ErrorBoundaryEvent {
  component_name: string;
  error_message: string;
  error_stack?: string;
  component_stack?: string;
  timestamp: string;
  thread_id?: string;
  session_id?: string;
  recovery_action: 'retry' | 'fallback' | 'reset';
}

// Union type for all streaming messages
export type StreamingMessage = 
  | StreamingContentBatch 
  | StreamingToolCall 
  | StreamingStatus;

// Hook configuration interfaces
export interface StreamingConfig {
  batch_size: number;
  batch_interval: number;
  silence_threshold: number;
  max_retries: number;
  retry_interval: number;
  keep_alive_interval: number;
}

export interface RenderGuardConfig {
  warning_threshold: number;
  error_threshold: number;
  throttle_threshold: number;
  reset_interval: number;
}

// Component prop interfaces
export interface StreamingMessageProps {
  message: StreamingMessage;
  isStreaming: boolean;
  renderVersion: number;
}

export interface ToolCallStreamProps {
  toolCall: ToolCallData;
  content: string;
  messageId: string;
  onToolClick?: (messageId: string, toolName: string) => void;
}

export interface RenderGuardProps {
  componentName: string;
  config?: Partial<RenderGuardConfig>;
  onThresholdExceeded?: (metrics: RenderMetrics) => void;
}

// Error boundary interfaces
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  recovery_action?: 'retry' | 'fallback' | 'reset';
}

export interface ToolCallErrorBoundaryProps {
  toolCall: ToolCallData;
  fallback?: ComponentType<{ error: Error }>;
  onError?: (event: ErrorBoundaryEvent) => void;
}

// Performance monitoring interfaces
export interface PerformanceMetrics {
  component_renders: Map<string, number>;
  batch_processing_times: number[];
  stream_latencies: number[];
  error_boundary_triggers: ErrorBoundaryEvent[];
  throttling_events: number;
}

export interface StreamingPerformanceReport {
  session_id: string;
  thread_id: string;
  duration_ms: number;
  total_messages: number;
  total_batches: number;
  average_batch_size: number;
  render_metrics: RenderMetrics[];
  error_events: ErrorBoundaryEvent[];
  performance_score: number; // 0-100
}
