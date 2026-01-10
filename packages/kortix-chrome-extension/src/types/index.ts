/**
 * Kortix Chrome Extension - Type Definitions
 */

/**
 * Command types
 */
export type CommandAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'screenshot'
  | 'extractEmails'
  | 'extractContent'
  | 'getElements'
  | 'fillForm'
  | 'submitForm'
  | 'getPageInfo'
  | 'executeScript';

/**
 * Command interface
 */
export interface Command {
  id: string;
  action: CommandAction;
  params?: Record<string, any>;
  timestamp: number;
}

/**
 * Command result interface
 */
export interface CommandResult {
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

/**
 * Extension state interface
 */
export interface ExtensionState {
  isListening: boolean;
  sessionId: string;
  lastCommand: Command | null;
  commandHistory: Command[];
  extractionHistory: ExtractionResult[];
}

/**
 * Extraction result interface
 */
export interface ExtractionResult {
  id: string;
  command: string;
  url?: string;
  data: any;
  timestamp: number;
}

/**
 * Browser session interface
 */
export interface BrowserSession {
  sessionId: string;
  isActive: boolean;
  lastCommand?: Command;
  commandCount: number;
  extractionCount: number;
}

/**
 * Page info interface
 */
export interface PageInfo {
  title: string;
  url: string;
  domain: string;
  protocol: string;
  scrollY: number;
  scrollHeight: number;
  innerHeight: number;
  innerWidth: number;
  readyState: DocumentReadyState;
}

/**
 * Element info interface
 */
export interface ElementInfo {
  index: number;
  tag: string;
  text: string;
  type?: string;
  href?: string;
  id?: string;
  className?: string;
}

/**
 * Email extraction result
 */
export interface EmailExtractionResult {
  emails: string[];
  count: number;
  sources: {
    text: number;
    mailto: number;
    dataAttributes: number;
  };
}

/**
 * Content extraction result
 */
export interface ContentExtractionResult {
  content: string;
  length: number;
}

/**
 * Form fill result
 */
export interface FormFillResult {
  [selector: string]: {
    success: boolean;
    value?: string;
    error?: string;
  };
}

/**
 * Screenshot result
 */
export interface ScreenshotResult {
  screenshot: string | null;
  width?: number;
  height?: number;
  error?: string;
  fallback?: boolean;
}

/**
 * Navigation result
 */
export interface NavigationResult {
  url: string;
  title: string;
}

/**
 * Scroll result
 */
export interface ScrollResult {
  scrolled: boolean;
  scrollY: number;
}

/**
 * Click result
 */
export interface ClickResult {
  clicked: boolean;
  element: string;
}

/**
 * Type result
 */
export interface TypeResult {
  typed: boolean;
  value: string;
}

/**
 * Submit result
 */
export interface SubmitResult {
  submitted: boolean;
  url: string;
}

/**
 * Script execution result
 */
export interface ScriptExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Message types
 */
export type MessageType =
  | 'executeCommand'
  | 'extractionResult'
  | 'getStatus'
  | 'getHistory'
  | 'statusUpdate';

/**
 * Message interface
 */
export interface Message {
  type: MessageType;
  data?: any;
  command?: Command;
  commandId?: string;
  sessionId?: string;
}

/**
 * Response interface
 */
export interface Response {
  success: boolean;
  data?: any;
  error?: string;
}
