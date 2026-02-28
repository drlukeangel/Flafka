import { useEffect, useState, useRef } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { TreeNavigator } from './components/TreeNavigator';
import { EditorCell } from './components/EditorCell';
import { Dropdown } from './components/Dropdown';
import Toast from './components/ui/Toast';
import { env } from './config/environment';
import { FiDatabase, FiPlay, FiPlus, FiSettings, FiCpu, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './App.css';

// Helper: map compute pool phase to dot CSS class
function getPoolDotClass(phase: string | null): string {
  if (!phase) return 'unknown';
  const p = phase.toUpperCase();
  if (p === 'RUNNING' || p === 'PROVISIONED') return 'running';
  if (p === 'PROVISIONING') return 'provisioning';
  return 'error';
}

// Helper: format display text for compute pool status
function getPoolStatusText(phase: string | null, cfu: number | null): string {
  if (!phase) return 'Loading...';
  if (phase === 'UNKNOWN') return 'Unknown';
  const cfuSuffix = cfu !== null && cfu > 0 ? ` · ${cfu} CFU` : '';
  return `${phase}${cfuSuffix}`;
}

// Truncate long IDs for display
function maskId(id: string): string {
  if (!id) return '\u2014';
  return id.length > 16 ? `${id.slice(0, 12)}\u2026` : id;
}

function App() {
  const {
    catalog,
    database,
    catalogs,
    databases,
    statements,
    lastSavedAt,
    sidebarCollapsed,
    computePoolPhase,
    computePoolCfu,
    setCatalog,
    setDatabase,
    loadCatalogs,
    loadDatabases,
    addStatement,
    runAllStatements,
    toggleSidebar,
    loadComputePoolStatus,
  } = useWorkspaceStore();

  const hasRunnableStatements = statements.some(
    (s) => s.status === 'IDLE' || s.status === 'ERROR' || s.status === 'CANCELLED'
  );

  const [showSettings, setShowSettings] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  const totalRowsCached = statements.reduce((sum, s) => sum + (s.results?.length ?? 0), 0);

  useEffect(() => {
    // Load initial data
    loadCatalogs();
    loadDatabases(catalog);
  }, []);

  useEffect(() => {
    // Load compute pool status on mount and poll every 30s
    loadComputePoolStatus();
    const interval = setInterval(() => {
      loadComputePoolStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close settings panel when clicking outside
  useEffect(() => {
    if (!showSettings) return;
    function handleOutsideClick(e: MouseEvent) {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showSettings]);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <FiDatabase size={24} />
            <span>SQL Workspace</span>
          </div>
        </div>
        <div className="header-center">
          <div className="environment-info compute-pool-status">
            <FiCpu size={14} />
            <span
              className={`pool-status-dot ${getPoolDotClass(computePoolPhase)}`}
              title={`Compute Pool: ${env.computePoolId}`}
            />
            <span>{getPoolStatusText(computePoolPhase, computePoolCfu)}</span>
          </div>
        </div>
        <div className="header-right">
          <div className="settings-wrapper" ref={settingsPanelRef}>
            <button
              className={`header-btn${showSettings ? ' active' : ''}`}
              onClick={() => setShowSettings((prev) => !prev)}
              title="Settings"
              aria-label="Toggle settings panel"
            >
              <FiSettings size={18} />
            </button>

            {showSettings && (
              <div className="settings-panel">
                <div className="settings-section">
                  <span className="settings-section-title">Environment</span>
                  <div className="settings-row">
                    <span className="settings-label">Cloud Provider</span>
                    <span className="settings-value">{env.cloudProvider.toUpperCase() || '\u2014'}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Region</span>
                    <span className="settings-value">{env.cloudRegion || '\u2014'}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Compute Pool ID</span>
                    <span className="settings-value">{maskId(env.computePoolId)}</span>
                  </div>
                </div>

                <div className="settings-section">
                  <span className="settings-section-title">API</span>
                  <div className="settings-row">
                    <span className="settings-label">Flink Endpoint</span>
                    <span className="settings-value">/api/flink</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Organization ID</span>
                    <span className="settings-value">{maskId(env.orgId)}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Environment ID</span>
                    <span className="settings-value">{maskId(env.environmentId)}</span>
                  </div>
                </div>

                <div className="settings-section">
                  <span className="settings-section-title">Workspace</span>
                  <div className="settings-row">
                    <span className="settings-label">Statements</span>
                    <span className="settings-value">{statements.length}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Rows Cached</span>
                    <span className="settings-value">{totalRowsCached.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-content">
        {/* Sidebar - Tree Navigator */}
        <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
          <div className="sidebar-content">
            <TreeNavigator />
          </div>
          <button
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
          </button>
        </aside>

        {/* Main Content - Editor Area */}
        <main className="main-content">
          {/* Toolbar with Catalog/Database selectors */}
          <div className="editor-toolbar">
            <div className="toolbar-selectors">
              <Dropdown
                label="Catalog"
                value={catalog}
                options={catalogs}
                onChange={setCatalog}
              />
              <Dropdown
                label="Database"
                value={database}
                options={databases}
                onChange={setDatabase}
              />
            </div>
            <div className="toolbar-actions">
              <button
                className="run-all-btn"
                onClick={() => runAllStatements()}
                disabled={!hasRunnableStatements}
                title="Run all idle/errored statements sequentially"
              >
                <FiPlay size={16} />
                <span>Run All</span>
              </button>
              <button className="add-cell-btn" onClick={() => addStatement()}>
                <FiPlus size={16} />
                <span>Add Statement</span>
              </button>
            </div>
          </div>

          {/* Editor Cells */}
          <div className="editor-cells">
            {statements.map((statement, index) => (
              <EditorCell key={statement.id} statement={statement} index={index} />
            ))}
          </div>

          {/* Footer Status */}
          <div className="editor-footer">
            <span className="cell-count">{statements.length} statement(s)</span>
            {lastSavedAt && (
              <span className="last-saved">
                Last saved at {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            )}
            <span className="env-info">
              {env.cloudProvider.toUpperCase()} | {env.cloudRegion}
            </span>
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}

export default App;
