import { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { StatementResponse } from '../../api/flink-api';
import { FiRefreshCw, FiX } from 'react-icons/fi';

interface HistoryPanelProps {
  onClose: () => void;
  onRefresh: () => void;
}

const FILTER_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed', phases: ['COMPLETED'] },
  { key: 'stopped', label: 'Stopped', phases: ['CANCELLED'] },
  { key: 'failed', label: 'Failed', phases: ['FAILED'] },
  { key: 'running', label: 'Running', phases: ['RUNNING', 'PENDING'] },
];

function getRelativeTime(isoDateString: string | undefined | null): string | null {
  if (!isoDateString) return null;
  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return 'now';

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return null;
  }
}

function getStatusDotClass(phase: string | undefined): string {
  if (!phase) return 'history-status-dot history-status-dot--unknown';
  switch (phase.toUpperCase()) {
    case 'COMPLETED':
      return 'history-status-dot history-status-dot--completed';
    case 'RUNNING':
      return 'history-status-dot history-status-dot--running';
    case 'PENDING':
      return 'history-status-dot history-status-dot--pending';
    case 'FAILED':
      return 'history-status-dot history-status-dot--failed';
    case 'CANCELLED':
      return 'history-status-dot history-status-dot--cancelled';
    default:
      return 'history-status-dot history-status-dot--unknown';
  }
}

function HistoryItem({
  statement,
  onLoad,
}: {
  statement: StatementResponse;
  onLoad: (sql: string) => void;
}) {
  const sql = statement.spec?.statement;
  const phase = statement.status?.phase;

  if (!sql) {
    return null;
  }

  const sqlPreview = sql.length > 80 ? `${sql.slice(0, 80)}...` : sql;
  const relativeTime = getRelativeTime((statement.metadata as Record<string, unknown>)?.created_at as string | undefined);

  return (
    <div className="history-item">
      <div className="history-item-meta">
        <span
          className={getStatusDotClass(phase)}
          title={phase ?? 'Unknown'}
        />
        {relativeTime && <span className="history-item-time">{relativeTime}</span>}
        <span className="history-item-name" title={statement.name}>
          {statement.name}
        </span>
      </div>
      <div className="history-item-sql" title={sql}>
        {sqlPreview}
      </div>
      <div className="history-item-actions">
        <button
          className="history-load-btn"
          onClick={() => onLoad(sql)}
          title="Load this statement into a new editor cell"
        >
          Load
        </button>
      </div>
    </div>
  );
}

export function HistoryPanel({ onClose, onRefresh }: HistoryPanelProps) {
  const { statementHistory, historyLoading, historyError, addStatement } = useWorkspaceStore();
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const handleLoad = (sql: string) => {
    addStatement(sql);
    onClose();
  };

  // Compute SQL-guarded list
  const sqlStatements = statementHistory.filter(s => s.spec?.statement);

  // Compute counts for each category
  const counts = FILTER_CATEGORIES.reduce((acc, cat) => {
    if (cat.key === 'all') {
      acc[cat.key] = sqlStatements.length;
    } else {
      acc[cat.key] = sqlStatements.filter(s => {
        const phase = s.status?.phase;
        return phase && cat.phases?.includes(phase);
      }).length;
    }
    return acc;
  }, {} as Record<string, number>);

  // Compute filtered statements
  const filteredStatements = activeFilter === 'all'
    ? sqlStatements
    : sqlStatements.filter(s => {
      const phase = s.status?.phase;
      const category = FILTER_CATEGORIES.find(c => c.key === activeFilter);
      return phase && category?.phases?.includes(phase);
    });

  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <span className="history-panel-title">Statement History</span>
        <div className="history-panel-controls">
          <button
            className="history-icon-btn"
            onClick={onRefresh}
            title="Refresh history"
            disabled={historyLoading}
          >
            <FiRefreshCw size={14} className={historyLoading ? 'history-spin' : ''} />
          </button>
          <button
            className="history-icon-btn"
            onClick={onClose}
            title="Close history panel"
          >
            <FiX size={14} />
          </button>
        </div>
      </div>

      {!historyLoading && !historyError && statementHistory.length > 0 && (
        <div className="history-filter-strip">
          {FILTER_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`history-filter-btn ${activeFilter === cat.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(cat.key)}
            >
              {cat.label} ({counts[cat.key]})
            </button>
          ))}
        </div>
      )}

      <div className="history-list">
        {historyLoading && (
          <div className="history-loading">
            <span className="history-spinner" />
            <span>Loading history...</span>
          </div>
        )}

        {!historyLoading && historyError && (
          <div className="history-error">
            <span>Failed to load history: {historyError}</span>
            <button className="history-retry-btn" onClick={onRefresh}>
              Retry
            </button>
          </div>
        )}

        {!historyLoading && !historyError && statementHistory.length === 0 && (
          <div className="history-empty-state">No statements found</div>
        )}

        {!historyLoading && !historyError && statementHistory.length > 0 && filteredStatements.length === 0 && (
          <div className="history-empty-state">
            No {FILTER_CATEGORIES.find(c => c.key === activeFilter)?.label?.toLowerCase()} statements
          </div>
        )}

        {!historyLoading && !historyError && statementHistory.length > 0 && filteredStatements.length > 0 &&
          filteredStatements.map((statement) => (
            <HistoryItem
              key={statement.name}
              statement={statement}
              onLoad={handleLoad}
            />
          ))
        }
      </div>
    </div>
  );
}
