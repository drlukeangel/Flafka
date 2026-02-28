import { useWorkspaceStore } from '../../store/workspaceStore';
import type { StatementResponse } from '../../api/flink-api';
import { FiRefreshCw, FiX } from 'react-icons/fi';

interface HistoryPanelProps {
  onClose: () => void;
  onRefresh: () => void;
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

  return (
    <div className="history-item">
      <div className="history-item-meta">
        <span
          className={getStatusDotClass(phase)}
          title={phase ?? 'Unknown'}
        />
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

  const handleLoad = (sql: string) => {
    addStatement(sql);
    onClose();
  };

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

        {!historyLoading && !historyError && statementHistory.length > 0 &&
          statementHistory
            .filter((s) => s.spec?.statement)
            .map((statement) => (
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
