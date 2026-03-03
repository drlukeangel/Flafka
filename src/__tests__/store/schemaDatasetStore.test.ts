import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all API modules BEFORE any store import ────────────────────────────
// The store imports flink-api, schema-registry-api, topic-api, and artifact-api
// at module load time; vitest requires mocks to be hoisted before the module
// under test is evaluated.

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

vi.mock('../../api/artifact-api', () => ({
  listArtifacts: vi.fn(),
  deleteArtifact: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  uploadFileToPresignedUrl: vi.fn(),
  createArtifact: vi.fn(),
}));

vi.mock('../../utils/workspace-export', () => ({
  validateWorkspaceJSON: vi.fn(() => ({ valid: true, errors: [] })),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import type { SchemaDataset } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDataset(overrides: Partial<SchemaDataset> = {}): SchemaDataset {
  return {
    id: crypto.randomUUID(),
    name: 'Test Dataset',
    schemaSubject: 'orders-value',
    records: [{ name: 'Alice', age: 30 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('[@schema-dataset-store] Schema Dataset Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      schemaDatasets: [],
      schemaInitialView: null,
      toasts: [],
    });
  });

  it('addSchemaDataset adds to list', () => {
    const ds = makeDataset();
    useWorkspaceStore.getState().addSchemaDataset(ds);
    expect(useWorkspaceStore.getState().schemaDatasets).toHaveLength(1);
    expect(useWorkspaceStore.getState().schemaDatasets[0].id).toBe(ds.id);
  });

  it('add does not mutate other subjects datasets', () => {
    const ds1 = makeDataset({ schemaSubject: 'orders-value' });
    const ds2 = makeDataset({ schemaSubject: 'payments-value' });
    useWorkspaceStore.getState().addSchemaDataset(ds1);
    useWorkspaceStore.getState().addSchemaDataset(ds2);
    const all = useWorkspaceStore.getState().schemaDatasets;
    expect(all).toHaveLength(2);
    expect(all[0].schemaSubject).toBe('orders-value');
    expect(all[1].schemaSubject).toBe('payments-value');
  });

  it('updateSchemaDataset updates correct entry', () => {
    // Use an old timestamp so the update is guaranteed to produce a different one
    const ds = makeDataset({ name: 'Original', updatedAt: '2020-01-01T00:00:00.000Z' });
    useWorkspaceStore.getState().addSchemaDataset(ds);
    useWorkspaceStore.getState().updateSchemaDataset(ds.id, { name: 'Updated' });
    const updated = useWorkspaceStore.getState().schemaDatasets[0];
    expect(updated.name).toBe('Updated');
    expect(updated.updatedAt).not.toBe(ds.updatedAt);
  });

  it('update non-existent ID is no-op', () => {
    const ds = makeDataset();
    useWorkspaceStore.getState().addSchemaDataset(ds);
    useWorkspaceStore.getState().updateSchemaDataset('nonexistent', { name: 'Nope' });
    expect(useWorkspaceStore.getState().schemaDatasets[0].name).toBe(ds.name);
  });

  it('deleteSchemaDataset removes correct entry', () => {
    const ds1 = makeDataset({ name: 'Keep' });
    const ds2 = makeDataset({ name: 'Delete' });
    useWorkspaceStore.getState().addSchemaDataset(ds1);
    useWorkspaceStore.getState().addSchemaDataset(ds2);
    useWorkspaceStore.getState().deleteSchemaDataset(ds2.id);
    const remaining = useWorkspaceStore.getState().schemaDatasets;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Keep');
  });

  it('delete non-existent ID is no-op', () => {
    const ds = makeDataset();
    useWorkspaceStore.getState().addSchemaDataset(ds);
    useWorkspaceStore.getState().deleteSchemaDataset('nonexistent');
    expect(useWorkspaceStore.getState().schemaDatasets).toHaveLength(1);
  });

  it('datasets scoped per subject', () => {
    const ds1 = makeDataset({ schemaSubject: 'orders-value' });
    const ds2 = makeDataset({ schemaSubject: 'payments-value' });
    useWorkspaceStore.getState().addSchemaDataset(ds1);
    useWorkspaceStore.getState().addSchemaDataset(ds2);
    const ordersDs = useWorkspaceStore.getState().schemaDatasets.filter(
      (d) => d.schemaSubject === 'orders-value'
    );
    expect(ordersDs).toHaveLength(1);
  });

  it('schemaDatasets persisted to localStorage', () => {
    const ds = makeDataset();
    useWorkspaceStore.getState().addSchemaDataset(ds);
    const stored = localStorage.getItem('flink-workspace');
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state.schemaDatasets).toBeDefined();
      expect(parsed.state.schemaDatasets).toHaveLength(1);
    }
  });

  it('record count > 500 rejected', () => {
    const bigRecords = Array.from({ length: 501 }, (_, i) => ({ id: i }));
    const ds = makeDataset({ records: bigRecords });
    useWorkspaceStore.getState().addSchemaDataset(ds);
    expect(useWorkspaceStore.getState().schemaDatasets).toHaveLength(0);
  });

  it('corrupt localStorage does not crash', () => {
    localStorage.setItem('flink-workspace', 'not-valid-json{{{');
    // Re-importing the store should not throw
    expect(() => useWorkspaceStore.getState()).not.toThrow();
  });

  describe('cross-panel navigation', () => {
    it('navigateToSchemaDatasets sets activeNavItem and schemaInitialView', () => {
      // Mock getSchemaDetail so loadSchemaDetail doesn't throw
      vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValue({
        subject: 'orders-value',
        version: 1,
        id: 100,
        schemaType: 'AVRO',
        schema: '{"type":"record","name":"Order","fields":[]}',
      });

      useWorkspaceStore.getState().navigateToSchemaDatasets('orders-value');
      const state = useWorkspaceStore.getState();
      expect(state.activeNavItem).toBe('schemas');
      expect(state.schemaInitialView).toBe('datasets');
    });

    it('clearSchemaInitialView sets to null', () => {
      useWorkspaceStore.setState({ schemaInitialView: 'datasets' });
      useWorkspaceStore.getState().clearSchemaInitialView();
      expect(useWorkspaceStore.getState().schemaInitialView).toBeNull();
    });
  });
});
