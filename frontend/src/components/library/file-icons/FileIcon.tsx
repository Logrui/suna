/**
 * FileIcon Component
 * Smart icon selector that displays the appropriate Manus-style icon
 * based on the file type detected from the filename
 */

import React from 'react';
import { getFileType } from '@/lib/utils/fileTypeDetector';
import {
  DocumentIcon,
  SpreadsheetIcon,
  CodeIcon,
  PdfIcon,
  ArchiveIcon,
  DefaultIcon,
} from './icons';

interface FileIconProps {
  /** The filename including extension */
  filename: string;
  /** Optional CSS class for sizing/styling (default: h-4 w-4) */
  className?: string;
  /** Optional title for accessibility */
  title?: string;
}

/**
 * Displays the appropriate file type icon based on the filename
 * Uses Manus design system icons with proper color coding for file types
 */
export const FileIcon: React.FC<FileIconProps> = ({
  filename,
  className = 'h-4 w-4',
  title,
}) => {
  const fileType = getFileType(filename);

  // Determine display title
  const displayTitle = title || `${filename} (${fileType})`;

  // Render the appropriate icon based on file type
  const iconProps = { className, title: displayTitle };

  switch (fileType) {
    case 'document':
      return <DocumentIcon {...iconProps} />;
    case 'spreadsheet':
      return <SpreadsheetIcon {...iconProps} />;
    case 'code':
      return <CodeIcon {...iconProps} />;
    case 'pdf':
      return <PdfIcon {...iconProps} />;
    case 'archive':
      return <ArchiveIcon {...iconProps} />;
    default:
      return <DefaultIcon {...iconProps} />;
  }
};

FileIcon.displayName = 'FileIcon';
