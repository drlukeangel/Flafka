/**
 * workspaceStore.ts — The single Zustand store for the entire application.
 *
 * ALL app state lives here: SQL statements, sidebar navigation, compute pool status,
 * schema registry data, topic management, stream cards, artifacts, and settings.
 *
 * Architecture:
 *  - Uses a per-tab model: each tab has its own statements, tree data, and editor state
 *    (see `tabs` / `activeTabId` / `tabOrder` in the state interface).
 *  - Selected fields are persisted to localStorage via Zustand's `persist` middleware
 *    (configured with `partialize` at the bottom of this file).
 *  - Runtime-only fields (compute pool status, history, schema registry data, topics)
 *    are excluded from persistence and reset on page reload.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as flinkApi from '../api/flink-api';
import type { StatementResponse } from '../api/flink-api';
import * as telemetryApi from '../api/telemetry-api';
import { env } from '../config/environment';
import type { SQLStatement, StatementStatus, TreeNode, Column, Toast, NavItem, ConfigAuditEntry, Snippet, BackgroundStatement, FlinkArtifact, SchemaDataset, StatementTelemetry, SavedWorkspace, TabState, StreamCardEntry } from '../types';
import * as artifactApi from '../api/artifact-api';
import { validateWorkspaceJSON } from '../utils/workspace-export';
import * as schemaRegistryApi from '../api/schema-registry-api';
import * as topicApi from '../api/topic-api';
import { generateFunName, generateTopicStatementName, generateStatementName, getSessionTag } from '../utils/names';

// Humorous SQL-themed jokes displayed in the empty workspace state.
// Format: "-- SQL comment\nresult line" (parsed by App.tsx's parseJoke()).
const STARTER_JOKES = [
  "-- SELECT * FROM regrets WHERE action = 'DELETE ALL'\n-- Result: 1 row returned",
  "-- ROLLBACK\n-- ERROR: no transaction in progress. it's too late.",
  "-- SELECT meaning FROM empty_workspace\n-- ERROR: column \"meaning\" does not exist",
  "-- SELECT COUNT(tears) FROM this_moment\n-- Result: 1",
  "-- EXPLAIN DELETE FROM statements\n-- Plan: regret",
  "-- SELECT last_words FROM statements ORDER BY deleted_at DESC LIMIT 1\n-- Result: NULL",
  "-- SELECT * FROM genius_ideas WHERE committed = true\n-- 0 rows returned",
  "-- SELECT COUNT(*) FROM hope\n-- Result: 0",
  "-- ALTER TABLE workspace ADD COLUMN motivation VARCHAR\n-- ERROR: table 'workspace' is empty",
  "-- SELECT * FROM flink.jobs WHERE status = 'RUNNING'\n-- 0 rows returned (they're all CANCELLED now)",
  "-- SELECT undo FROM history WHERE feature = 'delete_all'\n-- ERROR: column \"undo\" does not exist",
  "-- DROP TABLE statements CASCADE\n-- SUCCESS — no going back now",
  "-- SELECT * FROM workspace WHERE hope IS NOT NULL\n-- 0 rows returned",
  "-- INSERT INTO workspace SELECT * FROM your_ideas\n-- waiting for upstream...",
  "-- WHERE did all the statements go?\n-- syntax error near \"WHERE\"",
  "-- SELECT purpose FROM workspace WHERE statements IS NULL\n-- Result: NULL",
  "-- CREATE STREAM thoughts FROM SOURCE your_brain\n-- waiting for upstream...",
  "-- SELECT salary FROM engineers WHERE they_feel_valued = true\n-- 0 rows returned",
  "-- SELECT * FROM production WHERE everything = 'fine'\n-- ERROR: table 'fine' does not exist",
  "-- SELECT work_life_balance FROM engineers\n-- ERROR: division by zero",
  "-- DESCRIBE TABLE legacy_code\n-- WARNING: schema unknown, author unknown, do not touch",
  "-- SELECT estimated_finish FROM project WHERE deadline = 'tomorrow'\n-- Result: next_quarter",
  "-- SELECT bugs FROM code WHERE i_wrote_it = true\n-- 0 rows returned (i checked twice)",
  "-- DELETE FROM todo_list WHERE priority = 'low'\n-- 847 rows deleted",
  "-- SELECT coffee_cups FROM today WHERE it_was_enough = true\n-- 0 rows returned",
  "-- EXPLAIN SELECT * FROM my_future\n-- Plan: undefined. Cost: high. Rows: unknown.",
  "-- SELECT * FROM meetings WHERE outcome IS NOT NULL\n-- 0 rows returned",
  "-- ALTER TABLE deadlines ADD COLUMN realistic BOOLEAN\n-- ERROR: type 'realistic' not found",
  "-- SELECT nap FROM schedule WHERE allowed = true\n-- 0 rows returned",
  "-- COMMIT\n-- WARNING: are you sure? this cannot be undone. (unlike your life choices)",
  "-- SELECT on_call FROM engineers WHERE it_is_friday = true\n-- 1 row returned (it me)",
  "-- SELECT * FROM stack_overflow WHERE answer_accepted = true AND year > 2019\n-- 0 rows returned",
  "-- DROP DATABASE production\n-- just kidding. or am i.",
  "-- SELECT confidence FROM junior_devs\n-- Result: 9999\n-- SELECT confidence FROM seniors\n-- Result: 2",
  "-- SELECT work FROM queue WHERE urgent = true AND also_important = true AND well_defined = true\n-- 0 rows returned",
  "-- TRUNCATE TABLE assumptions\n-- 10,847 rows deleted. you're welcome.",
  "-- SELECT * FROM documentation WHERE up_to_date = true\n-- 0 rows returned",
  "-- SELECT sleep FROM last_week WHERE hours > 7\n-- 0 rows returned",
  "-- INSERT INTO inbox SELECT * FROM slack\n-- ERROR: max_size exceeded. consider therapy.",
  "-- SELECT estimated_time FROM ticket WHERE accurate = true\n-- 0 rows returned",
];

export function randomStarterJoke(): string {
  return STARTER_JOKES[Math.floor(Math.random() * STARTER_JOKES.length)];
}
import type { SchemaSubject, KafkaTopic } from '../types';

export interface WorkspaceState {
  // ── Catalog & Database ──────────────────────────────────────────────────────
  catalog: string;
  database: string;
  catalogs: string[];
  databases: string[];

  // ── Tab Infrastructure (per-tab state) ──────────────────────────────────────
  tabs: Record<string, TabState>;
  activeTabId: string;
  tabOrder: string[];

  // ── UI / Toast Notifications ────────────────────────────────────────────────
  toasts: Toast[];
  sidebarCollapsed: boolean;

  // ── Sidebar / Navigation ────────────────────────────────────────────────────
  activeNavItem: NavItem;
  navExpanded: boolean;

  // ── Compute Pool (runtime only, not persisted) ───────────────────────────────
  computePoolPhase: string | null;
  computePoolCfu: number | null;
  computePoolMaxCfu: number | null;
  computePoolDashboardOpen: boolean;
  statementTelemetry: StatementTelemetry[];
  telemetryLoading: boolean;
  telemetryError: string | null;
  telemetryLastUpdated: Date | null;
  dashboardHeight: number;

  // ── Statement History (runtime only, not persisted) ──────────────────────────
  statementHistory: StatementResponse[];
  historyLoading: boolean;
  historyError: string | null;

  // ── Settings ─────────────────────────────────────────────────────────────────
  theme: 'light' | 'dark';
  hasSeenOnboardingHint: boolean;
  sessionProperties: Record<string, string>;

  // ── Schema Registry (runtime only, not persisted) ──────────────────────────
  schemaRegistrySubjects: string[];
  selectedSchemaSubject: SchemaSubject | null;
  schemaRegistryLoading: boolean;
  schemaRegistryError: string | null;
  // ORIG-8: Lazy cache of subject name → schemaType (populated on first click)
  schemaTypeCache: Record<string, string>;
  // Phase 12.6 F2: Lazy cache of subject name → compatibilityLevel (populated on first click)
  schemaCompatCache: Record<string, string>;

  // ── Topics (runtime only, not persisted) ─────────────────────────────────────
  topicList: KafkaTopic[];
  selectedTopic: KafkaTopic | null;
  topicLoading: boolean;
  topicError: string | null;
  // LOW-2: last-focused topic name for back-nav focus restore
  lastFocusedTopicName: string | null;
  // ENH-5: bulk delete state
  isBulkMode: boolean;
  bulkSelectedTopics: string[];

  // ── Actions ──────────────────────────────────────────────────────────────────
  setCatalog: (catalog: string) => void;
  setDatabase: (database: string) => void;
  setFocusedStatementId: (id: string | null) => void;
  loadCatalogs: () => Promise<void>;
  loadDatabases: (catalog: string) => Promise<void>;
  loadTreeData: () => Promise<void>;
  toggleTreeNode: (nodeId: string) => void;
  selectTreeNode: (nodeId: string) => void;
  loadTreeNodeChildren: (nodeId: string) => Promise<void>;
  loadTableSchema: (catalog: string, database: string, tableName: string) => Promise<void>;

  addStatement: (code?: string, afterId?: string, label?: string, overrides?: Partial<Pick<SQLStatement, 'status' | 'statementName' | 'startedAt'>>) => string;
  updateStatement: (id: string, code: string) => void;
  deleteStatement: (id: string) => void;
  duplicateStatement: (id: string) => void;
  toggleStatementCollapse: (id: string) => void;
  reorderStatements: (fromIndex: number, toIndex: number) => void;

  executeStatement: (id: string) => Promise<void>;
  resumeStatementPolling: (id: string) => Promise<void>;
  refreshStatementStatus: (id: string) => Promise<void>;
  cancelStatement: (id: string) => Promise<void>;
  stopAllStatements: () => Promise<void>;
  clearWorkspace: () => void;
  runAllStatements: () => Promise<void>;

  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleSidebar: () => void;
  setActiveNavItem: (item: NavItem) => void;
  toggleNavExpanded: () => void;
  toggleTheme: () => void;
  loadComputePoolStatus: () => Promise<void>;
  toggleComputePoolDashboard: () => void;
  loadStatementTelemetry: () => Promise<void>;
  stopDashboardStatement: (statementName: string) => Promise<void>;
  setDashboardHeight: (height: number) => void;
  loadStatementHistory: () => Promise<void>;
  clearHistoryError: () => void;
  setWorkspaceName: (name: string) => void;
  dismissOnboardingHint: () => void;
  importWorkspace: (fileData: unknown) => void;
  updateStatementLabel: (id: string, label: string) => void;
  setStatementScanMode: (id: string, mode: string | null, params?: { timestampMillis?: string; specificOffsets?: string; groupId?: string }) => void;
  setSessionProperty: (key: string, value: string) => void;
  removeSessionProperty: (key: string) => void;
  resetSessionProperties: () => void;
  loadSchemaRegistrySubjects: () => Promise<void>;
  loadSchemaDetail: (subject: string, version?: number | 'latest') => Promise<void>;
  clearSelectedSchema: () => void;
  setSchemaRegistryError: (error: string | null) => void;
  clearSchemaRegistryError: () => void;

  // Topic actions
  loadTopics: () => Promise<void>;
  selectTopic: (topic: KafkaTopic) => void;
  clearSelectedTopic: () => void;
  deleteTopic: (topicName: string) => Promise<void>;
  createTopic: (params: {
    topicName: string;
    partitionsCount: number;
    replicationFactor: number;
    cleanupPolicy?: 'delete' | 'compact';
    retentionMs?: number;
  }) => Promise<void>;
  setTopicError: (error: string | null) => void;
  navigateToSchemaSubject: (subjectName: string) => void;
  navigateToTopic: (topicName: string) => Promise<void>;
  // ENH-5: bulk delete actions
  enterBulkMode: () => void;
  exitBulkMode: () => void;
  toggleBulkTopicSelection: (topicName: string) => void;
  selectAllBulkTopics: () => void;
  clearBulkSelection: () => void;
  deleteTopicsBulk: (topicNames: string[]) => Promise<{ deleted: string[]; failed: string[] }>;
  // LOW-2: set last focused topic name for focus restore
  setLastFocusedTopicName: (name: string | null) => void;

  // Phase 12.6 — F1: Config Edit Audit Log (session only, not persisted)
  configAuditLog: ConfigAuditEntry[];
  addConfigAuditEntry: (entry: Omit<ConfigAuditEntry, 'timestamp'>) => void;
  getConfigAuditLogForTopic: (topicName: string) => ConfigAuditEntry[];

  // Phase 12.6 — F6: Query Templates / Saved SQL Snippets (persisted to localStorage)
  snippets: Snippet[];
  addSnippet: (name: string, sql: string) => { success: boolean; error?: string };
  deleteSnippet: (id: string) => void;
  renameSnippet: (id: string, newName: string) => void;

  // Workspace Notes actions (now per-tab, delegated to tab helpers)
  setWorkspaceNotes: (notes: string | null) => void;
  toggleWorkspaceNotes: () => void;
  updateSavedWorkspaceNotes: (id: string, notes: string) => void;

  // Saved Workspaces (persisted to localStorage)
  savedWorkspaces: SavedWorkspace[];
  saveCurrentWorkspace: (name: string, sourceTemplateId?: string, sourceTemplateName?: string, notes?: string) => void;
  openSavedWorkspace: (id: string) => Promise<void>;
  deleteSavedWorkspace: (id: string) => void;
  renameSavedWorkspace: (id: string, name: string) => void;
  updateStreamCardConfig: (id: string, updates: { mode?: 'consume' | 'produce-consume'; dataSource?: 'synthetic' | 'dataset'; selectedDatasetId?: string | null; scanMode?: 'earliest-offset' | 'latest-offset' }) => void;

  // Jobs Page (runtime only, NOT persisted)
  jobStatements: StatementResponse[];
  jobsLoading: boolean;
  jobsError: string | null;
  selectedJobName: string | null;
  selectedExampleId: string | null;

  // Jobs actions
  loadJobs: () => Promise<void>;
  cancelJob: (statementName: string) => Promise<void>;
  deleteJob: (statementName: string) => Promise<void>;
  navigateToJobDetail: (statementName: string) => void;
  navigateToExampleDetail: (cardId: string | null) => void;

  // Artifacts (runtime only, NOT persisted)
  artifactList: FlinkArtifact[];
  selectedArtifact: FlinkArtifact | null;
  artifactLoading: boolean;
  artifactUploading: boolean;
  uploadProgress: number | null;
  artifactError: string | null;

  // Artifact actions
  loadArtifacts: () => Promise<void>;
  selectArtifact: (artifact: FlinkArtifact) => void;
  clearSelectedArtifact: () => void;
  deleteArtifact: (id: string) => Promise<void>;
  setArtifactError: (error: string | null) => void;
  setArtifactUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number | null) => void;

  // Phase 13.1 — Stream Panel (runtime only, NOT persisted)
  streamsPanelOpen: boolean;

  // Schema test datasets (persisted)
  schemaDatasets: SchemaDataset[];

  // Cross-panel navigation (runtime only, NOT persisted)
  schemaInitialView: 'code' | 'tree' | 'datasets' | null;

  // Stream Panel actions
  toggleStreamsPanel: () => void;
  setStreamsPanelOpen: (open: boolean) => void;
  addStreamCard: (topicName: string, initialMode?: 'consume' | 'produce-consume', preselectedDatasetId?: string, datasetTemplate?: { type: string; count: number }) => void;
  removeStreamCard: (cardId: string) => void;
  removeStreamCardsByTopic: (topicName: string) => void;

  // Schema dataset actions
  addSchemaDataset: (dataset: SchemaDataset) => void;
  updateSchemaDataset: (id: string, updates: { name?: string; records?: Record<string, unknown>[] }) => void;
  deleteSchemaDataset: (id: string) => void;

  // Cross-panel navigation
  navigateToSchemaDatasets: (subject: string) => void;
  clearSchemaInitialView: () => void;

  executeBackgroundStatement: (contextId: string, sql: string, scanMode?: string, topicName?: string) => Promise<void>;
  cancelBackgroundStatement: (contextId: string) => Promise<void>;
  clearBackgroundStatements: () => Promise<void>;

  // Scoped stop/delete/run actions for split buttons
  stopAllStreams: () => Promise<void>;
  clearStatements: () => void;
  clearStreamCards: () => Promise<void>;

  // Signal pattern: StreamCard components watch these counters and self-start/stop
  runAllStreamsSignal: number;
  stopAllStreamsSignal: number;
  runAllStreams: () => void;

  // Resource Filtering (soft multi-tenancy)
  resourceFilterMode: 'unique' | 'all';
  setResourceFilterMode: (mode: 'unique' | 'all') => void;
  toggleResourceFilterMode: () => void;

  // Tab actions
  addTab: (name?: string) => string;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  renameTab: (id: string, name: string) => void;

  // Backward-compatible accessors (delegate to active tab)
  // These allow existing consumers to read state.statements, state.treeNodes, etc.
  statements: SQLStatement[];
  focusedStatementId: string | null;
  workspaceName: string;
  workspaceNotes: string | null;
  workspaceNotesOpen: boolean;
  lastSavedAt: string | null;
  streamCards: StreamCardEntry[];
  backgroundStatements: BackgroundStatement[];
  treeNodes: TreeNode[];
  selectedNodeId: string | null;
  treeLoading: boolean;
  selectedTableSchema: Column[];
  selectedTableName: string | null;
  schemaLoading: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const initialTabId = generateId();

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (rawSet, get) => {
      // Wrap set to auto-sync backward-compatible root-level mirrors from the active tab
      const syncMirrors = (state: WorkspaceState): Partial<WorkspaceState> => {
        const tab = state.tabs[state.activeTabId];
        if (!tab) return {};
        return {
          statements: tab.statements,
          focusedStatementId: tab.focusedStatementId,
          workspaceName: tab.workspaceName,
          workspaceNotes: tab.workspaceNotes,
          workspaceNotesOpen: tab.workspaceNotesOpen,
          lastSavedAt: tab.lastSavedAt,
          streamCards: tab.streamCards,
          backgroundStatements: tab.backgroundStatements,
          treeNodes: tab.treeNodes,
          selectedNodeId: tab.selectedNodeId,
          treeLoading: tab.treeLoading,
          selectedTableSchema: tab.selectedTableSchema,
          selectedTableName: tab.selectedTableName,
          schemaLoading: tab.schemaLoading,
        };
      };
      const set = ((updater: any, replace?: any) => {
        if (typeof updater === 'function') {
          rawSet((state: WorkspaceState) => {
            const partial = updater(state);
            const merged = { ...state, ...partial };
            return { ...partial, ...syncMirrors(merged as WorkspaceState) };
          }, replace);
        } else {
          rawSet((state: WorkspaceState) => {
            const merged = { ...state, ...updater };
            return { ...updater, ...syncMirrors(merged as WorkspaceState) };
          }, replace);
        }
      }) as typeof rawSet;

      // Tab helpers — internal use only
      const getTab = (tabId: string) => get().tabs[tabId];
      const activeTab = () => get().tabs[get().activeTabId];
      const setTab = (tabId: string, updates: Partial<TabState>) => {
        set(state => ({
          tabs: { ...state.tabs, [tabId]: { ...state.tabs[tabId], ...updates } }
        }));
      };
      const setActiveTab = (updates: Partial<TabState>) => {
        setTab(get().activeTabId, updates);
      };

      return {
      // Initial State
      catalog: env.flinkCatalog,
      database: env.flinkDatabase,
      catalogs: [env.flinkCatalog],
      databases: [env.flinkDatabase],

      // Tab infrastructure — build initial tab first so mirrors can reference same objects
      ...(() => {
        const _initialTab: TabState = {
          statements: [],
          focusedStatementId: null,
          workspaceName: 'Workspace',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        };
        return {
          tabs: { [initialTabId]: _initialTab },
          activeTabId: initialTabId,
          tabOrder: [initialTabId],
          // Backward-compatible mirrors — reference same objects as initial tab
          statements: _initialTab.statements,
          focusedStatementId: _initialTab.focusedStatementId,
          workspaceName: _initialTab.workspaceName,
          workspaceNotes: _initialTab.workspaceNotes,
          workspaceNotesOpen: _initialTab.workspaceNotesOpen,
          lastSavedAt: _initialTab.lastSavedAt,
          streamCards: _initialTab.streamCards,
          backgroundStatements: _initialTab.backgroundStatements,
          treeNodes: _initialTab.treeNodes,
          selectedNodeId: _initialTab.selectedNodeId,
          treeLoading: _initialTab.treeLoading,
          selectedTableSchema: _initialTab.selectedTableSchema,
          selectedTableName: _initialTab.selectedTableName,
          schemaLoading: _initialTab.schemaLoading,
        };
      })(),

      toasts: [],
      sidebarCollapsed: false,
      activeNavItem: 'workspace' as NavItem,
      navExpanded: false,
      theme: 'light',

      computePoolPhase: null,
      computePoolCfu: null,

      computePoolMaxCfu: null,
      computePoolDashboardOpen: false,
      statementTelemetry: [],
      telemetryLoading: false,
      telemetryError: null,
      telemetryLastUpdated: null,
      dashboardHeight: 280,

      statementHistory: [],
      historyLoading: false,
      historyError: null,

      hasSeenOnboardingHint: false,

      sessionProperties: {
        'sql.local-time-zone': 'UTC',
        'sql.execution.mode': 'streaming',
        'execution.checkpointing.mode': 'EXACTLY_ONCE',
      },

      schemaRegistrySubjects: [],
      selectedSchemaSubject: null,
      schemaRegistryLoading: false,
      schemaRegistryError: null,
      schemaTypeCache: {},
      schemaCompatCache: {},

      topicList: [],
      selectedTopic: null,
      topicLoading: false,
      topicError: null,
      lastFocusedTopicName: null,
      isBulkMode: false,
      bulkSelectedTopics: [],
      // Phase 12.6 — F1: Config Audit Log (session-scoped, not persisted)
      configAuditLog: [],

      // Phase 12.6 — F6: Snippets (persisted via partialize)
      snippets: [],

      // Saved Workspaces (persisted via partialize)
      savedWorkspaces: [],

      // Jobs Page (runtime only, NOT persisted)
      jobStatements: [],
      jobsLoading: false,
      jobsError: null,
      selectedJobName: null,
      selectedExampleId: null,

      // Artifacts (runtime only, NOT persisted)
      artifactList: [],
      selectedArtifact: null,
      artifactLoading: false,
      artifactUploading: false,
      uploadProgress: null,
      artifactError: null,

      // Phase 13.1 — Stream Panel (runtime only, NOT persisted)
      streamsPanelOpen: false,
      runAllStreamsSignal: 0,
      stopAllStreamsSignal: 0,

      // Resource Filtering — admin sees all by default
      resourceFilterMode: env.isAdmin ? 'all' : 'unique',

      // Schema test datasets (persisted)
      schemaDatasets: [],

      // Cross-panel navigation (runtime only, NOT persisted)
      schemaInitialView: null,

      // Catalog & Database Actions
      setCatalog: (catalog) => {
        set({ catalog });
        get().loadDatabases(catalog);
        get().loadTreeData();
      },

      setDatabase: (database) => {
        set({ database });
        get().loadTreeData();
      },

      loadCatalogs: async () => {
        try {
          const catalogs = await flinkApi.getCatalogs();
          set({ catalogs });
        } catch (error) {
          console.error('Failed to load catalogs:', error);
          get().addToast({ type: 'error', message: 'Failed to load catalogs' });
        }
      },

      loadDatabases: async (catalog) => {
        try {
          const databases = await flinkApi.getDatabases(catalog);
          set({ databases });
        } catch (error) {
          console.error('Failed to load databases:', error);
          get().addToast({ type: 'error', message: 'Failed to load databases' });
        }
      },

      // Tree Navigator Actions
      loadTreeData: async () => {
        const { catalog, database } = get();
        setActiveTab({ treeLoading: true });

        try {
          const [tables, views, functions] = await Promise.all([
            flinkApi.getTables(catalog, database),
            flinkApi.getViews(catalog, database),
            flinkApi.getFunctions(catalog, database),
          ]);

          const treeNodes: TreeNode[] = [
            {
              id: `${catalog}`,
              name: catalog,
              type: 'catalog',
              isExpanded: true,
              children: [
                {
                  id: `${catalog}.${database}`,
                  name: database,
                  type: 'database',
                  isExpanded: true,
                  metadata: { catalog },
                  children: [
                    {
                      id: `${catalog}.${database}.tables`,
                      name: 'Tables',
                      type: 'tables',
                      isExpanded: true,
                      metadata: { catalog, database },
                      children: tables.map((tableName) => ({
                        id: `${catalog}.${database}.table.${tableName}`,
                        name: tableName,
                        type: 'table' as const,
                        metadata: { catalog, database },
                      })),
                    },
                    {
                      id: `${catalog}.${database}.views`,
                      name: 'Views',
                      type: 'views',
                      isExpanded: false,
                      metadata: { catalog, database },
                      children: views.map((viewName) => ({
                        id: `${catalog}.${database}.view.${viewName}`,
                        name: viewName,
                        type: 'view' as const,
                        metadata: { catalog, database },
                      })),
                    },
                    {
                      id: `${catalog}.${database}.models`,
                      name: 'Models',
                      type: 'models',
                      isExpanded: false,
                      metadata: { catalog, database },
                      children: [],
                    },
                    {
                      id: `${catalog}.${database}.functions`,
                      name: 'Functions',
                      type: 'functions',
                      isExpanded: false,
                      metadata: { catalog, database },
                      children: functions.map((funcName) => ({
                        id: `${catalog}.${database}.function.${funcName}`,
                        name: funcName,
                        type: 'function' as const,
                        metadata: { catalog, database },
                      })),
                    },
                    {
                      id: `${catalog}.${database}.externalTables`,
                      name: 'External tables',
                      type: 'externalTables',
                      isExpanded: false,
                      metadata: { catalog, database },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ];

          setActiveTab({ treeNodes, treeLoading: false });
        } catch (error) {
          console.error('Failed to load tree data:', error);
          setActiveTab({ treeLoading: false });
          get().addToast({ type: 'error', message: 'Failed to load database objects' });
        }
      },

      toggleTreeNode: (nodeId) => {
        const tab = activeTab();
        setActiveTab({ treeNodes: toggleNodeExpanded(tab.treeNodes, nodeId) });
      },

      selectTreeNode: (nodeId) => {
        setActiveTab({ selectedNodeId: nodeId });
        const node = findNodeById(activeTab().treeNodes, nodeId);
        if (node && (node.type === 'table' || node.type === 'view')) {
          const catalog = node.metadata?.catalog;
          const database = node.metadata?.database;
          if (catalog && database) {
            setActiveTab({ selectedTableName: node.name });
            get().loadTableSchema(catalog, database, node.name);
          }
        } else {
          setActiveTab({ selectedTableName: null, selectedTableSchema: [] });
        }
      },

      loadTreeNodeChildren: async (nodeId) => {
        if (import.meta.env.DEV) {
          console.log('Load children for:', nodeId);
        }
      },

      loadTableSchema: async (catalog, database, tableName) => {
        setActiveTab({ schemaLoading: true, selectedTableSchema: [] });
        try {
          const schema = await flinkApi.getTableSchema(catalog, database, tableName);
          setActiveTab({ selectedTableSchema: schema, schemaLoading: false });
        } catch (error) {
          console.error('Failed to load table schema:', error);
          setActiveTab({ schemaLoading: false });
        }
      },

      // Statement Actions
      addStatement: (code, afterId, label, overrides) => {
        const { catalog, database } = get();
        const newId = generateId();
        const newStatement: SQLStatement = {
          id: newId,
          code: code || `-- Write your Flink SQL query here\nSELECT * FROM \`${catalog}\`.\`${database}\`.<table_name> LIMIT 10;`,
          status: overrides?.status || 'IDLE',
          createdAt: new Date(),
          label: label ?? generateFunName(),
          statementName: overrides?.statementName,
          startedAt: overrides?.startedAt,
        };
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          if (afterId) {
            const index = tab.statements.findIndex((s) => s.id === afterId);
            if (index !== -1) {
              const newStatements = [...tab.statements];
              newStatements.splice(index + 1, 0, newStatement);
              return { tabs: { ...state.tabs, [tabId]: { ...tab, statements: newStatements, lastSavedAt: new Date().toISOString() } } };
            }
          }
          return { tabs: { ...state.tabs, [tabId]: { ...tab, statements: [...tab.statements, newStatement], lastSavedAt: new Date().toISOString() } } };
        });
        return newId;
      },

      updateStatement: (id, code) => {
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
              s.id === id ? { ...s, code, updatedAt: new Date() } : s
            ), lastSavedAt: new Date().toISOString() } }
          };
        });
      },

      deleteStatement: (id) => {
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.filter((s) => s.id !== id), lastSavedAt: new Date().toISOString() } }
          };
        });
        get().addToast({ type: 'success', message: 'Statement deleted' });
      },

      duplicateStatement: (id) => {
        const tab = activeTab();
        const statement = tab.statements.find((s) => s.id === id);
        if (!statement) return;

        const newStatement: SQLStatement = {
          ...statement,
          id: generateId(),
          status: 'IDLE',
          results: undefined,
          error: undefined,
          statementName: undefined,
          startedAt: undefined,
          lastExecutedCode: null,
          updatedAt: undefined,
          label: statement.label ? `${statement.label}-copy` : undefined,
          createdAt: new Date(),
        };

        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          const sourceIndex = tab.statements.findIndex(s => s.id === id);
          const newStatements = [...tab.statements];
          newStatements.splice(sourceIndex + 1, 0, newStatement);
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: newStatements, lastSavedAt: new Date().toISOString() } }
          };
        });
      },

      toggleStatementCollapse: (id) => {
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
              s.id === id ? { ...s, isCollapsed: !s.isCollapsed } : s
            ) } }
          };
        });
      },

      reorderStatements: (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          const statements = [...tab.statements];
          const [removed] = statements.splice(fromIndex, 1);
          statements.splice(toIndex, 0, removed);
          return { tabs: { ...state.tabs, [tabId]: { ...tab, statements, lastSavedAt: new Date().toISOString() } } };
        });
      },

      // Execution Actions
      executeStatement: async (id) => {
        const tabId = get().activeTabId; // Capture tab at execution start
        const tab = getTab(tabId);
        const statement = tab.statements.find((s) => s.id === id);
        if (!statement) return;

        // Require a valid job name (label) before execution
        const jobName = statement.label?.trim();
        if (!jobName) {
          get().addToast({ type: 'warning', message: 'Enter a job name before running.' });
          return;
        }
        // Flink API: lowercase alphanumeric + hyphens, 1-72 chars, must start/end with alphanumeric
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(jobName) || jobName.length > 72) {
          get().addToast({ type: 'warning', message: 'Job name: lowercase letters, numbers, hyphens only (max 72 chars). Must start/end with a letter or number.' });
          return;
        }

        const submittedCode = statement.code;

        // Update status to PENDING
        set((state) => {
          const tab = state.tabs[tabId];
          if (!tab) return state;
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
              s.id === id ? { ...s, status: 'PENDING' as StatementStatus, error: undefined, results: undefined, startedAt: new Date(), lastExecutedCode: submittedCode } : s
            ) } }
          };
        });

        const startTime = Date.now();

        try {
          // Build execution properties: catalog/database + global session props + per-statement scan mode
          const { catalog, database, sessionProperties } = get();
          const execProps: Record<string, string> = {
            'sql.current-catalog': catalog,
            'sql.current-database': database,
            ...sessionProperties,
          };
          const scanMode = statement.scanMode || 'earliest-offset';
          execProps['sql.tables.scan.startup.mode'] = scanMode;
          if (scanMode === 'timestamp' && statement.scanTimestampMillis) {
            execProps['sql.tables.scan.startup.timestamp-millis'] = statement.scanTimestampMillis;
          }
          if (scanMode === 'specific-offsets' && statement.scanSpecificOffsets) {
            execProps['sql.tables.scan.startup.specific-offsets'] = statement.scanSpecificOffsets;
          }
          if (scanMode === 'group-offsets' && statement.scanGroupId) {
            execProps['properties.group.id'] = statement.scanGroupId;
          }

          // If restarting (same name exists on server), delete the old statement first
          if (statement.statementName === jobName) {
            try {
              await flinkApi.cancelStatement(jobName);
            } catch {
              // 404 = already gone, 409 = conflict — both OK to ignore
            }
          }

          // Execute the SQL — use the label as the Flink API statement name
          const result = await flinkApi.executeSQL(statement.code, jobName, execProps);
          const statementName = result.name;

          // Update with statement name and RUNNING status
          set((state) => {
            const tab = state.tabs[tabId];
            if (!tab) return state;
            return {
              tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                s.id === id ? { ...s, status: 'RUNNING' as StatementStatus, statementName } : s
              ) } }
            };
          });

          // Poll for results continuously.
          const maxAttempts = 600;
          let attempts = 0;
          let nextCursor: string | undefined;
          const MAX_ROWS = 5000;
          let allResults: Record<string, unknown>[] = [];
          let totalRowsReceived = 0;
          let columns: Column[] = [];
          const poll = async (): Promise<void> => {
            if (attempts >= maxAttempts) {
              throw new Error('Query timeout');
            }

            // Check if this statement was cancelled or re-executed
            const currentTab = getTab(tabId);
            if (!currentTab) return; // Tab was closed, orphaned poll
            const currentStatement = currentTab.statements.find((s) => s.id === id);
            if (!currentStatement) return; // Tab was closed, orphaned poll
            if (currentStatement.status === 'CANCELLED') {
              return;
            }

            const status = await flinkApi.getStatementStatus(statementName);
            const phase = status.status?.phase;

            if (phase === 'FAILED') {
              const errorDetail = await flinkApi.getStatementErrorDetail(statementName, status.status?.detail);
              throw new Error(errorDetail);
            }

            if (phase === 'CANCELLED') {
              return;
            }

            // INSERT INTO creates a persistent streaming job — no results to poll
            if (/^\s*INSERT\s+INTO/i.test(submittedCode) && phase === 'RUNNING') {
              get().addToast({
                type: 'info',
                message: 'Streaming job started — use Stop to end it',
              });
              return;
            }

            // Extract column names from traits.schema on first successful status check
            if (columns.length === 0 && status.status?.traits?.schema?.columns) {
              columns = status.status.traits.schema.columns.map((col) => ({
                name: col.name,
                type: col.type?.type || 'STRING',
                nullable: col.type?.nullable,
              }));
            }

            // Fetch results for both COMPLETED and RUNNING states
            if (phase === 'COMPLETED' || phase === 'RUNNING') {
              try {
                const resultsData = await flinkApi.getStatementResults(statementName, nextCursor);
                const rawRows = resultsData.results?.data || [];
                const rows = rawRows.map((item) => item.row || []);

                if (rows.length > 0) {
                  if (columns.length === 0) {
                    const firstRow = rows[0];
                    columns = firstRow.map((_: unknown, idx: number) => ({
                      name: `col_${idx}`,
                      type: 'STRING',
                    }));
                  }

                  const newResults = rows.map((row: unknown[]) => {
                    const obj: Record<string, unknown> = {};
                    row.forEach((val, idx) => {
                      const colName = columns[idx]?.name || `col_${idx}`;
                      obj[colName] = val;
                    });
                    return obj;
                  });

                  allResults = [...allResults, ...newResults];
                  totalRowsReceived += newResults.length;

                  if (allResults.length > MAX_ROWS) {
                    allResults = allResults.slice(allResults.length - MAX_ROWS);
                  }

                  const executionTime = Date.now() - startTime;

                  set((state) => {
                    const tab = state.tabs[tabId];
                    if (!tab) return state;
                    return {
                      tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                        s.id === id
                          ? {
                              ...s,
                              status: phase === 'COMPLETED' ? 'COMPLETED' as StatementStatus : 'RUNNING' as StatementStatus,
                              results: allResults,
                              columns,
                              executionTime,
                              totalRowsReceived,
                              lastExecutedAt: new Date(),
                            }
                          : s
                      ) } }
                    };
                  });

                  if (import.meta.env.DEV) {
                    console.log(`[Poll] Total: ${allResults.length} (+${newResults.length})`);
                  }
                }

                if (resultsData.metadata?.next) {
                  nextCursor = resultsData.metadata.next;
                }

                if (phase === 'COMPLETED' && !resultsData.metadata?.next) {
                  const executionTime = Date.now() - startTime;
                  set((state) => {
                    const tab = state.tabs[tabId];
                    if (!tab) return state;
                    return {
                      tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                        s.id === id
                          ? { ...s, status: 'COMPLETED' as StatementStatus, executionTime, lastExecutedAt: new Date() }
                          : s
                      ) } }
                    };
                  });
                  get().addToast({
                    type: 'success',
                    message: `Statement completed in ${(executionTime / 1000).toFixed(2)}s${allResults.length > 0 ? ` — ${allResults.length} rows` : ''}`,
                  });
                  return;
                }
              } catch (resultError) {
                if (import.meta.env.DEV) {
                  console.log('Results not ready yet:', resultError);
                }
              }
            }

            // DDL / empty-result completion
            if (phase === 'COMPLETED' && !nextCursor) {
              const executionTime = Date.now() - startTime;
              set((state) => {
                const tab = state.tabs[tabId];
                if (!tab) return state;
                return {
                  tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                    s.id === id
                      ? { ...s, status: 'COMPLETED' as StatementStatus, executionTime, lastExecutedAt: new Date() }
                      : s
                  ) } }
                };
              });
              get().addToast({
                type: 'success',
                message: `Statement completed in ${(executionTime / 1000).toFixed(2)}s`,
              });
              return;
            }

            // Continue polling
            if (phase !== 'COMPLETED' || nextCursor) {
              set((state) => {
                const tab = state.tabs[tabId];
                if (!tab) return state;
                return {
                  tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                    s.id === id && s.status !== 'CANCELLED' ? { ...s, status: 'RUNNING' as StatementStatus } : s
                  ) } }
                };
              });

              attempts++;
              await new Promise((resolve) => setTimeout(resolve, 1000));
              await poll();
            }
          };

          await poll();
        } catch (error) {
          const apiErr = error as { message?: string; details?: string };
          const errorMessage = [apiErr?.message, apiErr?.details].filter(Boolean).join(': ') || (error instanceof Error ? error.message : 'Unknown error');
          set((state) => {
            const tab = state.tabs[tabId];
            if (!tab) return state;
            return {
              tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                s.id === id ? { ...s, status: 'ERROR' as StatementStatus, error: errorMessage } : s
              ) } }
            };
          });
          get().addToast({ type: 'error', message: errorMessage });
        }
      },

      // Resume polling for a statement that is already running on the server (e.g. after page refresh)
      resumeStatementPolling: async (id) => {
        const tabId = get().activeTabId; // Capture tab at execution start
        const tab = getTab(tabId);
        const statement = tab?.statements.find((s) => s.id === id);
        if (!statement?.statementName || statement.status !== 'RUNNING') return;

        const statementName = statement.statementName;
        const submittedCode = statement.code;
        const startTime = statement.startedAt ? new Date(statement.startedAt).getTime() : Date.now();
        const MAX_ROWS = 5000;
        let allResults: Record<string, unknown>[] = [];
        let totalRowsReceived = 0;
        let columns: Column[] = [];
        let nextCursor: string | undefined;
        let attempts = 0;
        const maxAttempts = 600;

        // INSERT INTO: check API status once to verify still running, but don't poll for results
        if (/^\s*INSERT\s+INTO/i.test(submittedCode)) {
          try {
            const status = await flinkApi.getStatementStatus(statementName);
            const phase = status.status?.phase;
            if (phase !== 'RUNNING' && phase !== 'PENDING') {
              const newStatus = phase === 'FAILED' ? 'ERROR' as const :
                                phase === 'CANCELLED' ? 'CANCELLED' as const : 'COMPLETED' as const;
              const errorDetail = phase === 'FAILED' ? await flinkApi.getStatementErrorDetail(statementName, status.status?.detail) : undefined;
              set((state) => {
                const tab = state.tabs[tabId];
                if (!tab) return state;
                return {
                  tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                    s.id === id ? { ...s, status: newStatus, lastExecutedAt: new Date(), error: errorDetail } : s
                  ) } }
                };
              });
            }
          } catch {
            // API check failed — keep showing RUNNING, user can manually stop
          }
          return;
        }

        try {
          const poll = async (): Promise<void> => {
            if (attempts >= maxAttempts) throw new Error('Query timeout');

            const currentTab = getTab(tabId);
            if (!currentTab) return; // Tab was closed, orphaned poll
            const currentStatement = currentTab.statements.find((s) => s.id === id);
            if (!currentStatement) return; // Tab was closed, orphaned poll
            if (currentStatement.status === 'CANCELLED') return;

            const status = await flinkApi.getStatementStatus(statementName);
            const phase = status.status?.phase;

            if (phase === 'FAILED') {
              const errorDetail = await flinkApi.getStatementErrorDetail(statementName, status.status?.detail);
              throw new Error(errorDetail);
            }
            if (phase === 'CANCELLED' || (phase as string) === 'STOPPED') {
              set((state) => {
                const tab = state.tabs[tabId];
                if (!tab) return state;
                return {
                  tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                    s.id === id ? { ...s, status: 'CANCELLED' as StatementStatus, lastExecutedAt: new Date() } : s
                  ) } }
                };
              });
              return;
            }

            // Extract columns from schema
            if (columns.length === 0 && status.status?.traits?.schema?.columns) {
              columns = status.status.traits.schema.columns.map((col) => ({
                name: col.name,
                type: col.type?.type || 'STRING',
                nullable: col.type?.nullable,
              }));
            }

            if (phase === 'COMPLETED' || phase === 'RUNNING') {
              try {
                const resultsData = await flinkApi.getStatementResults(statementName, nextCursor);
                const rawRows = resultsData.results?.data || [];
                const rows = rawRows.map((item) => item.row || []);

                if (rows.length > 0) {
                  if (columns.length === 0) {
                    columns = rows[0].map((_: unknown, idx: number) => ({ name: `col_${idx}`, type: 'STRING' }));
                  }
                  const newResults = rows.map((row: unknown[]) => {
                    const obj: Record<string, unknown> = {};
                    row.forEach((val, idx) => {
                      obj[columns[idx]?.name || `col_${idx}`] = val;
                    });
                    return obj;
                  });

                  allResults = [...allResults, ...newResults];
                  totalRowsReceived += newResults.length;
                  if (allResults.length > MAX_ROWS) allResults = allResults.slice(allResults.length - MAX_ROWS);

                  set((state) => {
                    const tab = state.tabs[tabId];
                    if (!tab) return state;
                    return {
                      tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                        s.id === id ? { ...s, status: phase as StatementStatus, results: allResults, columns, executionTime: Date.now() - startTime, totalRowsReceived, lastExecutedAt: new Date() } : s
                      ) } }
                    };
                  });
                }

                if (resultsData.metadata?.next) nextCursor = resultsData.metadata.next;

                if (phase === 'COMPLETED' && !resultsData.metadata?.next) {
                  set((state) => {
                    const tab = state.tabs[tabId];
                    if (!tab) return state;
                    return {
                      tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                        s.id === id ? { ...s, status: 'COMPLETED' as StatementStatus, executionTime: Date.now() - startTime, lastExecutedAt: new Date() } : s
                      ) } }
                    };
                  });
                  return;
                }
              } catch {
                // Results not ready yet
              }
            }

            if (phase === 'COMPLETED' && !nextCursor) {
              set((state) => {
                const tab = state.tabs[tabId];
                if (!tab) return state;
                return {
                  tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                    s.id === id ? { ...s, status: 'COMPLETED' as StatementStatus, executionTime: Date.now() - startTime, lastExecutedAt: new Date() } : s
                  ) } }
                };
              });
              return;
            }

            if (phase !== 'COMPLETED' || nextCursor) {
              attempts++;
              await new Promise((resolve) => setTimeout(resolve, 1000));
              await poll();
            }
          };

          await poll();
        } catch (error) {
          const apiErr = error as { message?: string; details?: string };
          const errorMessage = [apiErr?.message, apiErr?.details].filter(Boolean).join(': ') || (error instanceof Error ? error.message : 'Unknown error');
          set((state) => {
            const tab = state.tabs[tabId];
            if (!tab) return state;
            return {
              tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                s.id === id ? { ...s, status: 'ERROR' as StatementStatus, error: errorMessage } : s
              ) } }
            };
          });
        }
      },

      refreshStatementStatus: async (id) => {
        const tab = activeTab();
        const statement = tab.statements.find((s) => s.id === id);
        if (!statement?.statementName) return;
        try {
          const apiStatus = await flinkApi.getStatementStatus(statement.statementName);
          const phase = apiStatus.status?.phase;
          if (!phase) return;
          const statusMap: Record<string, StatementStatus> = {
            RUNNING: 'RUNNING', PENDING: 'PENDING', COMPLETED: 'COMPLETED',
            FAILED: 'ERROR', CANCELLED: 'CANCELLED', STOPPED: 'CANCELLED',
          };
          const newStatus = statusMap[phase] || statement.status;
          if (newStatus !== statement.status) {
            const errorDetail = phase === 'FAILED' ? await flinkApi.getStatementErrorDetail(statement.statementName, apiStatus.status?.detail) : undefined;
            set((state) => {
              const tabId = state.activeTabId;
              const tab = state.tabs[tabId];
              return {
                tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
                  s.id === id ? {
                    ...s,
                    status: newStatus,
                    lastExecutedAt: newStatus !== 'RUNNING' && newStatus !== 'PENDING' ? new Date() : s.lastExecutedAt,
                    error: errorDetail,
                  } : s
                ) } }
              };
            });
            get().addToast({ type: 'info', message: `${statement.statementName}: ${phase}` });
          } else {
            get().addToast({ type: 'info', message: `Status confirmed: ${phase}` });
          }
        } catch {
          get().addToast({ type: 'error', message: 'Failed to check statement status' });
        }
      },

      cancelStatement: async (id) => {
        const tab = activeTab();
        const statement = tab.statements.find((s) => s.id === id);

        // Always update local state to CANCELLED so user can re-run
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
              s.id === id ? { ...s, status: 'CANCELLED' as StatementStatus, lastExecutedAt: new Date() } : s
            ) } }
          };
        });
        get().addToast({ type: 'info', message: 'Query cancelled' });

        // Try to cancel on the server if we have a statement name
        if (statement?.statementName) {
          try {
            await flinkApi.cancelStatement(statement.statementName);
          } catch (error) {
            console.error('Failed to cancel statement on server:', error);
          }
        }
      },

      runAllStatements: async () => {
        const tab = activeTab();
        const eligible = tab.statements.filter(
          (s) => s.status === 'IDLE' || s.status === 'ERROR' || s.status === 'CANCELLED'
        );
        if (eligible.length === 0) return;

        get().addToast({ type: 'info', message: `Running ${eligible.length} statement(s)...` });

        for (const statement of eligible) {
          const current = activeTab().statements.find((s) => s.id === statement.id);
          if (!current || current.status === 'RUNNING' || current.status === 'PENDING') continue;
          await get().executeStatement(statement.id);
        }
      },

      stopAllStatements: async () => {
        const tab = activeTab();
        const active = tab.statements.filter((s) => s.status === 'RUNNING' || s.status === 'PENDING');
        if (active.length === 0) return;

        // Optimistically mark all as CANCELLED
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
              s.status === 'RUNNING' || s.status === 'PENDING'
                ? { ...s, status: 'CANCELLED' as StatementStatus, lastExecutedAt: new Date() }
                : s
            ) } }
          };
        });
        get().addToast({ type: 'info', message: `Stopped ${active.length} statement(s)` });

        await Promise.allSettled(
          active
            .filter((s) => s.statementName)
            .map((s) => flinkApi.cancelStatement(s.statementName!))
        );
      },

      clearWorkspace: () => {
        const tab = activeTab();
        // Cancel running statements server-side (best-effort)
        tab.statements
          .filter((s) => (s.status === 'RUNNING' || s.status === 'PENDING') && s.statementName)
          .forEach((s) => flinkApi.cancelStatement(s.statementName!).catch(() => {}));

        // Cancel background statements for stream cards
        tab.backgroundStatements
          .filter((s) => s.status === 'RUNNING' || s.status === 'PENDING')
          .forEach((s) => flinkApi.cancelStatement(s.statementName).catch(() => {}));

        setActiveTab({
          statements: [],
          streamCards: [],
          backgroundStatements: [],
          workspaceNotes: null,
          workspaceNotesOpen: false,
        });
        get().addToast({ type: 'info', message: 'Workspace cleared' });
      },

      // Toast Actions
      addToast: (toast) => {
        const id = generateId();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        setTimeout(() => {
          get().removeToast(id);
        }, toast.duration || 5000);
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setActiveNavItem: (item) => {
        set({ activeNavItem: item });
      },

      setResourceFilterMode: (mode) => {
        set({ resourceFilterMode: mode });
      },

      toggleResourceFilterMode: () => {
        const next = get().resourceFilterMode === 'unique' ? 'all' : 'unique';
        set({ resourceFilterMode: next });
      },

      toggleNavExpanded: () => {
        set((state) => ({ navExpanded: !state.navExpanded }));
      },

      toggleTheme: () => {
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' }));
      },

      // Compute Pool Status Action
      loadComputePoolStatus: async () => {
        try {
          const status = await flinkApi.getComputePoolStatus();
          set({ computePoolPhase: status.phase, computePoolCfu: status.currentCfu, computePoolMaxCfu: status.maxCfu });
        } catch (error) {
          console.error('Failed to load compute pool status:', error);
          set({ computePoolPhase: 'UNKNOWN', computePoolCfu: null, computePoolMaxCfu: null });
        }
      },

      toggleComputePoolDashboard: () => {
        const isOpen = !get().computePoolDashboardOpen;
        set({ computePoolDashboardOpen: isOpen });
        if (isOpen) {
          get().loadStatementTelemetry();
        }
      },

      loadStatementTelemetry: async () => {
        set({ telemetryLoading: true, telemetryError: null });
        try {
          // Collect workspace statement names for origin tagging
          const tab = activeTab();
          const wsNames = tab.statements
            .filter((s) => s.statementName)
            .map((s) => s.statementName!);
          const telemetry = await telemetryApi.getStatementTelemetry(wsNames);
          set({
            statementTelemetry: telemetry,
            telemetryLoading: false,
            telemetryLastUpdated: new Date(),
          });
        } catch (error: unknown) {
          const err = error as { message?: string };
          set({
            telemetryError: err?.message || 'Failed to load telemetry',
            telemetryLoading: false,
          });
        }
      },

      stopDashboardStatement: async (statementName: string) => {
        try {
          await flinkApi.cancelStatement(statementName);
          get().addToast({ type: 'success', message: `Stopped ${statementName}` });
          get().loadStatementTelemetry();
        } catch (error: unknown) {
          const err = error as { message?: string; status?: number };
          if (err?.status === 409) {
            get().addToast({ type: 'info', message: `${statementName} already stopped` });
            get().loadStatementTelemetry();
          } else {
            const msg = (error as { details?: string })?.details || err?.message || 'Failed to stop statement';
            get().addToast({ type: 'error', message: msg });
          }
        }
      },

      setDashboardHeight: (height: number) => {
        set({ dashboardHeight: Math.min(Math.max(height, 120), 600) });
      },

      // Statement History Actions
      loadStatementHistory: async () => {
        set({ historyLoading: true, historyError: null });
        try {
          const filterId = get().resourceFilterMode === 'unique' ? getSessionTag() : undefined;
          const statements = await flinkApi.listStatements(100, (accumulated) => {
            set({ statementHistory: accumulated });
          }, 100, filterId);
          set({ statementHistory: statements, historyLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load statement history';
          console.error('Failed to load statement history:', error);
          set({ historyError: errorMessage, historyLoading: false });
        }
      },

      clearHistoryError: () => {
        set({ historyError: null });
      },

      setWorkspaceName: (name) => {
        setActiveTab({ workspaceName: name });
      },

      setFocusedStatementId: (id) => {
        setActiveTab({ focusedStatementId: id });
      },

      dismissOnboardingHint: () => {
        set({ hasSeenOnboardingHint: true });
      },

      importWorkspace: (fileData) => {
        const validation = validateWorkspaceJSON(fileData);
        if (!validation.valid) {
          throw new Error(`Invalid workspace file: ${validation.errors.join(', ')}`);
        }

        const data = fileData as { statements: Array<{ id: string; code: string; createdAt: string; isCollapsed?: boolean; lastExecutedCode?: string | null }>; catalog: string; database: string; workspaceName: string };

        const newTabId = generateId();
        const newTab: TabState = {
          statements: data.statements.map((s) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            code: s.code,
            status: 'IDLE' as const,
            createdAt: new Date(s.createdAt),
            isCollapsed: s.isCollapsed,
            lastExecutedCode: s.lastExecutedCode ?? null,
          })),
          focusedStatementId: null,
          workspaceName: data.workspaceName,
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: new Date().toISOString(),
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        };

        set((state) => ({
          tabs: { ...state.tabs, [newTabId]: newTab },
          tabOrder: [...state.tabOrder, newTabId],
          activeTabId: newTabId,
          catalog: data.catalog,
          database: data.database,
        }));

        try {
          get().loadTreeData();
        } catch (error) {
          console.warn('Failed to load tree data after import:', error);
        }
      },

      updateStatementLabel: (id, label) => {
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
              s.id === id
                ? { ...s, label: label.trim() === '' ? undefined : label.trim() }
                : s
            ), lastSavedAt: new Date().toISOString() } }
          };
        });
      },

      setStatementScanMode: (id, mode, params) => {
        set((state) => {
          const tabId = state.activeTabId;
          const tab = state.tabs[tabId];
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, statements: tab.statements.map((s) =>
              s.id === id
                ? {
                    ...s,
                    scanMode: mode ?? undefined,
                    scanTimestampMillis: mode === 'timestamp' ? params?.timestampMillis : undefined,
                    scanSpecificOffsets: mode === 'specific-offsets' ? params?.specificOffsets : undefined,
                    scanGroupId: mode === 'group-offsets' ? params?.groupId : undefined,
                  }
                : s
            ), lastSavedAt: new Date().toISOString() } }
          };
        });
      },

      setSessionProperty: (key, value) => {
        const trimmedKey = key.trim();
        if (!trimmedKey) return;

        const reserved = ['sql.current-catalog', 'sql.current-database'];
        if (reserved.includes(trimmedKey)) {
          get().addToast({ type: 'error', message: `Cannot override reserved property: ${trimmedKey}`, duration: 3000 });
          return;
        }

        set(state => ({
          sessionProperties: {
            ...state.sessionProperties,
            [trimmedKey]: value,
          },
        }));
      },

      removeSessionProperty: (key) => {
        set(state => {
          const updated = { ...state.sessionProperties };
          delete updated[key];
          return { sessionProperties: updated };
        });
      },

      resetSessionProperties: () => {
        set({
          sessionProperties: {
            'sql.local-time-zone': 'UTC',
            'sql.execution.mode': 'streaming',
            'execution.checkpointing.mode': 'EXACTLY_ONCE',
          },
        });
      },

      loadSchemaRegistrySubjects: async () => {
        set({ schemaRegistryLoading: true, schemaRegistryError: null });
        try {
          const filterId = get().resourceFilterMode === 'unique' ? getSessionTag() : undefined;
          const subjects = await schemaRegistryApi.listSubjects(filterId);
          set({ schemaRegistrySubjects: subjects, schemaRegistryLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load schemas';
          console.error('Failed to load schema subjects:', error);
          set({ schemaRegistryError: errorMessage, schemaRegistryLoading: false });
        }
      },

      loadSchemaDetail: async (subject, version = 'latest') => {
        const requestId = `${subject}-${version}-${Date.now()}`;
        (get() as unknown as Record<string, string>)._schemaDetailRequestId = requestId;
        set({ schemaRegistryLoading: true, schemaRegistryError: null });
        try {
          const detail = await schemaRegistryApi.getSchemaDetail(subject, version);
          if ((get() as unknown as Record<string, string>)._schemaDetailRequestId !== requestId) return;
          const existingCache = get().schemaTypeCache;
          const updatedCache = { ...existingCache, [detail.subject]: detail.schemaType };
          const existingCompatCache = get().schemaCompatCache;
          const updatedCompatCache = detail.compatibilityLevel
            ? { ...existingCompatCache, [detail.subject]: detail.compatibilityLevel }
            : existingCompatCache;
          set({
            selectedSchemaSubject: detail,
            schemaRegistryLoading: false,
            schemaTypeCache: updatedCache,
            schemaCompatCache: updatedCompatCache,
          });
        } catch (error) {
          if ((get() as unknown as Record<string, string>)._schemaDetailRequestId !== requestId) return;
          const errorMessage = error instanceof Error ? error.message : 'Failed to load schema detail';
          console.error('Failed to load schema detail:', error);
          set({ schemaRegistryError: errorMessage, schemaRegistryLoading: false });
        }
      },

      clearSelectedSchema: () => {
        set({ selectedSchemaSubject: null, schemaRegistryError: null });
      },

      setSchemaRegistryError: (error) => {
        set({ schemaRegistryError: error });
      },

      clearSchemaRegistryError: () => {
        set({ schemaRegistryError: null });
      },

      // Topic Actions
      loadTopics: async () => {
        set({ topicLoading: true, topicError: null });
        try {
          const filterId = get().resourceFilterMode === 'unique' ? getSessionTag() : undefined;
          const topics = await topicApi.listTopics(filterId);
          set({ topicList: topics, topicLoading: false });
        } catch (error) {
          let errorMessage = 'Failed to load topics';

          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status: number } | undefined };
            if (axiosError.response === undefined) {
              errorMessage = 'Cannot connect to Kafka REST endpoint.';
            } else if (axiosError.response?.status === 401) {
              errorMessage = 'Authentication failed. Check API key and secret.';
            } else if (axiosError.response?.status === 403) {
              errorMessage = 'Permission denied. Check API key permissions.';
            }
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }

          console.error('Failed to load topics:', error);
          set({ topicError: errorMessage, topicLoading: false, topicList: [] });
        }
      },

      selectTopic: (topic) => {
        set({ selectedTopic: topic, lastFocusedTopicName: topic.topic_name });
      },

      clearSelectedTopic: () => {
        set({ selectedTopic: null });
      },

      createTopic: async (params) => {
        // Automatically tag topic name with uniqueId for filtering
        const suffix = `-${getSessionTag()}`;
        const topicName = params.topicName.endsWith(suffix) 
          ? params.topicName 
          : `${params.topicName}${suffix}`;

        const request: {
          topic_name: string;
          partitions_count: number;
          replication_factor: number;
          configs?: Array<{ name: string; value: string }>;
        } = {
          topic_name: topicName,
          partitions_count: params.partitionsCount,
          replication_factor: params.replicationFactor,
        };

        if (params.cleanupPolicy !== undefined || params.retentionMs !== undefined) {
          const configs: Array<{ name: string; value: string }> = [];
          if (params.cleanupPolicy !== undefined) {
            configs.push({ name: 'cleanup.policy', value: params.cleanupPolicy });
          }
          if (params.retentionMs !== undefined) {
            configs.push({ name: 'retention.ms', value: String(params.retentionMs) });
          }
          request.configs = configs;
        }

        await topicApi.createTopic(request);
        await get().loadTopics();
      },

      deleteTopic: async (topicName) => {
        set((state) => ({
          topicList: state.topicList.filter((t) => t.topic_name !== topicName),
        }));
        await topicApi.deleteTopic(topicName);
      },

      setTopicError: (error) => {
        set({ topicError: error });
      },

      setLastFocusedTopicName: (name) => {
        set({ lastFocusedTopicName: name });
      },

      // ENH-5: bulk delete actions
      enterBulkMode: () => {
        set({ isBulkMode: true, bulkSelectedTopics: [] });
      },

      exitBulkMode: () => {
        set({ isBulkMode: false, bulkSelectedTopics: [] });
      },

      toggleBulkTopicSelection: (topicName) => {
        set((state) => {
          const idx = state.bulkSelectedTopics.indexOf(topicName);
          if (idx === -1) {
            return { bulkSelectedTopics: [...state.bulkSelectedTopics, topicName] };
          } else {
            return {
              bulkSelectedTopics: state.bulkSelectedTopics.filter((n) => n !== topicName),
            };
          }
        });
      },

      selectAllBulkTopics: () => {
        set((state) => ({ bulkSelectedTopics: state.topicList.map((t) => t.topic_name) }));
      },

      clearBulkSelection: () => {
        set({ bulkSelectedTopics: [] });
      },

      deleteTopicsBulk: async (topicNames) => {
        set((state) => ({
          topicList: state.topicList.filter((t) => !topicNames.includes(t.topic_name)),
          isBulkMode: false,
          bulkSelectedTopics: [],
        }));
        const deleted: string[] = [];
        const failed: string[] = [];
        for (const name of topicNames) {
          try {
            await topicApi.deleteTopic(name);
            deleted.push(name);
          } catch {
            failed.push(name);
          }
        }
        await get().loadTopics();
        return { deleted, failed };
      },

      navigateToSchemaSubject: (subjectName) => {
        set({ activeNavItem: 'schemas' });
        get().loadSchemaDetail(subjectName, 'latest');
      },

      navigateToTopic: async (topicName) => {
        set({ activeNavItem: 'topics' });
        let list = get().topicList;
        if (list.length === 0) {
          await get().loadTopics();
          list = get().topicList;
        }
        const match = list.find((t) => t.topic_name === topicName);
        if (match) {
          get().selectTopic(match);
        } else {
          set({ selectedTopic: null });
        }
      },

      // Phase 12.6 — F1: Config Audit Log Actions
      addConfigAuditEntry: (entry) => {
        const timestamp = new Date().toISOString();
        set((state) => {
          const newEntry: ConfigAuditEntry = { ...entry, timestamp };
          const updated = [newEntry, ...state.configAuditLog];
          return { configAuditLog: updated.slice(0, 200) };
        });
      },

      getConfigAuditLogForTopic: (topicName) => {
        return get().configAuditLog.filter((e) => e.topicName === topicName);
      },

      // Phase 12.6 — F6: Snippet Actions
      addSnippet: (name, sql) => {
        const { snippets } = get();
        if (snippets.length >= 100) {
          return { success: false, error: 'Snippet limit reached (100). Delete existing snippets to add new ones.' };
        }
        const now = new Date().toISOString();
        const newSnippet: Snippet = {
          id: crypto.randomUUID(),
          name,
          sql,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          snippets: [...state.snippets, newSnippet].sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        }));
        return { success: true };
      },

      deleteSnippet: (id) => {
        set((state) => ({
          snippets: state.snippets.filter((s) => s.id !== id),
        }));
      },

      renameSnippet: (id, newName) => {
        if (!newName.trim()) return;
        set((state) => ({
          snippets: state.snippets
            .map((s) =>
              s.id === id
                ? { ...s, name: newName.trim(), updatedAt: new Date().toISOString() }
                : s
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
      },

      // Saved Workspace actions
      saveCurrentWorkspace: (name, sourceTemplateId, sourceTemplateName, notes) => {
        const tab = activeTab();
        const { savedWorkspaces } = get();
        const existingIndex = savedWorkspaces.findIndex((w) => w.name === name);
        if (existingIndex === -1 && savedWorkspaces.length >= 20) {
          get().addToast({ type: 'error', message: 'Max 20 workspaces reached — delete one first' });
          return;
        }
        const now = new Date().toISOString();
        const statementsSnapshot = tab.statements.map((s) => ({
          id: s.id,
          code: s.code,
          label: s.label,
          isCollapsed: s.isCollapsed,
          scanMode: s.scanMode,
          scanTimestampMillis: s.scanTimestampMillis,
          scanSpecificOffsets: s.scanSpecificOffsets,
          scanGroupId: s.scanGroupId,
          ...(s.status === 'RUNNING' && s.statementName ? { statementName: s.statementName } : {}),
        }));
        const streamCardsSnapshot = tab.streamCards.map((c) => ({
          topicName: c.topicName,
          mode: c.mode ?? c.initialMode ?? 'consume',
          dataSource: c.dataSource ?? 'synthetic',
          selectedDatasetId: c.selectedDatasetId ?? null,
          scanMode: c.scanMode ?? 'earliest-offset',
          ...(c.datasetTemplate ? { datasetTemplate: c.datasetTemplate } : {}),
        }));
        const isUpsert = existingIndex !== -1;
        let snapshot: SavedWorkspace;
        if (isUpsert) {
          const existing = savedWorkspaces[existingIndex];
          snapshot = {
            ...existing,
            updatedAt: now,
            statementCount: tab.statements.length,
            streamCardCount: tab.streamCards.length,
            ...(sourceTemplateId ? { sourceTemplateId } : {}),
            ...(sourceTemplateName ? { sourceTemplateName } : {}),
            notes: notes ?? existing.notes,
            statements: statementsSnapshot,
            streamCards: streamCardsSnapshot,
          };
        } else {
          snapshot = {
            id: crypto.randomUUID(),
            name,
            createdAt: now,
            updatedAt: now,
            statementCount: tab.statements.length,
            streamCardCount: tab.streamCards.length,
            ...(sourceTemplateId ? { sourceTemplateId } : {}),
            ...(sourceTemplateName ? { sourceTemplateName } : {}),
            ...(notes ? { notes } : {}),
            statements: statementsSnapshot,
            streamCards: streamCardsSnapshot,
          };
        }
        try {
          if (isUpsert) {
            const updated = [...get().savedWorkspaces];
            updated[existingIndex] = snapshot;
            set({ savedWorkspaces: updated });
          } else {
            set({ savedWorkspaces: [...get().savedWorkspaces, snapshot] });
          }
          setActiveTab({ lastSavedAt: new Date().toISOString() });
          if (!sourceTemplateId) {
            get().addToast({ type: 'success', message: isUpsert ? `Workspace "${name}" updated` : `Workspace "${name}" saved` });
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            get().addToast({ type: 'error', message: 'Storage full — delete some saved workspaces first' });
          }
        }
      },

      // Workspace Notes actions
      setWorkspaceNotes: (notes) => {
        setActiveTab({
          workspaceNotes: notes,
          ...(notes !== null ? { workspaceNotesOpen: true } : {}),
        });
      },

      toggleWorkspaceNotes: () => {
        const tab = activeTab();
        setActiveTab({ workspaceNotesOpen: !tab.workspaceNotesOpen });
      },

      updateSavedWorkspaceNotes: (id, notes) => {
        set((state) => ({
          savedWorkspaces: state.savedWorkspaces.map((w) =>
            w.id === id ? { ...w, notes, updatedAt: new Date().toISOString() } : w
          ),
        }));
      },

      openSavedWorkspace: async (id) => {
        const workspace = get().savedWorkspaces.find((w) => w.id === id);
        if (!workspace) return;

        // Check tab limit
        const { tabOrder } = get();
        if (tabOrder.length >= 8) {
          get().addToast({ type: 'error', message: 'Tab limit reached (8) — close a tab first' });
          return;
        }

        // Validate datasets
        const { schemaDatasets } = get();
        const datasetWarnings: string[] = [];

        // Restore statements — regenerate IDs
        const restoredStatements: SQLStatement[] = workspace.statements.map((s) => ({
          id: crypto.randomUUID(),
          code: s.code,
          status: s.statementName ? 'RUNNING' as const : 'IDLE' as const,
          createdAt: new Date(),
          label: s.label,
          isCollapsed: s.isCollapsed,
          scanMode: s.scanMode,
          scanTimestampMillis: s.scanTimestampMillis,
          scanSpecificOffsets: s.scanSpecificOffsets,
          scanGroupId: s.scanGroupId,
          ...(s.statementName ? { statementName: s.statementName, startedAt: new Date() } : {}),
        }));

        // Restore stream cards — regenerate IDs, validate datasets
        const restoredCards: StreamCardEntry[] = workspace.streamCards.map((c) => {
          let selectedDatasetId = c.selectedDatasetId;
          let dataSource = c.dataSource;
          if (c.dataSource === 'dataset' && c.selectedDatasetId) {
            const exists = schemaDatasets.some((ds) => ds.id === c.selectedDatasetId);
            if (!exists) {
              datasetWarnings.push(c.topicName);
              selectedDatasetId = null;
              dataSource = 'synthetic';
            }
          }
          return {
            id: crypto.randomUUID(),
            topicName: c.topicName,
            initialMode: c.mode,
            preselectedDatasetId: selectedDatasetId ?? undefined,
            mode: c.mode,
            dataSource,
            selectedDatasetId,
            scanMode: c.scanMode,
          };
        });

        // Create new tab from saved workspace (non-destructive)
        const newTabId = generateId();
        const newTab: TabState = {
          statements: restoredStatements,
          focusedStatementId: null,
          workspaceName: workspace.name,
          workspaceNotes: workspace.notes ?? null,
          workspaceNotesOpen: !!workspace.notes,
          lastSavedAt: null,
          streamCards: restoredCards,
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        };

        set(state => ({
          tabs: { ...state.tabs, [newTabId]: newTab },
          tabOrder: [...state.tabOrder, newTabId],
          activeTabId: newTabId,
        }));

        // Open streams panel if there are stream cards
        if (restoredCards.length > 0) {
          get().setStreamsPanelOpen(true);
        }

        // Show dataset warnings
        for (const topicName of datasetWarnings) {
          get().addToast({ type: 'warning', message: `Dataset for ${topicName} was removed — switched to synthetic mode` });
        }

        get().addToast({ type: 'success', message: `Workspace "${workspace.name}" opened` });

        // Reconnect RUNNING statements
        const runningToReconnect = restoredStatements.filter((s) => s.statementName && s.status === 'RUNNING');
        await Promise.allSettled(
          runningToReconnect.map(async (stmt) => {
            try {
              const apiStatus = await flinkApi.getStatementStatus(stmt.statementName!);
              const phase = apiStatus.status?.phase;
              const stopped = (apiStatus.spec as any)?.stopped === true;

              if (stopped || (phase as string) === 'STOPPED' || phase === 'CANCELLED') {
                set((state) => ({
                  tabs: { ...state.tabs, [newTabId]: {
                    ...state.tabs[newTabId],
                    statements: state.tabs[newTabId].statements.map((s) =>
                      s.id === stmt.id ? { ...s, status: 'CANCELLED' as StatementStatus, statementName: undefined } : s
                    ),
                  }},
                }));
              } else if (phase === 'RUNNING') {
                setTimeout(() => get().resumeStatementPolling(stmt.id), 100);
              } else if (phase === 'COMPLETED' || phase === 'FAILED') {
                const newStatus = phase === 'FAILED' ? 'ERROR' as const : 'COMPLETED' as const;
                const errorDetail = phase === 'FAILED'
                  ? await flinkApi.getStatementErrorDetail(stmt.statementName!, apiStatus.status?.detail)
                  : undefined;
                set((state) => ({
                  tabs: { ...state.tabs, [newTabId]: {
                    ...state.tabs[newTabId],
                    statements: state.tabs[newTabId].statements.map((s) =>
                      s.id === stmt.id ? { ...s, status: newStatus, error: errorDetail, statementName: undefined } : s
                    ),
                  }},
                }));
              }
            } catch (error: any) {
              if (error?.response?.status === 404) {
                set((state) => ({
                  tabs: { ...state.tabs, [newTabId]: {
                    ...state.tabs[newTabId],
                    statements: state.tabs[newTabId].statements.map((s) =>
                      s.id === stmt.id ? { ...s, status: 'IDLE' as StatementStatus, statementName: undefined } : s
                    ),
                  }},
                }));
              } else {
                get().addToast({ type: 'warning', message: `Reconnect check failed for ${stmt.statementName} — retrying...` });
              }
            }
          })
        );
      },

      deleteSavedWorkspace: (id) => {
        set((state) => ({
          savedWorkspaces: state.savedWorkspaces.filter((w) => w.id !== id),
        }));
      },

      renameSavedWorkspace: (id, name) => {
        if (!name.trim()) return;
        set((state) => ({
          savedWorkspaces: state.savedWorkspaces.map((w) =>
            w.id === id ? { ...w, name: name.trim(), updatedAt: new Date().toISOString() } : w
          ),
        }));
      },

      updateStreamCardConfig: (id, updates) => {
        const tab = activeTab();
        setActiveTab({
          streamCards: tab.streamCards.map((c) => c.id === id ? { ...c, ...updates } : c),
        });
      },

      // Jobs Page actions
      navigateToJobDetail: (statementName: string) => {
        set({ activeNavItem: 'jobs' as NavItem, selectedJobName: statementName });
      },

      navigateToExampleDetail: (cardId: string | null) => {
        set({ selectedExampleId: cardId });
      },

      loadJobs: async () => {
        set({ jobsLoading: true, jobsError: null });
        try {
          const filterId = get().resourceFilterMode === 'unique' ? getSessionTag() : undefined;
          await flinkApi.listStatements(200, (accumulated) => {
            set({ jobStatements: accumulated });
          }, undefined, filterId);
          set({ jobsLoading: false });
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || 'Failed to load jobs';
          set({ jobsError: msg, jobsLoading: false });
          get().addToast({ type: 'error', message: msg });
        }
      },

      cancelJob: async (statementName: string) => {
        const { jobStatements } = get();
        const idx = jobStatements.findIndex((s) => s.name === statementName);
        if (idx === -1) return;

        const previousPhase = jobStatements[idx].status?.phase;

        set({
          jobStatements: jobStatements.map((s) =>
            s.name === statementName
              ? { ...s, status: { ...s.status, phase: 'CANCELLED' as const } }
              : s
          ),
        });

        try {
          await flinkApi.cancelStatement(statementName, { stopAfterTerminatingQueries: true });
          get().addToast({ type: 'success', message: `Stopped ${statementName}` });
        } catch (error: unknown) {
          set({
            jobStatements: get().jobStatements.map((s) =>
              s.name === statementName && previousPhase
                ? { ...s, status: { ...s.status, phase: previousPhase } }
                : s
            ),
          });
          const err = error as { message?: string; status?: number; details?: string };
          const msg = err?.details || err?.message || 'Failed to stop job';
          get().addToast({ type: 'error', message: msg });
        }
      },

      deleteJob: async (statementName: string) => {
        const { jobStatements } = get();
        const idx = jobStatements.findIndex((s) => s.name === statementName);
        if (idx === -1) return;

        set({ jobStatements: jobStatements.filter((s) => s.name !== statementName) });

        try {
          await flinkApi.cancelStatement(statementName);
          get().addToast({ type: 'success', message: `Deleted ${statementName}` });
        } catch (error: unknown) {
          set({ jobStatements: [...get().jobStatements, jobStatements[idx]] });
          const err = error as { message?: string; status?: number; details?: string };
          const msg = err?.details || err?.message || 'Failed to delete statement';
          get().addToast({ type: 'error', message: msg });
        }
      },

      // Artifact actions
      loadArtifacts: async () => {
        set({ artifactLoading: true, artifactError: null });
        try {
          const filterId = get().resourceFilterMode === 'unique' ? getSessionTag() : undefined;
          const artifacts = await artifactApi.listArtifacts(filterId);
          set({ artifactList: artifacts, artifactLoading: false });
          const enriched = await Promise.all(
            artifacts.map(async (a) => {
              try {
                return await artifactApi.getArtifact(a.id);
              } catch {
                return a;
              }
            })
          );
          set({ artifactList: enriched });
        } catch (error: unknown) {
          const err = error as { response?: { status?: number }; message?: string };
          const status = err?.response?.status;
          let msg = 'Failed to load artifacts';
          if (status === 401 || status === 403) msg = 'Unauthorized — check your Cloud API keys';
          else if (status === 409) msg = 'Conflict — environment may not support artifacts';
          set({ artifactError: msg, artifactLoading: false });
        }
      },

      selectArtifact: (artifact) => {
        set({ selectedArtifact: artifact });
      },

      clearSelectedArtifact: () => {
        set({ selectedArtifact: null });
      },

      deleteArtifact: async (id: string) => {
        const { artifactList } = get();
        const removed = artifactList.find((a) => a.id === id);
        if (!removed) return;

        set({
          artifactList: artifactList.filter((a) => a.id !== id),
          selectedArtifact: null,
        });

        try {
          await artifactApi.deleteArtifact(id);
          get().addToast({ type: 'success', message: `Deleted artifact "${removed.display_name}"` });
        } catch (error: unknown) {
          set({ artifactList: [...get().artifactList, removed] });
          const err = error as { response?: { status?: number }; message?: string };
          const status = err?.response?.status;
          const msg = status === 409
            ? 'Cannot delete — artifact is in use by active functions'
            : 'Failed to delete artifact';
          get().addToast({ type: 'error', message: msg });
        }
      },

      setArtifactError: (error) => {
        set({ artifactError: error });
      },

      setArtifactUploading: (uploading) => {
        set({ artifactUploading: uploading });
        if (!uploading) set({ uploadProgress: null });
      },

      setUploadProgress: (progress) => {
        set({ uploadProgress: progress });
      },

      // Phase 13.1 — Stream Panel actions
      toggleStreamsPanel: () => {
        set({ streamsPanelOpen: !get().streamsPanelOpen });
      },

      setStreamsPanelOpen: (open) => {
        set({ streamsPanelOpen: open });
      },

      addStreamCard: (topicName, initialMode, preselectedDatasetId, datasetTemplate) => {
        const tab = activeTab();
        if (tab.streamCards.length >= 10) return;
        setActiveTab({
          streamCards: [...tab.streamCards, {
            id: crypto.randomUUID(),
            topicName,
            initialMode,
            preselectedDatasetId,
            mode: initialMode,
            dataSource: preselectedDatasetId ? 'dataset' as const : 'synthetic' as const,
            selectedDatasetId: preselectedDatasetId ?? null,
            scanMode: 'earliest-offset' as const,
            ...(datasetTemplate ? { datasetTemplate } : {}),
          }],
        });
      },

      removeStreamCard: (cardId) => {
        get().cancelBackgroundStatement(cardId);
        const tab = activeTab();
        setActiveTab({ streamCards: tab.streamCards.filter((c) => c.id !== cardId) });
      },

      removeStreamCardsByTopic: (topicName) => {
        const tab = activeTab();
        const cards = tab.streamCards.filter((c) => c.topicName === topicName);
        cards.forEach((c) => get().cancelBackgroundStatement(c.id));
        setActiveTab({ streamCards: tab.streamCards.filter((c) => c.topicName !== topicName) });
      },

      // Schema dataset actions
      addSchemaDataset: (dataset) => {
        if (dataset.records.length > 500) return;
        set((state) => ({
          schemaDatasets: [...state.schemaDatasets, dataset],
        }));
      },

      updateSchemaDataset: (id, updates) => {
        set((state) => ({
          schemaDatasets: state.schemaDatasets.map((ds) =>
            ds.id === id
              ? {
                  ...ds,
                  ...(updates.name !== undefined ? { name: updates.name } : {}),
                  ...(updates.records !== undefined ? { records: updates.records } : {}),
                  updatedAt: new Date().toISOString(),
                }
              : ds
          ),
        }));
      },

      deleteSchemaDataset: (id) => {
        set((state) => ({
          schemaDatasets: state.schemaDatasets.filter((ds) => ds.id !== id),
        }));
      },

      navigateToSchemaDatasets: (subject) => {
        set({
          activeNavItem: 'schemas',
          schemaInitialView: 'datasets',
        });
        get().loadSchemaDetail(subject, 'latest');
      },

      clearSchemaInitialView: () => {
        set({ schemaInitialView: null });
      },

      executeBackgroundStatement: async (contextId, sql, scanMode, topicName) => {
        const tabId = get().activeTabId; // Capture tab at execution start
        const tab = getTab(tabId);
        // Cancel existing statement for same contextId first (max 1 per contextId — AC-8.5)
        const existing = tab.backgroundStatements.find((s) => s.contextId === contextId);
        if (existing && existing.statementName) {
          try {
            await flinkApi.cancelStatement(existing.statementName);
          } catch {
            // Ignore cancel errors for existing statement
          }
        }

        const statementName = topicName
          ? generateTopicStatementName(topicName)
          : generateStatementName();
        const bgStatement: BackgroundStatement = {
          id: crypto.randomUUID(),
          contextId,
          statementName,
          sql,
          status: 'PENDING',
          createdAt: new Date(),
        };

        // Remove old statement for same contextId, add new one
        set((state) => {
          const tab = state.tabs[tabId];
          if (!tab) return state;
          return {
            tabs: { ...state.tabs, [tabId]: { ...tab, backgroundStatements: [
              ...tab.backgroundStatements.filter((s) => s.contextId !== contextId),
              bgStatement,
            ] } }
          };
        });

        try {
          const { catalog: bgCatalog, database: bgDatabase } = get();
          const streamSessionProps = {
            'sql.current-catalog': bgCatalog,
            'sql.current-database': bgDatabase,
            ...get().sessionProperties,
            'sql.tables.scan.startup.mode': scanMode || 'earliest-offset',
          };
          await flinkApi.executeSQL(sql, statementName, streamSessionProps);

          // Update to RUNNING
          set((state) => {
            const tab = state.tabs[tabId];
            if (!tab) return state;
            return {
              tabs: { ...state.tabs, [tabId]: { ...tab, backgroundStatements: tab.backgroundStatements.map((s) =>
                s.id === bgStatement.id ? { ...s, status: 'RUNNING' as const } : s
              ) } }
            };
          });

          // Poll for results
          let nextCursor: string | undefined;
          let allResults: Record<string, unknown>[] = [];
          let columns: Column[] = [];
          const maxAttempts = 120;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const currentTab = getTab(tabId);
            if (!currentTab) return; // Tab was closed, orphaned poll
            const current = currentTab.backgroundStatements.find((s) => s.id === bgStatement.id);
            if (!current || current.status === 'CANCELLED') return;

            const status = await flinkApi.getStatementStatus(statementName);
            const phase = status.status?.phase;

            if (phase === 'FAILED') {
              const errorDetail = await flinkApi.getStatementErrorDetail(statementName, status.status?.detail);
              set((state) => {
                const tab = state.tabs[tabId];
                if (!tab) return state;
                return {
                  tabs: { ...state.tabs, [tabId]: { ...tab, backgroundStatements: tab.backgroundStatements.map((s) =>
                    s.id === bgStatement.id
                      ? { ...s, status: 'ERROR' as const, error: errorDetail }
                      : s
                  ) } }
                };
              });
              return;
            }

            if (phase === 'CANCELLED') {
              set((state) => {
                const tab = state.tabs[tabId];
                if (!tab) return state;
                return {
                  tabs: { ...state.tabs, [tabId]: { ...tab, backgroundStatements: tab.backgroundStatements.map((s) =>
                    s.id === bgStatement.id ? { ...s, status: 'CANCELLED' as const } : s
                  ) } }
                };
              });
              return;
            }

            // Extract columns from schema
            if (columns.length === 0 && status.status?.traits?.schema?.columns) {
              columns = status.status.traits.schema.columns.map((col) => ({
                name: col.name,
                type: col.type?.type || 'STRING',
                nullable: col.type?.nullable,
              }));
            }

            if (phase === 'COMPLETED' || phase === 'RUNNING') {
              try {
                const resultsData = await flinkApi.getStatementResults(statementName, nextCursor);
                const rawRows = resultsData.results?.data || [];
                const rows = rawRows.map((item) => item.row || []);

                if (rows.length > 0) {
                  if (columns.length === 0) {
                    columns = rows[0].map((_: unknown, idx: number) => ({
                      name: `col_${idx}`,
                      type: 'STRING',
                    }));
                  }

                  const newResults = rows.map((row: unknown[]) => {
                    const obj: Record<string, unknown> = {};
                    row.forEach((val, idx) => {
                      const colName = columns[idx]?.name || `col_${idx}`;
                      obj[colName] = val;
                    });
                    return obj;
                  });

                  allResults = [...allResults, ...newResults];
                  if (allResults.length > 500) {
                    allResults = allResults.slice(allResults.length - 500);
                  }

                  set((state) => {
                    const tab = state.tabs[tabId];
                    if (!tab) return state;
                    return {
                      tabs: { ...state.tabs, [tabId]: { ...tab, backgroundStatements: tab.backgroundStatements.map((s) =>
                        s.id === bgStatement.id
                          ? { ...s, results: allResults, columns, status: phase === 'COMPLETED' ? 'COMPLETED' as const : 'RUNNING' as const }
                          : s
                      ) } }
                    };
                  });
                }

                if (resultsData.metadata?.next) {
                  nextCursor = resultsData.metadata.next;
                }

                if (phase === 'COMPLETED' && !resultsData.metadata?.next) {
                  set((state) => {
                    const tab = state.tabs[tabId];
                    if (!tab) return state;
                    return {
                      tabs: { ...state.tabs, [tabId]: { ...tab, backgroundStatements: tab.backgroundStatements.map((s) =>
                        s.id === bgStatement.id ? { ...s, status: 'COMPLETED' as const } : s
                      ) } }
                    };
                  });
                  return;
                }
              } catch {
                // Continue polling on transient errors
              }
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Background query failed';
          set((state) => {
            const tab = state.tabs[tabId];
            if (!tab) return state;
            return {
              tabs: { ...state.tabs, [tabId]: { ...tab, backgroundStatements: tab.backgroundStatements.map((s) =>
                s.id === bgStatement.id ? { ...s, status: 'ERROR' as const, error: message } : s
              ) } }
            };
          });
        }
      },

      cancelBackgroundStatement: async (contextId) => {
        const tab = activeTab();
        const statement = tab.backgroundStatements.find((s) => s.contextId === contextId);
        if (!statement) return;

        try {
          await flinkApi.cancelStatement(statement.statementName);
        } catch {
          // Ignore cancel errors
        }

        setActiveTab({
          backgroundStatements: activeTab().backgroundStatements.map((s) =>
            s.contextId === contextId ? { ...s, status: 'CANCELLED' as const } : s
          ),
        });
      },

      clearBackgroundStatements: async () => {
        const tab = activeTab();
        await Promise.allSettled(
          tab.backgroundStatements
            .filter((s) => s.status === 'RUNNING' || s.status === 'PENDING')
            .map((s) => flinkApi.cancelStatement(s.statementName).catch(() => {}))
        );
        setActiveTab({ backgroundStatements: [] });
      },

      stopAllStreams: async () => {
        const tab = activeTab();
        const active = tab.backgroundStatements.filter((s) => s.status === 'RUNNING' || s.status === 'PENDING');

        set(state => ({ stopAllStreamsSignal: state.stopAllStreamsSignal + 1 }));
        setActiveTab({
          backgroundStatements: activeTab().backgroundStatements.map((s) =>
            s.status === 'RUNNING' || s.status === 'PENDING'
              ? { ...s, status: 'CANCELLED' as const }
              : s
          ),
        });

        if (active.length > 0) {
          get().addToast({ type: 'info', message: `Stopped ${active.length} stream${active.length !== 1 ? 's' : ''}` });
          await Promise.allSettled(
            active.map((s) => flinkApi.cancelStatement(s.statementName).catch(() => {}))
          );
        }
      },

      clearStatements: () => {
        const tab = activeTab();
        tab.statements
          .filter((s) => (s.status === 'RUNNING' || s.status === 'PENDING') && s.statementName)
          .forEach((s) => flinkApi.cancelStatement(s.statementName!).catch(() => {}));

        setActiveTab({ statements: [] });
        get().addToast({ type: 'info', message: 'Workspace statements cleared' });
      },

      clearStreamCards: async () => {
        await get().clearBackgroundStatements();
        setActiveTab({ streamCards: [] });
        get().addToast({ type: 'info', message: 'Stream cards cleared' });
      },

      runAllStreams: () => {
        get().addToast({ type: 'info', message: 'Starting all streams...' });
        set((state) => ({ runAllStreamsSignal: state.runAllStreamsSignal + 1 }));
      },

      // Tab actions
      addTab: (name) => {
        const { tabOrder } = get();
        if (tabOrder.length >= 8) return '';
        const newId = generateId();
        const newTab: TabState = {
          statements: [],
          focusedStatementId: null,
          workspaceName: name || 'Workspace',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        };
        set(state => ({
          tabs: { ...state.tabs, [newId]: newTab },
          tabOrder: [...state.tabOrder, newId],
          activeTabId: newId,
        }));
        return newId;
      },

      closeTab: (id) => {
        const { tabs, tabOrder, activeTabId } = get();
        const tab = tabs[id];
        if (!tab) return;

        // Cancel running statements server-side (best-effort)
        tab.statements
          .filter(s => (s.status === 'RUNNING' || s.status === 'PENDING') && s.statementName)
          .forEach(s => flinkApi.cancelStatement(s.statementName!).catch(() => {}));
        tab.backgroundStatements
          .filter(s => s.status === 'RUNNING' || s.status === 'PENDING')
          .forEach(s => flinkApi.cancelStatement(s.statementName).catch(() => {}));

        const newTabOrder = tabOrder.filter(tid => tid !== id);
        const newTabs = { ...tabs };
        delete newTabs[id];

        // If closing the last tab, create a fresh one
        if (newTabOrder.length === 0) {
          const freshId = generateId();
          const { catalog, database } = get();
          newTabs[freshId] = {
            statements: [{
              id: generateId(),
              code: `-- Write your Flink SQL query here\nSELECT * FROM \`${catalog}\`.\`${database}\`.<table_name> LIMIT 10;`,
              status: 'IDLE',
              createdAt: new Date(),
              label: generateFunName(),
            }],
            focusedStatementId: null,
            workspaceName: 'Workspace',
            workspaceNotes: null,
            workspaceNotesOpen: false,
            lastSavedAt: null,
            streamCards: [],
            backgroundStatements: [],
            treeNodes: [],
            selectedNodeId: null,
            treeLoading: false,
            selectedTableSchema: [],
            selectedTableName: null,
            schemaLoading: false,
          };
          newTabOrder.push(freshId);
          set({ tabs: newTabs, tabOrder: newTabOrder, activeTabId: freshId });
          return;
        }

        // If closing the active tab, switch to adjacent
        let newActiveId = activeTabId;
        if (activeTabId === id) {
          const oldIdx = tabOrder.indexOf(id);
          newActiveId = newTabOrder[Math.min(oldIdx, newTabOrder.length - 1)];
        }

        set({ tabs: newTabs, tabOrder: newTabOrder, activeTabId: newActiveId });
      },

      switchTab: (id) => {
        if (get().tabs[id]) {
          set({ activeTabId: id });
        }
      },

      reorderTabs: (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        set(state => {
          const newOrder = [...state.tabOrder];
          const [removed] = newOrder.splice(fromIndex, 1);
          newOrder.splice(toIndex, 0, removed);
          return { tabOrder: newOrder };
        });
      },

      renameTab: (id, name) => {
        if (!name.trim()) return;
        setTab(id, { workspaceName: name.trim() });
      },
    };
    },
    {
      name: 'flink-workspace',
      version: 2,
      partialize: (state) => ({
        tabs: Object.fromEntries(
          Object.entries(state.tabs).map(([tabId, tab]) => [tabId, {
            statements: tab.statements.map((s) => {
              const keepRunning = s.status === 'RUNNING' && !!s.statementName;
              return {
                id: s.id,
                code: s.code,
                status: keepRunning ? 'RUNNING' as const : (s.status === 'RUNNING' || s.status === 'PENDING' ? 'IDLE' as const : s.status),
                createdAt: s.createdAt,
                isCollapsed: s.isCollapsed,
                lastExecutedCode: s.lastExecutedCode ?? null,
                label: s.label,
                scanMode: s.scanMode,
                scanTimestampMillis: s.scanTimestampMillis,
                scanSpecificOffsets: s.scanSpecificOffsets,
                scanGroupId: s.scanGroupId,
                ...(keepRunning ? { statementName: s.statementName, startedAt: s.startedAt } : {}),
              };
            }),
            lastSavedAt: tab.lastSavedAt,
            workspaceName: tab.workspaceName,
            focusedStatementId: null,
            workspaceNotes: null,
            workspaceNotesOpen: false,
            streamCards: [],
            backgroundStatements: [],
            treeNodes: [],
            selectedNodeId: null,
            treeLoading: false,
            selectedTableSchema: [],
            selectedTableName: null,
            schemaLoading: false,
          }])
        ),
        activeTabId: state.activeTabId,
        tabOrder: state.tabOrder,
        theme: state.theme,
        hasSeenOnboardingHint: state.hasSeenOnboardingHint,
        navExpanded: state.navExpanded,
        sessionProperties: state.sessionProperties,
        snippets: state.snippets,
        schemaDatasets: state.schemaDatasets,
        savedWorkspaces: state.savedWorkspaces,
      }) as unknown as WorkspaceState,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as any;

        // v1 → v2: Wrap flat workspace state into tabs
        if (version < 2) {
          if (!state.tabs) {
            const tabId = generateId();
            state.tabs = {
              [tabId]: {
                statements: state.statements || [],
                focusedStatementId: null,
                workspaceName: state.workspaceName || 'Workspace',
                workspaceNotes: null,
                workspaceNotesOpen: false,
                lastSavedAt: state.lastSavedAt || null,
                streamCards: [],
                backgroundStatements: [],
                treeNodes: [],
                selectedNodeId: null,
                treeLoading: false,
                selectedTableSchema: [],
                selectedTableName: null,
                schemaLoading: false,
              }
            };
            state.activeTabId = tabId;
            state.tabOrder = [tabId];
            // Clean up old flat fields
            delete state.statements;
            delete state.workspaceName;
            delete state.lastSavedAt;
          }
        }

        // Migration: remove invalid 'parallelism.default' session property
        if (state?.sessionProperties?.['parallelism.default']) {
          delete state.sessionProperties['parallelism.default'];
        }
        if (!state?.savedWorkspaces) state.savedWorkspaces = [];
        if (env.flinkCatalog) state.catalog = env.flinkCatalog;
        if (env.flinkDatabase) state.database = env.flinkDatabase;

        // Migrate per-tab data
        if (state.tabs) {
          for (const tabId of Object.keys(state.tabs)) {
            const tab = state.tabs[tabId];
            if (tab.workspaceName === 'SQL Workspace' || tab.workspaceName === 'Flafka') {
              tab.workspaceName = 'Workspace';
            }
            // Rehydrate Date fields
            if (tab.statements) {
              for (const s of tab.statements) {
                if (s.startedAt && typeof s.startedAt === 'string') s.startedAt = new Date(s.startedAt);
                if (s.createdAt && typeof s.createdAt === 'string') s.createdAt = new Date(s.createdAt);
                if (s.lastExecutedAt && typeof s.lastExecutedAt === 'string') s.lastExecutedAt = new Date(s.lastExecutedAt);
              }
            }
          }
        }

        if (state?.savedWorkspaces) {
          state.savedWorkspaces = state.savedWorkspaces.map((w: any) => ({
            ...w,
            sourceTemplateId: w.sourceTemplateId ?? undefined,
            sourceTemplateName: w.sourceTemplateName ?? undefined,
            notes: w.notes ?? undefined,
          }));
        }

        return state as WorkspaceState;
      },
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) return;

          // Rehydrate Date fields in all tabs
          const { tabs } = useWorkspaceStore.getState();
          let needsUpdate = false;
          const fixedTabs: Record<string, TabState> = {};
          for (const [tabId, tab] of Object.entries(tabs)) {
            const fixed = tab.statements.map((s) => {
              const startedAt = s.startedAt && typeof s.startedAt === 'string' ? new Date(s.startedAt) : s.startedAt;
              const createdAt = s.createdAt && typeof s.createdAt === 'string' ? new Date(s.createdAt) : s.createdAt;
              const lastExecutedAt = s.lastExecutedAt && typeof s.lastExecutedAt === 'string' ? new Date(s.lastExecutedAt) : s.lastExecutedAt;
              if (startedAt !== s.startedAt || createdAt !== s.createdAt || lastExecutedAt !== s.lastExecutedAt) {
                needsUpdate = true;
                return { ...s, startedAt, createdAt, lastExecutedAt };
              }
              return s;
            });
            fixedTabs[tabId] = { ...tab, statements: fixed };
          }
          if (needsUpdate) {
            useWorkspaceStore.setState({ tabs: fixedTabs });
          }

          // Verify RUNNING statements in all tabs
          const verify = () => {
            const { tabs } = useWorkspaceStore.getState();
            for (const [tabId, tab] of Object.entries(tabs)) {
              const runningStatements = tab.statements.filter(s => s.status === 'RUNNING' && s.statementName);
              for (const stmt of runningStatements) {
                flinkApi.getStatementStatus(stmt.statementName!).then(async (apiStatus) => {
                  const phase = apiStatus.status?.phase;
                  if (phase === 'RUNNING') {
                    setTimeout(() => useWorkspaceStore.getState().resumeStatementPolling(stmt.id), 100);
                  } else if (phase === 'COMPLETED' || phase === 'FAILED' || phase === 'CANCELLED') {
                    const newStatus = phase === 'FAILED' ? 'ERROR' as const :
                                      phase === 'CANCELLED' ? 'CANCELLED' as const : 'COMPLETED' as const;
                    const errorDetail = phase === 'FAILED' ? await flinkApi.getStatementErrorDetail(stmt.statementName!, apiStatus.status?.detail) : undefined;
                    useWorkspaceStore.setState((state) => ({
                      tabs: { ...state.tabs, [tabId]: {
                        ...state.tabs[tabId],
                        statements: state.tabs[tabId].statements.map((s) =>
                          s.id === stmt.id ? { ...s, status: newStatus, error: errorDetail } : s
                        ),
                      }},
                    }));
                  }
                }).catch(() => {
                  useWorkspaceStore.setState((state) => ({
                    tabs: { ...state.tabs, [tabId]: {
                      ...state.tabs[tabId],
                      statements: state.tabs[tabId].statements.map((s) =>
                        s.id === stmt.id ? { ...s, status: 'IDLE' as const, statementName: undefined } : s
                      ),
                    }},
                  }));
                });
              }
            }
          };
          setTimeout(verify, 2000);
        };
      },
    }
  )
);

// Patch external setState to keep tabs and root-level mirrors in sync.
// When tests or external code calls useWorkspaceStore.setState({ statements: [...] }),
// we need to propagate those values into the active tab, and vice versa.
const _originalSetState = useWorkspaceStore.setState.bind(useWorkspaceStore);
const TAB_FIELDS: (keyof TabState)[] = [
  'statements', 'focusedStatementId', 'workspaceName', 'workspaceNotes',
  'workspaceNotesOpen', 'lastSavedAt', 'streamCards', 'backgroundStatements',
  'treeNodes', 'selectedNodeId', 'treeLoading', 'selectedTableSchema',
  'selectedTableName', 'schemaLoading',
];
useWorkspaceStore.setState = ((updater: any, replace?: any) => {
  _originalSetState((state: WorkspaceState) => {
    const partial = typeof updater === 'function' ? updater(state) : updater;
    // Check if any tab fields are being set at root level (backward compat)
    const tabUpdates: Partial<TabState> = {};
    let hasTabUpdates = false;
    for (const field of TAB_FIELDS) {
      if (field in partial && partial[field] !== undefined) {
        (tabUpdates as any)[field] = partial[field];
        hasTabUpdates = true;
      }
    }
    // If tab fields were set at root, propagate into active tab
    if (hasTabUpdates) {
      const tabId = partial.activeTabId || state.activeTabId;
      const currentTab = (partial.tabs || state.tabs)[tabId];
      if (currentTab) {
        const updatedTab = { ...currentTab, ...tabUpdates };
        return {
          ...partial,
          tabs: { ...(partial.tabs || state.tabs), [tabId]: updatedTab },
        };
      }
    }
    // If tabs or activeTabId changed, sync root mirrors
    if (partial.tabs || partial.activeTabId) {
      const tabs = partial.tabs || state.tabs;
      const activeTabId = partial.activeTabId || state.activeTabId;
      const tab = tabs[activeTabId];
      if (tab) {
        const mirrors: any = {};
        for (const field of TAB_FIELDS) {
          mirrors[field] = tab[field];
        }
        return { ...partial, ...mirrors };
      }
    }
    return partial;
  }, replace);
}) as typeof useWorkspaceStore.setState;

// Helper function to toggle node expanded state
function toggleNodeExpanded(nodes: TreeNode[], nodeId: string): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, isExpanded: !node.isExpanded };
    }
    if (node.children) {
      return { ...node, children: toggleNodeExpanded(node.children, nodeId) };
    }
    return node;
  });
}

// Helper function to find a node by ID in the tree
function findNodeById(nodes: TreeNode[], nodeId: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children) {
      const found = findNodeById(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}
