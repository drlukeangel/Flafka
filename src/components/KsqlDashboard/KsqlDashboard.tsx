import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FiRefreshCw, FiX, FiSquare, FiArrowRight, FiLoader } from 'react-icons/fi';
import type { KsqlPersistentQuery } from '../../types';
import './KsqlDashboard.css';

function formatRelativeTime(date: Date | null): string {
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function parseQueryType(queryId: string): string {
  if (queryId.startsWith('CSAS_')) return 'STREAM AS';
  if (queryId.startsWith('CTAS_')) return 'TABLE AS';
  if (queryId.startsWith('INSERTQUERY_')) return 'INSERT';
  return 'PERSISTENT';
}

function getStatusClass(state: string): string {
  switch (state.toUpperCase()) {
    case 'RUNNING': return 'running';
    case 'PAUSED': return 'pending';
    case 'ERROR': return 'failed';
    default: return 'unknown';
  }
}

interface KsqlDashboardProps {
  isOpen: boolean;
}

export function KsqlDashboard({ isOpen }: KsqlDashboardProps) {
  const {
    ksqlDashboardQueries,
    ksqlDashboardLoading,
    ksqlDashboardError,
    ksqlDashboardLastUpdated,
    ksqlDashboardHeight,
    loadKsqlDashboardQueries,
    terminateKsqlDashboardQuery,
    setKsqlDashboardHeight,
    setActiveNavItem,
    navigateToKsqlQueryDetail,
  } = useWorkspaceStore();

  const toggleDashboard = useWorkspaceStore((s) => s.toggleKsqlDashboard);

  const [terminatingIds, setTerminatingIds] = useState<Set<string>>(new Set());

  const handleTerminate = useCallback(async (id: string) => {
    setTerminatingIds((prev) => new Set(prev).add(id));
    try {
      await terminateKsqlDashboardQuery(id);
    } finally {
      setTerminatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [terminateKsqlDashboardQuery]);

  const panelRef = useRef<HTMLDivElement>(null);
  const refreshBtnRef = useRef<HTMLButtonElement>(null);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Focus management: focus refresh button when panel opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        refreshBtnRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape closes panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        toggleDashboard();
        document.getElementById('ksql-dashboard-badge')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleDashboard]);

  // Click-outside closes panel (exclude both badges)
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !target.closest('#ksql-dashboard-badge') &&
        !target.closest('#compute-pool-badge')
      ) {
        toggleDashboard();
        document.getElementById('ksql-dashboard-badge')?.focus();
      }
    };
    // Use setTimeout so the click that opened the panel doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen, toggleDashboard]);

  // Drag resize handle
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = panelRef.current?.offsetHeight ?? ksqlDashboardHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [ksqlDashboardHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientY - dragStartY.current;
      setKsqlDashboardHeight(dragStartHeight.current + delta);
    };
    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setKsqlDashboardHeight]);

  // Polling: refresh every 30s while open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      loadKsqlDashboardQueries();
    }, 30000);
    return () => clearInterval(interval);
  }, [isOpen, loadKsqlDashboardQueries]);

  if (!isOpen) return null;

  const handleViewAllQueries = () => {
    setActiveNavItem('ksql-queries');
    toggleDashboard();
  };

  const handleGoToQuery = (queryId: string) => {
    navigateToKsqlQueryDetail(queryId);
    toggleDashboard();
  };

  return (
    <div
      ref={panelRef}
      className="ksql-dashboard"
      id="ksql-dashboard-panel"
      role="region"
      aria-label="ksqlDB persistent queries"
      style={{ height: ksqlDashboardHeight }}
    >
      {/* Header */}
      <div className="ksql-dashboard-header">
        <span className="ksql-dashboard-title">ksqlDB Queries</span>
        <div className="ksql-dashboard-header-actions">
          <button
            ref={refreshBtnRef}
            className="ksql-dashboard-btn"
            onClick={() => loadKsqlDashboardQueries()}
            disabled={ksqlDashboardLoading}
            title="Refresh queries"
            aria-label="Refresh ksqlDB queries"
          >
            <FiRefreshCw size={14} className={ksqlDashboardLoading ? 'spin-icon' : ''} />
          </button>
          <button
            className="ksql-dashboard-btn"
            onClick={() => {
              toggleDashboard();
              document.getElementById('ksql-dashboard-badge')?.focus();
            }}
            title="Close"
            aria-label="Close ksqlDB dashboard"
          >
            <FiX size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="ksql-dashboard-body">
        {ksqlDashboardLoading && ksqlDashboardQueries.length === 0 ? (
          <div className="ksql-dashboard-empty">
            <div className="spin" style={{ width: 20, height: 20 }} />
            <span>Loading queries...</span>
          </div>
        ) : ksqlDashboardError && ksqlDashboardQueries.length === 0 ? (
          <div className="ksql-dashboard-empty">
            <span className="ksql-dashboard-error-text">{ksqlDashboardError}</span>
            <button className="ksql-dashboard-retry-btn" onClick={() => loadKsqlDashboardQueries()}>
              Retry
            </button>
          </div>
        ) : ksqlDashboardQueries.length === 0 ? (
          <div className="ksql-dashboard-empty">
            <span>No persistent queries running</span>
          </div>
        ) : (
          <table className="ksql-dashboard-table" aria-label="ksqlDB persistent queries">
            <thead>
              <tr>
                <th scope="col">Query ID</th>
                <th scope="col">Status</th>
                <th scope="col">Type</th>
                <th scope="col">SQL</th>
                <th scope="col">Sink</th>
                <th scope="col" className="ksql-dashboard-action-col"></th>
              </tr>
            </thead>
            <tbody>
              {ksqlDashboardQueries.map((row: KsqlPersistentQuery) => (
                <tr key={row.id}>
                  <td className="ksql-dashboard-name-cell" title={row.id}>
                    <button
                      className="ksql-dashboard-name ksql-dashboard-name--clickable"
                      onClick={() => handleGoToQuery(row.id)}
                      title={`View details for ${row.id}`}
                    >
                      {row.id}
                    </button>
                  </td>
                  <td>
                    <span className={`ksql-dashboard-status-dot ${getStatusClass(row.state)}`} />
                    {row.state}
                  </td>
                  <td>{parseQueryType(row.id)}</td>
                  <td className="ksql-dashboard-sql-cell" title={row.queryString}>
                    {row.queryString.length > 80 ? row.queryString.slice(0, 80) + '...' : row.queryString}
                  </td>
                  <td>{row.sinks.join(', ')}</td>
                  <td className="ksql-dashboard-action-col">
                    <button
                      className="ksql-dashboard-stop-btn"
                      onClick={() => handleTerminate(row.id)}
                      disabled={terminatingIds.has(row.id)}
                      title={terminatingIds.has(row.id) ? 'Terminating...' : `Terminate ${row.id}`}
                      aria-label={`Terminate query ${row.id}`}
                    >
                      {terminatingIds.has(row.id)
                        ? <FiLoader size={12} className="ksql-terminate-spin" />
                        : <FiSquare size={12} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="ksql-dashboard-footer">
        <span className="ksql-dashboard-updated">
          {ksqlDashboardLastUpdated ? `Updated ${formatRelativeTime(ksqlDashboardLastUpdated)}` : ''}
        </span>
        <button className="ksql-dashboard-link-btn" onClick={handleViewAllQueries}>
          View all queries <FiArrowRight size={12} />
        </button>
      </div>

      {/* Drag resize handle at bottom */}
      <div className="ksql-dashboard-resize-handle" onMouseDown={handleDragStart} />
    </div>
  );
}
