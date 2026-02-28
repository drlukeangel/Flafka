import { useEffect, useState, useRef } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { TreeNavigator } from './components/TreeNavigator';
import { EditorCell } from './components/EditorCell';
import { HistoryPanel } from './components/HistoryPanel';
import { Dropdown } from './components/Dropdown';
import { OnboardingHint } from './components/OnboardingHint';
import Toast from './components/ui/Toast';
import FooterStatus from './components/FooterStatus';
import { env } from './config/environment';
import { FiDatabase, FiPlay, FiPlus, FiSettings, FiCpu, FiChevronLeft, FiChevronRight, FiClock, FiMoon, FiSun, FiEdit2, FiHelpCircle } from 'react-icons/fi';
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
    sidebarCollapsed,
    computePoolPhase,
    computePoolCfu,
    statementHistory,
    historyLoading,
    theme,
    workspaceName,
    hasSeenOnboardingHint,
    setCatalog,
    setDatabase,
    loadCatalogs,
    loadDatabases,
    addStatement,
    runAllStatements,
    toggleSidebar,
    toggleTheme,
    loadComputePoolStatus,
    loadStatementHistory,
    setWorkspaceName,
    dismissOnboardingHint,
  } = useWorkspaceStore();

  const hasRunnableStatements = statements.some(
    (s) => s.status === 'IDLE' || s.status === 'ERROR' || s.status === 'CANCELLED'
  );

  const showOnboardingHint = !hasSeenOnboardingHint && statements.length === 1 && statements[0].status === 'IDLE';

  const [showSettings, setShowSettings] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  const [showHistory, setShowHistory] = useState(false);
  const historyPanelRef = useRef<HTMLDivElement>(null);

  const [showHelp, setShowHelp] = useState(false);
  const showHelpRef = useRef(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  const totalRowsCached = statements.reduce((sum, s) => sum + (s.results?.length ?? 0), 0);

  useEffect(() => {
    // Sync theme to DOM attribute on mount and whenever it changes
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Sync showHelpRef with showHelp state
  useEffect(() => {
    showHelpRef.current = showHelp;
  }, [showHelp]);

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

  // Close history panel when clicking outside
  useEffect(() => {
    if (!showHistory) return;
    function handleOutsideClick(e: MouseEvent) {
      if (historyPanelRef.current && !historyPanelRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showHistory]);

  // Keyboard listener for help modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input, textarea, or Monaco editor
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.target as HTMLElement)?.closest('.monaco-editor')) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }
      if (e.key === 'Escape' && showHelpRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setShowHelp(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenHistory = () => {
    if (!showHistory) {
      if (!statementHistory.length && !historyLoading) {
        loadStatementHistory();
      }
    }
    setShowHistory(true);
  };

  const handleTitleClick = () => {
    setEditTitleValue(workspaceName);
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    const trimmed = editTitleValue.trim();
    if (trimmed) {
      setWorkspaceName(trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditingTitle(false);
      const trimmed = editTitleValue.trim();
      if (trimmed) {
        setWorkspaceName(trimmed);
      }
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleTitleBlur = () => {
    if (!isEditingTitle) return;
    handleTitleSave();
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <FiDatabase size={24} />
            <div className="logo-title-group" onClick={!isEditingTitle ? handleTitleClick : undefined}>
              {isEditingTitle ? (
                <input
                  className="logo-editable-input"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={handleTitleBlur}
                  autoFocus
                  maxLength={60}
                />
              ) : (
                <>
                  <span className="logo-text">{workspaceName}</span>
                  <FiEdit2 className="logo-edit-icon" size={14} />
                </>
              )}
            </div>
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
          <button
            className="header-btn"
            onClick={toggleTheme}
            title="Toggle dark/light theme"
            aria-label="Toggle dark/light theme"
          >
            {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
          </button>

          <div className="history-wrapper" ref={historyPanelRef}>
            <button
              className={`header-btn${showHistory ? ' active' : ''}`}
              onClick={handleOpenHistory}
              title="Statement History"
              aria-label="Toggle statement history panel"
            >
              <FiClock size={18} />
            </button>

            {showHistory && (
              <HistoryPanel
                onClose={() => setShowHistory(false)}
                onRefresh={loadStatementHistory}
              />
            )}
          </div>

          <button
            className={`header-btn${showHelp ? ' active' : ''}`}
            onClick={() => setShowHelp(prev => !prev)}
            title="Keyboard shortcuts (?)"
            aria-label="Toggle keyboard shortcuts help"
          >
            <FiHelpCircle size={18} />
          </button>

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
                onClick={() => {
                  dismissOnboardingHint();
                  runAllStatements();
                }}
                disabled={!hasRunnableStatements}
                title="Run all idle/errored statements sequentially"
              >
                <FiPlay size={16} />
                <span>Run All</span>
              </button>
              <button
                className="add-cell-btn"
                onClick={() => {
                  addStatement();
                  dismissOnboardingHint();
                }}
              >
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
            {showOnboardingHint && <OnboardingHint onDismiss={dismissOnboardingHint} />}
          </div>

          {/* Footer Status */}
          <FooterStatus />
        </main>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showHelp && (
        <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal-container" role="dialog" aria-modal="true" aria-labelledby="help-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="help-modal-title">Keyboard Shortcuts</h2>
            <div className="help-shortcuts-grid">
              <div className="help-shortcut-row">
                <kbd>Ctrl+Enter</kbd><span>Run statement</span>
              </div>
              <div className="help-shortcut-row">
                <kbd>Escape</kbd><span>Cancel running statement</span>
              </div>
              <div className="help-shortcut-row">
                <kbd>Ctrl+Alt+↓</kbd><span>Navigate to next cell</span>
              </div>
              <div className="help-shortcut-row">
                <kbd>Ctrl+Alt+↑</kbd><span>Navigate to previous cell</span>
              </div>
              <div className="help-shortcut-row">
                <kbd>?</kbd><span>Toggle this help</span>
              </div>
            </div>
            <button className="help-modal-close" onClick={() => setShowHelp(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}

export default App;
