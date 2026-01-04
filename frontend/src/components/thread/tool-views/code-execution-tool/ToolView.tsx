import React, { useState } from 'react';
import {
  Terminal,
  CheckCircle,
  AlertTriangle,
  CircleDashed,
  Code,
  Clock,
  Play,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { formatTimestamp, getToolTitle } from '../utils';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from '../shared/LoadingState';
import { extractCodeExecutionData, getRuntimeIcon, getRuntimeColor } from './_utils';

export function CodeExecutionToolView({
  name = 'execute-code',
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
}: ToolViewProps) {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const [showFullOutput, setShowFullOutput] = useState(true);

  const {
    runtime,
    code,
    session,
    output,
    status,
    actualIsSuccess,
    actualToolTimestamp,
    actualAssistantTimestamp
  } = extractCodeExecutionData(
    assistantContent,
    toolContent,
    isSuccess,
    toolTimestamp,
    assistantTimestamp
  );

  const runtimeIcon = getRuntimeIcon(runtime);
  const runtimeColor = getRuntimeColor(runtime);
  const toolTitle = getToolTitle(name);

  const formattedOutput = React.useMemo(() => {
    if (!output) return [];

    let processedOutput = output;

    // Handle object output
    if (typeof output === 'object' && output !== null) {
      try {
        processedOutput = JSON.stringify(output, null, 2);
      } catch (e) {
        processedOutput = String(output);
      }
    } else if (typeof output === 'string') {
      // Try to parse as JSON
      try {
        if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
          const parsed = JSON.parse(output);
          if (parsed && typeof parsed === 'object') {
            processedOutput = JSON.stringify(parsed, null, 2);
          } else {
            processedOutput = String(parsed);
          }
        } else {
          processedOutput = output;
        }
      } catch (e) {
        processedOutput = output;
      }
    } else {
      processedOutput = String(output);
    }

    // Clean escape sequences
    processedOutput = processedOutput.replace(/\\\\/g, '\\');
    processedOutput = processedOutput
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");

    processedOutput = processedOutput.replace(/\\u([0-9a-fA-F]{4})/g, (_match, group) => {
      return String.fromCharCode(parseInt(group, 16));
    });

    return processedOutput.split('\n');
  }, [output]);

  const hasMoreLines = formattedOutput.length > 30;
  const previewLines = formattedOutput.slice(0, 30);
  const linesToShow = showFullOutput ? formattedOutput : previewLines;

  // Add empty lines for scrolling
  const emptyLines = Array.from({ length: 20 }, () => '');

  const getRuntimeLabel = (rt: string | null): string => {
    switch (rt?.toLowerCase()) {
      case 'python':
        return 'Python';
      case 'nodejs':
        return 'Node.js';
      case 'terminal':
        return 'Terminal';
      case 'output':
        return 'Output Poll';
      case 'reset':
        return 'Session Reset';
      default:
        return 'Code Execution';
    }
  };

  const isResetOrOutput = runtime === 'reset' || runtime === 'output';

  return (
    <Card className="gap-0 flex border shadow-none border-t border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-card">
      <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("relative p-2 rounded-xl border", runtimeColor.bg, runtimeColor.border)}>
              <Code className={cn("w-5 h-5", runtimeColor.text)} />
            </div>
            <div>
              <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {getRuntimeLabel(runtime)}
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
              {actualIsSuccess ? 'Executed successfully' : 'Execution failed'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
        {isStreaming ? (
          <LoadingState
            icon={Code}
            iconColor={runtimeColor.text}
            bgColor={cn("bg-gradient-to-b shadow-inner", runtimeColor.bg)}
            title={`Executing ${getRuntimeLabel(runtime)}`}
            filePath={code ? code.substring(0, 60) + '...' : 'Processing code...'}
            showProgress={true}
          />
        ) : code || output || isResetOrOutput ? (
          <ScrollArea className="h-full w-full">
            <div className="bg-zinc-100 dark:bg-neutral-900 overflow-hidden">
              <div className="bg-zinc-300 dark:bg-neutral-800 flex items-center justify-between dark:border-zinc-700/50">
                <div className="bg-zinc-200 w-full dark:bg-zinc-800 px-4 py-2 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {getRuntimeLabel(runtime)}
                    {session !== null && ` - Session ${session}`}
                  </span>
                </div>
                {!actualIsSuccess && (
                  <Badge variant="outline" className="text-xs h-5 mr-2 border-red-700/30 text-red-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </div>
              <div className="px-4 py-3 overflow-auto">
                {/* Code input (if present) */}
                {code && !isResetOrOutput && (
                  <div className="mb-3">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-medium">
                      {runtime === 'python' ? 'Python Code:' : runtime === 'nodejs' ? 'JavaScript Code:' : 'Command:'}
                    </div>
                    <pre className="py-2 px-3 bg-zinc-50 dark:bg-zinc-900 rounded text-xs text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap break-words border border-zinc-200 dark:border-zinc-700">
                      {code}
                    </pre>
                  </div>
                )}

                {/* Output */}
                {formattedOutput.length > 0 && (
                  <div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-medium">
                      Output:
                    </div>
                    <pre className="text-xs text-zinc-600 dark:text-zinc-300 font-mono whitespace-pre-wrap break-words">
                      {linesToShow.map((line, idx) => (
                        <span key={idx}>
                          {line}
                          {'\n'}
                        </span>
                      ))}
                      {showFullOutput && emptyLines.map((_, idx) => (
                        <span key={`empty-${idx}`}>{'\n'}</span>
                      ))}
                    </pre>
                  </div>
                )}

                {!showFullOutput && hasMoreLines && (
                  <div className="text-zinc-500 mt-2 border-t border-zinc-700/30 pt-2 text-xs font-mono">
                    + {formattedOutput.length - 30} more lines
                  </div>
                )}
              </div>
            </div>

            {!output && !code && !isStreaming && (
              <div className="bg-black overflow-hidden p-12 flex items-center justify-center">
                <div className="text-center">
                  <CircleDashed className="h-8 w-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">No output received</p>
                </div>
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
            <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner", runtimeColor.bg)}>
              <Code className={cn("h-10 w-10", runtimeColor.text)} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              No Code Found
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md">
              No code was detected. Please provide code to execute.
            </p>
          </div>
        )}
      </CardContent>

      <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
        <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {!isStreaming && runtime && (
            <Badge variant="outline" className="h-6 py-0.5 bg-zinc-50 dark:bg-zinc-900">
              <span className="mr-1">{runtimeIcon}</span>
              {getRuntimeLabel(runtime)}
            </Badge>
          )}
          {session !== null && session !== undefined && !isStreaming && (
            <Badge variant="outline" className="h-6 py-0.5 bg-zinc-50 dark:bg-zinc-900">
              <Terminal className="h-3 w-3 mr-1" />
              Session {session}
            </Badge>
          )}
        </div>

        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {actualToolTimestamp && !isStreaming
            ? formatTimestamp(actualToolTimestamp)
            : actualAssistantTimestamp
              ? formatTimestamp(actualAssistantTimestamp)
              : ''}
        </div>
      </div>
    </Card>
  );
}
