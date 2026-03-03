import { useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { formatBytes, formatNumber } from '../../utils/format';
import { FiRefreshCw, FiX, FiSquare, FiArrowRight } from 'react-icons/fi';
import type { StatementTelemetry } from '../../types';
import './ComputePoolDashboard.css';

function formatRelativeTime(date: Date | null): string {
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

interface ComputePoolDashboardProps {
  isOpen: boolean;
}

export function ComputePoolDashboard({ isOpen }: ComputePoolDashboardProps) {
  const {
    statementTelemetry,
    telemetryLoading,
    telemetryError,
    telemetryLastUpdated,
    dashboardHeight,
    loadStatementTelemetry,
    stopDashboardStatement,
    setDashboardHeight,
    setActiveNavItem,
    navigateToJobDetail,
  } = useWorkspaceStore();

  const toggleDashboard = useWorkspaceStore((s) => s.toggleComputePoolDashboard);

  const panelRef = useRef<HTMLDivElement>(null);
  const refreshBtnRef = useRef<HTMLButtonElement>(null);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Focus management: focus refresh button when panel opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow render
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
        // Return focus to badge
        document.getElementById('compute-pool-badge')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleDashboard]);

  // Click-outside closes panel (exclude badge)
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !target.closest('#compute-pool-badge')
      ) {
        toggleDashboard();
        document.getElementById('compute-pool-badge')?.focus();
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
    dragStartHeight.current = panelRef.current?.offsetHeight ?? dashboardHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [dashboardHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientY - dragStartY.current;
      setDashboardHeight(dragStartHeight.current + delta);
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
  }, [setDashboardHeight]);

  // Polling: refresh every 60s while open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      loadStatementTelemetry();
    }, 60000);
    return () => clearInterval(interval);
  }, [isOpen, loadStatementTelemetry]);

  if (!isOpen) return null;

  const handleViewAllJobs = () => {
    setActiveNavItem('jobs');
    toggleDashboard();
  };

  const handleGoToJob = (statementName: string) => {
    navigateToJobDetail(statementName);
    toggleDashboard();
  };

  return (
    <div
      ref={panelRef}
      className="compute-dashboard"
      id="compute-pool-panel"
      role="region"
      aria-label="Compute pool running statements"
      style={{ height: dashboardHeight }}
    >
      {/* Header */}
      <div className="compute-dashboard-header">
        <span className="compute-dashboard-title">Compute Pool Usage</span>
        <div className="compute-dashboard-header-actions">
          <button
            ref={refreshBtnRef}
            className="compute-dashboard-btn"
            onClick={() => loadStatementTelemetry()}
            disabled={telemetryLoading}
            title="Refresh telemetry"
            aria-label="Refresh telemetry data"
          >
            <FiRefreshCw size={14} className={telemetryLoading ? 'spin-icon' : ''} />
          </button>
          <button
            className="compute-dashboard-btn"
            onClick={() => {
              toggleDashboard();
              document.getElementById('compute-pool-badge')?.focus();
            }}
            title="Close"
            aria-label="Close compute pool dashboard"
          >
            <FiX size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="compute-dashboard-body">
        {telemetryLoading && statementTelemetry.length === 0 ? (
          <div className="compute-dashboard-empty">
            <div className="spin" style={{ width: 20, height: 20 }} />
            <span>Loading telemetry...</span>
          </div>
        ) : telemetryError && statementTelemetry.length === 0 ? (
          <div className="compute-dashboard-empty">
            <span className="compute-dashboard-error-text">{telemetryError}</span>
            <button className="compute-dashboard-retry-btn" onClick={() => loadStatementTelemetry()}>
              Retry
            </button>
          </div>
        ) : statementTelemetry.length === 0 ? (
          <div className="compute-dashboard-empty">
            <span>No statements currently consuming CFU</span>
          </div>
        ) : (
          <table className="compute-dashboard-table" aria-label="Running statements in compute pool">
            <thead>
              <tr>
                <th scope="col">Statement</th>
                <th scope="col">CFU</th>
                <th scope="col">Records In</th>
                <th scope="col">Records Out</th>
                <th scope="col">Pending</th>
                <th scope="col">State Size</th>
                <th scope="col" className="compute-dashboard-action-col"></th>
              </tr>
            </thead>
            <tbody>
              {statementTelemetry.map((row: StatementTelemetry) => (
                <tr key={row.statementName} className={row.isWorkspaceStatement ? '' : 'compute-dashboard-external'}>
                  <td className="compute-dashboard-name-cell" title={row.sql || row.statementName}>
                    <button
                      className="compute-dashboard-name compute-dashboard-name--clickable"
                      onClick={() => handleGoToJob(row.statementName)}
                      title={`View details for ${row.statementName}`}
                    >
                      {row.statementName}
                    </button>
                    {!row.isWorkspaceStatement && <span className="compute-dashboard-external-badge">external</span>}
                  </td>
                  <td className="compute-dashboard-cfu-cell">{row.cfus !== null ? row.cfus : '\u2014'}</td>
                  <td>{formatNumber(row.recordsIn)}</td>
                  <td>{formatNumber(row.recordsOut)}</td>
                  <td className={row.pendingRecords && row.pendingRecords > 0 ? 'compute-dashboard-warning' : ''}>
                    {formatNumber(row.pendingRecords)}
                  </td>
                  <td>{formatBytes(row.stateSizeBytes)}</td>
                  <td className="compute-dashboard-action-col">
                    <button
                      className="compute-dashboard-stop-btn"
                      onClick={() => stopDashboardStatement(row.statementName)}
                      title={`Stop ${row.statementName}`}
                      aria-label={`Stop statement ${row.statementName}`}
                    >
                      <FiSquare size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="compute-dashboard-footer">
        <span className="compute-dashboard-updated">
          {telemetryLastUpdated ? `Updated ${formatRelativeTime(telemetryLastUpdated)}` : ''}
        </span>
        <button className="compute-dashboard-link-btn" onClick={handleViewAllJobs}>
          View all jobs <FiArrowRight size={12} />
        </button>
      </div>

      {/* Drag resize handle at bottom */}
      <div className="compute-dashboard-resize-handle" onMouseDown={handleDragStart} />
    </div>
  );
}
