/**
 * @jobs-detail
 * Job detail view — overview (metadata, SQL, load-in-workspace) + settings tabs.
 */
import { useState, useEffect, useRef } from 'react';
import type { StatementResponse } from '../../api/flink-api';
import * as flinkApi from '../../api/flink-api';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { env } from '../../config/environment';
import { FiArrowLeft, FiSquare, FiTrash2 } from 'react-icons/fi';

interface JobsDetailProps {
  statement: StatementResponse | undefined;
  onBack: () => void;
  onCancelJob: (statementName: string) => void;
  onDeleteJob: (statementName: string) => void;
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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '\u2014';
    return d.toLocaleString();
  } catch {
    return '\u2014';
  }
}

export function JobsDetail({ statement, onBack, onCancelJob, onDeleteJob }: JobsDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const addStatement = useWorkspaceStore((s) => s.addStatement);
  const resumeStatementPolling = useWorkspaceStore((s) => s.resumeStatementPolling);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Soft multi-tenancy check
  const isOwner = statement?.name?.endsWith(`-${env.uniqueId}`);
  const canManage = env.isAdmin || isOwner;

  // Auto-refresh for running/pending statements
  useEffect(() => {
    if (!statement) return;
    const phase = statement.status?.phase;
    if (phase !== 'RUNNING' && phase !== 'PENDING') return;

    const refresh = async () => {
      try {
        const updated = await flinkApi.getStatementStatus(statement.name);
        const { jobStatements } = useWorkspaceStore.getState();
        useWorkspaceStore.setState({
          jobStatements: jobStatements.map((s) =>
            s.name === statement.name ? updated : s
          ),
        });
        // Stop polling if terminal
        const newPhase = updated.status?.phase;
        if (newPhase === 'COMPLETED' || newPhase === 'FAILED' || newPhase === 'CANCELLED') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
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
  }, [statement?.name, statement?.status?.phase]);

  if (!statement) {
    return (
      <div className="jobs-detail-not-found">
        <p>Statement not found.</p>
        <button className="jobs-back-btn" onClick={onBack}>
          <FiArrowLeft size={14} /> Back to list
        </button>
      </div>
    );
  }

  const phase = statement.status?.phase;
  const canStop = phase === 'RUNNING' || phase === 'PENDING';
  const canDelete = phase === 'COMPLETED' || phase === 'FAILED' || phase === 'CANCELLED';
  const sql = statement.spec?.statement;
  const properties = statement.spec?.properties ?? {};

  const handleLoadInWorkspace = () => {
    if (sql) {
      const phase = statement.status?.phase;
      const isRunning = phase === 'RUNNING' || phase === 'PENDING';
      const stmtId = addStatement(
        sql,
        undefined,
        statement.name,
        isRunning ? {
          status: 'RUNNING',
          statementName: statement.name,
          startedAt: statement.metadata?.created_at ? new Date(statement.metadata.created_at) : new Date(),
        } : undefined
      );
      setActiveNavItem('workspace');
      // For running SELECT queries, resume polling to reconnect to results
      if (isRunning && stmtId) {
        setTimeout(() => resumeStatementPolling(stmtId), 500);
      }
    }
  };

  return (
    <div className="jobs-detail">
      {/* Header */}
      <div className="jobs-detail-header">
        <button className="jobs-back-btn" onClick={onBack} title="Back to list">
          <FiArrowLeft size={16} />
        </button>
        <h2 className="jobs-detail-name" title={statement.name}>{statement.name}</h2>
        {canStop && canManage && (
          <button
            className="jobs-stop-btn-large"
            onClick={() => onCancelJob(statement.name)}
          >
            <FiSquare size={14} />
            <span>Stop</span>
          </button>
        )}
        {canDelete && canManage && (
          <button
            className="jobs-delete-btn-large"
            onClick={() => { onDeleteJob(statement.name); onBack(); }}
          >
            <FiTrash2 size={14} />
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="jobs-detail-status-bar">
        <span className={`status-dot ${getStatusClass(phase)}`} />
        <span className="jobs-detail-status-label">{getStatusLabel(phase)}</span>
        {statement.spec?.statement_type && (
          <>
            <span className="jobs-detail-separator">&middot;</span>
            <span>{statement.spec.statement_type}</span>
          </>
        )}
        {statement.metadata?.created_at && (
          <>
            <span className="jobs-detail-separator">&middot;</span>
            <span>{formatDate(statement.metadata.created_at)}</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="jobs-detail-tabs">
        <button
          className={`jobs-detail-tab${activeTab === 'overview' ? ' jobs-detail-tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`jobs-detail-tab${activeTab === 'settings' ? ' jobs-detail-tab--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Tab content */}
      <div className="jobs-detail-content">
        {activeTab === 'overview' && (
          <div className="jobs-detail-overview">
            {/* Metadata grid */}
            <div className="jobs-detail-meta-grid">
              {statement.spec?.compute_pool_id && (
                <div className="jobs-detail-meta-item">
                  <span className="jobs-detail-meta-label">Compute Pool</span>
                  <span className="jobs-detail-meta-value">{statement.spec.compute_pool_id}</span>
                </div>
              )}
              {properties['sql.current-catalog'] && (
                <div className="jobs-detail-meta-item">
                  <span className="jobs-detail-meta-label">Catalog</span>
                  <span className="jobs-detail-meta-value">{properties['sql.current-catalog']}</span>
                </div>
              )}
              {properties['sql.current-database'] && (
                <div className="jobs-detail-meta-item">
                  <span className="jobs-detail-meta-label">Database</span>
                  <span className="jobs-detail-meta-value">{properties['sql.current-database']}</span>
                </div>
              )}
              {properties['sql.tables.scan.startup.mode'] && (
                <div className="jobs-detail-meta-item">
                  <span className="jobs-detail-meta-label">Scan Mode</span>
                  <span className="jobs-detail-meta-value">{properties['sql.tables.scan.startup.mode']}</span>
                </div>
              )}
            </div>

            {/* SQL panel */}
            <div className="jobs-detail-sql-section">
              <div className="jobs-detail-sql-header">
                <span>SQL Statement</span>
                {sql && (
                  <button className="jobs-load-workspace-btn" onClick={handleLoadInWorkspace}>
                    Load in Workspace
                  </button>
                )}
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

            {/* Error detail */}
            {phase === 'FAILED' && statement.status?.detail && (
              <div className="jobs-detail-error">
                <span className="jobs-detail-error-label">Error</span>
                <pre className="jobs-detail-error-text">{statement.status.detail}</pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="jobs-detail-settings">
            {Object.keys(properties).length === 0 ? (
              <div className="jobs-detail-settings-empty">No properties configured.</div>
            ) : (
              <table className="jobs-detail-settings-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(properties).map(([key, value]) => (
                    <tr key={key}>
                      <td className="jobs-setting-key">{key}</td>
                      <td className="jobs-setting-value">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
