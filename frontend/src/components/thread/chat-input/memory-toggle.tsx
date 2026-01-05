'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMemoryStats } from '@/hooks/memory/use-memory';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface MemoryToggleProps {
  disabled?: boolean;
  memoryEnabled?: boolean;
  onMemoryToggle?: (enabled: boolean) => void;
}

export const MemoryToggle = memo(function MemoryToggle({
  disabled,
  memoryEnabled: controlledEnabled,
  onMemoryToggle
}: MemoryToggleProps) {
  const t = useTranslations('settings.memory');
  const { data: stats } = useMemoryStats();
  const [localEnabled, setLocalEnabled] = useState(true);

  useEffect(() => {
    if (controlledEnabled !== undefined) {
      setLocalEnabled(controlledEnabled);
    }
  }, [controlledEnabled]);

  const isControlled = onMemoryToggle !== undefined;
  const isEnabled = isControlled ? (controlledEnabled ?? true) : localEnabled;

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onMemoryToggle) {
      onMemoryToggle(!isEnabled);
    } else {
      setLocalEnabled(prev => !prev);
    }
  }, [onMemoryToggle, isEnabled]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            "relative h-10 w-10 p-0 bg-transparent border-[1.5px] border-border rounded-2xl text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center justify-center cursor-pointer transition-colors",
            isEnabled && "text-foreground bg-muted dark:bg-muted/50"
          )}
        >
          <Brain className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <>
          <p>{isEnabled ? (t('memoryEnabledTooltip') || 'Memory enabled') : (t('memoryDisabledTooltip') || 'Memory disabled')}</p>
          <p className="text-xs text-muted-foreground">{t('clickToToggle') || `Click to ${isEnabled ? 'disable' : 'enable'}`}</p>
        </>
      </TooltipContent>
    </Tooltip>
  );
});
