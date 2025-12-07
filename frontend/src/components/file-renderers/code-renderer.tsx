'use client';

import React, { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { langs } from '@uiw/codemirror-extensions-langs';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { xcodeLight } from '@uiw/codemirror-theme-xcode';
import { useTheme } from 'next-themes';
import { EditorView } from '@codemirror/view';

interface CodeRendererProps {
  content: string;
  language?: string;
  className?: string;
}

// Map of language aliases to CodeMirror language support
const languageMap: Record<string, any> = {
  js: (langs as any).javascript,
  jsx: (langs as any).jsx,
  ts: (langs as any).typescript,
  tsx: (langs as any).tsx,
  html: (langs as any).html,
  css: (langs as any).css,
  json: (langs as any).json,
  md: (langs as any).markdown,
  python: (langs as any).python,
  py: (langs as any).python,
  rust: (langs as any).rust,
  go: (langs as any).go,
  java: (langs as any).java,
  c: (langs as any).c,
  cpp: (langs as any).cpp,
  cs: (langs as any).csharp,
  php: (langs as any).php,
  ruby: (langs as any).ruby,
  sh: (langs as any).shell,
  bash: (langs as any).shell,
  sql: (langs as any).sql,
  yaml: (langs as any).yaml,
  yml: (langs as any).yaml,
  // Add more languages as needed
};

export function CodeRenderer({
  content,
  language = '',
  className,
}: CodeRendererProps) {
  // Get current theme
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Set mounted state to true after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the language extension to use
  const langExtension =
    language && languageMap[language] ? [languageMap[language]()] : [];

  // Add line wrapping extension
  const extensions = [...langExtension, EditorView.lineWrapping];

  // Select the theme based on the current theme
  const theme = mounted && resolvedTheme === 'dark' ? vscodeDark : xcodeLight;

  return (
    <ScrollArea className={cn('w-full h-full', className)}>
      <div className="w-full">
        <CodeMirror
          value={content}
          theme={theme}
          extensions={extensions}
          basicSetup={{
            lineNumbers: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            foldGutter: false,
          }}
          editable={false}
          className="text-sm w-full min-h-full"
          style={{ maxWidth: '100%' }}
          height="auto"
        />
      </div>
    </ScrollArea>
  );
}
