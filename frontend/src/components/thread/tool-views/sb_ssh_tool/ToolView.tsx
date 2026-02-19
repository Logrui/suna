import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  CheckCircle,
  AlertTriangle,
  CircleDashed,
  Code,
  Clock,
  ArrowRight,
  TerminalIcon,
  Loader2,
  Plug,
  Unplug
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { formatTimestamp, getToolTitle } from '../utils';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from '../shared/LoadingState';
import { extractSSHData } from './_utils';
import { useToolStreamStore } from '@/stores/tool-stream-store';

export function SBSSHToolView({
  toolCall,
  toolResult,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
}: ToolViewProps) {
  const { resolvedTheme } = useTheme();
  const [showFullOutput, setShowFullOutput] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toolCallId = toolCall?.tool_call_id || '';
  const streamingOutput = useToolStreamStore((state) => state.streamingOutputs.get(toolCallId) || '');
  const isOutputStreaming = useToolStreamStore((state) => state.streamingStatus.get(toolCallId) === 'streaming');

  const {
    command,
    output,
    exitCode,
    connectionId,
    host,
    username,
    target,
    cwd,
    action, // 'connect', 'execute', 'disconnect'
    success: actualIsSuccess,
    timestamp: actualToolTimestamp,
  } = extractSSHData(
    toolCall,
    toolResult,
    isSuccess,
    toolTimestamp,
    assistantTimestamp
  );

  const displayOutput = isStreaming && streamingOutput ? streamingOutput : output;

  useEffect(() => {
    if (isOutputStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingOutput, isOutputStreaming]);

  const formattedOutput = React.useMemo(() => {
    if (isOutputStreaming && streamingOutput) {
      return streamingOutput.split('\n');
    }

    if (!displayOutput) return [];

    let processedOutput = displayOutput;
    if (typeof displayOutput === 'object') {
        processedOutput = JSON.stringify(displayOutput, null, 2);
    }

    processedOutput = String(processedOutput).replace(/\\n/g, '\n');

    // Remove ANSI codes
    processedOutput = processedOutput.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');

    return processedOutput.split('\n');
  }, [displayOutput, isOutputStreaming, streamingOutput]);

  const linesToShow = showFullOutput ? formattedOutput : formattedOutput.slice(0, 10);
  const hasMoreLines = formattedOutput.length > 10;

  const getHeaderIcon = () => {
    if (action === 'connect') return <Plug className="w-5 h-5 text-zinc-500" />;
    if (action === 'disconnect') return <Unplug className="w-5 h-5 text-zinc-500" />;
    return <Terminal className="w-5 h-5 text-zinc-500" />;
  };

  const getTitle = () => {
    if (action === 'connect') return `SSH Connect: ${target || host}`;
    if (action === 'disconnect') return `SSH Disconnect: ${connectionId}`;
    return "SSH Command";
  };

  return (
    <Card className="gap-0 flex border-0 shadow-none p-0 py-0 rounded-none flex-col h-full overflow-hidden bg-card">
      <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-lg border flex-shrink-0 bg-zinc-200/60 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
              {getHeaderIcon()}
            </div>
            <div>
              <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {getTitle()}
              </CardTitle>
            </div>
          </div>

          {!isStreaming && (
            <Badge
              variant="secondary"
              className={
                actualIsSuccess
                  ? "bg-gradient-to-b from-emerald-200 to-emerald-100 text-emerald-700 dark:from-emerald-800/50 dark:to-emerald-900/60 dark:text-emerald-300"
                  : "bg-gradient-to-b from-rose-200 to-rose-100 text-rose-700 dark:from-rose-800/50 dark:to-rose-900/60 dark:text-rose-300"
              }
            >
              {actualIsSuccess ? (
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              )}
              {actualIsSuccess ? 'Success' : 'Failed'}
            </Badge>
          )}

           {isStreaming && (
            <Badge className="bg-gradient-to-b from-blue-200 to-blue-100 text-blue-700 dark:from-blue-800/50 dark:to-blue-900/60 dark:text-blue-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Executing
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-4 pb-2">
                {/* Connection Info */}
                {action === 'connect' && target && (
                     <div className="mb-4 bg-card border border-border rounded-lg p-3.5">
                        <div className="text-sm text-foreground">
                            Connected to <span className="font-semibold">{target}</span>
                        </div>
                        {connectionId && (
                            <div className="text-xs text-muted-foreground mt-1">
                                Connection ID: <span className="font-mono">{connectionId}</span>
                            </div>
                        )}
                     </div>
                )}

                {/* Command Display */}
                {action === 'execute' && command && (
                    <div className="mb-4 bg-card border border-border rounded-lg p-3.5">
                         <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal">
                              <TerminalIcon className="h-2.5 w-2.5 mr-1 opacity-70" />
                              Command
                            </Badge>
                            {cwd && <span className="text-xs text-muted-foreground font-mono">{cwd}</span>}
                        </div>
                        <div className="font-mono text-xs text-foreground">
                            <span className="text-green-500 dark:text-green-400 font-semibold">$ </span>
                            <span className="text-foreground">{command}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Output Display */}
            {(formattedOutput.length > 0 || isOutputStreaming) && (
              <div className="flex-1 min-h-0 px-4 pb-4">
                <div className="h-full bg-card border border-border rounded-lg flex flex-col overflow-hidden">
                   <div className="flex-shrink-0 p-3.5 pb-2 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 font-normal">
                                <TerminalIcon className="h-2.5 w-2.5 mr-1 opacity-70" />
                                Output
                            </Badge>
                        </div>
                   </div>
                   <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
                        <div className="p-3.5 pt-2">
                            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-words">
                                {linesToShow.map((line, idx) => (
                                    <span key={idx}>{line}{'\n'}</span>
                                ))}
                            </pre>
                            {!showFullOutput && hasMoreLines && (
                                <div className="text-muted-foreground mt-2 border-t border-border pt-2 text-xs font-mono">
                                    + {formattedOutput.length - 10} more lines
                                </div>
                            )}
                        </div>
                   </ScrollArea>
                </div>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
