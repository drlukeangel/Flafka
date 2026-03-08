/**
 * Virtual-scrolled results table for SQL query output.
 * Uses @tanstack/react-virtual for efficient rendering of large result sets
 * (only visible rows are in the DOM).
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ExpandableJsonPane } from '../shared/ExpandableJsonPane';
import type { Column, SortConfig } from '../../types';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  formatCellValue as sharedFormatCellValue,
  getExportFilename as sharedGetExportFilename,
  downloadFile as sharedDownloadFile,
  buildCsvContent,
  buildJsonContent,
} from '../../utils/table-export';
import {
  FiSearch,
  FiDownload,
  FiArrowUp,
  FiArrowDown,
  FiColumns,
  FiClipboard,
} from 'react-icons/fi';

interface ResultsTableProps {
  data: Record<string, unknown>[];
  columns: Column[];
  totalRowsReceived?: number;
  statementIndex?: number;
  statementName?: string;
}

// Helper function to check if a value is expandable (object or array)
// exported for testing purposes and potential future use
export const isExpandable = (value: unknown): boolean => {
  return value !== null && value !== undefined && typeof value === 'object';
};

// Helper function to format values as pretty-printed JSON
export const formatJSON = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[Unable to display]';
  }
};

// Delegate to shared utility — re-exported for backward compatibility
export const formatCellValue = sharedFormatCellValue;

const ResultsTable: React.FC<ResultsTableProps> = ({ data, columns, totalRowsReceived, statementIndex = 0, statementName }) => {
  const addToast = useWorkspaceStore((s) => s.addToast);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const [expandedCellRect, setExpandedCellRect] = useState<DOMRect | null>(null);
  const [expandedCellValue, setExpandedCellValue] = useState<unknown>(null);
  const columnsDropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottom = useRef(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        columnsDropdownRef.current &&
        !columnsDropdownRef.current.contains(event.target as Node)
      ) {
        setColumnsDropdownOpen(false);
      }
    };
    if (columnsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [columnsDropdownOpen]);

  // Filter data by search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(term)
      )
    );
  }, [data, searchTerm]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Precompute original index mapping for O(1) lookups
  const originalIndexMap = useMemo(() => {
    return new Map(data.map((row, i) => [row, i + 1]));
  }, [data]);

  // Virtual scrolling (both grid and list modes)
  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  // Scroll-lock: auto-scroll to bottom when new streaming data arrives if pinned
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isPinnedToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sortedData.length]);

  // Track whether user has scrolled away from bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      isPinnedToBottom.current = atBottom;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCellClick = (value: unknown, cellKey: string) => {
    const stringValue =
      value === null || value === undefined
        ? 'null'
        : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

    navigator.clipboard.writeText(stringValue).then(() => {
      addToast({ type: 'success', message: 'Copied to clipboard', duration: 2000 });
      setCopiedCell(cellKey);
      setTimeout(() => setCopiedCell(null), 600);
    }).catch(() => {
      addToast({ type: 'error', message: 'Failed to copy to clipboard', duration: 2000 });
    });
  };

  const handleExpandClick = (e: React.MouseEvent<HTMLButtonElement>, cellKey: string, value: unknown, td: HTMLTableCellElement) => {
    e.stopPropagation();
    if (expandedCell === cellKey) {
      setExpandedCell(null);
      setExpandedCellRect(null);
      setExpandedCellValue(null);
    } else {
      // Close columns dropdown if open
      setColumnsDropdownOpen(false);
      const rect = td.getBoundingClientRect();
      setExpandedCell(cellKey);
      setExpandedCellRect(rect);
      setExpandedCellValue(value);
    }
  };

  const copyAsMarkdown = () => {
    if (sortedData.length === 0) {
      addToast({ type: 'error', message: 'No data to copy', duration: 2000 });
      return;
    }

    if (!visibleColumnNames || visibleColumnNames.length === 0) {
      addToast({ type: 'error', message: 'No columns to copy', duration: 2000 });
      return;
    }

    const headers = ['#', ...visibleColumnNames];
    const markdownLines: string[] = [];

    // Header row
    markdownLines.push('| ' + headers.join(' | ') + ' |');

    // Separator row
    const separators = headers.map((h) => '-'.repeat(Math.max(3, h.length)));
    markdownLines.push('| ' + separators.join(' | ') + ' |');

    // Data rows (max 100)
    const rowsToShow = Math.min(sortedData.length, 100);
    for (let i = 0; i < rowsToShow; i++) {
      const row = sortedData[i];
      const displayRowNum = originalIndexMap.get(row) ?? (i + 1);
      const cells = [String(displayRowNum)];

      for (const colName of visibleColumnNames) {
        cells.push(formatCellValue(row[colName]));
      }

      markdownLines.push('| ' + cells.join(' | ') + ' |');
    }

    // Footer if truncated (same column count as header)
    if (sortedData.length > 100) {
      const remaining = sortedData.length - 100;
      const footerCells = Array(headers.length).fill('');
      footerCells[1] = `*[...${remaining} more rows]*`;
      markdownLines.push('| ' + footerCells.join(' | ') + ' |');
    }

    const markdown = markdownLines.join('\n');

    navigator.clipboard.writeText(markdown)
      .then(() => {
        addToast({
          type: 'success',
          message: `Copied ${rowsToShow} rows as markdown`,
          duration: 2000,
        });
      })
      .catch(() => {
        addToast({
          type: 'error',
          message: 'Failed to copy to clipboard',
          duration: 2000,
        });
      });
  };

  const handleSort = (column: string) => {
    setSortConfig((prev) => {
      if (prev?.column !== column) {
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return null;
    });
  };

  const getExportFilename = (ext: string): string => {
    const prefix = statementName
      ? statementName.replace(/\s+/g, '-').toLowerCase()
      : `query-${statementIndex + 1}`;
    return sharedGetExportFilename(prefix, ext);
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const csv = buildCsvContent(sortedData, columns.map((c) => c.name));
      sharedDownloadFile(csv, getExportFilename('csv'), 'text/csv');
    } else {
      const json = buildJsonContent(sortedData, columns.map((c) => c.name));
      sharedDownloadFile(json, getExportFilename('json'), 'application/json');
    }
  };

  const columnNames = columns.length > 0
    ? columns.map(c => c.name)
    : data.length > 0
      ? Object.keys(data[0])
      : [];

  const visibleColumnNames = columnNames.filter(c => !hiddenColumns.has(c));

  const toggleColumn = (colName: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(colName)) {
        next.delete(colName);
      } else {
        next.add(colName);
      }
      return next;
    });
  };

  const showAll = () => setHiddenColumns(new Set());
  const hideAll = () => setHiddenColumns(new Set(columnNames));

  if (data.length === 0) {
    return (
      <div className="results-empty">
        <span>Query executed successfully. No rows returned.</span>
      </div>
    );
  }

  return (
    <div className="results-table-container">
      <div className="results-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <FiSearch size={14} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="results-info">
            {sortedData.length} of {data.length} rows{totalRowsReceived && totalRowsReceived > data.length ? ` (${totalRowsReceived.toLocaleString()} total received)` : ''}
          </span>
        </div>
        <div className="toolbar-right">
          <div className="columns-dropdown-wrapper" ref={columnsDropdownRef}>
            <button
              className={`export-btn${columnsDropdownOpen ? ' active' : ''}`}
              title="Toggle column visibility"
              onClick={() => { setColumnsDropdownOpen(o => !o); setExpandedCell(null); setExpandedCellRect(null); setExpandedCellValue(null); }}
            >
              <FiColumns size={14} />
              <span>Columns{hiddenColumns.size > 0 ? ` (${visibleColumnNames.length}/${columnNames.length})` : ''}</span>
            </button>
            {columnsDropdownOpen && (
              <div className="columns-dropdown">
                <div className="columns-dropdown-actions">
                  <button onClick={showAll}>Show All</button>
                  <button onClick={hideAll}>Hide All</button>
                </div>
                <div className="columns-dropdown-list">
                  {columnNames.map(colName => (
                    <label key={colName} className="column-toggle-item">
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.has(colName)}
                        onChange={() => toggleColumn(colName)}
                      />
                      <span>{colName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={copyAsMarkdown}
            disabled={sortedData.length === 0 || visibleColumnNames.length === 0}
            title="Copy as Markdown"
            className="export-btn"
          >
            <FiClipboard size={14} />
            <span>Copy as MD</span>
          </button>
          <div className="export-dropdown">
            <button className="export-btn" title="Export">
              <FiDownload size={14} />
              <span>Export</span>
            </button>
            <div className="export-menu">
              <button onClick={() => handleExport('csv')}>Export as CSV</button>
              <button onClick={() => handleExport('json')}>Export as JSON</button>
            </div>
          </div>
        </div>
      </div>

      <div className="results-table-wrapper" ref={containerRef}>
        <table className="results-table">
          <colgroup>
            <col style={{ width: '50px' }} />
            {visibleColumnNames.map((colName) => (
              <col key={colName} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="results-index-cell">#</th>
              {visibleColumnNames.map((colName) => (
                <th key={colName} onClick={() => handleSort(colName)}>
                  <div className="th-content">
                    <span>{colName}</span>
                    <span className="sort-icons">
                      {sortConfig?.column === colName ? (
                        sortConfig.direction === 'asc' ? (
                          <FiArrowUp size={12} />
                        ) : (
                          <FiArrowDown size={12} />
                        )
                      ) : (
                        <FiArrowUp size={12} className="sort-icon-inactive" />
                      )}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Virtual scrolling spacer rows: empty <tr> elements whose height
                equals the total size of all off-screen rows above/below the
                visible window. This creates the correct scroll height in the
                container without rendering actual data rows for every record. */}
            {paddingTop > 0 && (
              <tr><td colSpan={visibleColumnNames.length + 1} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
            )}
            {virtualItems.map((virtualRow) => {
              const row = sortedData[virtualRow.index];
              const originalIndex = originalIndexMap.get(row);
              return (
                <tr
                  key={virtualRow.key}
                  className={virtualRow.index % 2 !== 0 ? 'results-row-odd' : ''}
                >
                  <td className="results-index-cell">{originalIndex}</td>
                  {visibleColumnNames.map((colName) => {
                    const cellKey = `${virtualRow.index}-${colName}`;
                    return (
                      <td
                        key={colName}
                        className={`results-cell${copiedCell === cellKey ? ' results-cell--copied' : ''}`}
                        onClick={() => handleCellClick(row[colName], cellKey)}
                      >
                        {row[colName] === null || row[colName] === undefined ? (
                          <span className="null-value">null</span>
                        ) : typeof row[colName] === 'object' ? (
                          <span className="results-cell-json">
                            <span className="results-cell-json-preview">{JSON.stringify(row[colName])}</span>
                            <button
                              className="json-expand-btn"
                              onClick={(e) => handleExpandClick(e, cellKey, row[colName], e.currentTarget.closest('td')!)}
                              title="Expand JSON"
                            >
                              {expandedCell === cellKey ? '▲' : '▼'}
                            </button>
                          </span>
                        ) : (
                          String(row[colName])
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr><td colSpan={visibleColumnNames.length + 1} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedCell && expandedCellRect && expandedCellValue !== null && expandedCellValue !== undefined && (
        <ExpandableJsonPane
          value={typeof expandedCellValue === 'object' ? JSON.stringify(expandedCellValue) : String(expandedCellValue)}
          anchorRect={expandedCellRect}
          onClose={() => {
            setExpandedCell(null);
            setExpandedCellRect(null);
            setExpandedCellValue(null);
          }}
        />
      )}
    </div>
  );
};

export default ResultsTable;
