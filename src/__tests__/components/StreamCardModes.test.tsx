import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StreamCard } from '../../components/StreamsPanel/StreamCard';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import * as topicApi from '../../api/topic-api';

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
vi.mock('../../utils/confluent-serializer', () => ({
  serializeToConfluentBinary: vi.fn(() => null),
}));
vi.mock('../../components/StreamsPanel/StreamCardTable', () => ({
  StreamCardTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="stream-card-table">rows: {data.length}</div>
  ),
}));

describe('[@stream-card-modes] StreamCard Modes', () => {
  const mockOnRemove = vi.fn();
  const mockOnDuplicate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useWorkspaceStore.setState({
      catalog: 'test_catalog',
      database: 'test_db',
      backgroundStatements: [],
      streamsSelectedTopics: ['test-topic'],
      schemaDatasets: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('default mode is Consume', () => {
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    // Should show Fetch button (icon-only, found by aria-label) but NO Play button
    expect(screen.getByLabelText('Fetch messages')).toBeTruthy();
    expect(screen.queryByLabelText('Start producer')).toBeNull();
  });

  it('mode selector renders with two options', () => {
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    expect(screen.getByText('Consume')).toBeTruthy();
    expect(screen.getByText('Produce')).toBeTruthy();
  });

  it('selecting Produce & Consume shows produce controls', () => {
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    fireEvent.click(screen.getByText('Produce'));
    expect(screen.getByLabelText('Data source')).toBeTruthy();
    expect(screen.getByLabelText(/Start producer/)).toBeTruthy();
  });

  it('switching back to Consume hides produce controls', () => {
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    fireEvent.click(screen.getByText('Produce'));
    expect(screen.getByLabelText('Data source')).toBeTruthy();
    fireEvent.click(screen.getByText('Consume'));
    expect(screen.queryByLabelText('Data source')).toBeNull();
  });

  it('dataset dropdown hidden in Consume mode', () => {
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    expect(screen.queryByLabelText('Select dataset')).toBeNull();
  });

  it('dataset dropdown visible when dataset source selected in P&C mode', () => {
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    fireEvent.click(screen.getByText('Produce'));
    fireEvent.change(screen.getByLabelText('Data source'), { target: { value: 'dataset' } });
    expect(screen.getByLabelText('Select dataset')).toBeTruthy();
  });

  it('dropdown shows placeholder when no datasets', () => {
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    fireEvent.click(screen.getByText('Produce'));
    fireEvent.change(screen.getByLabelText('Data source'), { target: { value: 'dataset' } });
    expect(screen.getByText(/No datasets/)).toBeTruthy();
  });

  it('dropdown populated from store datasets', () => {
    useWorkspaceStore.setState({
      schemaDatasets: [{
        id: 'ds-1',
        name: 'My Dataset',
        schemaSubject: 'test-topic-value',
        records: [{ a: 1 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
    });
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    fireEvent.click(screen.getByText('Produce'));
    fireEvent.change(screen.getByLabelText('Data source'), { target: { value: 'dataset' } });
    expect(screen.getByText('My Dataset (1)')).toBeTruthy();
  });

  it('"+" button calls navigateToSchemaDatasets with correct subject', () => {
    const navSpy = vi.fn();
    useWorkspaceStore.setState({ navigateToSchemaDatasets: navSpy });
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    fireEvent.click(screen.getByText('Produce'));
    fireEvent.change(screen.getByLabelText('Data source'), { target: { value: 'dataset' } });
    const addBtn = screen.getByTitle('Add test datasets for this topic');
    fireEvent.click(addBtn);
    expect(navSpy).toHaveBeenCalledWith('test-topic-value');
  });

  it('fetch works in Consume mode', async () => {
    const executeSpy = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });
    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Fetch messages'));
    });
    expect(executeSpy).toHaveBeenCalled();
  });

  it('switching from P&C to Consume while producing stops producer', async () => {
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValue({
      id: 1,
      subject: 'test-topic-value',
      version: 1,
      schemaType: 'AVRO',
      schema: '{"type":"record","name":"Test","fields":[{"name":"id","type":"int"}]}',
    });
    vi.mocked(topicApi.produceRecord).mockResolvedValue({ error_code: 200 } as any);

    render(<StreamCard cardId="card-1" topicName="test-topic" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />);
    fireEvent.click(screen.getByText('Produce'));

    // Start synthetic producer
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Start producer'));
    });

    // Switch back to Consume — should stop producing
    fireEvent.click(screen.getByText('Consume'));
    // No produce controls visible
    expect(screen.queryByLabelText('Data source')).toBeNull();
  });

  it('multiple cards have independent modes', () => {
    render(
      <>
        <StreamCard cardId="card-a" topicName="topic-a" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />
        <StreamCard cardId="card-b" topicName="topic-b" onRemove={mockOnRemove} onDuplicate={mockOnDuplicate} />
      </>
    );
    // Switch topic-a to Produce
    const produceButtons = screen.getAllByText('Produce');
    fireEvent.click(produceButtons[0]);
    // topic-a should show produce controls
    const sources = screen.getAllByLabelText('Data source');
    expect(sources).toHaveLength(1); // Only topic-a has it
  });
});
