/**
 * @ksql-queries-list
 * ksqlDB persistent queries list view — table with search, status filter,
 * checkbox selection, bulk terminate, refresh button, and page-loaded timestamp.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { KsqlPersistentQuery } from '../../types';
import { FiRefreshCw, FiSquare, FiSearch, FiLoader } from 'react-icons/fi';
import { FilterFlyout } from '../ui/FilterFlyout';
import type { FilterCategory } from '../ui/FilterFlyout';

interface KsqlQueriesListProps {
  queries: KsqlPersistentQuery[];
  loading: boolean;
  error: string | null;
  onSelectQuery: (queryId: string) => void;
  onTerminateQuery: (queryId: string) => Promise<void>;
  onRefresh: () => void;
}

function getStatusClass(state: string): string {
  switch (state.toUpperCase()) {
    case 'RUNNING': return 'running';
    case 'PAUSED': return 'pending';
    case 'ERROR': return 'failed';
    default: return 'unknown';
  }
}

function getStatusLabel(state: string): string {
  return state.charAt(0) + state.slice(1).toLowerCase();
}

function parseQueryType(queryId: string): string {
  if (queryId.startsWith('CSAS_')) return 'CREATE STREAM AS';
  if (queryId.startsWith('CTAS_')) return 'CREATE TABLE AS';
  if (queryId.startsWith('INSERTQUERY_')) return 'INSERT INTO';
  return 'PERSISTENT';
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'RUNNING', label: 'Running' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ERROR', label: 'Error' },
];

function buildFilterCategories(): FilterCategory[] {
  return [
    { key: 'status', label: 'Query Status', options: STATUS_FILTER_OPTIONS },
  ];
}

export function KsqlQueriesList({ queries, loading, error, onSelectQuery, onTerminateQuery, onRefresh }: KsqlQueriesListProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});
  const filterCategories = useMemo(() => buildFilterCategories(), []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [terminatingIds, setTerminatingIds] = useState<Set<string>>(new Set());
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  // 200ms debounce for search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Set lastLoadedAt when queries first arrive or on refresh
  const prevLengthRef = useRef(0);
  useEffect(() => {
    if (queries.length > 0 && prevLengthRef.current === 0) {
      setLastLoadedAt(new Date());
    }
    prevLengthRef.current = queries.length;
  }, [queries]);

  // Tick every 60s to keep relative time fresh
  useEffect(() => {
    if (!lastLoadedAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [lastLoadedAt]);

  const handleRefresh = useCallback(() => {
    onRefresh();
    setLastLoadedAt(new Date());
  }, [onRefresh]);

  const filtered = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    const statusSet = activeFilters['status'];
    const hasStatusFilter = statusSet && statusSet.size > 0;

    return queries.filter((q) => {
      if (hasStatusFilter && !statusSet.has(q.state.toUpperCase())) return false;
      if (searchLower) {
        const id = q.id.toLowerCase();
        const sql = q.queryString.toLowerCase();
        if (!id.includes(searchLower) && !sql.includes(searchLower)) return false;
      }
      return true;
    });
  }, [queries, debouncedSearch, activeFilters]);

  // Clear stale selections when filtered list changes
  useEffect(() => {
    setSelectedIds((prev) => {
      const filteredIdSet = new Set(filtered.map((q) => q.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (filteredIdSet.has(id)) next.add(id);
      }
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [filtered]);

  const handleFilterChange = useCallback(
    (categoryKey: string, value: string, checked: boolean) => {
      setActiveFilters((prev) => {
        const prevSet = prev[categoryKey] ?? new Set<string>();
        const next = new Set(prevSet);
        if (checked) next.add(value);
        else next.delete(value);
        return { ...prev, [categoryKey]: next };
      });
    },
    [],
  );

  const handleClearCategory = useCallback((categoryKey: string) => {
    setActiveFilters((prev) => ({ ...prev, [categoryKey]: new Set<string>() }));
  }, []);

  const handleClearAll = useCallback(() => {
    setActiveFilters({});
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((q) => q.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTerminate = useCallback(async (id: string) => {
    setTerminatingIds((prev) => new Set(prev).add(id));
    try {
      await onTerminateQuery(id);
    } finally {
      setTerminatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [onTerminateQuery]);

  const handleBulkTerminate = useCallback(async () => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    // Queue sequentially with backoff to avoid overwhelming the ksqlDB command topic
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, Math.min(i - 1, 3))));
      await handleTerminate(ids[i]);
    }
  }, [selectedIds, handleTerminate]);

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filtered.length;

  if (loading && queries.length === 0) {
    return <div className="jobs-loading">Loading ksqlDB queries...</div>;
  }

  if (error && queries.length === 0) {
    return (
      <div className="jobs-error">
        <p>{error}</p>
        <button className="jobs-refresh-btn" onClick={handleRefresh}>Retry</button>
      </div>
    );
  }

  return (
    <div className="jobs-list">
      {/* Controls row */}
      <div className="jobs-controls">
        <div className="jobs-search-wrapper">
          <FiSearch size={14} className="jobs-search-icon" />
          <input
            type="text"
            className="jobs-search"
            placeholder="Search by query ID or SQL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <FilterFlyout
          categories={filterCategories}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearCategory={handleClearCategory}
          onClearAll={handleClearAll}
        />

        {lastLoadedAt && (
          <span className="jobs-loaded-time">
            Loaded {formatRelativeTime(lastLoadedAt)}
          </span>
        )}

        <button
          className="jobs-refresh-btn"
          onClick={handleRefresh}
          title="Refresh"
        >
          <FiRefreshCw size={14} className={loading ? 'ksql-spin' : ''} />
        </button>

        {selectedIds.size > 0 && (
          <button
            className="jobs-actions-btn"
            onClick={handleBulkTerminate}
            disabled={terminatingIds.size > 0}
          >
            {terminatingIds.size > 0
              ? <><FiLoader size={14} className="ksql-terminate-spin" /> Terminating ({terminatingIds.size} remaining)</>
              : <><FiSquare size={14} /> Terminate Selected ({selectedIds.size})</>}
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="jobs-count">
        {filtered.length} quer{filtered.length !== 1 ? 'ies' : 'y'} shown.
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="jobs-empty">
          {queries.length === 0
            ? 'No persistent queries found.'
            : 'No matching queries.'}
        </div>
      ) : (
        <div className="jobs-table-wrapper">
          <table className="jobs-table">
            <thead>
              <tr>
                <th className="jobs-th-checkbox">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th>Query ID</th>
                <th>Status</th>
                <th>Type</th>
                <th>SQL</th>
                <th>Sink</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const canTerminate = q.state.toUpperCase() === 'RUNNING';
                return (
                  <tr
                    key={q.id}
                    className={`jobs-row${selectedIds.has(q.id) ? ' jobs-row--selected' : ''}`}
                    onClick={() => onSelectQuery(q.id)}
                  >
                    <td className="jobs-cell-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(q.id)}
                        onChange={() => handleSelectRow(q.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${q.id}`}
                      />
                    </td>
                    <td className="jobs-cell-name" title={q.id}>
                      {q.id}
                    </td>
                    <td className="jobs-cell-status">
                      <span className={`status-dot ${getStatusClass(q.state)}`} />
                      <span>{getStatusLabel(q.state)}</span>
                    </td>
                    <td className="jobs-cell-type">{parseQueryType(q.id)}</td>
                    <td className="jobs-cell-sql" title={q.queryString}>
                      {q.queryString.length > 60
                        ? q.queryString.slice(0, 60) + '\u2026'
                        : q.queryString}
                    </td>
                    <td className="jobs-cell-type">
                      {q.sinks.length > 0 ? q.sinks[0] : '\u2014'}
                    </td>
                    <td className="jobs-cell-actions">
                      {canTerminate ? (
                        <button
                          className="jobs-stop-btn"
                          title={terminatingIds.has(q.id) ? 'Terminating...' : 'Terminate'}
                          disabled={terminatingIds.has(q.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTerminate(q.id);
                          }}
                        >
                          {terminatingIds.has(q.id)
                            ? <FiLoader size={14} className="ksql-terminate-spin" />
                            : <FiSquare size={14} />}
                        </button>
                      ) : (
                        <div style={{ width: 28 }} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
