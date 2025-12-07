/**
 * VariableMentionNode for Lexical Editor
 *
 * Custom Lexical node for rendering @variable mentions in the prompt editor.
 * Styled as inline elements with special formatting and validation feedback.
 *
 * Feature: Advanced Visual Workflow Builder
 * Maps to: T087 (Phase 7: User Story 4)
 * Implemented in: Phase 4 (Rich text editing for prompts)
 */

import {
  TextNode,
  DecoratorNode,
  LexicalNode,
  NodeKey,
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  Spread,
  SerializedLexicalNode,
} from 'lexical';
import React from 'react';

export interface VariableMentionNodePayload {
  variable: string;
  valid?: boolean;
  warning?: string;
}

export type SerializedVariableMentionNode = Spread<
  {
    variable: string;
    valid: boolean;
    warning?: string;
  },
  SerializedLexicalNode
>;

/**
 * VariableMentionNode
 *
 * Represents a @variable mention in the prompt editor.
 * Displays as an inline styled element with validation feedback.
 *
 * Example: @user_email renders as a styled mention with validation indicator
 */
export class VariableMentionNode extends DecoratorNode<React.ReactElement> {
  __variable: string;
  __valid: boolean;
  __warning?: string;

  constructor(
    variable: string,
    valid: boolean = true,
    warning?: string,
    key?: NodeKey,
  ) {
    super(key);
    this.__variable = variable;
    this.__valid = valid;
    this.__warning = warning;
  }

  static getType(): string {
    return 'variable-mention';
  }

  static clone(node: VariableMentionNode): VariableMentionNode {
    return new VariableMentionNode(
      node.__variable,
      node.__valid,
      node.__warning,
      node.__key,
    );
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'variable-mention';
    span.setAttribute('data-variable', this.__variable);
    span.setAttribute('data-valid', this.__valid ? 'true' : 'false');
    if (this.__warning) {
      span.setAttribute('data-warning', this.__warning);
    }
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-variable')) {
          return null;
        }

        return {
          conversion: (lexicalNode: LexicalNode) => {
            if (!VariableMentionNode.isNode(lexicalNode)) {
              return {
                node: null,
                after: null,
              };
            }
            return {
              node: new VariableMentionNode(
                domNode.getAttribute('data-variable') || '',
                domNode.getAttribute('data-valid') === 'true',
                domNode.getAttribute('data-warning') || undefined,
              ),
              after: null,
            };
          },
          priority: 2,
        };
      },
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.setAttribute('data-variable', this.__variable);
    element.setAttribute('data-valid', this.__valid ? 'true' : 'false');
    if (this.__warning) {
      element.setAttribute('data-warning', this.__warning);
    }
    element.textContent = `@${this.__variable}`;
    return { element };
  }

  static importJSON(
    serializedNode: SerializedVariableMentionNode,
  ): VariableMentionNode {
    const node = new VariableMentionNode(
      serializedNode.variable,
      serializedNode.valid !== false,
      serializedNode.warning,
    );
    return node;
  }

  exportJSON(): SerializedVariableMentionNode {
    return {
      type: 'variable-mention',
      variable: this.__variable,
      valid: this.__valid,
      warning: this.__warning,
      version: 1,
    };
  }

  getTextContent(): string {
    return `@${this.__variable}`;
  }

  isInline(): boolean {
    return true;
  }

  decorate(): React.ReactElement {
    return (
      <VariableMentionComponent
        variable={this.__variable}
        valid={this.__valid}
        warning={this.__warning}
      />
    );
  }
}

interface VariableMentionComponentProps {
  variable: string;
  valid: boolean;
  warning?: string;
}

/**
 * React component for rendering a variable mention
 */
function VariableMentionComponent({
  variable,
  valid,
  warning,
}: VariableMentionComponentProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium text-xs whitespace-nowrap cursor-pointer transition-colors ${
        valid
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700/50'
      }`}
      title={warning ? `Warning: ${warning}` : `Variable: @${variable}`}
    >
      <span className="text-blue-600 dark:text-blue-400">@</span>
      <span>{variable}</span>
      {!valid && <span className="ml-0.5 text-red-600">!</span>}
    </span>
  );
}

export default VariableMentionNode;
