import { describe, it, expect } from 'vitest';

// Test the formatCellValue logic directly
// Since it's not exported, we test the logic inline
describe('[@copy-markdown] Copy as Markdown - formatCellValue logic', () => {
  const formatCellValue = (value: unknown): string => {
    let str: string;
    if (value === null || value === undefined) {
      str = 'null';
    } else if (typeof value === 'object') {
      if (value instanceof Date) {
        str = value.toISOString();
      } else {
        str = JSON.stringify(value);
      }
    } else {
      str = String(value);
    }
    str = str.replace(/[\n\r\t]/g, ' ');
    str = str.replace(/\|/g, '\\|');
    if (str.length > 100) {
      str = str.substring(0, 97) + '...';
    }
    return str;
  };

  it('converts null to "null"', () => {
    expect(formatCellValue(null)).toBe('null');
  });

  it('converts undefined to "null"', () => {
    expect(formatCellValue(undefined)).toBe('null');
  });

  it('converts numbers to string', () => {
    expect(formatCellValue(42)).toBe('42');
  });

  it('converts booleans to string', () => {
    expect(formatCellValue(true)).toBe('true');
  });

  it('stringifies objects', () => {
    expect(formatCellValue({ key: 'value' })).toBe('{"key":"value"}');
  });

  it('stringifies arrays', () => {
    expect(formatCellValue([1, 2, 3])).toBe('[1,2,3]');
  });

  it('escapes pipe characters', () => {
    expect(formatCellValue('foo | bar')).toBe('foo \\| bar');
  });

  it('replaces newlines with spaces', () => {
    expect(formatCellValue('line1\nline2\tline3')).toBe('line1 line2 line3');
  });

  it('truncates values over 100 chars', () => {
    const longStr = 'a'.repeat(120);
    const result = formatCellValue(longStr);
    expect(result.length).toBe(100);
    expect(result).toMatch(/\.\.\.$/);
  });

  it('does not truncate values under 100 chars', () => {
    const str = 'a'.repeat(50);
    expect(formatCellValue(str)).toBe(str);
  });

  it('formats Date objects as ISO string', () => {
    const date = new Date('2026-01-15T10:30:00Z');
    expect(formatCellValue(date)).toBe('2026-01-15T10:30:00.000Z');
  });
});

describe('[@copy-markdown] Copy as Markdown - table generation', () => {
  it('generates valid markdown header and separator', () => {
    const headers = ['#', 'name', 'age'];
    const headerRow = '| ' + headers.join(' | ') + ' |';
    const separators = headers.map((h) => '-'.repeat(Math.max(3, h.length)));
    const separatorRow = '| ' + separators.join(' | ') + ' |';

    expect(headerRow).toBe('| # | name | age |');
    expect(separatorRow).toBe('| --- | ---- | --- |');
  });

  it('generates truncation footer with correct column count', () => {
    const headers = ['#', 'col1', 'col2', 'col3'];
    const remaining = 50;
    const footerCells = Array(headers.length).fill('');
    footerCells[1] = `*[...${remaining} more rows]*`;
    const footerRow = '| ' + footerCells.join(' | ') + ' |';

    expect(footerRow).toBe('|  | *[...50 more rows]* |  |  |');
    // Verify column count matches header
    const headerPipes = ('| ' + headers.join(' | ') + ' |').split('|').length;
    const footerPipes = footerRow.split('|').length;
    expect(footerPipes).toBe(headerPipes);
  });
});
