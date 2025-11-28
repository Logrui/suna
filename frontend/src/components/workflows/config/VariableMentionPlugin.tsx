/**
 * VariableMentionPlugin for Lexical Editor
 *
 * Handles @ trigger for variable mentions with autocomplete dropdown.
 * Listens for @ character, shows matching variables, and creates mentions on selection.
 *
 * Feature: Advanced Visual Workflow Builder
 * Maps to: T088-T089 (Phase 7: User Story 4)
 * Implemented in: Phase 4 (Rich text editing for prompts)
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  TextNode,
} from 'lexical';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import React, { useCallback, useMemo, useState } from 'react';
import { VariableMentionNode } from './VariableMentionNode';

export interface Variable {
  name: string;
  type: string;
  source: string;
  description?: string;
  alwaysDefined: boolean;
}

interface VariableOption extends MenuOption {
  variable: Variable;
}

class VariableTypeaheadOption extends MenuOption {
  variable: Variable;

  constructor(variable: Variable) {
    super(variable.name);
    this.variable = variable;
  }
}

interface VariableMentionPluginProps {
  variables: Variable[];
  onVariableAdded?: (variable: string) => void;
}

/**
 * VariableMentionPlugin Component
 *
 * Provides @ mention autocomplete for workflow variables.
 * Shows available variables when @ is typed, inserts mention when selected.
 *
 * Usage in Lexical Editor:
 * ```tsx
 * <LexicalComposer>
 *   <VariableMentionPlugin variables={workflowVariables} />
 *   <RichTextPlugin ... />
 * </LexicalComposer>
 * ```
 */
export function VariableMentionPlugin({
  variables,
  onVariableAdded,
}: VariableMentionPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string>('');

  // Filter variables based on query
  const matchingVariables = useMemo(() => {
    if (!queryString) {
      return variables.slice(0, 10); // Show first 10 if no query
    }

    return variables
      .filter((variable) =>
        variable.name.toLowerCase().includes(queryString.toLowerCase()),
      )
      .slice(0, 10); // Limit to 10 results
  }, [queryString, variables]);

  const options = useMemo(
    () =>
      matchingVariables.map(
        (variable) => new VariableTypeaheadOption(variable),
      ),
    [matchingVariables],
  );

  const onSelectOption = useCallback(
    (selectedOption: VariableTypeaheadOption, nodeToReplace: TextNode | null) => {
      editor.update(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) return;

        let node: VariableMentionNode;
        if (nodeToReplace) {
          node = new VariableMentionNode(selectedOption.variable.name);
          nodeToReplace.replace(node);
        } else {
          node = new VariableMentionNode(selectedOption.variable.name);
          selection.insertNodes([node]);
        }

        if (onVariableAdded) {
          onVariableAdded(selectedOption.variable.name);
        }

        // Move cursor after the mention
        node.selectNext();
      });
    },
    [editor, onVariableAdded],
  );

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={(text: string, editor) => {
        // LexicalTypeaheadMenuPlugin detects @ and passes remaining text
        // Only show suggestions if text is a valid variable name pattern
        if (!text) return null;

        // Check if text contains only valid variable name characters
        // (letters, numbers, underscores)
        if (/^[\w_]*$/.test(text)) {
          return { range: null, query: text };
        }

        return null;
      }}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (!matchingVariables.length) {
          return null;
        }

        return (
          <ul
            className="absolute z-50 mt-1 max-w-xs overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 py-1"
            ref={anchorElementRef}
          >
            {matchingVariables.map((variable, index) => (
              <li key={variable.name}>
                <button
                  onClick={() => {
                    setHighlightedIndex(index);
                    selectOptionAndCleanUp(
                      new VariableTypeaheadOption(variable),
                    );
                  }}
                  onMouseEnter={() => {
                    setHighlightedIndex(index);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-mono font-medium text-blue-600 dark:text-blue-300">
                        @{variable.name}
                      </div>
                      {variable.description && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {variable.description}
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {variable.type}
                    </div>
                  </div>
                  {!variable.alwaysDefined && (
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      ⚠ Conditional: only available in some paths
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        );
      }}
    />
  );
}

export default VariableMentionPlugin;
