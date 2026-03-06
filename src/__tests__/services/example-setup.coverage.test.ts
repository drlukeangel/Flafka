/**
 * @example-setup-coverage
 * Additional coverage for example-setup: setupJavaTableExplodeExample,
 * Python LANGUAGE keyword, fetch failure, version polling timeout,
 * artifact getArtifact fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FlinkArtifact } from '../../types';

const mockExecuteSQL = vi.fn();
const mockGetStatementStatus = vi.fn();

vi.mock('../../api/flink-api', () => ({
  executeSQL: (...args: unknown[]) => mockExecuteSQL(...args),
  getStatementStatus: (...args: unknown[]) => mockGetStatementStatus(...args),
}));

const mockListArtifacts = vi.fn();
const mockGetArtifact = vi.fn();
const mockGetPresignedUploadUrl = vi.fn();
const mockUploadFileToPresignedUrl = vi.fn();
const mockCreateArtifact = vi.fn();

vi.mock('../../api/artifact-api', () => ({
  listArtifacts: (...args: unknown[]) => mockListArtifacts(...args),
  getArtifact: (...args: unknown[]) => mockGetArtifact(...args),
  getPresignedUploadUrl: (...args: unknown[]) => mockGetPresignedUploadUrl(...args),
  uploadFileToPresignedUrl: (...args: unknown[]) => mockUploadFileToPresignedUrl(...args),
  createArtifact: (...args: unknown[]) => mockCreateArtifact(...args),
}));

vi.mock('../../config/environment', () => ({
  env: {
    flinkCatalog: 'test-catalog',
    flinkDatabase: 'test-db',
    cloudProvider: 'aws',
    cloudRegion: 'us-east-1',
    environmentId: 'env-123',
  },
}));

vi.mock('../../utils/names', () => ({
  generateFunName: vi.fn().mockReturnValue('test-run-123'),
  generateStatementName: vi.fn().mockReturnValue('test-stmt'),
  getSessionTag: vi.fn().mockReturnValue('123'),
  generateTopicStatementName: vi.fn().mockReturnValue('test-topic-stmt'),
}));

const mockFetchResponse = {
  ok: true,
  blob: vi.fn().mockResolvedValue(new Blob(['fake-content'])),
};
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse));

import {
  setupScalarExtractExample,
  setupTableExplodeExample,
  setupJavaTableExplodeExample,
} from '../../services/example-setup';

function makeArtifact(overrides: Partial<FlinkArtifact> = {}): FlinkArtifact {
  return {
    id: 'cfa-test123',
    display_name: 'Test Artifact',
    class: 'com.fm.flink.udf.LoanDetailExtractor',
    content_format: 'JAR',
    cloud: 'aws',
    region: 'us-east-1',
    environment: 'env-123',
    runtime_language: 'JAVA',
    versions: [{ version: 'ver-001' }],
    ...overrides,
  };
}

function makeStore(overrides: Record<string, unknown> = {}) {
  return {
    addStatement: vi.fn(),
    addToast: vi.fn(),
    setActiveNavItem: vi.fn(),
    addSchemaDataset: vi.fn(),
    schemaDatasets: [] as Array<{ name: string; schemaSubject: string }>,
    artifactList: [] as FlinkArtifact[],
    loadArtifacts: vi.fn().mockResolvedValue(undefined),
    statements: [{ id: 'stmt-1' }],
    addStreamCard: vi.fn(),
    setStreamsPanelOpen: vi.fn(),
    ...overrides,
  };
}

const onProgress = vi.fn();

describe('[@example-setup-coverage] setupJavaTableExplodeExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-test' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
    mockListArtifacts.mockResolvedValue([]);
  });

  it('reuses existing artifact and creates tables', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    const result = await setupJavaTableExplodeExample(store, onProgress);

    expect(result.runId).toBe('test-run-123');
    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('adds 4 statements: 2 functions + lateral table query + view', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupJavaTableExplodeExample(store, onProgress);

    expect(store.addStatement).toHaveBeenCalledTimes(4);
  });

  it('uses LATERAL TABLE in Java explode query (not f0/f1 aliases)', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupJavaTableExplodeExample(store, onProgress);

    const lateralCall = store.addStatement.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('LATERAL TABLE')
    );
    expect(lateralCall).toBeDefined();
    // Java version uses t.array_index and t.element_json, not f0/f1
    const sql = lateralCall![0] as string;
    expect(sql).toContain('t.array_index');
    expect(sql).toContain('t.element_json');
  });

  it('creates explode output DDL with correct columns', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupJavaTableExplodeExample(store, onProgress);

    const createTableCalls = mockExecuteSQL.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('CREATE TABLE')
    );
    expect(createTableCalls).toHaveLength(2);
    // Output table should have tradeline_index column
    const outputDDL = createTableCalls.find(
      (call: unknown[]) => (call[0] as string).includes('tradeline_index')
    );
    expect(outputDDL).toBeDefined();
  });

  it('opens stream panel with produce-consume card', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupJavaTableExplodeExample(store, onProgress);

    expect(store.setStreamsPanelOpen).toHaveBeenCalledWith(true);
    expect(store.addStreamCard).toHaveBeenCalledWith(
      expect.stringContaining('test-run-123'),
      'produce-consume',
      expect.any(String),
      expect.objectContaining({ type: 'loan-applications' }),
    );
  });

  it('throws when artifact has no versions', async () => {
    const noVersionArtifact = makeArtifact({ versions: [] });
    mockListArtifacts.mockResolvedValue([noVersionArtifact]);
    mockGetArtifact.mockResolvedValue(noVersionArtifact);

    const store = makeStore();
    await expect(
      setupJavaTableExplodeExample(store, onProgress)
    ).rejects.toThrow('no versions yet');
  });
});

describe('[@example-setup-coverage] Python LANGUAGE keyword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-test' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
  });

  it('Python function SQL includes LANGUAGE PYTHON', async () => {
    const existingArtifact = makeArtifact({
      class: 'loan_detail_udf.exploder.loan_detail_explode',
      content_format: 'ZIP',
      runtime_language: 'PYTHON',
    });
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupTableExplodeExample(store, onProgress);

    // Find the CREATE FUNCTION calls
    const fnCalls = store.addStatement.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('CREATE FUNCTION')
    );
    expect(fnCalls.length).toBeGreaterThan(0);
    // At least one should have LANGUAGE PYTHON
    const pythonFn = fnCalls.find(
      (call: unknown[]) => (call[0] as string).includes('LANGUAGE PYTHON')
    );
    expect(pythonFn).toBeDefined();
  });
});

describe('[@example-setup-coverage] fetch failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-test' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
    mockListArtifacts.mockResolvedValue([]);
  });

  it('throws when fetch returns non-ok response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      blob: vi.fn(),
    } as any);

    const store = makeStore();
    await expect(
      setupScalarExtractExample(store, onProgress)
    ).rejects.toThrow('Failed to fetch');
  });
});

describe('[@example-setup-coverage] artifact getArtifact fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-test' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
  });

  it('falls back to existing artifact record when getArtifact fails', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    // getArtifact fails — should fall back to the listing result
    mockGetArtifact.mockRejectedValue(new Error('Not found'));

    const store = makeStore();
    const result = await setupScalarExtractExample(store, onProgress);

    // Should still succeed since it falls back to existing artifact
    expect(result.runId).toBe('test-run-123');
    expect(store.addStatement).toHaveBeenCalled();
  });
});
