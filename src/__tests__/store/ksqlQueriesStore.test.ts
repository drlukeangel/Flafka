import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all API modules BEFORE any store import ────────────────────────────
vi.mock('../../api/flink-api', () => ({
  executeSQL: vi.fn(),
  getStatementStatus: vi.fn(),
  getStatementResults: vi.fn(),
  cancelStatement: vi.fn(),
  getComputePoolStatus: vi.fn(),
  listStatements: vi.fn(),
  listStatementsFirstPage: vi.fn(),
  getCatalogs: vi.fn(),
  getDatabases: vi.fn(),
  getTables: vi.fn(),
  getViews: vi.fn(),
  getFunctions: vi.fn(),
  getTableSchema: vi.fn(),
  pollForResults: vi.fn(),
}));

vi.mock('../../api/telemetry-api', () => ({
  getStatementTelemetry: vi.fn(),
}));

vi.mock('../../api/schema-registry-api', () => ({
  listSubjects: vi.fn(),
  getSchemaDetail: vi.fn(),
  getSchemaVersions: vi.fn(),
  registerSchema: vi.fn(),
  validateCompatibility: vi.fn(),
  getCompatibilityMode: vi.fn(),
  setCompatibilityMode: vi.fn(),
  deleteSubject: vi.fn(),
  deleteSchemaVersion: vi.fn(),
}));

vi.mock('../../api/topic-api', () => ({
  listTopics: vi.fn(),
  getTopicDetail: vi.fn(),
  getTopicConfigs: vi.fn(),
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
  alterTopicConfig: vi.fn(),
  getTopicPartitions: vi.fn(),
  getPartitionOffsets: vi.fn(),
  produceRecord: vi.fn(),
}));

vi.mock('../../utils/workspace-export', () => ({
  validateWorkspaceJSON: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('../../api/artifact-api', () => ({
  listArtifacts: vi.fn(),
  getArtifact: vi.fn(),
  deleteArtifact: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  uploadArtifactFile: vi.fn(),
  createArtifact: vi.fn(),
}));

vi.mock('../../api/ksql-api', () => ({
  listQueries: vi.fn(),
  terminateQuery: vi.fn(),
  explainQuery: vi.fn(),
  executeKsql: vi.fn(),
  handleKsqlError: vi.fn(),
  parseKsqlSchema: vi.fn(),
  executeKsqlQuery: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as ksqlApi from '../../api/ksql-api';
import type { KsqlPersistentQuery } from '../../types';

const mockQueries: KsqlPersistentQuery[] = [
  {
    id: 'CSAS_STREAM1_0',
    queryString: 'CREATE STREAM AS SELECT * FROM source EMIT CHANGES;',
    sinks: ['output-topic-1'],
    queryType: 'PERSISTENT',
    state: 'RUNNING',
  },
  {
    id: 'CTAS_TABLE1_0',
    queryString: 'CREATE TABLE AS SELECT id, COUNT(*) FROM s GROUP BY id;',
    sinks: ['table-topic'],
    queryType: 'PERSISTENT',
    state: 'PAUSED',
  },
];

function resetStore() {
  useWorkspaceStore.setState({
    ksqlQueries: [],
    ksqlQueriesLoading: false,
    ksqlQueriesError: null,
    selectedKsqlQueryId: null,
    ksqlDashboardOpen: false,
    ksqlDashboardHeight: 300,
    ksqlDashboardQueries: [],
    ksqlDashboardLoading: false,
    ksqlDashboardError: null,
    ksqlDashboardLastUpdated: null,
    ksqlFeatureEnabled: true,
    computePoolDashboardOpen: false,
    toasts: [],
  });
}

describe('[@ksql-store] ksqlDB Queries Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // ── loadKsqlQueries ─────────────────────────────────────────────────
  describe('loadKsqlQueries', () => {
    it('fetches and populates ksqlQueries', async () => {
      vi.mocked(ksqlApi.listQueries).mockResolvedValueOnce([
        {
          queries: [
            { id: 'CSAS_STREAM1_0', queryString: 'CREATE STREAM ...', sinks: ['out'], queryType: 'PERSISTENT', state: 'RUNNING' },
          ],
        },
      ]);

      await useWorkspaceStore.getState().loadKsqlQueries();

      const state = useWorkspaceStore.getState();
      expect(state.ksqlQueries).toHaveLength(1);
      expect(state.ksqlQueries[0].id).toBe('CSAS_STREAM1_0');
      expect(state.ksqlQueriesLoading).toBe(false);
      expect(state.ksqlQueriesError).toBeNull();
    });

    it('correctly parses SHOW QUERIES response with multiple queries', async () => {
      vi.mocked(ksqlApi.listQueries).mockResolvedValueOnce([
        {
          queries: [
            { id: 'CSAS_TEST_0', queryString: 'CREATE STREAM test AS SELECT * FROM src;', sinks: ['test-topic'], queryType: 'PERSISTENT', state: 'RUNNING' },
            { id: 'CTAS_AGG_0', queryString: 'CREATE TABLE agg AS SELECT k, COUNT(*) FROM s GROUP BY k;', sinks: ['agg-topic'], queryType: 'PERSISTENT', state: 'PAUSED' },
          ],
        },
      ]);

      await useWorkspaceStore.getState().loadKsqlQueries();

      const queries = useWorkspaceStore.getState().ksqlQueries;
      expect(queries).toHaveLength(2);
      expect(queries[0]).toEqual({
        id: 'CSAS_TEST_0',
        queryString: 'CREATE STREAM test AS SELECT * FROM src;',
        sinks: ['test-topic'],
        queryType: 'PERSISTENT',
        state: 'RUNNING',
      });
      expect(queries[1].id).toBe('CTAS_AGG_0');
      expect(queries[1].state).toBe('PAUSED');
    });

    it('handles API error', async () => {
      vi.mocked(ksqlApi.listQueries).mockRejectedValueOnce(new Error('Connection refused'));

      await useWorkspaceStore.getState().loadKsqlQueries();

      const state = useWorkspaceStore.getState();
      expect(state.ksqlQueriesError).toBe('Connection refused');
      expect(state.ksqlQueriesLoading).toBe(false);
      expect(state.ksqlQueries).toHaveLength(0);
    });

    it('sets loading state while fetching', async () => {
      let resolvePromise: (value: unknown) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      vi.mocked(ksqlApi.listQueries).mockReturnValueOnce(pending as Promise<ksqlApi.KsqlStatementResponse[]>);

      const loadPromise = useWorkspaceStore.getState().loadKsqlQueries();
      expect(useWorkspaceStore.getState().ksqlQueriesLoading).toBe(true);

      resolvePromise!([{ queries: [] }]);
      await loadPromise;
      expect(useWorkspaceStore.getState().ksqlQueriesLoading).toBe(false);
    });

    it('handles response with no queries array', async () => {
      vi.mocked(ksqlApi.listQueries).mockResolvedValueOnce([
        { commandStatus: { status: 'SUCCESS', message: 'ok' } },
      ]);

      await useWorkspaceStore.getState().loadKsqlQueries();

      expect(useWorkspaceStore.getState().ksqlQueries).toHaveLength(0);
      expect(useWorkspaceStore.getState().ksqlQueriesLoading).toBe(false);
    });
  });

  // ── terminateKsqlQuery ──────────────────────────────────────────────
  describe('terminateKsqlQuery', () => {
    it('optimistically removes query from list', async () => {
      useWorkspaceStore.setState({ ksqlQueries: [...mockQueries] });
      vi.mocked(ksqlApi.terminateQuery).mockResolvedValueOnce(undefined);

      const promise = useWorkspaceStore.getState().terminateKsqlQuery('CSAS_STREAM1_0');

      // Optimistic removal: query removed immediately (before API resolves)
      expect(useWorkspaceStore.getState().ksqlQueries).toHaveLength(1);
      expect(useWorkspaceStore.getState().ksqlQueries[0].id).toBe('CTAS_TABLE1_0');

      await promise;
      // Still removed after API success
      expect(useWorkspaceStore.getState().ksqlQueries).toHaveLength(1);
    });

    it('reverts on API error', async () => {
      useWorkspaceStore.setState({ ksqlQueries: [...mockQueries] });
      vi.mocked(ksqlApi.terminateQuery).mockRejectedValueOnce(new Error('Terminate failed'));

      await useWorkspaceStore.getState().terminateKsqlQuery('CSAS_STREAM1_0');

      // Reverted: both queries restored
      expect(useWorkspaceStore.getState().ksqlQueries).toHaveLength(2);
      expect(useWorkspaceStore.getState().ksqlQueries[0].id).toBe('CSAS_STREAM1_0');

      // Error toast shown
      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && t.message.includes('Terminate failed'))).toBe(true);
    });
  });

  // ── navigateToKsqlQueryDetail ───────────────────────────────────────
  describe('navigateToKsqlQueryDetail', () => {
    it('sets activeNavItem to ksql-queries and selectedKsqlQueryId', () => {
      useWorkspaceStore.getState().navigateToKsqlQueryDetail('CSAS_TEST_0');

      const state = useWorkspaceStore.getState();
      expect(state.activeNavItem).toBe('ksql-queries');
      expect(state.selectedKsqlQueryId).toBe('CSAS_TEST_0');
    });
  });

  // ── setKsqlFeatureEnabled ───────────────────────────────────────────
  describe('setKsqlFeatureEnabled', () => {
    it('toggles ksqlFeatureEnabled to true', () => {
      useWorkspaceStore.setState({ ksqlFeatureEnabled: false });

      useWorkspaceStore.getState().setKsqlFeatureEnabled(true);

      expect(useWorkspaceStore.getState().ksqlFeatureEnabled).toBe(true);
    });

    it('toggles ksqlFeatureEnabled to false', () => {
      useWorkspaceStore.setState({ ksqlFeatureEnabled: true });

      useWorkspaceStore.getState().setKsqlFeatureEnabled(false);

      expect(useWorkspaceStore.getState().ksqlFeatureEnabled).toBe(false);
    });

    it('closes dashboard when disabling', () => {
      useWorkspaceStore.setState({
        ksqlFeatureEnabled: true,
        ksqlDashboardOpen: true,
      });

      useWorkspaceStore.getState().setKsqlFeatureEnabled(false);

      expect(useWorkspaceStore.getState().ksqlFeatureEnabled).toBe(false);
      expect(useWorkspaceStore.getState().ksqlDashboardOpen).toBe(false);
    });

    it('does not close dashboard when enabling', () => {
      useWorkspaceStore.setState({
        ksqlFeatureEnabled: false,
        ksqlDashboardOpen: false,
      });

      useWorkspaceStore.getState().setKsqlFeatureEnabled(true);

      expect(useWorkspaceStore.getState().ksqlFeatureEnabled).toBe(true);
    });
  });

  // ── toggleKsqlDashboard ─────────────────────────────────────────────
  describe('toggleKsqlDashboard', () => {
    it('opens dashboard and triggers load', async () => {
      vi.mocked(ksqlApi.listQueries).mockResolvedValueOnce([{ queries: [] }]);

      useWorkspaceStore.getState().toggleKsqlDashboard();

      expect(useWorkspaceStore.getState().ksqlDashboardOpen).toBe(true);
      // Wait for async load
      await vi.waitFor(() => {
        expect(ksqlApi.listQueries).toHaveBeenCalled();
      });
    });

    it('closes dashboard without loading', () => {
      useWorkspaceStore.setState({ ksqlDashboardOpen: true });

      useWorkspaceStore.getState().toggleKsqlDashboard();

      expect(useWorkspaceStore.getState().ksqlDashboardOpen).toBe(false);
      expect(ksqlApi.listQueries).not.toHaveBeenCalled();
    });

    it('mutual exclusion — closes compute pool dashboard', () => {
      useWorkspaceStore.setState({ computePoolDashboardOpen: true });
      vi.mocked(ksqlApi.listQueries).mockResolvedValueOnce([{ queries: [] }]);

      useWorkspaceStore.getState().toggleKsqlDashboard();

      expect(useWorkspaceStore.getState().ksqlDashboardOpen).toBe(true);
      expect(useWorkspaceStore.getState().computePoolDashboardOpen).toBe(false);
    });
  });

  // ── toggleComputePoolDashboard ──────────────────────────────────────
  describe('toggleComputePoolDashboard', () => {
    it('mutual exclusion — closes ksql dashboard', () => {
      useWorkspaceStore.setState({ ksqlDashboardOpen: true });

      useWorkspaceStore.getState().toggleComputePoolDashboard();

      expect(useWorkspaceStore.getState().computePoolDashboardOpen).toBe(true);
      expect(useWorkspaceStore.getState().ksqlDashboardOpen).toBe(false);
    });
  });

  // ── loadKsqlDashboardQueries ────────────────────────────────────────
  describe('loadKsqlDashboardQueries', () => {
    it('populates dashboard state separately from page state', async () => {
      // Pre-populate page state to verify independence
      useWorkspaceStore.setState({ ksqlQueries: [...mockQueries] });

      vi.mocked(ksqlApi.listQueries).mockResolvedValueOnce([
        {
          queries: [
            { id: 'CSAS_DASH_0', queryString: 'CREATE STREAM ...', sinks: ['dash-out'], queryType: 'PERSISTENT', state: 'RUNNING' },
          ],
        },
      ]);

      await useWorkspaceStore.getState().loadKsqlDashboardQueries();

      const state = useWorkspaceStore.getState();
      // Dashboard has its own queries
      expect(state.ksqlDashboardQueries).toHaveLength(1);
      expect(state.ksqlDashboardQueries[0].id).toBe('CSAS_DASH_0');
      expect(state.ksqlDashboardLoading).toBe(false);
      expect(state.ksqlDashboardLastUpdated).toBeInstanceOf(Date);

      // Page queries unchanged
      expect(state.ksqlQueries).toHaveLength(2);
    });

    it('handles API error', async () => {
      vi.mocked(ksqlApi.listQueries).mockRejectedValueOnce(new Error('Timeout'));

      await useWorkspaceStore.getState().loadKsqlDashboardQueries();

      const state = useWorkspaceStore.getState();
      expect(state.ksqlDashboardError).toBe('Timeout');
      expect(state.ksqlDashboardLoading).toBe(false);
    });
  });

  // ── terminateKsqlDashboardQuery ─────────────────────────────────────
  describe('terminateKsqlDashboardQuery', () => {
    it('optimistically removes query from dashboard list', async () => {
      useWorkspaceStore.setState({ ksqlDashboardQueries: [...mockQueries] });
      vi.mocked(ksqlApi.terminateQuery).mockResolvedValueOnce(undefined);

      const promise = useWorkspaceStore.getState().terminateKsqlDashboardQuery('CSAS_STREAM1_0');

      expect(useWorkspaceStore.getState().ksqlDashboardQueries).toHaveLength(1);

      await promise;
      expect(useWorkspaceStore.getState().ksqlDashboardQueries).toHaveLength(1);
    });

    it('reverts dashboard on API error', async () => {
      useWorkspaceStore.setState({ ksqlDashboardQueries: [...mockQueries] });
      vi.mocked(ksqlApi.terminateQuery).mockRejectedValueOnce(new Error('Forbidden'));

      await useWorkspaceStore.getState().terminateKsqlDashboardQuery('CSAS_STREAM1_0');

      expect(useWorkspaceStore.getState().ksqlDashboardQueries).toHaveLength(2);
      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error')).toBe(true);
    });
  });

  // ── setKsqlDashboardHeight ──────────────────────────────────────────
  describe('setKsqlDashboardHeight', () => {
    it('sets height within bounds', () => {
      useWorkspaceStore.getState().setKsqlDashboardHeight(400);
      expect(useWorkspaceStore.getState().ksqlDashboardHeight).toBe(400);
    });

    it('clamps minimum height to 150', () => {
      useWorkspaceStore.getState().setKsqlDashboardHeight(50);
      expect(useWorkspaceStore.getState().ksqlDashboardHeight).toBe(150);
    });

    it('clamps maximum height to 600', () => {
      useWorkspaceStore.getState().setKsqlDashboardHeight(900);
      expect(useWorkspaceStore.getState().ksqlDashboardHeight).toBe(600);
    });
  });
});
