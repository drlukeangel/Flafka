import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { TreeNavigator } from './components/TreeNavigator';
import { EditorCell } from './components/EditorCell';
import { HistoryPanel } from './components/HistoryPanel';
import { HelpPanel } from './components/HelpPanel/HelpPanel';
import { OnboardingHint } from './components/OnboardingHint';
import Toast from './components/ui/Toast';
import { TabBar } from './components/TabBar/TabBar';
import { env } from './config/environment';
import { FiPlay, FiPlus, FiCpu, FiActivity, FiZap, FiChevronDown, FiSquare, FiTrash2, FiChevronsRight, FiChevronsLeft } from 'react-icons/fi';
import { SplitButton } from './components/SplitButton/SplitButton';
import { ComputePoolDashboard } from './components/ComputePoolDashboard/ComputePoolDashboard';
import { NavRail } from './components/NavRail/NavRail';
import SchemaPanel from './components/SchemaPanel/SchemaPanel';
import TopicPanel from './components/TopicPanel/TopicPanel';
import { SnippetsPanel } from './components/SnippetsPanel/SnippetsPanel';
import { WorkspacesPanel } from './components/WorkspacesPanel/WorkspacesPanel';
import ArtifactsPanel from './components/ArtifactsPanel/ArtifactsPanel';
const ExampleDetailPage = lazy(() =>
  import('./components/ExampleDetailView/ExampleDetailPage').then(m => ({ default: m.ExampleDetailPage }))
);
const LearnPanel = lazy(() =>
  import('./components/LearnPanel/LearnPanel').then(m => ({ default: m.LearnPanel }))
);
import { StreamsPanel } from './components/StreamsPanel/StreamsPanel';
import { JobsPage } from './components/JobsPage/JobsPage';
import { KsqlQueriesPage } from './components/KsqlQueriesPage/KsqlQueriesPage';
import { KsqlDashboard } from './components/KsqlDashboard/KsqlDashboard';
import { isKsqlEnabled, isKsqlConfigured } from './config/environment';
import { exportWorkspace, generateExportFilename } from './utils/workspace-export';
import { randomStarterJoke } from './store/workspaceStore';
import { useRoute } from './hooks/useRoute';
import './App.css';

/**
 * Help text for common Flink SQL session properties
 */
const SESSION_PROPERTY_HELP: Record<string, string> = {
  'sql.local-time-zone': 'Timezone for temporal functions (e.g., CURRENT_TIMESTAMP). Default: UTC',
  'sql.execution.mode': 'Execution mode: "streaming" or "batch". Default: streaming',
  'execution.checkpointing.mode': 'Checkpoint mode: "EXACTLY_ONCE" (slower, safer) or "AT_LEAST_ONCE" (faster). Default: EXACTLY_ONCE',
  'sql.parallelism': 'Number of parallel tasks for SQL operators. Scales with your compute pool.',
  'execution.checkpointing.interval': 'Checkpoint interval in milliseconds. Higher = faster but less recovery precision.',
  'state.backend': 'State storage backend: "hashmap" (in-memory) or "rocksdb" (disk-backed). Default: hashmap',
  'taskmanager.memory.managed.size': 'Managed memory for task manager (e.g., "512mb"). Leave empty for auto.',
};

/**
 * Maps a Compute Pool lifecycle phase to a CSS class for the status indicator dot.
 * - RUNNING / PROVISIONED => "running" (green dot)
 * - PROVISIONING          => "provisioning" (amber dot)
 * - anything else         => "error" (red dot)
 * - null (not yet loaded) => "unknown"
 */
function getPoolDotClass(phase: string | null): string {
  if (!phase) return 'unknown';
  const p = phase.toUpperCase();
  if (p === 'RUNNING' || p === 'PROVISIONED') return 'running';
  if (p === 'PROVISIONING') return 'provisioning';
  return 'error';
}

/**
 * Returns a human-readable status string for the Compute Pool header badge.
 * Includes the phase name and, when available, the current/max CFU (Confluent Flink Units).
 * Examples: "RUNNING . 4/8 CFU", "PROVISIONING", "Loading..."
 */
function getPoolStatusText(phase: string | null, cfu: number | null, maxCfu: number | null): string {
  if (!phase) return 'Loading...';
  if (phase === 'UNKNOWN') return 'Unknown';
  if (cfu !== null && maxCfu !== null && maxCfu > 0) {
    return `${phase} \u00b7 ${cfu}/${maxCfu} CFU`;
  }
  if (cfu !== null) {
    return `${phase} \u00b7 ${cfu} CFU`;
  }
  return phase;
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
    ksqlDashboardOpen,
    toggleKsqlDashboard,
    ksqlDashboardQueries,
    ksqlFeatureEnabled,
    setKsqlFeatureEnabled,
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
    activeTabId,
    selectedSchemaSubject,
    streamsPanelOpen,
    toggleStreamsPanel,
    navExpanded,
    toggleNavExpanded,
    workspaceName,
    saveCurrentWorkspace,
    selectedExampleId,
    cacheTtlMinutes,
    setCacheTtlMinutes,
    clearCachedData,
  } = useWorkspaceStore();

  // Sync URL with navigation state (enables back/forward + direct URLs)
  useRoute();

  const hasRunnableStatements = statements.some(
    (s) => s.status === 'IDLE' || s.status === 'ERROR' || s.status === 'CANCELLED'
  );

  const hasActiveStatements = statements.some(
    (s) => s.status === 'RUNNING' || s.status === 'PENDING'
  );

  const hasAnyStatements = statements.length > 0;

  const hasAnyStreamCards = streamCards.length > 0;

  const showOnboardingHint = !hasSeenOnboardingHint && statements.length === 1 && statements[0].status === 'IDLE';

  /**
   * Parses a STARTER_JOKES string into its display parts.
   * Each joke follows the format: "-- SQL comment\nresult line"
   * This function strips the leading "-- " from the SQL line and splits
   * out the result (if present) for separate rendering in the empty-workspace state.
   */
  const parseJoke = (joke: string) => {
    const nl = joke.indexOf('\n');
    return {
      sql: (nl >= 0 ? joke.slice(0, nl) : joke).replace(/^--\s*/, ''),
      result: nl >= 0 ? joke.slice(nl + 1) : null,
    };
  };
  const [emptyJoke, setEmptyJoke] = useState(() => parseJoke(randomStarterJoke()));
  const [newPropertyKey, setNewPropertyKey] = useState('');

  useEffect(() => {
    if (statements.length === 0) setEmptyJoke(parseJoke(randomStarterJoke()));
  }, [statements.length, activeTabId]);

  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [helpTopicId, setHelpTopicId] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importConfirmation, setImportConfirmation] = useState<{
    data: Record<string, unknown>;
    fileName: string;
  } | null>(null);

  const totalRowsCached = statements.reduce((sum, s) => sum + (s.results?.length ?? 0), 0);

  // ── Dual-panel drag-to-resize ──────────────────────────────────────────────
  // The app has two independently resizable panels:
  //   1. Side panel (left) — Tree navigator, history, schemas, etc.
  //   2. Streams panel (right) — live stream cards.
  // Both share a single mousemove/mouseup listener. The `isDragging` ref tracks
  // which panel (if any) is being resized. The side panel grows with rightward
  // drag; the streams panel grows with leftward drag (delta is inverted).
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

  // Ctrl+S to save workspace
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (workspaceName && workspaceName !== 'Flafka') {
          saveCurrentWorkspace(workspaceName);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [workspaceName, saveCurrentWorkspace]);

  const handleExportWorkspace = () => {
    const state = useWorkspaceStore.getState();
    const jsonStr = exportWorkspace({
      statements: state.statements.map(s => ({
        id: s.id,
        code: s.code,
        createdAt: s.createdAt,
        isCollapsed: s.isCollapsed,
        lastExecutedCode: s.lastExecutedCode ?? null,
        engine: s.engine,
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
            <img src="/img/fob-logo-sm.png" alt="Flafka" className="logo-icon" />
            <div className="logo-title-group">
              <span className="logo-text">Flafka</span>
            </div>
          </div>
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
          {ksqlFeatureEnabled && isKsqlEnabled() && (
            <button
              id="ksql-dashboard-badge"
              className={`environment-info compute-pool-status compute-pool-status--clickable${ksqlDashboardOpen ? ' compute-pool-status--active' : ''}`}
              onClick={toggleKsqlDashboard}
              role="button"
              tabIndex={0}
              aria-expanded={ksqlDashboardOpen}
              aria-controls="ksql-dashboard-panel"
              aria-label={`ksqlDB queries: ${ksqlDashboardQueries.length} persistent queries`}
            >
              <FiZap size={14} />
              <span>ksqlDB</span>
              {ksqlDashboardQueries.length > 0 && (
                <span className="ksql-badge-count">{ksqlDashboardQueries.length}</span>
              )}
              <FiChevronDown size={14} className={`pool-chevron${ksqlDashboardOpen ? ' pool-chevron--open' : ''}`} />
            </button>
          )}
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
      {ksqlFeatureEnabled && isKsqlEnabled() && (
        <KsqlDashboard isOpen={ksqlDashboardOpen} />
      )}

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
        {activeNavItem !== 'workspace' && activeNavItem !== 'jobs' && activeNavItem !== 'ksql-queries' && activeNavItem !== 'learn' && (
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
                      <span className="settings-label">Unique ID</span>
                      <span className="settings-value">
                        <input
                          id="settings-unique-id-input"
                          type="text"
                          className="settings-input"
                          defaultValue={env.uniqueId || ''}
                          placeholder={env.uniqueId || 'e.g., F696969'}
                        />
                      </span>
                    </div>
                    <div className="settings-row">
                      <span className="settings-label">Catalog</span>
                      <span className="settings-value">
                        <select
                          id="settings-catalog-select"
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
                          id="settings-database-select"
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
                      <button id="settings-export-workspace-btn" className="settings-action-btn" onClick={handleExportWorkspace}>
                        Export Workspace
                      </button>
                      <button id="settings-import-workspace-btn" className="settings-action-btn" onClick={handleImportClick}>
                        Import Workspace
                      </button>
                    </div>
                  </div>

                  <div className="settings-section">
                    <span className="settings-section-title">Performance</span>
                    <p className="settings-help-text">
                      Controls how frequently Jobs and History data refreshes from the server.
                    </p>
                    <div className="settings-row">
                      <span className="settings-label">Data refresh interval</span>
                      <select
                        className="settings-select"
                        value={cacheTtlMinutes}
                        onChange={(e) => setCacheTtlMinutes(Number(e.target.value))}
                      >
                        <option value={1}>1 minute</option>
                        <option value={5}>5 minutes</option>
                        <option value={10}>10 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </div>
                    <div className="settings-row settings-row--actions">
                      <button className="settings-action-btn" onClick={clearCachedData}>
                        Clear Cached Data
                      </button>
                    </div>
                  </div>

                  <div className="settings-section">
                    <span className="settings-section-title">Feature Flags</span>
                    <div className="settings-row">
                      <span className="settings-label">ksqlDB Engine</span>
                      <span className="settings-value">
                        <label className="settings-toggle" title={!isKsqlConfigured() ? 'Configure VITE_KSQL_ENDPOINT, VITE_KSQL_API_KEY, and VITE_KSQL_API_SECRET in .env to enable' : undefined}>
                          <input
                            type="checkbox"
                            checked={ksqlFeatureEnabled && isKsqlConfigured()}
                            disabled={!isKsqlConfigured()}
                            onChange={(e) => setKsqlFeatureEnabled(e.target.checked)}
                          />
                          <span className="settings-toggle-slider" />
                        </label>
                      </span>
                    </div>
                    {!isKsqlConfigured() && (
                      <p className="settings-help-text">
                        ksqlDB requires VITE_KSQL_ENDPOINT, VITE_KSQL_API_KEY, and VITE_KSQL_API_SECRET configured in .env
                      </p>
                    )}
                  </div>

                  <div className="settings-section">
                    <span className="settings-section-title">Session Properties</span>
                    <p className="settings-help-text">
                      Flink SQL session properties applied to all statements.
                    </p>
                    <div className="property-editor">
                      {newPropertyKey === '__NEW__' && (
                        <div className="property-row property-row--new">
                          <input
                            id="settings-new-property-key"
                            type="text"
                            className="property-key"
                            placeholder="property key"
                            autoFocus
                            defaultValue=""
                            onBlur={(e) => {
                              if (!e.target.value.trim()) {
                                setNewPropertyKey('');
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setNewPropertyKey('');
                              }
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                const valueInput = document.getElementById('settings-new-property-value') as HTMLInputElement;
                                setSessionProperty((e.target as HTMLInputElement).value.trim(), valueInput?.value || '');
                                setNewPropertyKey('');
                              }
                            }}
                          />
                          <input
                            id="settings-new-property-value"
                            type="text"
                            className="property-value"
                            placeholder="value"
                            defaultValue=""
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const keyInput = document.getElementById('settings-new-property-key') as HTMLInputElement;
                                if (keyInput?.value?.trim()) {
                                  setSessionProperty(keyInput.value.trim(), e.currentTarget.value);
                                  setNewPropertyKey('');
                                }
                              } else if (e.key === 'Escape') {
                                setNewPropertyKey('');
                              }
                            }}
                          />
                          <button
                            className="property-delete-btn"
                            onClick={() => setNewPropertyKey('')}
                            title="Cancel"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      {Object.entries(sessionProperties).map(([key, value]) => (
                        <div key={key} className="property-row-group">
                          <div className="property-row">
                            <span className="property-key" title={SESSION_PROPERTY_HELP[key] || key}>{key}</span>
                            <input
                              id={`settings-session-property-${key.replace(/[^a-z0-9-]/gi, '-')}`}
                              type="text"
                              value={value}
                              onChange={(e) => setSessionProperty(key, e.target.value)}
                              className="property-value"
                              placeholder="value"
                            />
                            <button
                              id={`settings-session-property-delete-${key.replace(/[^a-z0-9-]/gi, '-')}`}
                              onClick={() => removeSessionProperty(key)}
                              className="property-delete-btn"
                              title="Remove property"
                            >
                              ×
                            </button>
                          </div>
                          {SESSION_PROPERTY_HELP[key] && (
                            <div className="property-help">{SESSION_PROPERTY_HELP[key]}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="property-actions">
                      <button
                        id="settings-add-property-btn"
                        onClick={() => {
                          setNewPropertyKey('__NEW__');
                        }}
                        className="settings-action-btn"
                      >
                        + Add Property
                      </button>
                      <button
                        id="settings-reset-properties-btn"
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
              {/* Examples panel moved to LearnPanel full-page view */}
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
          <Suspense fallback={null}>
          {activeNavItem === 'jobs' ? (
            <JobsPage />
          ) : activeNavItem === 'ksql-queries' ? (
            <KsqlQueriesPage />
          ) : activeNavItem === 'learn' ? (
            selectedExampleId ? <ExampleDetailPage /> : <LearnPanel />
          ) : selectedExampleId ? (
            <ExampleDetailPage />
          ) : (
            <>
              {/* Editor Cells or Empty State */}
              {statements.length === 0 ? (
                <div className="workspace-empty-state">
                  <img src="/img/fob-logo-sm.png" alt="Flafka squirrel" className="workspace-empty-logo" />
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
          </Suspense>

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
