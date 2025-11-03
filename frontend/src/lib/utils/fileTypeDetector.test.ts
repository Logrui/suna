import { getFileType, getExtensionsForType, getTypeDescription } from './fileTypeDetector';

describe('fileTypeDetector', () => {
  describe('getFileType', () => {
    it('should detect document files', () => {
      expect(getFileType('README.md')).toBe('document');
      expect(getFileType('notes.txt')).toBe('document');
      expect(getFileType('report.docx')).toBe('document');
    });

    it('should detect spreadsheet files', () => {
      expect(getFileType('data.csv')).toBe('spreadsheet');
      expect(getFileType('budget.xlsx')).toBe('spreadsheet');
      expect(getFileType('records.ods')).toBe('spreadsheet');
    });

    it('should detect code files', () => {
      expect(getFileType('app.ts')).toBe('code');
      expect(getFileType('index.js')).toBe('code');
      expect(getFileType('config.json')).toBe('code');
      expect(getFileType('style.css')).toBe('code');
      expect(getFileType('query.sql')).toBe('code');
      expect(getFileType('script.py')).toBe('code');
    });

    it('should detect PDF files', () => {
      expect(getFileType('document.pdf')).toBe('pdf');
      expect(getFileType('CONTRACT.PDF')).toBe('pdf');
    });

    it('should detect archive files', () => {
      expect(getFileType('archive.zip')).toBe('archive');
      expect(getFileType('backup.tar.gz')).toBe('archive');
      expect(getFileType('compressed.7z')).toBe('archive');
    });

    it('should return default for unknown types', () => {
      expect(getFileType('unknown.xyz')).toBe('default');
      expect(getFileType('random.abc')).toBe('default');
    });

    it('should be case insensitive', () => {
      expect(getFileType('FILE.MD')).toBe('document');
      expect(getFileType('Data.CSV')).toBe('spreadsheet');
      expect(getFileType('Script.JS')).toBe('code');
    });

    it('should handle files without extensions', () => {
      expect(getFileType('Dockerfile')).toBe('code');
      expect(getFileType('Makefile')).toBe('code');
      expect(getFileType('README')).toBe('default');
    });

    it('should handle empty filenames', () => {
      expect(getFileType('')).toBe('default');
    });
  });

  describe('getExtensionsForType', () => {
    it('should return extensions for document type', () => {
      const exts = getExtensionsForType('document');
      expect(exts).toContain('md');
      expect(exts).toContain('txt');
      expect(exts).toContain('docx');
    });

    it('should return extensions for code type', () => {
      const exts = getExtensionsForType('code');
      expect(exts).toContain('js');
      expect(exts).toContain('ts');
      expect(exts).toContain('json');
      expect(exts).toContain('py');
    });

    it('should return empty array for default type', () => {
      expect(getExtensionsForType('default')).toEqual([]);
    });
  });

  describe('getTypeDescription', () => {
    it('should return descriptions for all types', () => {
      expect(getTypeDescription('document')).toBe('Text & Document Files');
      expect(getTypeDescription('spreadsheet')).toBe('Spreadsheet Files');
      expect(getTypeDescription('code')).toBe('Code & Data Files');
      expect(getTypeDescription('pdf')).toBe('PDF Documents');
      expect(getTypeDescription('archive')).toBe('Archive Files');
      expect(getTypeDescription('default')).toBe('Unknown File Type');
    });
  });
});
