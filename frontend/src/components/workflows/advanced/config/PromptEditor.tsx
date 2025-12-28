'use client';

/**
 * PromptEditor Component
 *
 * Rich text editor for workflow prompts using Lexical.
 * Supports @variable mentions with autocomplete.
 *
 * Feature: Advanced Visual Workflow Builder
 * Maps to: T041, T087-T089 (Phase 4/7)
 */

import React, { useCallback, useMemo } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { EditorState, $getRoot } from 'lexical';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { VariableMentionNode } from './VariableMentionNode';
import { VariableMentionPlugin, Variable } from './VariableMentionPlugin';

interface PromptEditorProps {
  /** Current prompt text or Lexical state */
  value?: string;

  /** Called when prompt text changes */
  onChange?: (text: string) => void;

  /** Available workflow variables for mention plugin */
  variables?: Variable[];

  /** Placeholder text */
  placeholder?: string;

  /** Optional CSS class */
  className?: string;

  /** Read-only mode */
  readOnly?: boolean;

  /** Minimum height */
  minHeight?: string;
}

/**
 * Lexical editor configuration
 */
const editorConfig = {
  namespace: 'PromptEditor',
  theme: {
    paragraph: 'p-1',
    text: {
      bold: 'font-bold',
      italic: 'italic',
      underline: 'underline',
    },
  },
  onError: (error: Error) => {
    console.error('Lexical editor error:', error);
  },
  nodes: [VariableMentionNode],
};

/**
 * PromptEditor Component
 *
 * Rich text editor for prompts with variable mention support.
 * - Type @variable_name to trigger autocomplete
 * - Mentions are styled and validated
 * - Full undo/redo support
 * - Keyboard shortcuts support
 *
 * Usage:
 * ```tsx
 * <PromptEditor
 *   value={prompt}
 *   onChange={setPrompt}
 *   variables={[
 *     { name: 'user_email', type: 'string', source: 'trigger' }
 *   ]}
 * />
 * ```
 */
export const PromptEditor = React.memo<PromptEditorProps>(
  ({
    value = '',
    onChange,
    variables = [],
    placeholder = 'Enter the prompt for this AI step. Use @variable_name to reference workflow variables.',
    className = '',
    readOnly = false,
    minHeight = '120px',
  }) => {
    // Handle text changes from the editor
    const handleChange = useCallback(
      (editorState: EditorState) => {
        editorState.read(() => {
          const text = $getRoot().getTextContent();
          onChange?.(text);
        });
      },
      [onChange],
    );

    // Create initial editor state with value
    const initialState = useMemo(() => {
      return undefined; // Let editor manage its own state
    }, []);

    return (
      <div className={`space-y-2 ${className}`}>
        <LexicalComposer initialConfig={editorConfig}>
          {/* Editor container with styling */}
          <div
            className="relative rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-500 dark:focus-within:ring-blue-400"
            style={{ minHeight }}
          >
            {/* Rich text editing area */}
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono outline-none resize-none"
                  readOnly={readOnly}
                />
              }
              placeholder={
                <div className="absolute top-3 left-3 text-sm text-gray-400 dark:text-gray-500 pointer-events-none">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />

            {/* Plugins */}
            <HistoryPlugin />
            <OnChangePlugin onChange={handleChange} />
            <VariableMentionPlugin variables={variables} />
          </div>

          {/* Editor toolbar hints */}
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <div>
              Type <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">@</code> to insert
              variable mentions
            </div>
            <div className="flex gap-2">
              <div>Ctrl+B: Bold</div>
              <div>Ctrl+I: Italic</div>
              <div>Ctrl+U: Underline</div>
            </div>
          </div>
        </LexicalComposer>
      </div>
    );
  },
);

PromptEditor.displayName = 'PromptEditor';

export default PromptEditor;
