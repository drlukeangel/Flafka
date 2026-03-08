/**
 * @jobs-list
 * Jobs list view — full-width table of Flink statements with search, filter dropdown,
 * checkbox selection, bulk actions, region subtitle, and page-loaded timestamp.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { StatementResponse } from '../../api/flink-api';
import { FiRefreshCw, FiSquare, FiSearch, FiChevronDown } from 'react-icons/fi';
import { env } from '../../config/environment';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FilterFlyout } from '../ui/FilterFlyout';
import type { FilterCategory } from '../ui/FilterFlyout';

interface JobsListProps {
  statements: StatementResponse[];
  loading: boolean;
  error: string | null;
  onSelectJob: (statementName: string) => void;
  onCancelJob: (statementName: string) => void;
  onDeleteJob: (statementName: string) => void;
  onRefresh: () => void;
}

function getStatusClass(phase?: string): string {
  if (!phase) return 'unknown';
  switch (phase.toUpperCase()) {
    case 'RUNNING': return 'running';
    case 'COMPLETED': return 'completed';
    case 'PENDING': return 'pending';
    case 'FAILED': return 'failed';
    case 'CANCELLED': return 'cancelled';
    default: return 'unknown';
  }
}

function getStatusLabel(phase?: string): string {
  if (!phase) return 'Unknown';
  if (phase === 'CANCELLED') return 'Stopped';
  return phase.charAt(0) + phase.slice(1).toLowerCase();
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '\u2014';
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
  } catch {
    return '\u2014';
  }
}

/** Map internal phase strings to the display value used in filter checkboxes */
function normalizePhase(phase?: string): string {
  const p = phase?.toUpperCase();
  if (p === 'CANCELLED') return 'STOPPED';
  return p || 'UNKNOWN';
}

const STATUS_FILTER_OPTIONS = [
  { value: 'RUNNING', label: 'Running' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'STOPPED', label: 'Stopped' },
  { value: 'FAILED', label: 'Failed' },
];

const OWNERSHIP_FILTER_OPTIONS = [
  { value: 'MINE', label: 'My Statements' },
  { value: 'OTHERS', label: 'Other Statements' },
];

/** Build filter categories, including a dynamic "Statement Type" list derived from loaded data. */
function buildFilterCategories(statements: StatementResponse[]): FilterCategory[] {
  // Collect unique statement types from loaded data, sorted alphabetically
  const typeSet = new Set<string>();
  for (const s of statements) {
    const t = s.spec?.statement_type;
    if (t) typeSet.add(t);
  }
  const typeOptions = Array.from(typeSet)
    .sort()
    .map((t) => ({ value: t, label: t }));

  return [
    { key: 'status', label: 'Statement Status', options: STATUS_FILTER_OPTIONS },
    ...(typeOptions.length > 0
      ? [{ key: 'type', label: 'Statement Type', options: typeOptions }]
      : []),
    { key: 'ownership', label: 'Ownership', options: OWNERSHIP_FILTER_OPTIONS },
  ];
}

function getRegionSubtitle(computePoolId?: string): string | null {
  if (!computePoolId) return null;
  const provider = env.cloudProvider?.toUpperCase() || 'AWS';
  const region = env.cloudRegion || '';
  return `${provider}.${region}.${computePoolId}`;
}

export function JobsList({ statements, loading, error, onSelectJob, onCancelJob, onDeleteJob, onRefresh }: JobsListProps) {
  const userLaunchedNames = useMemo(() => {
    const names = useWorkspaceStore.getState().userLaunchedStatements;
    return new Set(names.map(s => s.name));
  }, [statements]); // recalculate when statements change (proxy for store updates)

  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});

  const filterCategories = useMemo(() => buildFilterCategories(statements), [statements]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Set lastLoadedAt when statements first arrive or on refresh
  const prevLengthRef = useRef(0);
  useEffect(() => {
    if (statements.length > 0 && prevLengthRef.current === 0) {
      setLastLoadedAt(new Date());
    }
    prevLengthRef.current = statements.length;
  }, [statements]);

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
    const searchLower = search.toLowerCase();
    const statusSet = activeFilters['status'];
    const hasStatusFilter = statusSet && statusSet.size > 0;
    const typeSet = activeFilters['type'];
    const hasTypeFilter = typeSet && typeSet.size > 0;
    const ownerSet = activeFilters['ownership'];
    const hasOwnerFilter = ownerSet && ownerSet.size > 0;
    const uniqueId = env.uniqueId;

    const result = statements.filter((s) => {
      // Multi-select status filter: if any statuses selected, must match one
      if (hasStatusFilter && !statusSet.has(normalizePhase(s.status?.phase))) return false;
      // Statement type filter
      if (hasTypeFilter && !typeSet.has(s.spec?.statement_type ?? '')) return false;
      // Ownership filter
      if (hasOwnerFilter) {
        const isMine = uniqueId && s.name?.includes(uniqueId);
        const wantMine = ownerSet.has('MINE');
        const wantOthers = ownerSet.has('OTHERS');
        // If both selected, show all (no filter). If only one, filter accordingly.
        if (wantMine && !wantOthers && !isMine) return false;
        if (wantOthers && !wantMine && isMine) return false;
      }
      if (searchLower) {
        const name = s.name?.toLowerCase() ?? '';
        const sql = s.spec?.statement?.toLowerCase() ?? '';
        if (!name.includes(searchLower) && !sql.includes(searchLower)) return false;
      }
      return true;
    });
    // Sort user-launched statements first (stable sort preserves existing order within groups)
    return result.sort((a, b) => {
      const aUser = userLaunchedNames.has(a.name) ? 0 : 1;
      const bUser = userLaunchedNames.has(b.name) ? 0 : 1;
      return aUser - bUser;
    });
  }, [statements, search, activeFilters, userLaunchedNames]);

  // Clear stale selections when filtered list changes
  useEffect(() => {
    setSelectedNames((prev) => {
      const filteredNameSet = new Set(filtered.map((s) => s.name));
      const next = new Set<string>();
      for (const name of prev) {
        if (filteredNameSet.has(name)) next.add(name);
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

  // Close actions dropdown on click outside
  useEffect(() => {
    if (!actionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionsOpen]);

  // Determine which actions apply to ALL selected items
  const selectedActions = useMemo(() => {
    if (selectedNames.size === 0) return { canStop: false, canDelete: false };
    let allStoppable = true;
    let allDeletable = true;
    for (const s of statements) {
      if (!selectedNames.has(s.name)) continue;
      const p = s.status?.phase?.toUpperCase();
      const isRunning = p === 'RUNNING' || p === 'PENDING';
      const isTerminal = p === 'COMPLETED' || p === 'FAILED' || p === 'CANCELLED';
      
      // Soft multi-tenancy check
      const isOwner = s.name?.endsWith(`-${env.uniqueId}`);
      const canManage = env.isAdmin || isOwner;

      if (!isRunning || !canManage) allStoppable = false;
      if (!isTerminal || !canManage) allDeletable = false;
    }
    return { canStop: allStoppable, canDelete: allDeletable };
  }, [statements, selectedNames]);

  const handleSelectAll = () => {
    if (selectedNames.size === filtered.length) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(filtered.map((s) => s.name)));
    }
  };

  const handleSelectRow = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleBulkStop = () => {
    for (const name of selectedNames) {
      onCancelJob(name);
    }
    setSelectedNames(new Set());
    setActionsOpen(false);
  };

  const handleBulkDelete = () => {
    for (const name of selectedNames) {
      onDeleteJob(name);
    }
    setSelectedNames(new Set());
    setActionsOpen(false);
  };

  const allSelected = filtered.length > 0 && selectedNames.size === filtered.length;
  const someSelected = selectedNames.size > 0 && selectedNames.size < filtered.length;

  if (loading && statements.length === 0) {
    return <div className="jobs-loading">Loading statements...</div>;
  }

  if (error && statements.length === 0) {
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
            placeholder="Search by name or SQL..."
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
            Page loaded {formatRelativeTime(lastLoadedAt.toISOString())}
          </span>
        )}

        <button className="jobs-refresh-btn" onClick={handleRefresh} title="Refresh">
          <FiRefreshCw size={14} />
        </button>

        <div className="jobs-actions-wrapper" ref={actionsRef}>
          <button
            className="jobs-actions-btn"
            disabled={selectedNames.size === 0}
            onClick={() => setActionsOpen(!actionsOpen)}
          >
            Actions <FiChevronDown size={14} />
          </button>
          {actionsOpen && selectedNames.size > 0 && (
            <div className="jobs-actions-menu">
              {selectedActions.canStop && (
                <button className="jobs-actions-menu-item" onClick={handleBulkStop}>
                  Stop statement
                </button>
              )}
              {selectedActions.canDelete && (
                <button className="jobs-actions-menu-item" onClick={handleBulkDelete}>
                  Delete statement
                </button>
              )}
              {!selectedActions.canStop && !selectedActions.canDelete && (
                <div className="jobs-actions-menu-empty">No actions available</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="jobs-count">
        {filtered.length} statement{filtered.length !== 1 ? 's' : ''} shown.
        {loading && statements.length > 0 && ' Loading more...'}
        {!loading && filtered.length < statements.length && ' Scroll or use search to fetch more.'}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="jobs-empty">No statements match your filters.</div>
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
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>SQL</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const phase = s.status?.phase;
                // Soft multi-tenancy check
                const isOwner = s.name?.endsWith(`-${env.uniqueId}`);
                const canManage = env.isAdmin || isOwner;
                const canStop = (phase === 'RUNNING' || phase === 'PENDING') && canManage;
                const regionSub = getRegionSubtitle(s.spec?.compute_pool_id);
                const isUserLaunched = userLaunchedNames.has(s.name);
                return (
                  <tr
                    key={s.name}
                    className={`jobs-row${selectedNames.has(s.name) ? ' jobs-row--selected' : ''}${isUserLaunched ? ' jobs-row--mine' : ''}`}
                    onClick={() => onSelectJob(s.name)}
                  >
                    <td className="jobs-cell-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedNames.has(s.name)}
                        onChange={() => handleSelectRow(s.name)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${s.name}`}
                      />
                    </td>
                    <td className="jobs-cell-name" title={s.name}>
                      <div className="jobs-cell-name-primary">
                        {s.name}
                        {isUserLaunched && <span className="jobs-mine-badge" title="Launched from this workspace">mine</span>}
                      </div>
                      {regionSub && <div className="jobs-cell-name-region" title={regionSub}>{regionSub}</div>}
                    </td>
                    <td className="jobs-cell-status">
                      <span className={`status-dot ${getStatusClass(phase)}`} />
                      <span>{getStatusLabel(phase)}</span>
                    </td>
                    <td className="jobs-cell-type">{s.spec?.statement_type ?? '\u2014'}</td>
                    <td className="jobs-cell-sql" title={s.spec?.statement ?? ''}>
                      {s.spec?.statement
                        ? s.spec.statement.length > 80
                          ? s.spec.statement.slice(0, 80) + '\u2026'
                          : s.spec.statement
                        : '\u2014'}
                    </td>
                    <td className="jobs-cell-created">{formatRelativeTime(s.metadata?.created_at)}</td>
                    <td className="jobs-cell-actions">
                      {canStop ? (
                        <button
                          className="jobs-stop-btn"
                          title="Stop"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelJob(s.name);
                          }}
                        >
                          <FiSquare size={14} />
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
