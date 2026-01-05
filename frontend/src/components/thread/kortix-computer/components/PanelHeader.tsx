'use client';

import { memo, useState, useEffect } from 'react';
import { CircleDashed, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DrawerTitle } from '@/components/ui/drawer';
import { ViewType } from '@/stores/kortix-computer-store';
import { KortixLogo } from '@/components/sidebar/kortix-logo';
import { cn } from '@/lib/utils';
import { ViewToggle } from './ViewToggle';
import { ToolbarButtons } from './ToolbarButtons';

function useBatteryStatus() {
  const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean } | null>(null);

  useEffect(() => {
    let battery: any = null;

    const updateBatteryInfo = (b: any) => {
      setBatteryInfo({
        level: Math.round(b.level * 100),
        charging: b.charging,
      });
    };

    const setupBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          battery = await (navigator as any).getBattery();
          updateBatteryInfo(battery);

          battery.addEventListener('levelchange', () => updateBatteryInfo(battery));
          battery.addEventListener('chargingchange', () => updateBatteryInfo(battery));
        }
      } catch (e) {
        console.log('Battery API not available');
      }
    };

    setupBattery();

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', () => updateBatteryInfo(battery));
        battery.removeEventListener('chargingchange', () => updateBatteryInfo(battery));
      }
    };
  }, []);

  return batteryInfo;
}

function useCurrentTime() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

function StatusBar() {
  const currentTime = useCurrentTime();
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="font-medium">
        {currentTime}
      </div>
    </div>
  );
}

// Sandbox status helpers
const getSandboxStateColor = (state: string) => {
  switch (state?.toLowerCase()) {
    case 'started':
    case 'running':
      return 'text-chart-2';
    case 'stopped':
      return 'text-chart-4';
    case 'archived':
      return 'text-muted-foreground';
    default:
      return 'text-amber-500';
  }
};

const SandboxStatusIndicator = ({ state }: { state: string }) => {
  const isActive = state?.toLowerCase() === 'started' || state?.toLowerCase() === 'running';

  if (isActive) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-chart-2" />
      </span>
    );
  }

  if (state?.toLowerCase() === 'stopped') {
    return <span className="h-2 w-2 rounded-full bg-chart-4" />;
  }

  // Default for loading/initializing states
  return <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />;
};

interface PanelHeaderProps {
  onClose: () => void;
  onMaximize?: () => void;
  isStreaming?: boolean;
  variant?: 'drawer' | 'desktop' | 'motion';
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  showFilesTab?: boolean;
  isMaximized?: boolean;
  sandboxState?: string;
  hideViewToggle?: boolean;
  isEmbedded?: boolean;
  isExpanded?: boolean;
}

export const PanelHeader = memo(function PanelHeader({
  onClose,
  onMaximize,
  isStreaming = false,
  variant = 'desktop',
  currentView,
  onViewChange,
  showFilesTab = true,
  isMaximized = false,
  sandboxState,
  hideViewToggle = false,
  isEmbedded = false,
  isExpanded = false,
}: PanelHeaderProps) {

  const title = "Kortix Computer";

  if (variant === 'drawer') {
    return (
      <div className="h-14 flex-shrink-0 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 flex items-center justify-center">
            <KortixLogo size={18} />
          </div>
          <DrawerTitle className="text-sm font-semibold text-foreground">
            {title}
          </DrawerTitle>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle currentView={currentView} onViewChange={onViewChange} showFilesTab={showFilesTab} />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Minimize"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }



  if (variant === 'motion') {
    const canExpand = currentView === 'desktop' && onMaximize && !isMaximized;

    // Show status indicator only when on desktop tab and sandbox is not in 'started'/'running' state
    const showSandboxStatus = currentView === 'desktop' &&
      sandboxState &&
      sandboxState.toLowerCase() !== 'started' &&
      sandboxState.toLowerCase() !== 'running';

    return (
      <div className="h-14 flex-shrink-0 px-4 grid grid-cols-3 items-center border-b border-border">
        {/* Left side - Sandbox status when not running */}
        <div className="flex items-center gap-2">
          {showSandboxStatus && (
            <>
              <SandboxStatusIndicator state={sandboxState} />
              <span className={cn(
                "text-xs font-medium capitalize",
                getSandboxStateColor(sandboxState)
              )}>
                {sandboxState}
              </span>
            </>
          )}
        </div>

        {/* Center - Clickable title when on desktop tab */}
        <div
          onClick={canExpand ? onMaximize : undefined}
          className={cn(
            "flex items-center justify-center gap-2",
            canExpand && "cursor-pointer hover:opacity-80 transition-opacity"
          )}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <KortixLogo size={18} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            {title}
          </h2>
        </div>

        {/* Right side - ViewToggle + action buttons */}
        <div className="flex items-center gap-2 justify-end">
          <ViewToggle currentView={currentView} onViewChange={onViewChange} showFilesTab={showFilesTab} />
          {/* Show Expand button when on desktop tab and not maximized */}
          {canExpand && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMaximize}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Expand to Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          {/* Hide minimize button when on desktop tab - user should use Expand or click title */}
          {currentView !== 'desktop' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex-shrink-0 grid grid-cols-3 items-center",
      isMaximized
        ? "h-9 px-3"
        : "h-14 px-3.5 pt-1 border-b border-border"
    )}>
      <div className="flex items-center justify-start gap-4">
        <ToolbarButtons
          onClose={onClose}
          isMaximized={isMaximized}
          isEmbedded={isEmbedded}
          isExpanded={isExpanded}
          onMaximize={onMaximize}
        />
        {/* Sandbox status when not running and on desktop view */}
        {currentView === 'desktop' &&
          sandboxState &&
          sandboxState.toLowerCase() !== 'started' &&
          sandboxState.toLowerCase() !== 'running' && (
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <SandboxStatusIndicator state={sandboxState} />
              <span className={cn(
                "text-[10px] font-medium capitalize",
                getSandboxStateColor(sandboxState)
              )}>
                {sandboxState}
              </span>
            </div>
          )}
      </div>
      {/* Title click: if maximized, exit fullscreen (onClose). Otherwise expand (onMaximize) */}
      <div
        onClick={isMaximized ? onClose : () => onMaximize?.()}
        className="flex items-center justify-center gap-1.5 cursor-pointer select-none hover:opacity-80 transition-opacity"
        title={isMaximized ? "Exit Fullscreen" : "Expand to Fullscreen"}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <KortixLogo size={14} />
        </div>
        <h2 className="text-sm font-semibold text-foreground">
          {title}
        </h2>
      </div>

      <div className="flex items-center justify-end gap-2">
        {isStreaming && (
          <div className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary flex items-center gap-1">
            <CircleDashed className="h-2.5 w-2.5 animate-spin" />
            <span>Running</span>
          </div>
        )}
        {!hideViewToggle && (
          <ViewToggle currentView={currentView} onViewChange={onViewChange} showFilesTab={showFilesTab} />
        )}
        {isMaximized && (
          <>
            <StatusBar />
          </>
        )}
      </div>
    </div>
  );
});

PanelHeader.displayName = 'PanelHeader';

