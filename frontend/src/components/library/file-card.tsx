/**
 * File Card Component - Manus Style
 * Individual file card with icon, name, and optional markdown preview
 */

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSandboxFileContent } from '@/lib/api';
import { MarkdownPreview } from './markdown-preview/MarkdownPreview';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileCardProps {
  file: any;
  IconComponent: React.ComponentType<{ className?: string; title?: string }>;
  isMarkdown: boolean;
  sandboxId: string;
  onFileClick: (e: React.MouseEvent, filePath: string) => void;
}

export function FileCard({
  file,
  IconComponent,
  isMarkdown,
  sandboxId,
  onFileClick,
}: FileCardProps) {
  // Fetch markdown content if it's a markdown file
  const { data: markdownContent } = useQuery({
    queryKey: ['file-preview', sandboxId, file.path],
    queryFn: async () => {
      if (!isMarkdown || !file.path) return '';
      
      try {
        const content = await getSandboxFileContent(sandboxId, file.path);
        
        // Handle both string and Blob responses
        let contentStr = '';
        if (typeof content === 'string') {
          contentStr = content;
        } else if (content instanceof Blob) {
          contentStr = await content.text();
        }
        
        return contentStr;
      } catch (error) {
        console.error('Failed to fetch file preview:', error);
        return '';
      }
    },
    enabled: isMarkdown && !!file.path && !!sandboxId,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div 
      className="relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-card group hover:shadow-lg transition-shadow"
      onClick={(e) => onFileClick(e, file.path)}
    >
      {/* File Header */}
      <div className="flex items-center gap-2 px-2 py-2.5 relative">
        {/* Icon */}
        <div className="flex items-center justify-center flex-shrink-0">
          <IconComponent className="w-6 h-6" />
        </div>

        {/* File Name */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 min-w-0 truncate text-sm" title={file.name}>
            <span className="truncate">{file.name || 'Untitled File'}</span>
          </div>
        </div>

        {/* More Menu Button */}
        <div className="flex items-center flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add file menu actions
            }}
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* File Preview Area */}
      <div className="aspect-[16/9] rounded-lg overflow-hidden relative m-2 mt-0">
        <div className="size-full rounded-lg bg-muted p-3 relative">
          {isMarkdown && markdownContent ? (
            <>
              {/* Markdown Preview */}
              <div className="scale-[0.5] origin-top-left">
                <div className="w-[200%] h-[200%]">
                  <MarkdownPreview markdown={markdownContent} maxLines={20} maxChars={1600} />
                </div>
              </div>
              {/* Gradient fade at bottom */}
              <div 
                className="pointer-events-none absolute left-0 right-0 bottom-0 h-8"
                style={{
                  background: 'linear-gradient(rgba(0, 0, 0, 0) 0%, hsl(var(--muted)) 100%)'
                }}
              />
            </>
          ) : (
            /* Large Icon for Non-Markdown Files */
            <div className="flex items-center justify-center h-full">
              <IconComponent className="w-24 h-24 opacity-40" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
