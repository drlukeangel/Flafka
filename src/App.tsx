import { useEffect, useState, useRef, useCallback } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { TreeNavigator } from './components/TreeNavigator';
import { EditorCell } from './components/EditorCell';
import { HistoryPanel } from './components/HistoryPanel';
import { HelpPanel } from './components/HelpPanel/HelpPanel';
import { OnboardingHint } from './components/OnboardingHint';
import Toast from './components/ui/Toast';
import { TabBar } from './components/TabBar/TabBar';
import { env } from './config/environment';
import { FiPlay, FiPlus, FiCpu, FiActivity, FiChevronDown, FiSquare, FiTrash2, FiSave, FiEdit3, FiChevronsRight, FiChevronsLeft } from 'react-icons/fi';
import { SplitButton } from './components/SplitButton/SplitButton';
import { ComputePoolDashboard } from './components/ComputePoolDashboard/ComputePoolDashboard';
import { NavRail } from './components/NavRail/NavRail';
import SchemaPanel from './components/SchemaPanel/SchemaPanel';
import TopicPanel from './components/TopicPanel/TopicPanel';
import { SnippetsPanel } from './components/SnippetsPanel/SnippetsPanel';
import { WorkspacesPanel } from './components/WorkspacesPanel/WorkspacesPanel';
import ArtifactsPanel from './components/ArtifactsPanel/ArtifactsPanel';
import { ExamplesPanel } from './components/ExamplesPanel/ExamplesPanel';
import { StreamsPanel } from './components/StreamsPanel/StreamsPanel';
import { JobsPage } from './components/JobsPage/JobsPage';
import { exportWorkspace, generateExportFilename } from './utils/workspace-export';
import { generateFunName } from './utils/names';
import { randomStarterJoke } from './store/workspaceStore';
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
function getPoolStatusText(phase: string | null, cfu: number | null, maxCfu: number | null): string {
  if (!phase) return 'Loading...';
  if (phase === 'UNKNOWN') return 'Unknown';
  if (cfu !== null && cfu > 0 && maxCfu !== null && maxCfu > 0) {
    return `${phase} \u00b7 ${cfu}/${maxCfu} CFU`;
  }
  const cfuSuffix = cfu !== null && cfu > 0 ? ` \u00b7 ${cfu} CFU` : '';
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
    activeNavItem,
    setActiveNavItem,
    computePoolPhase,
    computePoolCfu,
    computePoolMaxCfu,
    computePoolDashboardOpen,
    toggleComputePoolDashboard,
    loadStatementTelemetry,
    theme,
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
    stopAllStatements,
    clearWorkspace,
    clearStatements,
    clearStreamCards,
    stopAllStreams,
    runAllStreams,
    streamCards,
    loadComputePoolStatus,
    loadStatementHistory,
    dismissOnboardingHint,
    importWorkspace,
    addToast,
    selectedSchemaSubject,
    streamsPanelOpen,
    toggleStreamsPanel,
    navExpanded,
    toggleNavExpanded,
    workspaceName,
    saveCurrentWorkspace,
    setWorkspaceName,
    workspaceNotes,
    workspaceNotesOpen,
    toggleWorkspaceNotes,
    setWorkspaceNotes,
    savedWorkspaces,
    updateSavedWorkspaceNotes,
  } = useWorkspaceStore();

  const hasRunnableStatements = statements.some(
    (s) => s.status === 'IDLE' || s.status === 'ERROR' || s.status === 'CANCELLED'
  );

  const hasActiveStatements = statements.some(
    (s) => s.status === 'RUNNING' || s.status === 'PENDING'
  );

  const hasAnyStatements = statements.length > 0;

  const hasAnyStreamCards = streamCards.length > 0;

  const showOnboardingHint = !hasSeenOnboardingHint && statements.length === 1 && statements[0].status === 'IDLE';

  const parseJoke = (joke: string) => {
    const nl = joke.indexOf('\n');
    return {
      sql: (nl >= 0 ? joke.slice(0, nl) : joke).replace(/^--\s*/, ''),
      result: nl >= 0 ? joke.slice(nl + 1) : null,
    };
  };
  const [emptyJoke, setEmptyJoke] = useState(() => parseJoke(randomStarterJoke()));
  useEffect(() => {
    if (statements.length === 0) setEmptyJoke(parseJoke(randomStarterJoke()));
  }, [statements.length]);

  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [helpTopicId, setHelpTopicId] = useState<string | undefined>(undefined);

  // Local notes state — synced from store (e.g., when workspace opened or Quick Start completes)
  const [localNotes, setLocalNotes] = useState<string>(workspaceNotes ?? '');
  useEffect(() => {
    setLocalNotes(workspaceNotes ?? '');
  }, [workspaceNotes]);

  // Save workspace dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNameValue, setSaveNameValue] = useState('');
  const saveWorkspaceInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importConfirmation, setImportConfirmation] = useState<{
    data: Record<string, unknown>;
    fileName: string;
  } | null>(null);

  const totalRowsCached = statements.reduce((sum, s) => sum + (s.results?.length ?? 0), 0);

  // ── Side-panel resize (drag handle) ────────────────────────────────────────
  const [sidePanelWidth, setSidePanelWidth] = useState<number | null>(null);
  const isDragging = useRef<'side' | 'stream' | false>(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const sidePanelRef = useRef<HTMLElement>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = 'side';
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidePanelRef.current?.offsetWidth ?? 300;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // ── Streams-panel resize (drag handle) ──────────────────────────────────────
  const [streamsPanelWidth, setStreamsPanelWidth] = useState<number | null>(null);
  const streamsPanelRef = useRef<HTMLElement>(null);

  const handleStreamsResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = 'stream';
    dragStartX.current = e.clientX;
    dragStartWidth.current = streamsPanelRef.current?.offsetWidth ?? 420;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      if (isDragging.current === 'side') {
        const newWidth = Math.min(Math.max(dragStartWidth.current + delta, 200), 800);
        setSidePanelWidth(newWidth);
      } else if (isDragging.current === 'stream') {
        // Streams panel is on right — dragging left makes it wider (invert delta)
        const newWidth = Math.min(Math.max(dragStartWidth.current - delta, 280), 900);
        setStreamsPanelWidth(newWidth);
      }
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
  }, []);

  // Reset custom width when switching nav panels
  useEffect(() => {
    setSidePanelWidth(null);
  }, [activeNavItem]);

  // Width preserved across open/close since panel stays mounted

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

  // Poll telemetry while dashboard is open (every 60s)
  useEffect(() => {
    if (!computePoolDashboardOpen) return;
    loadStatementTelemetry();
    const interval = setInterval(() => {
      loadStatementTelemetry();
    }, 60000);
    return () => clearInterval(interval);
  }, [computePoolDashboardOpen]);

  // Keyboard listener for help panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input, textarea, or Monaco editor
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.target as HTMLElement)?.closest('.monaco-editor')) return;

      if (e.key === '?') {
        e.preventDefault();
        if (activeNavItem === 'help') {
          setActiveNavItem('workspace');
          setHelpPanelOpen(false);
          setHelpTopicId(undefined);
        } else {
          setActiveNavItem('help');
          setHelpPanelOpen(true);
        }
        return;
      }
      if (e.key === 'Escape' && activeNavItem === 'help') {
        e.preventDefault();
        e.stopPropagation();
        setActiveNavItem('workspace');
        setHelpPanelOpen(false);
        setHelpTopicId(undefined);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [helpPanelOpen, activeNavItem, setActiveNavItem]);

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
            <img src="/src/img/fob-logo-sm.png" alt="Flafka" className="logo-icon" />
            <div className="logo-title-group">
              <span className="logo-text">Flafka</span>
            </div>
          </div>
          {workspaceName && workspaceName !== 'Flafka' && (
            <>
              <span className="header-workspace-sep" aria-hidden="true" />
              <span className="header-workspace-name" title={workspaceName}>{workspaceName}</span>
              <button
                className="header-icon-btn"
                onClick={() => {
                  setSaveNameValue(workspaceName && workspaceName !== 'Flafka' ? workspaceName : generateFunName());
                  setSaveDialogOpen(true);
                  requestAnimationFrame(() => { saveWorkspaceInputRef.current?.select(); });
                }}
                title="Save workspace"
                aria-label="Save workspace"
              >
                <FiSave size={13} />
              </button>
              <button
                className={`header-icon-btn${workspaceNotesOpen ? ' header-icon-btn--active' : ''}`}
                onClick={toggleWorkspaceNotes}
                aria-label={workspaceNotesOpen ? 'Hide notes' : 'Show notes'}
                title={workspaceNotesOpen ? 'Hide notes' : 'Show notes'}
                aria-expanded={workspaceNotesOpen}
              >
                <FiEdit3 size={13} />
              </button>
            </>
          )}
        </div>
        <div className="header-center">
          <button
            id="compute-pool-badge"
            className={`environment-info compute-pool-status compute-pool-status--clickable${computePoolDashboardOpen ? ' compute-pool-status--active' : ''}`}
            onClick={toggleComputePoolDashboard}
            role="button"
            tabIndex={0}
            aria-expanded={computePoolDashboardOpen}
            aria-controls="compute-pool-panel"
            aria-label={`Compute pool status: ${computePoolPhase || 'loading'}, ${computePoolCfu ?? 0} of ${computePoolMaxCfu ?? 0} CFU. Click to view running statements`}
          >
            <FiCpu size={14} />
            <span
              className={`pool-status-dot ${getPoolDotClass(computePoolPhase)}`}
              title={`Compute Pool: ${env.computePoolId}`}
            />
            <span>{getPoolStatusText(computePoolPhase, computePoolCfu, computePoolMaxCfu)}</span>
            <FiChevronDown size={14} className={`pool-chevron${computePoolDashboardOpen ? ' pool-chevron--open' : ''}`} />
          </button>
        </div>
        <div className="header-right">
          {activeNavItem === 'workspace' && (
            <>
              <SplitButton
                className="split-btn--run"
                icon={<FiPlay size={16} />}
                label="Run All"
                onClick={() => {
                  dismissOnboardingHint();
                  runAllStatements();
                  runAllStreams();
                }}
                disabled={!hasRunnableStatements && !hasAnyStreamCards}
                options={[
                  {
                    label: 'Run Queries',
                    icon: <FiPlay size={14} />,
                    onClick: () => { dismissOnboardingHint(); runAllStatements(); },
                    disabled: !hasRunnableStatements,
                  },
                  {
                    label: 'Run Streams',
                    icon: <FiPlay size={14} />,
                    onClick: () => { runAllStreams(); },
                    disabled: !hasAnyStreamCards,
                  },
                ]}
              />
              <SplitButton
                className="split-btn--stop"
                icon={<FiSquare size={14} />}
                label="Stop All"
                onClick={() => { stopAllStatements(); stopAllStreams(); }}
                disabled={!hasActiveStatements && !hasAnyStreamCards}
                options={[
                  {
                    label: 'Stop Queries',
                    icon: <FiSquare size={14} />,
                    onClick: () => stopAllStatements(),
                    disabled: !hasActiveStatements,
                  },
                  {
                    label: 'Stop Streams',
                    icon: <FiSquare size={14} />,
                    onClick: () => { stopAllStreams(); },
                    disabled: !hasAnyStreamCards,
                  },
                ]}
              />
              <SplitButton
                className="split-btn--delete"
                icon={<FiTrash2 size={14} />}
                label="Delete All"
                onClick={() => { clearWorkspace(); clearStreamCards(); }}
                disabled={!hasAnyStatements && !hasAnyStreamCards}
                options={[
                  {
                    label: 'Delete Queries',
                    icon: <FiTrash2 size={14} />,
                    onClick: () => clearStatements(),
                    disabled: !hasAnyStatements,
                  },
                  {
                    label: 'Delete Streams',
                    icon: <FiTrash2 size={14} />,
                    onClick: () => { clearStreamCards(); },
                    disabled: !hasAnyStreamCards,
                  },
                ]}
              />
              <button
                className="add-cell-btn"
                onClick={() => {
                  addStatement();
                  dismissOnboardingHint();
                }}
                title="Add Statement"
              >
                <FiPlus size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Compute Pool Dashboard — push-down panel */}
      <ComputePoolDashboard isOpen={computePoolDashboardOpen} />

      <div className="app-content">
        {/* Navigation Rail + floating expand/collapse handle */}
        <div className="nav-rail-wrapper">
          <NavRail />
          <button
            className="nav-rail-handle"
            onClick={toggleNavExpanded}
            title={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-expanded={navExpanded}
          >
            {navExpanded ? <FiChevronsLeft size={13} /> : <FiChevronsRight size={13} />}
          </button>
        </div>

        {/* Side Panel - conditionally rendered based on active nav item */}
        {activeNavItem !== 'workspace' && activeNavItem !== 'jobs' && (
          <aside
            ref={sidePanelRef}
            className="side-panel"
            style={{
              width: sidePanelWidth
                ? sidePanelWidth
                : activeNavItem === 'schemas' && selectedSchemaSubject
                  ? 'var(--schema-panel-width)'
                  : 'var(--side-panel-width)',
              minWidth: 200,
            }}
          >
            <div className="side-panel-content">
              {activeNavItem === 'tree' && <TreeNavigator />}
              {activeNavItem === 'history' && (
                <HistoryPanel
                  onClose={() => setActiveNavItem('workspace')}
                  onRefresh={loadStatementHistory}
                />
              )}
              {activeNavItem === 'help' && (
                <HelpPanel
                  isOpen={true}
                  onClose={() => {
                    setActiveNavItem('workspace');
                    setHelpPanelOpen(false);
                    setHelpTopicId(undefined);
                  }}
                  activeTopicId={helpTopicId}
                />
              )}
              {activeNavItem === 'settings' && (
                <div className="settings-side-panel">
                  <div className="settings-section">
                    <span className="settings-section-title">Environment</span>
                    <div className="settings-row">
                      <span className="settings-label">Catalog</span>
                      <span className="settings-value">
                        <select
                          className="settings-select"
                          value={catalog}
                          onChange={(e) => setCatalog(e.target.value)}
                        >
                          {catalogs.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </span>
                    </div>
                    <div className="settings-row">
                      <span className="settings-label">Database</span>
                      <span className="settings-value">
                        <select
                          className="settings-select"
                          value={database}
                          onChange={(e) => setDatabase(e.target.value)}
                        >
                          {databases.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </span>
                    </div>
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
              {activeNavItem === 'topics' && <TopicPanel />}
              {activeNavItem === 'schemas' && <SchemaPanel />}
              {activeNavItem === 'artifacts' && <ArtifactsPanel />}
              {activeNavItem === 'snippets' && <SnippetsPanel />}
              {activeNavItem === 'workspaces' && <WorkspacesPanel />}
              {activeNavItem === 'examples' && <ExamplesPanel />}
            </div>
            {/* Drag handle for resizing */}
            <div
              className="side-panel-resize-handle"
              onMouseDown={handleResizeStart}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className="main-content">
          {activeNavItem === 'jobs' ? (
            <JobsPage />
          ) : (
            <>
              {/* Workspace Notes Panel — push-down above cells */}
              <div
                className={`workspace-notes-panel${workspaceNotesOpen ? ' workspace-notes-panel--open' : ''}`}
                role="region"
                aria-label="Workspace Notes"
              >
                <div className="workspace-notes-header">
                  <span className="workspace-notes-label">Workspace Notes</span>
                  <button
                    className="workspace-notes-close"
                    onClick={toggleWorkspaceNotes}
                    aria-label="Close notes"
                  >
                    Close Notes
                  </button>
                </div>
                <textarea
                  className="workspace-notes-textarea"
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onBlur={() => {
                    setWorkspaceNotes(localNotes || null);
                    const savedId = savedWorkspaces.find((w) => w.name === workspaceName)?.id;
                    if (savedId) updateSavedWorkspaceNotes(savedId, localNotes);
                  }}
                  placeholder="Add notes about this workspace..."
                  aria-label="Workspace notes"
                />
              </div>

              {/* Editor Cells or Empty State */}
              {statements.length === 0 ? (
                <div className="workspace-empty-state">
                  <img src="/src/img/fob-logo-sm.png" alt="Flafka squirrel" className="workspace-empty-logo" />
                  <p className="workspace-empty-title">Flafka</p>
                  <div className="workspace-empty-code-block">
                    <p className="workspace-empty-sql">{emptyJoke.sql}</p>
                    {emptyJoke.result && <p className="workspace-empty-query-result">{emptyJoke.result}</p>}
                  </div>
                  <button
                    className="add-cell-btn"
                    onClick={() => { addStatement(); dismissOnboardingHint(); }}
                  >
                    <FiPlus size={16} />
                    <span>Statement</span>
                  </button>
                </div>
              ) : (
                <div className="editor-cells">
                  {statements.map((statement, index) => (
                    <EditorCell
                      key={statement.id}
                      statement={statement}
                      index={index}
                    />
                  ))}
                  {showOnboardingHint && <OnboardingHint onDismiss={dismissOnboardingHint} />}
                </div>
              )}

              {/* Tab Bar */}
              <TabBar />
            </>
          )}

          {/* Floating handle to toggle streams panel */}
          <button
            className="stream-panel-handle"
            onClick={() => toggleStreamsPanel()}
            aria-label={streamsPanelOpen ? 'Close streams panel' : 'Open streams panel'}
            title="Streams"
          >
            <FiActivity size={16} />
          </button>
        </main>

        {/* Streams Panel (right side) — always mounted for persistence */}
        <aside
          ref={streamsPanelRef}
          className={`stream-panel-aside${streamsPanelOpen ? '' : ' stream-panel-aside--hidden'}`}
          role="complementary"
          aria-label="Streams panel"
          style={streamsPanelOpen && streamsPanelWidth ? { width: streamsPanelWidth } : undefined}
        >
          <div
            className="stream-panel-resize-handle"
            onMouseDown={handleStreamsResizeStart}
          />
          <StreamsPanel />
        </aside>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />

      {/* Save Workspace Dialog */}
      {saveDialogOpen && (
        <div
          className="import-confirm-overlay"
          onClick={() => setSaveDialogOpen(false)}
        >
          <div
            className="import-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-workspace-dialog-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSaveDialogOpen(false);
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const name = saveNameValue.trim();
                if (name) {
                  saveCurrentWorkspace(name);
                  setWorkspaceName(name);
                  setSaveDialogOpen(false);
                }
              }
            }}
          >
            <h3 id="save-workspace-dialog-title" className="import-confirm-title">Save Workspace</h3>
            <div className="import-confirm-details">
              <div className="import-confirm-row">
                <label className="import-confirm-label" htmlFor="save-workspace-name">Name</label>
                <input
                  id="save-workspace-name"
                  ref={saveWorkspaceInputRef}
                  type="text"
                  value={saveNameValue}
                  onChange={(e) => setSaveNameValue(e.target.value)}
                  className="settings-select"
                  maxLength={80}
                  autoFocus
                  style={{ flex: 1, fontSize: 13 }}
                />
              </div>
            </div>
            <div className="import-confirm-actions">
              <button className="import-confirm-btn import-confirm-btn--cancel" onClick={() => setSaveDialogOpen(false)}>Cancel</button>
              <button
                className="import-confirm-btn import-confirm-btn--confirm"
                disabled={!saveNameValue.trim()}
                onClick={() => {
                  const name = saveNameValue.trim();
                  if (!name) return;
                  saveCurrentWorkspace(name);
                  setWorkspaceName(name);
                  setSaveDialogOpen(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
