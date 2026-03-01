import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all API modules BEFORE any store import ────────────────────────────
// The store imports flink-api, schema-registry-api, and topic-api at module
// load time; vitest requires mocks to be hoisted before the module under test
// is evaluated.

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
}));

// Mock workspace-export utility (imported by the store)
vi.mock('../../utils/workspace-export', () => ({
  validateWorkspaceJSON: vi.fn(() => ({ valid: true, errors: [] })),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as topicApi from '../../api/topic-api';
import type { KafkaTopic } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Canonical blank topic state used in beforeEach resets. */
const topicDefaults = {
  topicList: [],
  selectedTopic: null,
  topicLoading: false,
  topicError: null,
  // Reset unrelated slices so tests are isolated from each other
  statements: [],
  toasts: [],
  statementHistory: [],
  historyLoading: false,
  historyError: null,
  schemaRegistrySubjects: [],
  selectedSchemaSubject: null,
  schemaRegistryLoading: false,
  schemaRegistryError: null,
};

/** Build a realistic KafkaTopic fixture. */
function makeTopic(overrides: Partial<KafkaTopic> = {}): KafkaTopic {
  return {
    topic_name: 'orders',
    is_internal: false,
    replication_factor: 3,
    partitions_count: 6,
    ...overrides,
  };
}

// ─── Test suites ─────────────────────────────────────────────────────────────

describe('[@topic-store] loadTopics — loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
  });

  it('sets topicLoading=true while pending', async () => {
    let capturedLoading: boolean | undefined;

    vi.mocked(topicApi.listTopics).mockImplementationOnce(async () => {
      capturedLoading = useWorkspaceStore.getState().topicLoading;
      return [makeTopic()];
    });

    await useWorkspaceStore.getState().loadTopics();

    expect(capturedLoading).toBe(true);
  });

  it('sets topicLoading=false after success', async () => {
    vi.mocked(topicApi.listTopics).mockResolvedValueOnce([makeTopic()]);

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicLoading).toBe(false);
  });

  it('sets topicLoading=false after failure', async () => {
    vi.mocked(topicApi.listTopics).mockRejectedValueOnce(new Error('network error'));

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@topic-store] loadTopics — success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
  });

  it('sets topicList on success', async () => {
    const topics = [
      makeTopic({ topic_name: 'orders' }),
      makeTopic({ topic_name: 'payments', partitions_count: 12 }),
    ];
    vi.mocked(topicApi.listTopics).mockResolvedValueOnce(topics);

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicList).toEqual(topics);
  });

  it('sets topicList to empty array when API returns empty array', async () => {
    vi.mocked(topicApi.listTopics).mockResolvedValueOnce([]);

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicList).toEqual([]);
    expect(useWorkspaceStore.getState().topicError).toBeNull();
  });

  it('clears topicError on success (after previous error)', async () => {
    useWorkspaceStore.setState({ topicError: 'previous error' });
    vi.mocked(topicApi.listTopics).mockResolvedValueOnce([makeTopic()]);

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicError).toBeNull();
  });

  it('replaces a previously-loaded topic list on refresh', async () => {
    useWorkspaceStore.setState({ topicList: [makeTopic({ topic_name: 'old-topic' })] });

    const freshTopics = [
      makeTopic({ topic_name: 'new-topic-a' }),
      makeTopic({ topic_name: 'new-topic-b' }),
    ];
    vi.mocked(topicApi.listTopics).mockResolvedValueOnce(freshTopics);

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicList).toEqual(freshTopics);
  });

  it('clears topicError at the start of loadTopics (before resolution)', async () => {
    useWorkspaceStore.setState({ topicError: 'stale error' });
    let capturedError: string | null | undefined;

    vi.mocked(topicApi.listTopics).mockImplementationOnce(async () => {
      capturedError = useWorkspaceStore.getState().topicError;
      return [];
    });

    await useWorkspaceStore.getState().loadTopics();

    expect(capturedError).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@topic-store] loadTopics — failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
  });

  it('sets topicError on failure', async () => {
    vi.mocked(topicApi.listTopics).mockRejectedValueOnce(new Error('503 Service Unavailable'));

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicError).toBe('503 Service Unavailable');
  });

  it('clears topicList on failure', async () => {
    useWorkspaceStore.setState({ topicList: [makeTopic()] });
    vi.mocked(topicApi.listTopics).mockRejectedValueOnce(new Error('network error'));

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicList).toEqual([]);
  });

  it('uses fallback message for non-Error rejections', async () => {
    vi.mocked(topicApi.listTopics).mockRejectedValueOnce('plain string error');

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicError).toBe('Failed to load topics');
  });

  it('uses fallback message for null rejections', async () => {
    vi.mocked(topicApi.listTopics).mockRejectedValueOnce(null);

    await useWorkspaceStore.getState().loadTopics();

    expect(useWorkspaceStore.getState().topicError).toBe('Failed to load topics');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@topic-store] selectTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
  });

  it('sets selectedTopic', () => {
    const topic = makeTopic({ topic_name: 'orders' });

    useWorkspaceStore.getState().selectTopic(topic);

    expect(useWorkspaceStore.getState().selectedTopic).toEqual(topic);
  });

  it('overwrites previously selected topic with a new one', () => {
    const first = makeTopic({ topic_name: 'orders' });
    const second = makeTopic({ topic_name: 'payments' });
    useWorkspaceStore.setState({ selectedTopic: first });

    useWorkspaceStore.getState().selectTopic(second);

    expect(useWorkspaceStore.getState().selectedTopic).toEqual(second);
  });

  it('does not affect topicList when selecting a topic', () => {
    const topics = [makeTopic({ topic_name: 'orders' }), makeTopic({ topic_name: 'payments' })];
    useWorkspaceStore.setState({ topicList: topics });

    useWorkspaceStore.getState().selectTopic(topics[0]);

    expect(useWorkspaceStore.getState().topicList).toEqual(topics);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@topic-store] clearSelectedTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
  });

  it('sets selectedTopic to null', () => {
    useWorkspaceStore.setState({ selectedTopic: makeTopic() });

    useWorkspaceStore.getState().clearSelectedTopic();

    expect(useWorkspaceStore.getState().selectedTopic).toBeNull();
  });

  it('is idempotent when called with already-null selectedTopic', () => {
    useWorkspaceStore.setState({ selectedTopic: null });

    useWorkspaceStore.getState().clearSelectedTopic();

    expect(useWorkspaceStore.getState().selectedTopic).toBeNull();
  });

  it('does not affect topicList when clearing selection', () => {
    const topics = [makeTopic({ topic_name: 'orders' }), makeTopic({ topic_name: 'payments' })];
    useWorkspaceStore.setState({ topicList: topics, selectedTopic: topics[0] });

    useWorkspaceStore.getState().clearSelectedTopic();

    expect(useWorkspaceStore.getState().topicList).toEqual(topics);
  });

  it('does not affect topicError when clearing selection', () => {
    useWorkspaceStore.setState({ selectedTopic: makeTopic(), topicError: 'some error' });

    useWorkspaceStore.getState().clearSelectedTopic();

    expect(useWorkspaceStore.getState().topicError).toBe('some error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@topic-store] setTopicError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
  });

  it('sets the error field', () => {
    useWorkspaceStore.getState().setTopicError('Connection refused');

    expect(useWorkspaceStore.getState().topicError).toBe('Connection refused');
  });

  it('overwrites an existing error with a new one', () => {
    useWorkspaceStore.setState({ topicError: 'old error' });

    useWorkspaceStore.getState().setTopicError('new error');

    expect(useWorkspaceStore.getState().topicError).toBe('new error');
  });

  it('accepts null to clear the error', () => {
    useWorkspaceStore.setState({ topicError: 'some error' });

    useWorkspaceStore.getState().setTopicError(null);

    expect(useWorkspaceStore.getState().topicError).toBeNull();
  });

  it('does not mutate other topic state fields', () => {
    const topics = [makeTopic()];
    const selected = makeTopic({ topic_name: 'payments' });
    useWorkspaceStore.setState({
      topicList: topics,
      selectedTopic: selected,
      topicLoading: false,
    });

    useWorkspaceStore.getState().setTopicError('custom error');

    const state = useWorkspaceStore.getState();
    expect(state.topicList).toEqual(topics);
    expect(state.selectedTopic).toEqual(selected);
    expect(state.topicLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@topic-store] createTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
    // createTopic calls loadTopics internally — stub listTopics to prevent real call
    vi.mocked(topicApi.listTopics).mockResolvedValue([]);
  });

  it('calls topicApi.createTopic with correct snake_case body', async () => {
    vi.mocked(topicApi.createTopic).mockResolvedValueOnce(makeTopic({ topic_name: 'my-topic' }));

    await useWorkspaceStore.getState().createTopic({
      topicName: 'my-topic',
      partitionsCount: 6,
      replicationFactor: 3,
    });

    expect(topicApi.createTopic).toHaveBeenCalledWith({
      topic_name: 'my-topic',
      partitions_count: 6,
      replication_factor: 3,
    });
  });

  it('calls loadTopics after success', async () => {
    vi.mocked(topicApi.createTopic).mockResolvedValueOnce(makeTopic());

    await useWorkspaceStore.getState().createTopic({
      topicName: 'orders',
      partitionsCount: 6,
      replicationFactor: 3,
    });

    expect(topicApi.listTopics).toHaveBeenCalledTimes(1);
  });

  it('does NOT call loadTopics on failure (rethrows)', async () => {
    vi.mocked(topicApi.createTopic).mockRejectedValueOnce(new Error('409 Conflict'));

    await expect(
      useWorkspaceStore.getState().createTopic({
        topicName: 'orders',
        partitionsCount: 6,
        replicationFactor: 3,
      })
    ).rejects.toThrow('409 Conflict');

    expect(topicApi.listTopics).not.toHaveBeenCalled();
  });

  it('includes configs array when cleanupPolicy is provided', async () => {
    vi.mocked(topicApi.createTopic).mockResolvedValueOnce(makeTopic());

    await useWorkspaceStore.getState().createTopic({
      topicName: 'compacted-topic',
      partitionsCount: 3,
      replicationFactor: 3,
      cleanupPolicy: 'compact',
    });

    expect(topicApi.createTopic).toHaveBeenCalledWith({
      topic_name: 'compacted-topic',
      partitions_count: 3,
      replication_factor: 3,
      configs: [{ name: 'cleanup.policy', value: 'compact' }],
    });
  });

  it('includes configs array when retentionMs is provided', async () => {
    vi.mocked(topicApi.createTopic).mockResolvedValueOnce(makeTopic());

    await useWorkspaceStore.getState().createTopic({
      topicName: 'retained-topic',
      partitionsCount: 6,
      replicationFactor: 3,
      retentionMs: 604800000,
    });

    expect(topicApi.createTopic).toHaveBeenCalledWith({
      topic_name: 'retained-topic',
      partitions_count: 6,
      replication_factor: 3,
      configs: [{ name: 'retention.ms', value: '604800000' }],
    });
  });

  it('includes both cleanup.policy and retention.ms when both are provided', async () => {
    vi.mocked(topicApi.createTopic).mockResolvedValueOnce(makeTopic());

    await useWorkspaceStore.getState().createTopic({
      topicName: 'full-config-topic',
      partitionsCount: 6,
      replicationFactor: 3,
      cleanupPolicy: 'delete',
      retentionMs: 86400000,
    });

    expect(topicApi.createTopic).toHaveBeenCalledWith({
      topic_name: 'full-config-topic',
      partitions_count: 6,
      replication_factor: 3,
      configs: [
        { name: 'cleanup.policy', value: 'delete' },
        { name: 'retention.ms', value: '86400000' },
      ],
    });
  });

  it('omits configs key entirely when no cleanupPolicy or retentionMs provided', async () => {
    vi.mocked(topicApi.createTopic).mockResolvedValueOnce(makeTopic());

    await useWorkspaceStore.getState().createTopic({
      topicName: 'bare-topic',
      partitionsCount: 1,
      replicationFactor: 3,
    });

    const callArg = vi.mocked(topicApi.createTopic).mock.calls[0][0];
    expect(callArg).not.toHaveProperty('configs');
  });

  it('converts retentionMs number to string in the configs value', async () => {
    vi.mocked(topicApi.createTopic).mockResolvedValueOnce(makeTopic());

    await useWorkspaceStore.getState().createTopic({
      topicName: 'orders',
      partitionsCount: 6,
      replicationFactor: 3,
      retentionMs: 7200000,
    });

    const callArg = vi.mocked(topicApi.createTopic).mock.calls[0][0];
    expect(callArg.configs?.[0]).toEqual({ name: 'retention.ms', value: '7200000' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@topic-store] deleteTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
    // deleteTopic calls loadTopics internally — stub listTopics to prevent real call
    vi.mocked(topicApi.listTopics).mockResolvedValue([]);
  });

  it('calls topicApi.deleteTopic with the topic name', async () => {
    vi.mocked(topicApi.deleteTopic).mockResolvedValueOnce(undefined);

    await useWorkspaceStore.getState().deleteTopic('orders');

    expect(topicApi.deleteTopic).toHaveBeenCalledWith('orders');
    expect(topicApi.deleteTopic).toHaveBeenCalledTimes(1);
  });

  it('CRIT-3: does NOT call clearSelectedTopic (orchestration moved to component)', async () => {
    // Store.deleteTopic only does the API call + optimistic removal.
    // clearSelectedTopic and loadTopics are now the component's responsibility.
    vi.mocked(topicApi.deleteTopic).mockResolvedValueOnce(undefined);
    const topic = makeTopic({ topic_name: 'orders' });
    useWorkspaceStore.setState({ selectedTopic: topic });

    await useWorkspaceStore.getState().deleteTopic('orders');

    // selectedTopic is NOT cleared by the store — only the component clears it
    expect(useWorkspaceStore.getState().selectedTopic).toEqual(topic);
  });

  it('CRIT-3: does NOT call loadTopics (orchestration moved to component)', async () => {
    // Store.deleteTopic only does the API call; the component calls loadTopics afterwards.
    vi.mocked(topicApi.deleteTopic).mockResolvedValueOnce(undefined);

    await useWorkspaceStore.getState().deleteTopic('orders');

    expect(topicApi.listTopics).not.toHaveBeenCalled();
  });

  it('HIGH-3: optimistically removes topic from topicList before API call resolves', async () => {
    const orders = makeTopic({ topic_name: 'orders' });
    const payments = makeTopic({ topic_name: 'payments' });
    useWorkspaceStore.setState({ topicList: [orders, payments] });

    // Delay the API mock so we can check state before it resolves
    let resolveDelete!: () => void;
    vi.mocked(topicApi.deleteTopic).mockReturnValueOnce(
      new Promise<void>((res) => { resolveDelete = res; })
    );

    const deletePromise = useWorkspaceStore.getState().deleteTopic('orders');

    // Optimistic removal should have happened synchronously before the API resolves
    expect(useWorkspaceStore.getState().topicList.map((t) => t.topic_name)).toEqual(['payments']);

    resolveDelete();
    await deletePromise;
  });

  it('does NOT call clearSelectedTopic on failure (rethrows)', async () => {
    vi.mocked(topicApi.deleteTopic).mockRejectedValueOnce(new Error('404 Not Found'));
    const topic = makeTopic({ topic_name: 'orders' });
    useWorkspaceStore.setState({ selectedTopic: topic });

    await expect(useWorkspaceStore.getState().deleteTopic('orders')).rejects.toThrow(
      '404 Not Found'
    );

    // selectedTopic should remain unchanged (store never clears it anyway now)
    expect(useWorkspaceStore.getState().selectedTopic).toEqual(topic);
  });

  it('does NOT call loadTopics on failure', async () => {
    vi.mocked(topicApi.deleteTopic).mockRejectedValueOnce(new Error('403 Forbidden'));

    await expect(useWorkspaceStore.getState().deleteTopic('orders')).rejects.toThrow(
      '403 Forbidden'
    );

    expect(topicApi.listTopics).not.toHaveBeenCalled();
  });

  it('passes the exact topic name string to the API (including dots and hyphens)', async () => {
    vi.mocked(topicApi.deleteTopic).mockResolvedValueOnce(undefined);

    await useWorkspaceStore.getState().deleteTopic('my.topic.v1-beta');

    expect(topicApi.deleteTopic).toHaveBeenCalledWith('my.topic.v1-beta');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('[@topic-store] persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState(topicDefaults);
    localStorage.clear();
  });

  it('topic state is NOT persisted to localStorage', async () => {
    // Seed the store with topic data
    const topics = [makeTopic({ topic_name: 'orders' }), makeTopic({ topic_name: 'payments' })];
    const selected = makeTopic({ topic_name: 'orders' });

    useWorkspaceStore.setState({
      topicList: topics,
      selectedTopic: selected,
      topicLoading: false,
      topicError: 'some error',
    });

    // Read the persisted state directly from localStorage
    const raw = localStorage.getItem('flink-workspace');
    if (raw === null) {
      // If nothing was persisted at all, the test passes trivially
      expect(raw).toBeNull();
      return;
    }

    const persisted = JSON.parse(raw) as { state?: Record<string, unknown> };
    const persistedState = persisted.state ?? {};

    expect(persistedState).not.toHaveProperty('topicList');
    expect(persistedState).not.toHaveProperty('selectedTopic');
    expect(persistedState).not.toHaveProperty('topicLoading');
    expect(persistedState).not.toHaveProperty('topicError');
  });
});
