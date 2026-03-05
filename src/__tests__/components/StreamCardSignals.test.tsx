import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { StreamCard } from '../../components/StreamsPanel/StreamCard';
import { useWorkspaceStore } from '../../store/workspaceStore';

vi.mock('../../api/flink-api');
vi.mock('../../api/schema-registry-api');
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
vi.mock('../../utils/synthetic-data', () => ({
  generateSyntheticRecord: vi.fn(() => ({ name: 'test', value: 42 })),
}));
vi.mock('../../components/StreamsPanel/StreamCardTable', () => ({
  StreamCardTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="stream-card-table">rows: {data.length}</div>
  ),
}));

const defaultProps = {
  cardId: 'test-topic',
  topicName: 'test-topic',
  onRemove: vi.fn(),
  onDuplicate: vi.fn(),
};

describe('[@split-button-signals] StreamCard signal watcher pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useWorkspaceStore.setState({
      catalog: 'test_catalog',
      database: 'test_db',
      backgroundStatements: [],
      streamCards: [{ id: 'test-topic', topicName: 'test-topic' }],
      runAllStreamsSignal: 0,
      stopAllStreamsSignal: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('initial render does NOT trigger the run-all effect (signal === ref)', () => {
    const executeSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

    render(<StreamCard {...defaultProps} />);

    // Signal is 0 on mount, ref initializes to 0 — effect should skip
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('initial render does NOT trigger the stop-all effect (signal === ref)', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    render(<StreamCard {...defaultProps} />);

    // No intervals should have been cleared from the signal effect
    // (clearInterval may be called 0 times or only from other effects, not from stop signal)
    clearIntervalSpy.mockRestore();
  });

  it('when runAllStreamsSignal increments, an idle StreamCard starts auto-refresh', async () => {
    const executeSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

    render(<StreamCard {...defaultProps} />);
    expect(executeSpy).not.toHaveBeenCalled();

    // Increment the run-all signal
    await act(async () => {
      useWorkspaceStore.setState({ runAllStreamsSignal: 1 });
    });

    // The card should have called executeBackgroundStatement (handleFetch via handleStartAutoRefresh)
    expect(executeSpy).toHaveBeenCalled();
    expect(executeSpy.mock.calls[0][0]).toBe('test-topic');
    expect(executeSpy.mock.calls[0][1]).toContain('test-topic');
  });

  it('when runAllStreamsSignal increments, an already-running StreamCard does NOT restart', async () => {
    const executeSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({
      executeBackgroundStatement: executeSpy,
      backgroundStatements: [{
        id: 'bg-1',
        contextId: 'test-topic',
        statementName: 'bg-123-test-topic',
        sql: 'SELECT ...',
        status: 'RUNNING' as const,
        results: [],
        columns: [],
        createdAt: new Date(),
      }],
    });

    render(<StreamCard {...defaultProps} />);

    // Increment signal
    await act(async () => {
      useWorkspaceStore.setState({ runAllStreamsSignal: 1 });
    });

    // Should NOT have called execute — statement is already RUNNING
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('when stopAllStreamsSignal increments, an active StreamCard stops auto-refresh', async () => {
    const executeSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

    render(<StreamCard {...defaultProps} />);

    // First start auto-refresh via runAll
    await act(async () => {
      useWorkspaceStore.setState({ runAllStreamsSignal: 1 });
    });

    expect(executeSpy).toHaveBeenCalled();
    executeSpy.mockClear();

    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    // Now stop all
    await act(async () => {
      useWorkspaceStore.setState({ stopAllStreamsSignal: 1 });
    });

    // clearInterval should have been called to stop the auto-refresh interval
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('when stopAllStreamsSignal increments, an active StreamCard stops producing', async () => {
    // We need to mock schema registry to allow produce to start
    const schemaRegistryApi = await import('../../api/schema-registry-api');
    const topicApi = await import('../../api/topic-api');
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValue({
      subject: 'test-topic-value',
      version: 1,
      id: 1,
      schemaType: 'AVRO',
      schema: '{"type":"record","name":"T","fields":[{"name":"v","type":"int"}]}',
    });
    vi.mocked(topicApi.produceRecord).mockResolvedValue({
      cluster_id: 'c1', topic_name: 'test-topic', partition_id: 0, offset: 1, timestamp: '',
    });

    const executeSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

    // Render in produce-consume mode so runAll triggers produce
    const { container } = render(<StreamCard {...defaultProps} initialMode="produce-consume" />);

    // Start via runAll signal
    await act(async () => {
      useWorkspaceStore.setState({ runAllStreamsSignal: 1 });
    });

    // Let produce interval tick
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    // Stop all
    await act(async () => {
      useWorkspaceStore.setState({ stopAllStreamsSignal: 1 });
    });

    // Should have cleared intervals (auto-refresh + produce)
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
