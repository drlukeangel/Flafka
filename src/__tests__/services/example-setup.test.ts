/**
 * @example-setup
 * Tests for one-click Quick Start example setup services.
 * Covers: artifact upload/reuse, table creation via DDL, dataset generation,
 * workspace cell creation, stream panel setup, error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FlinkArtifact } from '../../types';

// ---- Mocks ----

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

// Mock names so runId is deterministic
vi.mock('../../utils/names', () => ({
  generateFunName: vi.fn().mockReturnValue('test-run-123'),
  generateStatementName: vi.fn().mockReturnValue('test-stmt'),
  getSessionTag: vi.fn().mockReturnValue('123'),
  generateTopicStatementName: vi.fn().mockReturnValue('test-topic-stmt'),
}));

// Mock fetch for JAR/ZIP download
const mockFetchResponse = {
  ok: true,
  blob: vi.fn().mockResolvedValue(new Blob(['fake-jar-content'])),
};
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse));

import {
  setupScalarExtractExample,
  setupTableExplodeExample,
} from '../../services/example-setup';

// ---- Helpers ----

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

// ---- Tests ----

describe('[@example-setup] setupScalarExtractExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-test' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
    // Default: no existing artifacts
    mockListArtifacts.mockResolvedValue([]);
  });

  it('skips upload when artifact with same class already exists', async () => {
    const existingArtifact = makeArtifact();
    // listArtifacts returns an artifact with matching class
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    // Should NOT upload a new artifact
    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
    expect(mockCreateArtifact).not.toHaveBeenCalled();
    expect(mockUploadFileToPresignedUrl).not.toHaveBeenCalled();
    // Should still add statements
    expect(store.addStatement).toHaveBeenCalled();
  });

  it('full upload when no existing artifact found', async () => {
    mockListArtifacts.mockResolvedValue([]);
    const createdArtifact = makeArtifact();
    mockGetPresignedUploadUrl.mockResolvedValue({
      upload_url: 'https://s3.example.com/upload',
      upload_id: 'upload-123',
      upload_form_data: {},
    });
    mockCreateArtifact.mockResolvedValue(createdArtifact);
    // getArtifact for version polling
    mockGetArtifact.mockResolvedValue(createdArtifact);

    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith('JAR');
    expect(mockUploadFileToPresignedUrl).toHaveBeenCalled();
    expect(mockCreateArtifact).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith('Uploading UDF artifact...');
  });

  it('stops on artifact upload failure with error', async () => {
    mockListArtifacts.mockResolvedValue([]);
    mockGetPresignedUploadUrl.mockRejectedValue(new Error('Upload service unavailable'));
    const store = makeStore();

    await expect(
      setupScalarExtractExample(store, onProgress)
    ).rejects.toThrow('Upload service unavailable');
  });

  it('creates input and output tables via DDL', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    // createTable calls executeSQL with DDL
    const createTableCalls = mockExecuteSQL.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('CREATE TABLE')
    );
    expect(createTableCalls).toHaveLength(2);
    // Should poll getStatementStatus for each table
    expect(mockGetStatementStatus).toHaveBeenCalled();
  });

  it('generates dataset with 200 records', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(store.addSchemaDataset).toHaveBeenCalledTimes(1);
    const dataset = store.addSchemaDataset.mock.calls[0][0];
    expect(dataset.records).toHaveLength(200);
    // Schema subject includes run ID
    expect(dataset.schemaSubject).toContain('test-run-123');
  });

  it('adds workspace cells with correct labels including run ID', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    // Should add 3 cells: function creation, extraction query, view output
    expect(store.addStatement).toHaveBeenCalledTimes(3);
    // First cell: function creation
    expect(store.addStatement).toHaveBeenCalledWith(
      expect.stringContaining('CREATE FUNCTION'),
      undefined,
      expect.stringContaining('test-run-123'),
    );
  });

  it('opens stream panel and adds stream card for input topic', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(store.setStreamsPanelOpen).toHaveBeenCalledWith(true);
    expect(store.addStreamCard).toHaveBeenCalledWith(
      expect.stringContaining('test-run-123'),
      'produce-consume',
      expect.any(String),
      expect.objectContaining({ type: 'loan-applications', count: 200 }),
    );
  });

  it('returns runId in result', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    const result = await setupScalarExtractExample(store, onProgress);

    expect(result).toHaveProperty('runId');
    expect(result.runId).toBe('test-run-123');
  });

  it('reports progress for each step', async () => {
    const existingArtifact = makeArtifact();
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(onProgress).toHaveBeenCalledWith('Checking for existing artifact...');
    expect(onProgress).toHaveBeenCalledWith('Generating test data...');
    expect(onProgress).toHaveBeenCalledWith('Adding queries to workspace...');
  });

  it('throws when artifact has no versions', async () => {
    const noVersionArtifact = makeArtifact({ versions: [] });
    mockListArtifacts.mockResolvedValue([noVersionArtifact]);
    // getArtifact also returns no versions
    mockGetArtifact.mockResolvedValue(noVersionArtifact);

    const store = makeStore();

    await expect(
      setupScalarExtractExample(store, onProgress)
    ).rejects.toThrow('no versions yet');
  });
});

describe('[@example-setup] setupTableExplodeExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-test' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
    mockListArtifacts.mockResolvedValue([]);
  });

  it('skips upload when artifact with matching class exists', async () => {
    const existingArtifact = makeArtifact({
      class: 'loan_detail_udf.exploder.loan_detail_explode',
      content_format: 'ZIP',
      runtime_language: 'PYTHON',
    });
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupTableExplodeExample(store, onProgress);

    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
    expect(mockCreateArtifact).not.toHaveBeenCalled();
  });

  it('adds function registration and LATERAL TABLE query cells', async () => {
    const existingArtifact = makeArtifact({
      class: 'loan_detail_udf.exploder.loan_detail_explode',
      content_format: 'ZIP',
      runtime_language: 'PYTHON',
    });
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupTableExplodeExample(store, onProgress);

    // Should add 4 cells: 2 function registrations, 1 LATERAL TABLE query, 1 view output
    expect(store.addStatement).toHaveBeenCalledTimes(4);
    // Check for LATERAL TABLE in one of the calls
    const lateralCall = store.addStatement.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('LATERAL TABLE')
    );
    expect(lateralCall).toBeDefined();
  });

  it('creates input and output tables', async () => {
    const existingArtifact = makeArtifact({
      class: 'loan_detail_udf.exploder.loan_detail_explode',
      content_format: 'ZIP',
      runtime_language: 'PYTHON',
    });
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupTableExplodeExample(store, onProgress);

    const createTableCalls = mockExecuteSQL.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('CREATE TABLE')
    );
    expect(createTableCalls).toHaveLength(2);
  });

  it('opens stream panel with produce-consume card', async () => {
    const existingArtifact = makeArtifact({
      class: 'loan_detail_udf.exploder.loan_detail_explode',
      content_format: 'ZIP',
      runtime_language: 'PYTHON',
    });
    mockListArtifacts.mockResolvedValue([existingArtifact]);
    mockGetArtifact.mockResolvedValue(existingArtifact);

    const store = makeStore();
    await setupTableExplodeExample(store, onProgress);

    expect(store.setStreamsPanelOpen).toHaveBeenCalledWith(true);
    expect(store.addStreamCard).toHaveBeenCalledWith(
      expect.stringContaining('test-run-123'),
      'produce-consume',
      expect.any(String),
      expect.objectContaining({ type: 'loan-applications', count: 200 }),
    );
  });
});
