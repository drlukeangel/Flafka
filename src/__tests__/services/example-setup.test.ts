/**
 * @example-setup
 * Tests for one-click Quick Start example setup services.
 * Covers: UDF registration, artifact upload, topic/table creation,
 * dataset generation, workspace cell creation, idempotency, error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FlinkArtifact } from '../../types';

// ---- Mocks ----

const mockExecuteSQL = vi.fn();
const mockPollForResults = vi.fn();
const mockGetFunctions = vi.fn();
const mockGetTables = vi.fn();

vi.mock('../../api/flink-api', () => ({
  executeSQL: (...args: unknown[]) => mockExecuteSQL(...args),
  pollForResults: (...args: unknown[]) => mockPollForResults(...args),
  getFunctions: (...args: unknown[]) => mockGetFunctions(...args),
  getTables: (...args: unknown[]) => mockGetTables(...args),
}));

const mockListArtifacts = vi.fn();
const mockGetPresignedUploadUrl = vi.fn();
const mockUploadFileToPresignedUrl = vi.fn();
const mockCreateArtifact = vi.fn();

vi.mock('../../api/artifact-api', () => ({
  listArtifacts: (...args: unknown[]) => mockListArtifacts(...args),
  getPresignedUploadUrl: (...args: unknown[]) => mockGetPresignedUploadUrl(...args),
  uploadFileToPresignedUrl: (...args: unknown[]) => mockUploadFileToPresignedUrl(...args),
  createArtifact: (...args: unknown[]) => mockCreateArtifact(...args),
}));

const mockListTopics = vi.fn();
const mockCreateTopic = vi.fn();

vi.mock('../../api/topic-api', () => ({
  listTopics: (...args: unknown[]) => mockListTopics(...args),
  createTopic: (...args: unknown[]) => mockCreateTopic(...args),
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
    ...overrides,
  };
}

const onProgress = vi.fn();

// ---- Tests ----

describe('[@example-setup] setupScalarExtractExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTables.mockResolvedValue([]);
    mockListTopics.mockResolvedValue([]);
    mockCreateTopic.mockResolvedValue({});
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-test' });
    mockPollForResults.mockResolvedValue([]);
  });

  it('skips upload + registration when UDF already exists', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
    expect(mockCreateArtifact).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith('UDF already registered — skipping');
    expect(store.addStatement).toHaveBeenCalled();
  });

  it('skips upload when artifact exists, only creates function', async () => {
    mockGetFunctions.mockResolvedValue([]);
    const existingArtifact = makeArtifact();
    const store = makeStore({
      artifactList: [existingArtifact],
    });

    await setupScalarExtractExample(store, onProgress);

    // Should NOT upload
    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
    // Should register function
    expect(mockExecuteSQL).toHaveBeenCalledWith(
      expect.stringContaining('CREATE FUNCTION')
    );
  });

  it('full upload + register when UDF not found and no artifact', async () => {
    mockGetFunctions.mockResolvedValue([]);
    const createdArtifact = makeArtifact();
    mockGetPresignedUploadUrl.mockResolvedValue({
      upload_url: 'https://s3.example.com/upload',
      upload_id: 'upload-123',
      upload_form_data: {},
    });
    mockCreateArtifact.mockResolvedValue(createdArtifact);

    const store = makeStore();
    // loadArtifacts updates artifactList to include the new artifact
    store.loadArtifacts.mockImplementation(async () => {
      store.artifactList = [createdArtifact];
    });

    await setupScalarExtractExample(store, onProgress);

    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith('JAR');
    expect(mockUploadFileToPresignedUrl).toHaveBeenCalled();
    expect(mockCreateArtifact).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith('Uploading UDF artifact...');
    expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Registering UDF'));
  });

  it('stops on artifact upload failure with error', async () => {
    mockGetFunctions.mockResolvedValue([]);
    mockGetPresignedUploadUrl.mockRejectedValue(new Error('Upload service unavailable'));
    const store = makeStore();

    await expect(
      setupScalarExtractExample(store, onProgress)
    ).rejects.toThrow('Upload service unavailable');
  });

  it('stops on CREATE FUNCTION failure', async () => {
    mockGetFunctions.mockResolvedValue([]);
    const artifact = makeArtifact();
    const store = makeStore({ artifactList: [artifact] });
    mockExecuteSQL.mockRejectedValueOnce(new Error('DDL failed'));

    await expect(
      setupScalarExtractExample(store, onProgress)
    ).rejects.toThrow('DDL failed');
  });

  it('skips topic creation when topic already exists', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    mockListTopics.mockResolvedValue([
      { topic_name: 'EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS' },
      { topic_name: 'EOT-PLATFORM-EXAMPLES-LOAN-DETAILS' },
    ]);
    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(mockCreateTopic).not.toHaveBeenCalled();
  });

  it('creates topics via REST API when not present', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    mockListTopics.mockResolvedValue([]);
    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(mockCreateTopic).toHaveBeenCalledTimes(2);
    expect(mockCreateTopic).toHaveBeenCalledWith(expect.objectContaining({
      topic_name: 'EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS',
    }));
    expect(mockCreateTopic).toHaveBeenCalledWith(expect.objectContaining({
      topic_name: 'EOT-PLATFORM-EXAMPLES-LOAN-DETAILS',
    }));
  });

  it('skips table creation when tables already exist (SHOW TABLES check)', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    mockGetTables.mockResolvedValue([
      'EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS',
      'EOT-PLATFORM-EXAMPLES-LOAN-DETAILS',
    ]);
    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    // executeSQL should NOT be called for CREATE TABLE (only for extraction query cell)
    const createTableCalls = mockExecuteSQL.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('CREATE TABLE')
    );
    expect(createTableCalls).toHaveLength(0);
  });

  it('creates tables via DDL + polls COMPLETED when not present', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    mockGetTables.mockResolvedValue([]);
    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    const createTableCalls = mockExecuteSQL.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('CREATE TABLE')
    );
    expect(createTableCalls).toHaveLength(2);
    expect(mockPollForResults).toHaveBeenCalled();
  });

  it('creates dataset with 200 records and correct schema subject', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(store.addSchemaDataset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Loan Applications (200 records)',
        schemaSubject: 'EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS-value',
      })
    );
    const dataset = store.addSchemaDataset.mock.calls[0][0];
    expect(dataset.records).toHaveLength(200);
  });

  it('skips dataset when one with same name+subject already exists', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    const store = makeStore({
      schemaDatasets: [{
        name: 'Loan Applications (200 records)',
        schemaSubject: 'EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS-value',
      }],
    });
    await setupScalarExtractExample(store, onProgress);

    expect(store.addSchemaDataset).not.toHaveBeenCalled();
  });

  it('adds extraction query cell to workspace', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(store.addStatement).toHaveBeenCalledWith(
      expect.stringContaining('LoanDetailExtract'),
      undefined,
      'extract-loan-details'
    );
  });

  it('reports progress for each step', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailextract']);
    const store = makeStore();
    await setupScalarExtractExample(store, onProgress);

    expect(onProgress).toHaveBeenCalledWith('Checking for existing UDF...');
    expect(onProgress).toHaveBeenCalledWith('Adding query to workspace...');
  });
});

describe('[@example-setup] setupTableExplodeExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTables.mockResolvedValue([]);
    mockListTopics.mockResolvedValue([]);
    mockCreateTopic.mockResolvedValue({});
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-test' });
    mockPollForResults.mockResolvedValue([]);
  });

  it('skips registration when explode UDF already exists', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailexplode']);
    const store = makeStore();
    await setupTableExplodeExample(store, onProgress);

    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith('UDF already registered — skipping');
  });

  it('registers both Python functions from same artifact', async () => {
    mockGetFunctions.mockResolvedValue([]);
    const artifact = makeArtifact({
      class: 'loan_detail_udf.exploder.loan_detail_explode',
      content_format: 'ZIP',
      runtime_language: 'PYTHON',
    });
    const store = makeStore({ artifactList: [artifact] });
    await setupTableExplodeExample(store, onProgress);

    // Should register both extract and explode functions
    const createFnCalls = mockExecuteSQL.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('CREATE FUNCTION')
    );
    expect(createFnCalls).toHaveLength(2);
  });

  it('creates explode output topic', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailexplode']);
    const store = makeStore();
    await setupTableExplodeExample(store, onProgress);

    expect(mockCreateTopic).toHaveBeenCalledWith(expect.objectContaining({
      topic_name: 'EOT-PLATFORM-EXAMPLES-LOAN-TRADELINES',
    }));
  });

  it('adds LATERAL TABLE query cell', async () => {
    mockGetFunctions.mockResolvedValue(['loandetailexplode']);
    const store = makeStore();
    await setupTableExplodeExample(store, onProgress);

    expect(store.addStatement).toHaveBeenCalledWith(
      expect.stringContaining('LATERAL TABLE'),
      undefined,
      'explode-loan-tradelines'
    );
  });
});
