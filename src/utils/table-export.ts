/**
 * Shared table export utilities — pure functions with zero React/store dependencies.
 * Used by both ResultsTable and StreamCardTable for consistent export behavior.
 */

/**
 * Format a cell value for text-based export (CSV, Markdown).
 * Handles null, undefined, Date, objects, and primitives.
 * Escapes pipe characters for markdown compatibility.
 * Truncates to 100 chars.
 */
export function formatCellValue(value: unknown): string {
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

  // Remove newlines/tabs
  str = str.replace(/[\n\r\t]/g, ' ');

  // Escape pipe characters
  str = str.replace(/\|/g, '\\|');

  // Truncate to 100 chars
  if (str.length > 100) {
    str = str.substring(0, 97) + '...';
  }

  return str;
}

/**
 * Generate a timestamped filename for export.
 * @param prefix - e.g., topic name or statement name
 * @param ext - file extension without dot (e.g., 'csv', 'json')
 */
export function getExportFilename(prefix: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
  const [date, time] = ts.split('T');
  const safeName = prefix.replace(/\s+/g, '-').toLowerCase();
  return `${safeName}-${date}-${time}.${ext}`;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build CSV content from tabular data.
 */
export function buildCsvContent(data: Record<string, unknown>[], columnNames: string[]): string {
  const headers = columnNames.join(',');
  const rows = data.map((row) =>
    columnNames.map((col) => JSON.stringify(row[col] ?? '')).join(',')
  );
  return [headers, ...rows].join('\n');
}

/**
 * Build JSON content from tabular data.
 */
export function buildJsonContent(data: Record<string, unknown>[], columnNames: string[]): string {
  const filtered = data.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columnNames) {
      obj[col] = row[col];
    }
    return obj;
  });
  return JSON.stringify(filtered, null, 2);
}

/**
 * Build a Markdown table from tabular data.
 * @param maxRows - maximum rows to include (default 100)
 */
export function buildMarkdownContent(
  data: Record<string, unknown>[],
  columnNames: string[],
  maxRows: number = 100,
): string {
  const headers = ['#', ...columnNames];
  const lines: string[] = [];

  // Header row
  lines.push('| ' + headers.join(' | ') + ' |');

  // Separator row
  const separators = headers.map((h) => '-'.repeat(Math.max(3, h.length)));
  lines.push('| ' + separators.join(' | ') + ' |');

  // Data rows
  const rowsToShow = Math.min(data.length, maxRows);
  for (let i = 0; i < rowsToShow; i++) {
    const row = data[i];
    const cells = [String(i + 1)];
    for (const colName of columnNames) {
      cells.push(formatCellValue(row[colName]));
    }
    lines.push('| ' + cells.join(' | ') + ' |');
  }

  // Footer if truncated
  if (data.length > maxRows) {
    const remaining = data.length - maxRows;
    const footerCells = Array(headers.length).fill('');
    footerCells[1] = `*[...${remaining} more rows]*`;
    lines.push('| ' + footerCells.join(' | ') + ' |');
  }

  return lines.join('\n');
}
