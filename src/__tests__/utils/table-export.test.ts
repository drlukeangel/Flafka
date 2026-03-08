import { describe, it, expect } from 'vitest';
import {
  formatCellValue,
  getExportFilename,
  buildCsvContent,
  buildJsonContent,
  buildMarkdownContent,
} from '../../utils/table-export';

describe('[@table-export] table-export utilities', () => {
  describe('formatCellValue', () => {
    it('formats null as "null"', () => {
      expect(formatCellValue(null)).toBe('null');
    });

    it('formats undefined as "null"', () => {
      expect(formatCellValue(undefined)).toBe('null');
    });

    it('formats strings', () => {
      expect(formatCellValue('hello')).toBe('hello');
    });

    it('formats numbers', () => {
      expect(formatCellValue(42)).toBe('42');
    });

    it('formats booleans', () => {
      expect(formatCellValue(true)).toBe('true');
    });

    it('formats objects as JSON', () => {
      expect(formatCellValue({ a: 1 })).toBe('{"a":1}');
    });

    it('formats arrays as JSON', () => {
      expect(formatCellValue([1, 2, 3])).toBe('[1,2,3]');
    });

    it('escapes pipe characters', () => {
      expect(formatCellValue('a|b|c')).toBe('a\\|b\\|c');
    });

    it('replaces newlines with spaces', () => {
      expect(formatCellValue('line1\nline2\ttab')).toBe('line1 line2 tab');
    });

    it('truncates long strings to 100 chars', () => {
      const longStr = 'x'.repeat(200);
      const result = formatCellValue(longStr);
      expect(result.length).toBe(100);
      expect(result.endsWith('...')).toBe(true);
    });

    it('formats Date objects as ISO strings', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(formatCellValue(date)).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('getExportFilename', () => {
    it('generates filename with prefix and extension', () => {
      const result = getExportFilename('my-topic', 'csv');
      expect(result).toMatch(/^my-topic-\d{8}-\d{6}\.csv$/);
    });

    it('lowercases and hyphenates prefix', () => {
      const result = getExportFilename('My Topic Name', 'json');
      expect(result).toMatch(/^my-topic-name-/);
    });
  });

  describe('buildCsvContent', () => {
    it('builds CSV with headers and rows', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const result = buildCsvContent(data, ['name', 'age']);
      const lines = result.split('\n');
      expect(lines[0]).toBe('name,age');
      expect(lines[1]).toBe('"Alice",30');
      expect(lines[2]).toBe('"Bob",25');
    });

    it('handles empty data', () => {
      const result = buildCsvContent([], ['name', 'age']);
      expect(result).toBe('name,age');
    });

    it('handles null values', () => {
      const data = [{ name: null, age: undefined }];
      const result = buildCsvContent(data, ['name', 'age']);
      expect(result).toContain('""');
    });
  });

  describe('buildJsonContent', () => {
    it('builds JSON with selected columns', () => {
      const data = [
        { name: 'Alice', age: 30, hidden: 'x' },
      ];
      const result = buildJsonContent(data, ['name', 'age']);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual([{ name: 'Alice', age: 30 }]);
      expect(parsed[0]).not.toHaveProperty('hidden');
    });

    it('handles empty data', () => {
      const result = buildJsonContent([], ['name']);
      expect(JSON.parse(result)).toEqual([]);
    });
  });

  describe('buildMarkdownContent', () => {
    it('builds markdown table with headers and rows', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const result = buildMarkdownContent(data, ['name', 'age']);
      const lines = result.split('\n');
      // Header
      expect(lines[0]).toBe('| # | name | age |');
      // Separator
      expect(lines[1]).toMatch(/^\| -+ \| -+ \| -+ \|$/);
      // Rows
      expect(lines[2]).toBe('| 1 | Alice | 30 |');
      expect(lines[3]).toBe('| 2 | Bob | 25 |');
    });

    it('respects maxRows limit', () => {
      const data = Array.from({ length: 5 }, (_, i) => ({ id: i }));
      const result = buildMarkdownContent(data, ['id'], 3);
      expect(result).toContain('2 more rows');
    });

    it('handles empty data', () => {
      const result = buildMarkdownContent([], ['name']);
      const lines = result.split('\n');
      expect(lines.length).toBe(2); // header + separator only
    });
  });
});
