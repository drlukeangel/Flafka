/**
 * @ksql-query-detail
 * ksqlDB query detail view — metadata, SQL panel, load-in-workspace, auto-refresh.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { KsqlPersistentQuery } from '../../types';
import { explainQuery } from '../../api/ksql-api';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FiArrowLeft, FiSquare, FiCode, FiLoader } from 'react-icons/fi';
import '../JobsPage/JobsPage.css';

interface KsqlQueryDetailProps {
  query: KsqlPersistentQuery | undefined;
  onBack: () => void;
  onTerminateQuery: (queryId: string) => Promise<void>;
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

export function KsqlQueryDetail({ query, onBack, onTerminateQuery }: KsqlQueryDetailProps) {
  const addStatement = useWorkspaceStore((s) => s.addStatement);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveState, setLiveState] = useState<string | null>(null);
  const [terminating, setTerminating] = useState(false);

  const handleTerminate = useCallback(async () => {
    if (!query) return;
    setTerminating(true);
    try {
      await onTerminateQuery(query.id);
    } finally {
      setTerminating(false);
    }
  }, [query, onTerminateQuery]);

  // Auto-refresh for RUNNING queries — poll every 5s
  useEffect(() => {
    if (!query) return;
    const state = liveState ?? query.state;
    if (state.toUpperCase() !== 'RUNNING') return;

    const refresh = async () => {
      try {
        const response = await explainQuery(query.id);
        // The EXPLAIN response contains queryDescription with state
        const desc = response?.[0] as Record<string, unknown> | undefined;
        const queryDesc = desc?.queryDescription as Record<string, unknown> | undefined;
        const newState = queryDesc?.state as string | undefined;
        if (newState) {
          setLiveState(newState);
          // Update the query in the store
          const { ksqlQueries } = useWorkspaceStore.getState();
          useWorkspaceStore.setState({
            ksqlQueries: ksqlQueries.map((q) =>
              q.id === query.id ? { ...q, state: newState } : q
            ),
          });
          // Stop polling if terminal
          const upper = newState.toUpperCase();
          if (upper === 'ERROR' || upper === 'PAUSED') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        }
      } catch {
        // Silently ignore refresh errors
      }
    };

    intervalRef.current = setInterval(refresh, 5000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [query?.id, query?.state, liveState]);

  if (!query) {
    return (
      <div className="jobs-detail-not-found">
        <p>Query not found.</p>
        <button className="jobs-back-btn" onClick={onBack}>
          <FiArrowLeft size={14} /> Back to list
        </button>
      </div>
    );
  }

  const currentState = liveState ?? query.state;
  const canTerminate = currentState.toUpperCase() === 'RUNNING';
  const sql = query.queryString;

  const handleLoadInWorkspace = () => {
    if (sql) {
      addStatement(sql, undefined, undefined, { engine: 'ksqldb' });
      setActiveNavItem('workspace');
    }
  };

  return (
    <div className="jobs-detail">
      {/* Header */}
      <div className="jobs-detail-header">
        <button className="jobs-back-btn" onClick={onBack} title="Back to list">
          <FiArrowLeft size={16} />
        </button>
        <h2 className="jobs-detail-name" title={query.id}>{query.id}</h2>
        {canTerminate && (
          <button
            className="jobs-stop-btn-large"
            onClick={handleTerminate}
            disabled={terminating}
          >
            {terminating
              ? <><FiLoader size={14} className="ksql-terminate-spin" /><span>Terminating...</span></>
              : <><FiSquare size={14} /><span>Terminate</span></>}
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="jobs-detail-status-bar">
        <span className={`status-dot ${getStatusClass(currentState)}`} />
        <span className="jobs-detail-status-label">{getStatusLabel(currentState)}</span>
        <span className="jobs-detail-separator">&middot;</span>
        <span>{parseQueryType(query.id)}</span>
      </div>

      {/* Content */}
      <div className="jobs-detail-content">
        <div className="jobs-detail-overview">
          {/* Metadata grid */}
          <div className="jobs-detail-meta-grid">
            <div className="jobs-detail-meta-item">
              <span className="jobs-detail-meta-label">Query Type</span>
              <span className="jobs-detail-meta-value">{parseQueryType(query.id)}</span>
            </div>
            <div className="jobs-detail-meta-item">
              <span className="jobs-detail-meta-label">State</span>
              <span className="jobs-detail-meta-value">{currentState}</span>
            </div>
            {query.sinks.length > 0 && (
              <div className="jobs-detail-meta-item">
                <span className="jobs-detail-meta-label">Sink{query.sinks.length > 1 ? 's' : ''}</span>
                <span className="jobs-detail-meta-value">{query.sinks.join(', ')}</span>
              </div>
            )}
          </div>

          {/* SQL panel */}
          <div className="jobs-detail-sql-section">
            <div className="jobs-detail-sql-header">
              <span><FiCode size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />SQL Statement</span>
              <button className="jobs-load-workspace-btn" onClick={handleLoadInWorkspace}>
                Load in Workspace
              </button>
            </div>
            {sql ? (
              <pre className="jobs-detail-sql-code">
                {sql.split('\n').map((line, i) => (
                  <div key={i} className="jobs-detail-sql-line">
                    <span className="jobs-detail-line-number">{i + 1}</span>
                    <span className="jobs-detail-line-text">{line}</span>
                  </div>
                ))}
              </pre>
            ) : (
              <div className="jobs-detail-sql-empty">No SQL available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
