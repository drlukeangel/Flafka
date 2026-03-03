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

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as flinkApi from '../../api/flink-api';
import type { StatementResponse } from '../../api/flink-api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const mockStatements: StatementResponse[] = [
  {
    name: 'stmt-running-1',
    metadata: { created_at: '2026-03-01T10:00:00Z' },
    spec: { statement: 'SELECT * FROM t1', statement_type: 'SELECT', compute_pool_id: 'pool-1', properties: {} },
    status: { phase: 'RUNNING' },
  },
  {
    name: 'stmt-completed-1',
    metadata: { created_at: '2026-03-01T09:00:00Z' },
    spec: { statement: 'SELECT * FROM t2', statement_type: 'SELECT', compute_pool_id: 'pool-1', properties: {} },
    status: { phase: 'COMPLETED' },
  },
  {
    name: 'stmt-failed-1',
    metadata: {},
    spec: { statement: 'BAD SQL', statement_type: 'SELECT', properties: {} },
    status: { phase: 'FAILED', detail: 'Syntax error' },
  },
];

function resetStore() {
  useWorkspaceStore.setState({
    jobStatements: [],
    jobsLoading: false,
    jobsError: null,
    toasts: [],
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('[@jobs-store] Jobs store state and actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('loadJobs', () => {
    it('sets loading true, then false after success', async () => {
      (flinkApi.listStatements as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatements);

      const promise = useWorkspaceStore.getState().loadJobs();
      expect(useWorkspaceStore.getState().jobsLoading).toBe(true);

      await promise;
      expect(useWorkspaceStore.getState().jobsLoading).toBe(false);
    });

    it('calls listStatements with page size 200', async () => {
      (flinkApi.listStatements as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await useWorkspaceStore.getState().loadJobs();
      expect(flinkApi.listStatements).toHaveBeenCalledWith(200);
    });

    it('stores results in jobStatements', async () => {
      (flinkApi.listStatements as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatements);

      await useWorkspaceStore.getState().loadJobs();
      expect(useWorkspaceStore.getState().jobStatements).toEqual(mockStatements);
    });

    it('sets jobsError on API failure', async () => {
      (flinkApi.listStatements as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await useWorkspaceStore.getState().loadJobs();
      expect(useWorkspaceStore.getState().jobsError).toBe('Network error');
      expect(useWorkspaceStore.getState().jobsLoading).toBe(false);
    });

    it('shows error toast on API failure', async () => {
      (flinkApi.listStatements as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Timeout'));

      await useWorkspaceStore.getState().loadJobs();
      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && t.message === 'Timeout')).toBe(true);
    });
  });

  describe('cancelJob', () => {
    beforeEach(() => {
      useWorkspaceStore.setState({ jobStatements: [...mockStatements] });
    });

    it('optimistically updates status to CANCELLED', async () => {
      (flinkApi.cancelStatement as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const promise = useWorkspaceStore.getState().cancelJob('stmt-running-1');
      // After optimistic update but before await
      const stmt = useWorkspaceStore.getState().jobStatements.find((s) => s.name === 'stmt-running-1');
      expect(stmt?.status?.phase).toBe('CANCELLED');

      await promise;
    });

    it('calls cancelStatement with stopAfterTerminatingQueries true', async () => {
      (flinkApi.cancelStatement as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await useWorkspaceStore.getState().cancelJob('stmt-running-1');
      expect(flinkApi.cancelStatement).toHaveBeenCalledWith('stmt-running-1', { stopAfterTerminatingQueries: true });
    });

    it('shows success toast on success', async () => {
      (flinkApi.cancelStatement as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await useWorkspaceStore.getState().cancelJob('stmt-running-1');
      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'success')).toBe(true);
    });

    it('rolls back on API failure', async () => {
      (flinkApi.cancelStatement as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('409 Conflict'));

      await useWorkspaceStore.getState().cancelJob('stmt-running-1');
      const stmt = useWorkspaceStore.getState().jobStatements.find((s) => s.name === 'stmt-running-1');
      expect(stmt?.status?.phase).toBe('RUNNING');
    });

    it('shows error toast on API failure', async () => {
      (flinkApi.cancelStatement as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

      await useWorkspaceStore.getState().cancelJob('stmt-running-1');
      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'error' && t.message === 'Server error')).toBe(true);
    });

    it('does nothing for unknown statement name', async () => {
      await useWorkspaceStore.getState().cancelJob('nonexistent');
      expect(flinkApi.cancelStatement).not.toHaveBeenCalled();
    });
  });

  describe('jobStatements persistence', () => {
    it('jobStatements are NOT in persisted state', () => {
      useWorkspaceStore.setState({ jobStatements: mockStatements });
      // Access the internal persisted state by checking what partialize returns
      // jobStatements should not appear in localStorage
      const stored = localStorage.getItem('flink-workspace');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.jobStatements).toBeUndefined();
      }
    });
  });
});
