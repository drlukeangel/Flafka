import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all API modules BEFORE any store import ────────────────────────────
vi.mock('../../api/flink-api', () => ({
  executeSQL: vi.fn(),
  getStatementStatus: vi.fn(),
  getStatementResults: vi.fn(),
  cancelStatement: vi.fn(),
  getComputePoolStatus: vi.fn(),
  listStatements: vi.fn(),
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

// Also mock artifact-api since workspaceStore imports it
vi.mock('../../api/artifact-api', () => ({
  listArtifacts: vi.fn(),
  getArtifact: vi.fn(),
  deleteArtifact: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  uploadArtifactFile: vi.fn(),
  createArtifact: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as flinkApi from '../../api/flink-api';
import * as telemetryApi from '../../api/telemetry-api';
import type { StatementTelemetry } from '../../types';

const mockTelemetry: StatementTelemetry[] = [
  {
    statementName: 'stmt-1',
    cfus: 4,
    recordsIn: 100,
    recordsOut: 80,
    pendingRecords: 20,
    stateSizeBytes: 1024,
    sql: 'SELECT * FROM t1',
    createdAt: '2026-03-01T10:00:00Z',
    isWorkspaceStatement: true,
  },
];

function resetStore() {
  useWorkspaceStore.setState({
    computePoolDashboardOpen: false,
    statementTelemetry: [],
    telemetryLoading: false,
    telemetryError: null,
    telemetryLastUpdated: null,
    dashboardHeight: 280,
    computePoolMaxCfu: null,
    toasts: [],
    statements: [{ id: '1', code: 'SELECT 1', status: 'RUNNING', createdAt: new Date(), statementName: 'stmt-1' }],
  });
}

describe('[@store] [@dashboard] Compute Pool Dashboard Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('toggleComputePoolDashboard', () => {
    it('should toggle dashboard open and trigger initial load', async () => {
      vi.mocked(telemetryApi.getStatementTelemetry).mockResolvedValueOnce(mockTelemetry);

      useWorkspaceStore.getState().toggleComputePoolDashboard();

      expect(useWorkspaceStore.getState().computePoolDashboardOpen).toBe(true);
      // Wait for async load
      await vi.waitFor(() => {
        expect(useWorkspaceStore.getState().telemetryLoading).toBe(false);
      });
      expect(telemetryApi.getStatementTelemetry).toHaveBeenCalled();
    });

    it('should toggle dashboard closed without loading', () => {
      useWorkspaceStore.setState({ computePoolDashboardOpen: true });

      useWorkspaceStore.getState().toggleComputePoolDashboard();

      expect(useWorkspaceStore.getState().computePoolDashboardOpen).toBe(false);
      expect(telemetryApi.getStatementTelemetry).not.toHaveBeenCalled();
    });
  });

  describe('loadStatementTelemetry', () => {
    it('should set loading state and store results', async () => {
      vi.mocked(telemetryApi.getStatementTelemetry).mockResolvedValueOnce(mockTelemetry);

      const promise = useWorkspaceStore.getState().loadStatementTelemetry();

      expect(useWorkspaceStore.getState().telemetryLoading).toBe(true);

      await promise;

      expect(useWorkspaceStore.getState().telemetryLoading).toBe(false);
      expect(useWorkspaceStore.getState().statementTelemetry).toEqual(mockTelemetry);
      expect(useWorkspaceStore.getState().telemetryLastUpdated).toBeInstanceOf(Date);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(telemetryApi.getStatementTelemetry).mockRejectedValueOnce(new Error('Network error'));

      await useWorkspaceStore.getState().loadStatementTelemetry();

      expect(useWorkspaceStore.getState().telemetryLoading).toBe(false);
      expect(useWorkspaceStore.getState().telemetryError).toBe('Network error');
    });

    it('should pass workspace statement names to API', async () => {
      vi.mocked(telemetryApi.getStatementTelemetry).mockResolvedValueOnce([]);

      await useWorkspaceStore.getState().loadStatementTelemetry();

      expect(telemetryApi.getStatementTelemetry).toHaveBeenCalledWith(['stmt-1']);
    });
  });

  describe('stopDashboardStatement', () => {
    it('should cancel statement and show success toast', async () => {
      vi.mocked(flinkApi.cancelStatement).mockResolvedValueOnce(undefined);
      vi.mocked(telemetryApi.getStatementTelemetry).mockResolvedValue([]);

      await useWorkspaceStore.getState().stopDashboardStatement('stmt-1');

      expect(flinkApi.cancelStatement).toHaveBeenCalledWith('stmt-1');
      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.message.includes('Stopped stmt-1'))).toBe(true);
    });

    it('should handle 409 conflict gracefully', async () => {
      const error = { status: 409, message: 'Conflict' };
      vi.mocked(flinkApi.cancelStatement).mockRejectedValueOnce(error);
      vi.mocked(telemetryApi.getStatementTelemetry).mockResolvedValue([]);

      await useWorkspaceStore.getState().stopDashboardStatement('stmt-1');

      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.message.includes('already stopped'))).toBe(true);
    });

    it('should show error toast on failure', async () => {
      const error = { message: 'Server error' };
      vi.mocked(flinkApi.cancelStatement).mockRejectedValueOnce(error);

      await useWorkspaceStore.getState().stopDashboardStatement('stmt-1');

      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error')).toBe(true);
    });

    it('should refresh telemetry after successful stop', async () => {
      vi.mocked(flinkApi.cancelStatement).mockResolvedValueOnce(undefined);
      vi.mocked(telemetryApi.getStatementTelemetry).mockResolvedValue([]);

      await useWorkspaceStore.getState().stopDashboardStatement('stmt-1');

      expect(telemetryApi.getStatementTelemetry).toHaveBeenCalled();
    });
  });

  describe('setDashboardHeight', () => {
    it('should set height within bounds', () => {
      useWorkspaceStore.getState().setDashboardHeight(400);
      expect(useWorkspaceStore.getState().dashboardHeight).toBe(400);
    });

    it('should clamp minimum height to 120', () => {
      useWorkspaceStore.getState().setDashboardHeight(50);
      expect(useWorkspaceStore.getState().dashboardHeight).toBe(120);
    });

    it('should clamp maximum height to 600', () => {
      useWorkspaceStore.getState().setDashboardHeight(900);
      expect(useWorkspaceStore.getState().dashboardHeight).toBe(600);
    });
  });

  describe('loadComputePoolStatus (updated)', () => {
    it('should set maxCfu from API response', async () => {
      vi.mocked(flinkApi.getComputePoolStatus).mockResolvedValueOnce({
        phase: 'PROVISIONED',
        currentCfu: 4,
        maxCfu: 10,
      });

      await useWorkspaceStore.getState().loadComputePoolStatus();

      expect(useWorkspaceStore.getState().computePoolMaxCfu).toBe(10);
      expect(useWorkspaceStore.getState().computePoolCfu).toBe(4);
    });

    it('should set maxCfu to null on error', async () => {
      vi.mocked(flinkApi.getComputePoolStatus).mockRejectedValueOnce(new Error('fail'));

      await useWorkspaceStore.getState().loadComputePoolStatus();

      expect(useWorkspaceStore.getState().computePoolMaxCfu).toBeNull();
    });
  });

  describe('partialize (persistence)', () => {
    it('should NOT include dashboard state in persisted data', () => {
      useWorkspaceStore.setState({
        computePoolDashboardOpen: true,
        statementTelemetry: mockTelemetry,
        dashboardHeight: 400,
      });

      // Access the persisted state via the store's internal persist API
      const persistedState = JSON.parse(
        localStorage.getItem('flink-workspace') || '{}'
      );
      // These keys should not appear in localStorage
      expect(persistedState?.state?.computePoolDashboardOpen).toBeUndefined();
      expect(persistedState?.state?.statementTelemetry).toBeUndefined();
      expect(persistedState?.state?.dashboardHeight).toBeUndefined();
    });
  });
});
