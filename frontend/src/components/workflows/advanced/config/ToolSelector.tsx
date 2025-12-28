'use client';

import React, { memo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface Tool {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: 'search' | 'content' | 'web' | 'data' | 'media' | 'other';
  icon?: string;
}

const AVAILABLE_TOOLS: Tool[] = [
  // Search tools
  {
    id: 'web_search',
    name: 'Web Search',
    displayName: 'Web Search',
    description: 'Search the web for information',
    category: 'search',
  },
  {
    id: 'people_search',
    name: 'People Search',
    displayName: 'People Search',
    description: 'Search for people and their information',
    category: 'search',
  },
  {
    id: 'company_search',
    name: 'Company Search',
    displayName: 'Company Search',
    description: 'Search for company information',
    category: 'search',
  },
  {
    id: 'paper_search',
    name: 'Paper Search',
    displayName: 'Academic Paper Search',
    description: 'Search academic papers',
    category: 'search',
  },
  {
    id: 'image_search',
    name: 'Image Search',
    displayName: 'Image Search',
    description: 'Search for images',
    category: 'search',
  },

  // Content tools
  {
    id: 'browser',
    name: 'Browser',
    displayName: 'Browser',
    description: 'Open URLs and navigate the web',
    category: 'web',
  },
  {
    id: 'kb_tool',
    name: 'Knowledge Base',
    displayName: 'Knowledge Base',
    description: 'Search knowledge base documents',
    category: 'content',
  },

  // File tools
  {
    id: 'files',
    name: 'Files',
    displayName: 'File Management',
    description: 'Read, write, and manage files',
    category: 'content',
  },
  {
    id: 'shell',
    name: 'Shell',
    displayName: 'Shell Commands',
    description: 'Execute shell commands',
    category: 'other',
  },

  // Media tools
  {
    id: 'image_edit',
    name: 'Image Editor',
    displayName: 'Image Editing',
    description: 'Edit and manipulate images',
    category: 'media',
  },
  {
    id: 'presentation',
    name: 'Presentations',
    displayName: 'Presentation Creator',
    description: 'Create and edit presentations',
    category: 'media',
  },

  // Data tools
  {
    id: 'data_providers',
    name: 'Data Providers',
    displayName: 'Data Providers',
    description: 'Access various data APIs',
    category: 'data',
  },

  // Communication
  {
    id: 'message',
    name: 'Messages',
    displayName: 'Send Messages',
    description: 'Send messages to users',
    category: 'other',
  },
];

const TOOL_CATEGORIES: Record<string, string> = {
  search: 'Search Tools',
  content: 'Content Tools',
  web: 'Web Tools',
  data: 'Data Tools',
  media: 'Media Tools',
  other: 'Other',
};

interface ToolSelectorProps {
  /** Currently selected tool IDs */
  value?: string[];

  /** Called when tool selection changes */
  onChange: (toolIds: string[]) => void;

  /** Optional CSS class */
  className?: string;

  /** Maximum number of tools that can be selected */
  maxTools?: number;

  /** Disable the selector */
  disabled?: boolean;
}

/**
 * ToolSelector Component
 *
 * Multi-select dropdown for choosing tools available to AI step.
 * Shows tools grouped by category with descriptions.
 *
 * Maps to: T039 (Phase 4: User Story 2)
 */
export const ToolSelector = memo<ToolSelectorProps>(
  ({ value = [], onChange, className = '', maxTools, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);

    const selectedTools = AVAILABLE_TOOLS.filter((t) => value.includes(t.id));

    const handleToggleTool = (toolId: string) => {
      if (value.includes(toolId)) {
        // Remove tool
        onChange(value.filter((id) => id !== toolId));
      } else {
        // Add tool (check max limit)
        if (maxTools && value.length >= maxTools) {
          return; // Don't add if at max
        }
        onChange([...value, toolId]);
      }
    };

    const handleRemoveTool = (toolId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(value.filter((id) => id !== toolId));
    };

    // Group tools by category
    const toolsByCategory = AVAILABLE_TOOLS.reduce(
      (acc, tool) => {
        if (!acc[tool.category]) {
          acc[tool.category] = [];
        }
        acc[tool.category].push(tool);
        return acc;
      },
      {} as Record<string, Tool[]>,
    );

    return (
      <div className={`space-y-2 ${className}`}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Tools
        </label>

        <div className="space-y-2">
          {/* Selected tools as badges */}
          {selectedTools.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTools.map((tool) => (
                <Badge
                  key={tool.id}
                  variant="secondary"
                  className="flex items-center gap-1 pl-2"
                >
                  {tool.displayName}
                  <button
                    onClick={(e) => handleRemoveTool(tool.id, e)}
                    className="ml-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 p-0.5"
                    aria-label={`Remove ${tool.displayName}`}
                  >
                    <X size={14} />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Dropdown trigger */}
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled={disabled || (maxTools && value.length >= maxTools)}
              >
                <span className="text-left">
                  {selectedTools.length === 0
                    ? 'Select tools...'
                    : `${selectedTools.length} tool${selectedTools.length !== 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown size={16} className="opacity-50" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56" align="start">
              {Object.entries(toolsByCategory).map(([category, tools]) => (
                <div key={category}>
                  <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    {TOOL_CATEGORIES[category] || category}
                  </DropdownMenuLabel>

                  {tools.map((tool) => (
                    <DropdownMenuCheckboxItem
                      key={tool.id}
                      checked={value.includes(tool.id)}
                      onCheckedChange={() => handleToggleTool(tool.id)}
                      disabled={maxTools && value.length >= maxTools && !value.includes(tool.id)}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{tool.displayName}</div>
                        {tool.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                            {tool.description}
                          </div>
                        )}
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}

                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Helper text */}
        {maxTools && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Maximum {maxTools} tool{maxTools !== 1 ? 's' : ''} can be selected
          </p>
        )}

        {value.length === 0 && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Select at least one tool for the AI step
          </p>
        )}
      </div>
    );
  },
);

ToolSelector.displayName = 'ToolSelector';

export default ToolSelector;
