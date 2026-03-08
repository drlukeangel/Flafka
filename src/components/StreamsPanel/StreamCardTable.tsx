import { useState, useMemo } from 'react';
import type { Column } from '../../types';
import { ExpandableJsonPane } from '../shared/ExpandableJsonPane';

interface StreamCardTableProps {
  data: Record<string, unknown>[];
  columns: Column[];
  hiddenColumns: Set<string>;
}

export function StreamCardTable({ data, columns, hiddenColumns }: StreamCardTableProps) {
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const [expandedCellRect, setExpandedCellRect] = useState<DOMRect | null>(null);
  const [expandedCellValue, setExpandedCellValue] = useState<unknown>(null);

  // Sort by timestamp, newest first
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aTs = String(a._ts ?? '');
      const bTs = String(b._ts ?? '');
      return bTs.localeCompare(aTs);
    });
  }, [data]);

  // Column names: show metadata columns first, then rest
  const metaCols = ['_ts', '_partition', '_offset', '_key'];
  const valueCols = columns
    .map((c) => c.name)
    .filter((name) => !metaCols.includes(name));
  const allColumnNames = [...metaCols.filter((c) => columns.some((col) => col.name === c)), ...valueCols];
  const displayCols = allColumnNames.filter((c) => !hiddenColumns.has(c));

  const formatTimestamp = (val: unknown): string => {
    if (!val) return '';
    const str = String(val);
    try {
      const d = new Date(str);
      return d.toLocaleTimeString('en-US', { hour12: false });
    } catch {
      return str.slice(11, 19);
    }
  };

  const truncate = (val: unknown, maxLen: number): string => {
    if (val === null || val === undefined) return 'null';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
  };

  const isExpandable = (val: unknown): boolean => {
    return val !== null && val !== undefined && typeof val === 'object';
  };

  const handleExpandClick = (e: React.MouseEvent, cellKey: string, value: unknown) => {
    e.stopPropagation();
    if (expandedCell === cellKey) {
      setExpandedCell(null);
      setExpandedCellRect(null);
      setExpandedCellValue(null);
    } else {
      const td = (e.target as HTMLElement).closest('td');
      if (td) {
        setExpandedCell(cellKey);
        setExpandedCellRect(td.getBoundingClientRect());
        setExpandedCellValue(value);
      }
    }
  };

  const getColWidth = (col: string): string => {
    switch (col) {
      case '_ts': return '80px';
      case '_partition': return '40px';
      case '_offset': return '55px';
      case '_key': return '70px';
      default: return 'auto';
    }
  };

  return (
    <div className="stream-card-table-wrapper">
      <table className="stream-card-table">
        <colgroup>
          <col style={{ width: '28px' }} />
          {displayCols.map((col) => (
            <col key={col} style={{ width: getColWidth(col) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="stream-card-table-row-num">#</th>
            {displayCols.map((col) => (
              <th key={col} title={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td className="stream-card-table-row-num">{rowIdx + 1}</td>
              {displayCols.map((col) => {
                const cellKey = `${rowIdx}-${col}`;
                const val = row[col];
                return (
                  <td key={col} title={col === '_ts' ? String(val) : undefined}>
                    {col === '_ts' ? (
                      formatTimestamp(val)
                    ) : col === '_key' ? (
                      truncate(val, 8)
                    ) : isExpandable(val) ? (
                      <span className="stream-cell-json">
                        <span className="stream-cell-json-preview">{truncate(val, 40)}</span>
                        <button
                          className="stream-cell-expand-btn"
                          onClick={(e) => handleExpandClick(e, cellKey, val)}
                          title={expandedCell === cellKey ? 'Collapse JSON' : 'Expand JSON'}
                          aria-label={expandedCell === cellKey ? 'Collapse JSON value' : 'Expand JSON value'}
                        >
                          {expandedCell === cellKey ? '▲' : '▼'}
                        </button>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-primary)' }}>{truncate(val, 40)}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

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
}
