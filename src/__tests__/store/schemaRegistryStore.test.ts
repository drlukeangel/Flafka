import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all API modules BEFORE any store import ────────────────────────────
// The store imports both flink-api and schema-registry-api at module load time;
// vitest requires mocks to be hoisted before the module under test is evaluated.

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

// Mock workspace-export utility (imported by the store)
vi.mock('../../utils/workspace-export', () => ({
  validateWorkspaceJSON: vi.fn(() => ({ valid: true, errors: [] })),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import type { SchemaSubject } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Canonical blank schema-registry state used in beforeEach resets. */
const srDefaults = {
  schemaRegistrySubjects: [],
  selectedSchemaSubject: null,
  schemaRegistryLoading: false,
  schemaRegistryError: null,
  // Reset unrelated slices so tests are isolated from each other
  statements: [],
  toasts: [],
  statementHistory: [],
  historyLoading: false,
  historyError: null,
};

/** Build a realistic SchemaSubject fixture. */
function makeSchemaSubject(overrides: Partial<SchemaSubject> = {}): SchemaSubject {
  return {
    subject: 'user-events-value',
    version: 1,
    id: 42,
    schemaType: 'AVRO',
    schema: JSON.stringify({
      type: 'record',
      name: 'UserEvent',
      fields: [
        { name: 'userId', type: 'string' },
        { name: 'eventType', type: 'string' },
      ],
    }),
    ...overrides,
  };
}

// ─── Test suites ─────────────────────────────────────────────────────────────

describe('[@schema-registry-store] loadSchemaRegistrySubjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(srDefaults);
  });

  it('sets subjects array on success', async () => {
    const subjects = ['user-events-value', 'order-created-value', 'payment-processed-value'];
    vi.mocked(schemaRegistryApi.listSubjects).mockResolvedValueOnce(subjects);

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    const state = useWorkspaceStore.getState();
    expect(state.schemaRegistrySubjects).toEqual(subjects);
  });

  it('clears loading flag after success', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockResolvedValueOnce(['topic-value']);

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(false);
  });

  it('does not set error on success', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockResolvedValueOnce(['topic-value']);

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull();
  });

  it('sets error message on failure', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockRejectedValueOnce(
      new Error('Schema Registry unreachable')
    );

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistryError).toBe(
      'Schema Registry unreachable'
    );
  });

  it('clears loading flag after failure', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockRejectedValueOnce(new Error('timeout'));

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(false);
  });

  it('does not populate subjects on failure', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockRejectedValueOnce(new Error('network error'));

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistrySubjects).toEqual([]);
  });

  it('uses fallback message for non-Error rejections', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockRejectedValueOnce('plain string error');

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistryError).toBe('Failed to load schemas');
  });

  it('handles empty subjects list returned by the API', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockResolvedValueOnce([]);

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistrySubjects).toEqual([]);
    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull();
  });

  it('replaces a previously-loaded subjects list on refresh', async () => {
    useWorkspaceStore.setState({ schemaRegistrySubjects: ['old-topic-value'] });

    vi.mocked(schemaRegistryApi.listSubjects).mockResolvedValueOnce([
      'new-topic-a-value',
      'new-topic-b-value',
    ]);

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistrySubjects).toEqual([
      'new-topic-a-value',
      'new-topic-b-value',
    ]);
  });

  it('clears a prior error when a subsequent call succeeds', async () => {
    useWorkspaceStore.setState({ schemaRegistryError: 'previous error' });
    vi.mocked(schemaRegistryApi.listSubjects).mockResolvedValueOnce(['topic-value']);

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@schema-registry-store] loadSchemaDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(srDefaults);
  });

  it('sets selectedSchemaSubject on success with default (latest) version', async () => {
    const detail = makeSchemaSubject();
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(detail);

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value');

    expect(useWorkspaceStore.getState().selectedSchemaSubject).toEqual(detail);
  });

  it('calls getSchemaDetail with the provided subject name', async () => {
    const detail = makeSchemaSubject({ subject: 'payment-processed-value' });
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(detail);

    await useWorkspaceStore.getState().loadSchemaDetail('payment-processed-value');

    expect(schemaRegistryApi.getSchemaDetail).toHaveBeenCalledWith(
      'payment-processed-value',
      'latest'
    );
  });

  it('calls getSchemaDetail with a specific numeric version when supplied', async () => {
    const detail = makeSchemaSubject({ version: 3 });
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(detail);

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value', 3);

    expect(schemaRegistryApi.getSchemaDetail).toHaveBeenCalledWith('user-events-value', 3);
    expect(useWorkspaceStore.getState().selectedSchemaSubject?.version).toBe(3);
  });

  it('clears loading flag after success', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(makeSchemaSubject());

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value');

    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(false);
  });

  it('does not set error on success', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(makeSchemaSubject());

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value');

    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull();
  });

  it('sets error message on failure', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockRejectedValueOnce(
      new Error('Subject not found')
    );

    await useWorkspaceStore.getState().loadSchemaDetail('nonexistent-subject');

    expect(useWorkspaceStore.getState().schemaRegistryError).toBe('Subject not found');
  });

  it('clears loading flag after failure', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockRejectedValueOnce(new Error('404'));

    await useWorkspaceStore.getState().loadSchemaDetail('bad-subject');

    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(false);
  });

  it('does not overwrite selectedSchemaSubject on failure', async () => {
    const existing = makeSchemaSubject({ subject: 'previously-loaded' });
    useWorkspaceStore.setState({ selectedSchemaSubject: existing });

    vi.mocked(schemaRegistryApi.getSchemaDetail).mockRejectedValueOnce(
      new Error('network failure')
    );

    await useWorkspaceStore.getState().loadSchemaDetail('bad-subject');

    // selectedSchemaSubject should retain the previously loaded value
    expect(useWorkspaceStore.getState().selectedSchemaSubject).toEqual(existing);
  });

  it('uses fallback message for non-Error rejections', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockRejectedValueOnce(null);

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value');

    expect(useWorkspaceStore.getState().schemaRegistryError).toBe(
      'Failed to load schema detail'
    );
  });

  it('correctly stores PROTOBUF schema type', async () => {
    const protoDetail = makeSchemaSubject({ schemaType: 'PROTOBUF', subject: 'proto-events-value' });
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(protoDetail);

    await useWorkspaceStore.getState().loadSchemaDetail('proto-events-value');

    expect(useWorkspaceStore.getState().selectedSchemaSubject?.schemaType).toBe('PROTOBUF');
  });

  it('correctly stores JSON schema type', async () => {
    const jsonDetail = makeSchemaSubject({ schemaType: 'JSON', subject: 'json-events-value' });
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(jsonDetail);

    await useWorkspaceStore.getState().loadSchemaDetail('json-events-value');

    expect(useWorkspaceStore.getState().selectedSchemaSubject?.schemaType).toBe('JSON');
  });

  it('overwrites a previously-selected schema with the newly loaded one', async () => {
    const first = makeSchemaSubject({ subject: 'first-topic-value', id: 1 });
    const second = makeSchemaSubject({ subject: 'second-topic-value', id: 2 });

    vi.mocked(schemaRegistryApi.getSchemaDetail)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    await useWorkspaceStore.getState().loadSchemaDetail('first-topic-value');
    await useWorkspaceStore.getState().loadSchemaDetail('second-topic-value');

    expect(useWorkspaceStore.getState().selectedSchemaSubject?.subject).toBe(
      'second-topic-value'
    );
  });

  it('clears a prior error when a subsequent call succeeds', async () => {
    useWorkspaceStore.setState({ schemaRegistryError: 'stale error' });
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(makeSchemaSubject());

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value');

    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@schema-registry-store] clearSelectedSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(srDefaults);
  });

  it('sets selectedSchemaSubject to null', () => {
    useWorkspaceStore.setState({ selectedSchemaSubject: makeSchemaSubject() });

    useWorkspaceStore.getState().clearSelectedSchema();

    expect(useWorkspaceStore.getState().selectedSchemaSubject).toBeNull();
  });

  it('clears schemaRegistryError', () => {
    useWorkspaceStore.setState({ schemaRegistryError: 'some prior error' });

    useWorkspaceStore.getState().clearSelectedSchema();

    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull();
  });

  it('is idempotent when called with already-null subject', () => {
    useWorkspaceStore.setState({ selectedSchemaSubject: null, schemaRegistryError: null });

    useWorkspaceStore.getState().clearSelectedSchema();

    expect(useWorkspaceStore.getState().selectedSchemaSubject).toBeNull();
    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull();
  });

  it('does not affect schemaRegistrySubjects list', () => {
    const subjects = ['topic-a-value', 'topic-b-value'];
    useWorkspaceStore.setState({ schemaRegistrySubjects: subjects, selectedSchemaSubject: makeSchemaSubject() });

    useWorkspaceStore.getState().clearSelectedSchema();

    expect(useWorkspaceStore.getState().schemaRegistrySubjects).toEqual(subjects);
  });

  it('does not affect schemaRegistryLoading', () => {
    useWorkspaceStore.setState({ schemaRegistryLoading: true });

    useWorkspaceStore.getState().clearSelectedSchema();

    // clearSelectedSchema only touches selectedSchemaSubject and error, not loading
    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@schema-registry-store] setSchemaRegistryError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(srDefaults);
  });

  it('sets an error string', () => {
    useWorkspaceStore.getState().setSchemaRegistryError('Connection refused');

    expect(useWorkspaceStore.getState().schemaRegistryError).toBe('Connection refused');
  });

  it('overwrites an existing error with a new one', () => {
    useWorkspaceStore.setState({ schemaRegistryError: 'old error' });

    useWorkspaceStore.getState().setSchemaRegistryError('new error');

    expect(useWorkspaceStore.getState().schemaRegistryError).toBe('new error');
  });

  it('accepts null to clear the error', () => {
    useWorkspaceStore.setState({ schemaRegistryError: 'some error' });

    useWorkspaceStore.getState().setSchemaRegistryError(null);

    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull();
  });

  it('does not mutate other schema registry state', () => {
    const subjects = ['topic-value'];
    const detail = makeSchemaSubject();
    useWorkspaceStore.setState({
      schemaRegistrySubjects: subjects,
      selectedSchemaSubject: detail,
      schemaRegistryLoading: false,
    });

    useWorkspaceStore.getState().setSchemaRegistryError('custom error');

    const state = useWorkspaceStore.getState();
    expect(state.schemaRegistrySubjects).toEqual(subjects);
    expect(state.selectedSchemaSubject).toEqual(detail);
    expect(state.schemaRegistryLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@schema-registry-store] loading states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(srDefaults);
  });

  it('sets schemaRegistryLoading to true at the start of loadSchemaRegistrySubjects', async () => {
    let capturedLoading: boolean | undefined;

    vi.mocked(schemaRegistryApi.listSubjects).mockImplementationOnce(async () => {
      capturedLoading = useWorkspaceStore.getState().schemaRegistryLoading;
      return ['topic-value'];
    });

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(capturedLoading).toBe(true);
  });

  it('sets schemaRegistryLoading to false after successful loadSchemaRegistrySubjects', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockResolvedValueOnce(['topic-value']);

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(false);
  });

  it('sets schemaRegistryLoading to false after failed loadSchemaRegistrySubjects', async () => {
    vi.mocked(schemaRegistryApi.listSubjects).mockRejectedValueOnce(new Error('network error'));

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(false);
  });

  it('sets schemaRegistryLoading to true at the start of loadSchemaDetail', async () => {
    let capturedLoading: boolean | undefined;

    vi.mocked(schemaRegistryApi.getSchemaDetail).mockImplementationOnce(async () => {
      capturedLoading = useWorkspaceStore.getState().schemaRegistryLoading;
      return makeSchemaSubject();
    });

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value');

    expect(capturedLoading).toBe(true);
  });

  it('sets schemaRegistryLoading to false after successful loadSchemaDetail', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValueOnce(makeSchemaSubject());

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value');

    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(false);
  });

  it('sets schemaRegistryLoading to false after failed loadSchemaDetail', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockRejectedValueOnce(new Error('404'));

    await useWorkspaceStore.getState().loadSchemaDetail('bad-subject');

    expect(useWorkspaceStore.getState().schemaRegistryLoading).toBe(false);
  });

  it('clears schemaRegistryError at the start of loadSchemaRegistrySubjects', async () => {
    useWorkspaceStore.setState({ schemaRegistryError: 'stale error' });
    let capturedError: string | null | undefined;

    vi.mocked(schemaRegistryApi.listSubjects).mockImplementationOnce(async () => {
      capturedError = useWorkspaceStore.getState().schemaRegistryError;
      return [];
    });

    await useWorkspaceStore.getState().loadSchemaRegistrySubjects();

    expect(capturedError).toBeNull();
  });

  it('clears schemaRegistryError at the start of loadSchemaDetail', async () => {
    useWorkspaceStore.setState({ schemaRegistryError: 'stale error' });
    let capturedError: string | null | undefined;

    vi.mocked(schemaRegistryApi.getSchemaDetail).mockImplementationOnce(async () => {
      capturedError = useWorkspaceStore.getState().schemaRegistryError;
      return makeSchemaSubject();
    });

    await useWorkspaceStore.getState().loadSchemaDetail('user-events-value');

    expect(capturedError).toBeNull();
  });
});
