// frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx

import React, { useEffect, useRef } from 'react';
import { SlashCommand } from '@/lib/slashCommands';
import { cn } from '@/lib/utils';

interface SlashCommandAutocompleteProps {
  isOpen: boolean;
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export const SlashCommandAutocomplete: React.FC<SlashCommandAutocompleteProps> = ({
  isOpen,
  commands,
  selectedIndex,
  onSelect,
  onClose,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      const list = listRef.current;
      const item = selectedItemRef.current;
      
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      if (itemRect.bottom > listRect.bottom) {
        item.scrollIntoView({ block: 'end', behavior: 'smooth' });
      } else if (itemRect.top < listRect.top) {
        item.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen || commands.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50"
      role="listbox"
    >
      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto"
      >
        {commands.map((command, index) => (
          <div
            key={command.name}
            ref={index === selectedIndex ? selectedItemRef : null}
            role="option"
            aria-selected={index === selectedIndex}
            className={cn(
              'px-4 py-3 cursor-pointer transition-colors',
              'hover:bg-accent focus:bg-accent',
              index === selectedIndex && 'bg-accent',
              'border-b border-border last:border-b-0'
            )}
            onClick={() => onSelect(command)}
            onMouseEnter={() => {
              // Optional: Update selected index on hover
              // This would require passing a setSelectedIndex callback
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-mono text-primary">/</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">
                  /{command.name}
                </div>
                {command.description && (
                  <div className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                    {command.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="px-4 py-2 bg-muted/50 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};
