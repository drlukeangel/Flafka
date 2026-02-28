import { useEffect } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { TreeNavigator } from './components/TreeNavigator';
import { EditorCell } from './components/EditorCell';
import { Dropdown } from './components/Dropdown';
import Toast from './components/ui/Toast';
import { env } from './config/environment';
import { FiDatabase, FiPlus, FiSettings, FiCpu, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
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
    toggleSidebar,
    loadComputePoolStatus,
  } = useWorkspaceStore();

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
          <button className="header-btn">
            <FiSettings size={18} />
          </button>
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
