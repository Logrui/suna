/**
 * File type detection utility for icon selection
 * Maps file extensions to icon types based on Manus design system
 */

export type FileType = 
  | 'document' 
  | 'spreadsheet' 
  | 'code' 
  | 'pdf' 
  | 'archive' 
  | 'default';

interface FileTypeConfig {
  extensions: string[];
  description: string;
}

const FILE_TYPE_MAP: Record<FileType, FileTypeConfig> = {
  document: {
    extensions: ['md', 'txt', 'doc', 'docx', 'rtf', 'odt', 'pages', 'tex', 'log'],
    description: 'Text & Document Files',
  },
  spreadsheet: {
    extensions: ['csv', 'xlsx', 'xls', 'tsv', 'ods', 'numbers', 'xlsm', 'xlsb'],
    description: 'Spreadsheet Files',
  },
  code: {
    extensions: [
      'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp', 'go', 'rs',
      'json', 'yaml', 'yml', 'html', 'css', 'scss', 'sass', 'less', 'xml', 'sql',
      'sh', 'bash', 'perl', 'rb', 'php', 'swift', 'kt', 'scala', 'groovy', 'gradle',
      'maven', 'dockerfile', 'makefile', 'cmake', 'lua', 'vim', 'toml', 'ini', 'conf',
      'vue', 'jsx', 'graphql', 'gql', 'prisma'
    ],
    description: 'Code & Data Files',
  },
  pdf: {
    extensions: ['pdf'],
    description: 'PDF Documents',
  },
  archive: {
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg', 'exe', 'msi'],
    description: 'Archive Files',
  },
  default: {
    extensions: [],
    description: 'Unknown File Type',
  },
};

/**
 * Detects the file type based on file extension
 * @param filename - The name of the file with extension
 * @returns The detected file type
 */
export function getFileType(filename: string): FileType {
  if (!filename) return 'default';

  // Extract extension (everything after the last dot)
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  // Search through file type map to find matching extension
  for (const [fileType, config] of Object.entries(FILE_TYPE_MAP)) {
    if (config.extensions.includes(extension)) {
      return fileType as FileType;
    }
  }

  return 'default';
}

/**
 * Gets all extensions for a specific file type
 * @param fileType - The file type to query
 * @returns Array of extensions for that type
 */
export function getExtensionsForType(fileType: FileType): string[] {
  return FILE_TYPE_MAP[fileType].extensions;
}

/**
 * Gets the description for a file type
 * @param fileType - The file type to query
 * @returns Human-readable description
 */
export function getTypeDescription(fileType: FileType): string {
  return FILE_TYPE_MAP[fileType].description;
}
