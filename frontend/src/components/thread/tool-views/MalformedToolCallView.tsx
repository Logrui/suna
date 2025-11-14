'use client'

import React from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { ToolViewProps } from './types';

export function MalformedToolCallView({
  assistantContent,
  toolContent,
}: ToolViewProps) {
  const [copied, setCopied] = React.useState(false);

  // Extract error message from either assistant content or tool content
  const errorMessage = React.useMemo(() => {
    try {
      // Try parsing assistant content first
      if (assistantContent) {
        const parsed = JSON.parse(assistantContent);
        if (parsed.content) return parsed.content;
        if (typeof parsed === 'string') return parsed;
      }
      // Fallback to tool content
      if (toolContent) {
        const parsed = JSON.parse(toolContent);
        if (parsed.content) return parsed.content;
        if (typeof parsed === 'string') return parsed;
        return JSON.stringify(parsed, null, 2);
      }
    } catch (e) {
      // If parsing fails, return raw content
      return assistantContent || toolContent || 'Unknown error';
    }
    return 'Unknown error';
  }, [assistantContent, toolContent]);

  const metadata = React.useMemo(() => {
    try {
      if (assistantContent) {
        const parsed = JSON.parse(assistantContent);
        return parsed.metadata || parsed;
      }
    } catch (e) {
      return null;
    }
    return null;
  }, [assistantContent]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorMessage);
      setCopied(true);
      toast.success('Error details copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Card className="w-full border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <CardTitle className="text-base font-semibold text-red-900 dark:text-red-100">
              Malformed Tool Call
            </CardTitle>
          </div>
          <Badge variant="destructive" className="text-xs">
            Validation Failed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-red-800 dark:text-red-200">Error Details</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs hover:bg-red-100 dark:hover:bg-red-900/30"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <ScrollArea className="h-[200px] w-full rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/20">
            <div className="p-3">
              <pre className="text-xs font-mono text-red-900 dark:text-red-100 whitespace-pre-wrap break-words">
                {errorMessage}
              </pre>
            </div>
          </ScrollArea>
        </div>

        {metadata?.raw_attempt && (
          <div>
            <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-2">Raw Attempt</p>
            <ScrollArea className="h-[150px] w-full rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/20">
              <div className="p-3">
                <pre className="text-xs font-mono text-red-900 dark:text-red-100 whitespace-pre-wrap break-words">
                  {metadata.raw_attempt}
                </pre>
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="pt-2 border-t border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-300">
            The model's output did not conform to the expected tool call format. This error has been sent back to the model for correction.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
