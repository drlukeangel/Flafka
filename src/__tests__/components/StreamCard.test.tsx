import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StreamCard } from '../../components/StreamsPanel/StreamCard';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import * as topicApi from '../../api/topic-api';
import * as flinkApi from '../../api/flink-api';

vi.mock('../../api/schema-registry-api');
vi.mock('../../api/flink-api', () => ({
  getTableSchema: vi.fn(),
  executeStatement: vi.fn(),
  getStatementStatus: vi.fn(),
  getStatementResults: vi.fn(),
  listStatements: vi.fn(),
  listStatementsFirstPage: vi.fn(),
  cancelStatement: vi.fn(),
  deleteStatement: vi.fn(),
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
vi.mock('../../utils/synthetic-data', () => ({
  generateSyntheticRecord: vi.fn(() => ({ name: 'test', value: 42 })),
}));
// Mock StreamCardTable to simplify tests
vi.mock('../../components/StreamsPanel/StreamCardTable', () => ({
  StreamCardTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="stream-card-table">rows: {data.length}</div>
  ),
}));

describe('[@stream-card] StreamCard', () => {
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useWorkspaceStore.setState({
      catalog: 'test_catalog',
      database: 'test_db',
      backgroundStatements: [],
      streamCards: [{ id: 'test-topic', topicName: 'test-topic' }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders with topic name in header', () => {
    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);
    expect(screen.getByText('test-topic')).toBeTruthy();
  });

  it('collapse toggle shows/hides card body', () => {
    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);
    // Card body should be visible initially
    expect(screen.getByText('Fetch')).toBeTruthy();

    // Click collapse
    const collapseBtn = screen.getByLabelText('Collapse card');
    fireEvent.click(collapseBtn);

    // Body should be hidden — Fetch button gone
    expect(screen.queryByText('Fetch')).toBeNull();

    // aria-expanded should change
    const expandBtn = screen.getByLabelText('Expand card');
    expect(expandBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('remove button calls cancelBackgroundStatement and onRemove', () => {
    const cancelSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ cancelBackgroundStatement: cancelSpy });

    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);
    const removeBtn = screen.getByLabelText('Remove card');
    fireEvent.click(removeBtn);

    expect(cancelSpy).toHaveBeenCalledWith('test-topic');
    expect(mockOnRemove).toHaveBeenCalled();
  });

  it('fetch button calls executeBackgroundStatement with correct SQL', async () => {
    const executeSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);
    const fetchBtn = screen.getByText('Fetch');

    await act(async () => {
      fireEvent.click(fetchBtn);
    });

    expect(executeSpy).toHaveBeenCalledWith(
      'test-topic',
      expect.stringContaining('SELECT * FROM'),
      'earliest-offset',
      'test-topic'
    );
    expect(executeSpy).toHaveBeenCalledWith(
      'test-topic',
      expect.stringContaining('test-topic'),
      expect.any(String),
      expect.any(String)
    );
  });

  it('schema not found shows inline error and does NOT start producer', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockRejectedValue(new Error('Not found'));
    vi.mocked(flinkApi.getTableSchema).mockResolvedValue([]);

    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);
    // Switch to Produce mode first
    fireEvent.click(screen.getByText('Produce'));
    const playBtn = screen.getByLabelText('Start producer');

    await act(async () => {
      fireEvent.click(playBtn);
    });

    expect(screen.getByText('Could not get table schema. Check that the table exists.')).toBeTruthy();
    // Producer should NOT have started
    expect(topicApi.produceRecord).not.toHaveBeenCalled();
  });

  it('auto-stop on unmount: clearInterval called', async () => {
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

    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);

    // Switch to Produce mode and start producer
    fireEvent.click(screen.getByText('Produce'));
    const playBtn = screen.getByLabelText('Start producer');
    await act(async () => {
      fireEvent.click(playBtn);
    });

    // Unmount
    unmount();

    // clearInterval should have been called
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('auto-stop on produce error', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockRejectedValue(new Error('Not found'));
    vi.mocked(flinkApi.getTableSchema).mockResolvedValue([
      { name: 'v', type: 'INT' },
    ]);
    vi.mocked(topicApi.produceRecord).mockRejectedValue(new Error('Network error'));

    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);

    // Switch to Produce mode and start producer
    fireEvent.click(screen.getByText('Produce'));
    const playBtn = screen.getByLabelText('Start producer');
    await act(async () => {
      fireEvent.click(playBtn);
    });

    // Advance timer to trigger interval callback
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Error should be shown
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('producer counter in aria-live region', async () => {
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

    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);

    // Switch to Produce mode and start producer
    fireEvent.click(screen.getByText('Produce'));
    const playBtn = screen.getByLabelText('Start producer');
    await act(async () => {
      fireEvent.click(playBtn);
    });

    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.textContent).toContain('sent');
  });

  it('producer generates unique keys per message', async () => {
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

    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);

    // Switch to Produce mode and start producer
    fireEvent.click(screen.getByText('Produce'));
    const playBtn = screen.getByLabelText('Start producer');
    await act(async () => {
      fireEvent.click(playBtn);
    });

    // Advance timer 5 times to produce 5 messages
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    const calls = vi.mocked(topicApi.produceRecord).mock.calls;
    const keys = calls.map((c) => (c[1] as any).key?.data?.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('play button aria-label changes when producing', async () => {
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

    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);

    // Switch to Produce mode
    fireEvent.click(screen.getByText('Produce'));

    expect(screen.getByLabelText('Start producer')).toBeTruthy();

    const playBtn = screen.getByLabelText('Start producer');
    await act(async () => {
      fireEvent.click(playBtn);
    });

    expect(screen.getByLabelText('Stop producer')).toBeTruthy();
  });

  it('shows message count from background statement results', () => {
    useWorkspaceStore.setState({
      backgroundStatements: [{
        id: 'bg-1',
        contextId: 'test-topic',
        statementName: 'bg-123-test-topic',
        sql: 'SELECT ...',
        status: 'COMPLETED' as const,
        results: [
          { _ts: '2026-01-01T00:00:00Z', _partition: 0, _offset: 0, _key: 'k1', value: 'a' },
          { _ts: '2026-01-01T00:00:01Z', _partition: 1, _offset: 0, _key: 'k2', value: 'b' },
          { _ts: '2026-01-01T00:00:02Z', _partition: 0, _offset: 1, _key: 'k3', value: 'c' },
        ],
        columns: [
          { name: '_ts', type: 'STRING' },
          { name: '_partition', type: 'INT' },
          { name: '_offset', type: 'BIGINT' },
          { name: '_key', type: 'STRING' },
          { name: 'value', type: 'STRING' },
        ],
        createdAt: new Date(),
      }],
    });

    render(<StreamCard cardId="test-topic" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={vi.fn()} />);

    // Should display message count
    expect(screen.getByText('3 msgs')).toBeTruthy();

    // Table should show all 3 rows (no partition filter)
    expect(screen.getByText('rows: 3')).toBeTruthy();
  });
});
