// frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx

import React, { useEffect, useRef } from 'react';
import { SlashCommand } from '@/components/slash-commands/types';
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
      className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-popover border border-border rounded-md shadow-lg overflow-hidden z-50"
      role="listbox"
    >
      <div
        ref={listRef}
        className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/50"
      >
        {commands.map((command, index) => (
          <div
            key={command.name}
            ref={index === selectedIndex ? selectedItemRef : null}
            role="option"
            aria-selected={index === selectedIndex}
            className={cn(
              'px-2 py-1 cursor-pointer transition-colors',
              'hover:bg-accent focus:bg-accent',
              index === selectedIndex && 'bg-accent/100',
              'border-b border-border last:border-b-0'
            )}
            onClick={() => onSelect(command)}
            onMouseEnter={() => {
              // Optional: Update selected index on hover
              // This would require passing a setSelectedIndex callback
            }}
          >
            <div className="flex items-start gap-1.5">
              <div className="flex-shrink-0 mt-0.5">
                <div className={cn(
                  "w-4 h-4 rounded flex items-center justify-center transition-colors",
                  index === selectedIndex
                    ? "bg-primary/80 text-primary-foreground"
                    : "bg-primary/10 text-primary"
                )}>
                  <span className="text-[9px] font-mono">/</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-[13px] font-medium transition-colors",
                  index === selectedIndex ? "text-foreground" : "text-foreground"
                )}>
                  /{command.name}
                </div>
                {command.description && (
                  <div className={cn(
                    "text-[11px] line-clamp-1 transition-colors",
                    index === selectedIndex ? "text-foreground/70" : "text-muted-foreground"
                  )}>
                    {command.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-2 py-1 bg-muted/50 border-t border-border">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};
