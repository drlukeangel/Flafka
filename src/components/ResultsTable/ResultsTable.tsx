import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Column, SortConfig } from '../../types';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  FiSearch,
  FiDownload,
  FiArrowUp,
  FiArrowDown,
  FiGrid,
  FiList,
  FiColumns,
} from 'react-icons/fi';

interface ResultsTableProps {
  data: Record<string, unknown>[];
  columns: Column[];
  totalRowsReceived?: number;
  statementIndex?: number;
  statementName?: string;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, columns, totalRowsReceived, statementIndex = 0, statementName }) => {
  const addToast = useWorkspaceStore((s) => s.addToast);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
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

  // Virtual scrolling (grid mode only)
  const virtualizer = useVirtualizer({
    count: viewMode === 'grid' ? sortedData.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const paddingTop = viewMode === 'grid' && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    viewMode === 'grid' && virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  // Scroll-lock: auto-scroll to bottom when new streaming data arrives if pinned
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const el = containerRef.current;
    if (!el) return;
    if (isPinnedToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sortedData.length, viewMode]);

  // Track whether user has scrolled away from bottom
  useEffect(() => {
    if (viewMode !== 'grid') return;
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      isPinnedToBottom.current = atBottom;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [viewMode]);

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
    const ts = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
    const [date, time] = ts.split('T');
    const prefix = statementName
      ? statementName.replace(/\s+/g, '-').toLowerCase()
      : `query-${statementIndex + 1}`;
    return `${prefix}-${date}-${time}.${ext}`;
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const headers = columns.map((c) => c.name).join(',');
      const rows = sortedData.map((row) =>
        columns.map((c) => JSON.stringify(row[c.name] ?? '')).join(',')
      );
      const csv = [headers, ...rows].join('\n');
      downloadFile(csv, getExportFilename('csv'), 'text/csv');
    } else {
      const json = JSON.stringify(sortedData, null, 2);
      downloadFile(json, getExportFilename('json'), 'application/json');
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <FiGrid size={14} />
          </button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <FiList size={14} />
          </button>
          <div className="columns-dropdown-wrapper" ref={columnsDropdownRef}>
            <button
              className={`export-btn${columnsDropdownOpen ? ' active' : ''}`}
              title="Toggle column visibility"
              onClick={() => setColumnsDropdownOpen(o => !o)}
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
        {viewMode === 'grid' ? (
          <table className="results-table">
            <thead>
              <tr>
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
              {paddingTop > 0 && (
                <tr><td colSpan={visibleColumnNames.length} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
              )}
              {virtualItems.map((virtualRow) => {
                const row = sortedData[virtualRow.index];
                return (
                  <tr
                    key={virtualRow.key}
                    className={virtualRow.index % 2 !== 0 ? 'results-row-odd' : ''}
                  >
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
                            JSON.stringify(row[colName])
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
                <tr><td colSpan={visibleColumnNames.length} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="results-table">
            <thead>
              <tr>
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
              {sortedData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {visibleColumnNames.map((colName) => {
                    const cellKey = `${rowIndex}-${colName}`;
                    return (
                      <td
                        key={colName}
                        className={`results-cell${copiedCell === cellKey ? ' results-cell--copied' : ''}`}
                        onClick={() => handleCellClick(row[colName], cellKey)}
                      >
                        {row[colName] === null || row[colName] === undefined ? (
                          <span className="null-value">null</span>
                        ) : typeof row[colName] === 'object' ? (
                          JSON.stringify(row[colName])
                        ) : (
                          String(row[colName])
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ResultsTable;
