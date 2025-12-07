
'use client';

import React from 'react';
import { PdfRenderer } from './pdf-renderer';
import { ImageRenderer } from './image-renderer';
import { BinaryRenderer } from './binary-renderer';
import { CsvRenderer } from './csv-renderer';
import { XlsxRenderer } from './xlsx-renderer';
import { PptxRenderer } from './pptx-renderer';
import { HtmlRenderer } from './html-renderer';
import { CodeRenderer } from './code-renderer';
import { MarkdownRenderer } from './authenticated-markdown-renderer';

interface FileRendererProps {
    content?: string | null;
    binaryUrl?: string | null;
    fileName: string;
    filePath: string;
    className?: string;
    project?: any;
    markdownRef?: React.RefObject<HTMLDivElement>;
    onDownload?: () => void;
    isDownloading?: boolean;
}

export function FileRenderer({
    content,
    binaryUrl,
    fileName,
    filePath,
    className,
    project,
    markdownRef,
    onDownload,
    isDownloading
}: FileRendererProps) {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    // Helper to determine language for CodeRenderer
    const getLanguage = (ext: string) => {
        const map: Record<string, string> = {
            js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
            py: 'python', rb: 'ruby', rs: 'rust', go: 'go',
            java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
            html: 'html', css: 'css', json: 'json', md: 'markdown',
            yaml: 'yaml', yml: 'yaml', sql: 'sql', sh: 'shell', bash: 'shell'
        };
        return map[ext] || 'text';
    };

    if (extension === 'pdf' && binaryUrl) {
        // PdfRenderer likely takes url. Assuming standard props for now as I verified others.
        return <PdfRenderer url={binaryUrl} className={className} />;
    }

    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(extension) && binaryUrl) {
        // ImageRenderer takes url, className. No alt.
        return <ImageRenderer url={binaryUrl} className={className} />;
    }

    if (extension === 'csv' && content) {
        return <CsvRenderer content={content} className={className} />;
    }

    if (['xlsx', 'xls'].includes(extension)) {
        // XlsxRenderer checks filePath || fileName. If binaryUrl is a blob url, we can pass it as filePath.
        // If not, we pass filePath from props.
        const path = binaryUrl || filePath;
        return <XlsxRenderer
            filePath={path}
            fileName={fileName}
            className={className}
            project={project}
        />;
    }

    if (['pptx', 'ppt'].includes(extension)) {
        return <PptxRenderer
            binaryUrl={binaryUrl}
            filePath={filePath}
            fileName={fileName}
            className={className}
            project={project}
            onDownload={onDownload}
            isDownloading={isDownloading}
        />;
    }

    if (extension === 'html' && content) {
        // HtmlRenderer needs previewUrl. 
        // If binaryUrl is available (blob), use it. Or filePath?
        return <HtmlRenderer
            content={content}
            previewUrl={binaryUrl || filePath}
            className={className}
            project={project}
        />;
    }

    if (extension === 'md' && content) {
        return <MarkdownRenderer
            content={content}
            className={className}
            project={project}
            basePath={filePath} // passing filePath as basePath for relative image resolution
            ref={markdownRef}
        />;
    }

    // Default to CodeRenderer for text content
    if (content !== null && content !== undefined) {
        return <CodeRenderer content={content} language={getLanguage(extension)} className={className} />;
    }

    // Fallback for binary files without specific renderer
    if (binaryUrl) {
        return <BinaryRenderer
            url={binaryUrl}
            fileName={fileName}
            className={className}
            onDownload={onDownload}
            isDownloading={isDownloading}
        />;
    }

    return <div className={className}>Unsupported file type or empty content</div>;
}
