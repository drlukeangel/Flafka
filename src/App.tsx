import { useEffect, useState, useRef } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { TreeNavigator } from './components/TreeNavigator';
import { EditorCell } from './components/EditorCell';
import { HistoryPanel } from './components/HistoryPanel';
import { HelpPanel } from './components/HelpPanel/HelpPanel';
import { Dropdown } from './components/Dropdown';
import { OnboardingHint } from './components/OnboardingHint';
import Toast from './components/ui/Toast';
import FooterStatus from './components/FooterStatus';
import { env } from './config/environment';
import { FiDatabase, FiPlay, FiPlus, FiSettings, FiCpu, FiChevronLeft, FiChevronRight, FiClock, FiMoon, FiSun, FiEdit2, FiHelpCircle } from 'react-icons/fi';
import { exportWorkspace, generateExportFilename } from './utils/workspace-export';
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
    sessionProperties,
    setSessionProperty,
    removeSessionProperty,
    resetSessionProperties,
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
    importWorkspace,
    addToast,
  } = useWorkspaceStore();

  const hasRunnableStatements = statements.some(
    (s) => s.status === 'IDLE' || s.status === 'ERROR' || s.status === 'CANCELLED'
  );

  const showOnboardingHint = !hasSeenOnboardingHint && statements.length === 1 && statements[0].status === 'IDLE';

  const [showSettings, setShowSettings] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  const [showHistory, setShowHistory] = useState(false);
  const historyPanelRef = useRef<HTMLDivElement>(null);

  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [helpTopicId, setHelpTopicId] = useState<string | undefined>(undefined);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importConfirmation, setImportConfirmation] = useState<{
    data: Record<string, unknown>;
    fileName: string;
  } | null>(null);

  const totalRowsCached = statements.reduce((sum, s) => sum + (s.results?.length ?? 0), 0);

  useEffect(() => {
    // Sync theme to DOM attribute on mount and whenever it changes
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  // Keyboard listener for help panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input, textarea, or Monaco editor
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.target as HTMLElement)?.closest('.monaco-editor')) return;

      if (e.key === '?') {
        e.preventDefault();
        setHelpPanelOpen(prev => !prev);
        return;
      }
      if (e.key === 'Escape' && helpPanelOpen) {
        e.preventDefault();
        e.stopPropagation();
        setHelpPanelOpen(false);
        setHelpTopicId(undefined);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [helpPanelOpen]);

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

  const handleExportWorkspace = () => {
    const state = useWorkspaceStore.getState();
    const jsonStr = exportWorkspace({
      statements: state.statements.map(s => ({
        id: s.id,
        code: s.code,
        createdAt: s.createdAt,
        isCollapsed: s.isCollapsed,
        lastExecutedCode: s.lastExecutedCode ?? null,
      })),
      catalog: state.catalog,
      database: state.database,
      workspaceName: state.workspaceName,
    });

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateExportFilename(state.workspaceName);
    link.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: 'Workspace exported' });
  };

  const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      addToast({
        type: 'error',
        message: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 5MB)`,
      });
      e.currentTarget.value = '';
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setImportConfirmation({ data, fileName: file.name });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message: `Import failed: ${msg}` });
    }

    e.currentTarget.value = '';
  };

  const handleImportConfirm = () => {
    if (!importConfirmation?.data) return;

    try {
      importWorkspace(importConfirmation.data);
      addToast({ type: 'success', message: 'Workspace imported successfully' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      addToast({ type: 'error', message: `Import failed: ${msg}` });
    }

    setImportConfirmation(null);
  };

  const handleImportCancel = () => {
    setImportConfirmation(null);
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
                onOpenHelp={(topicId) => {
                  setHelpPanelOpen(true);
                  setHelpTopicId(topicId);
                }}
              />
            )}
          </div>

          <button
            className={`header-btn${helpPanelOpen ? ' active' : ''}`}
            onClick={() => setHelpPanelOpen(prev => !prev)}
            title="Help (?)"
            aria-label="Toggle help panel"
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
                  <div className="settings-row settings-row--actions">
                    <button className="settings-action-btn" onClick={handleExportWorkspace}>
                      Export Workspace
                    </button>
                    <button className="settings-action-btn" onClick={handleImportClick}>
                      Import Workspace
                    </button>
                  </div>
                </div>

                <div className="settings-section">
                  <span className="settings-section-title">Session Properties</span>
                  <p className="settings-help-text">
                    Flink SQL session properties applied to all statements.
                  </p>
                  <div className="property-editor">
                    {Object.entries(sessionProperties).map(([key, value]) => (
                      <div key={key} className="property-row">
                        <span className="property-key" title={key}>{key}</span>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setSessionProperty(key, e.target.value)}
                          className="property-value"
                          placeholder="value"
                        />
                        <button
                          onClick={() => removeSessionProperty(key)}
                          className="property-delete-btn"
                          title="Remove property"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="property-actions">
                    <button
                      onClick={() => {
                        const newKey = prompt('Property key (e.g., sql.tables.scan.startup.mode):');
                        if (newKey?.trim()) {
                          setSessionProperty(newKey.trim(), '');
                        }
                      }}
                      className="settings-action-btn"
                    >
                      + Add Property
                    </button>
                    <button
                      onClick={() => resetSessionProperties()}
                      className="settings-action-btn"
                    >
                      Reset Defaults
                    </button>
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
              <EditorCell
                key={statement.id}
                statement={statement}
                index={index}
                onOpenHelp={(topicId) => {
                  setHelpPanelOpen(true);
                  setHelpTopicId(topicId);
                }}
              />
            ))}
            {showOnboardingHint && <OnboardingHint onDismiss={dismissOnboardingHint} />}
          </div>

          {/* Footer Status */}
          <FooterStatus />

          {/* Help Panel */}
          <HelpPanel
            isOpen={helpPanelOpen}
            onClose={() => {
              setHelpPanelOpen(false);
              setHelpTopicId(undefined);
            }}
            activeTopicId={helpTopicId}
          />
        </main>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />

      {/* Import Confirmation Dialog */}
      {importConfirmation && (
        <div className="import-confirm-overlay" onClick={handleImportCancel}>
          <div className="import-confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3 className="import-confirm-title">Import Workspace?</h3>
            <div className="import-confirm-details">
              <div className="import-confirm-row">
                <span className="import-confirm-label">Name:</span>
                <span>{(importConfirmation.data as Record<string, unknown>).workspaceName as string || 'Unknown'}</span>
              </div>
              <div className="import-confirm-row">
                <span className="import-confirm-label">Statements:</span>
                <span>{Array.isArray((importConfirmation.data as Record<string, unknown>).statements) ? ((importConfirmation.data as Record<string, unknown>).statements as unknown[]).length : 0}</span>
              </div>
              <div className="import-confirm-row">
                <span className="import-confirm-label">Catalog:</span>
                <span>{(importConfirmation.data as Record<string, unknown>).catalog as string || 'Unknown'}</span>
              </div>
              <div className="import-confirm-row">
                <span className="import-confirm-label">Database:</span>
                <span>{(importConfirmation.data as Record<string, unknown>).database as string || 'Unknown'}</span>
              </div>
            </div>
            <p className="import-confirm-warning">This will replace your current workspace.</p>
            <div className="import-confirm-actions">
              <button className="import-confirm-btn import-confirm-btn--cancel" onClick={handleImportCancel}>Cancel</button>
              <button className="import-confirm-btn import-confirm-btn--confirm" onClick={handleImportConfirm}>Confirm Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}

export default App;
