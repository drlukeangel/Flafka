/**
 * @stream-card-coverage
 * StreamCard — additional coverage for dataset produce, SQL editor,
 * scan mode, auto-refresh error handling, mode switching, duplicate.
 */

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
vi.mock('../../utils/confluent-serializer', () => ({
  serializeToConfluentBinary: vi.fn(() => null),
}));
vi.mock('../../components/StreamsPanel/StreamCardTable', () => ({
  StreamCardTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="stream-card-table">rows: {data.length}</div>
  ),
}));

const defaultProps = {
  cardId: 'card-1',
  topicName: 'test-topic',
  onRemove: vi.fn(),
  onDuplicate: vi.fn(),
};

describe('[@stream-card-coverage] StreamCard Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useWorkspaceStore.setState({
      catalog: 'test_catalog',
      database: 'test_db',
      backgroundStatements: [],
      streamCards: [{ id: 'card-1', topicName: 'test-topic' }],
      schemaDatasets: [],
      runAllStreamsSignal: 0,
      stopAllStreamsSignal: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // ========================================================================
  // SQL Editor
  // ========================================================================

  describe('[@stream-card-coverage] SQL Editor', () => {
    it('renders SQL textarea with default query', () => {
      render(<StreamCard {...defaultProps} />);
      const textarea = screen.getByLabelText('SQL query') as HTMLTextAreaElement;
      expect(textarea.value).toContain('SELECT * FROM');
      expect(textarea.value).toContain('test-topic');
      expect(textarea.value).toContain('LIMIT 50');
    });

    it('editing SQL sets dirty flag and shows Reset button', () => {
      render(<StreamCard {...defaultProps} />);
      const textarea = screen.getByLabelText('SQL query');
      fireEvent.change(textarea, { target: { value: 'SELECT id FROM test' } });
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('Reset button restores default SQL', () => {
      render(<StreamCard {...defaultProps} />);
      const textarea = screen.getByLabelText('SQL query') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'SELECT id FROM test' } });
      fireEvent.click(screen.getByText('Reset'));
      expect(textarea.value).toContain('SELECT * FROM');
      expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    });

    it('changing row limit updates default SQL', () => {
      render(<StreamCard {...defaultProps} />);
      const limitSelect = screen.getByLabelText('Row limit');
      fireEvent.change(limitSelect, { target: { value: '25' } });
      const textarea = screen.getByLabelText('SQL query') as HTMLTextAreaElement;
      expect(textarea.value).toContain('LIMIT 25');
    });

    it('changing row limit does NOT update SQL if dirty', () => {
      render(<StreamCard {...defaultProps} />);
      const textarea = screen.getByLabelText('SQL query') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'SELECT custom FROM t' } });
      const limitSelect = screen.getByLabelText('Row limit');
      fireEvent.change(limitSelect, { target: { value: '25' } });
      expect(textarea.value).toBe('SELECT custom FROM t');
    });
  });

  // ========================================================================
  // Scan Mode
  // ========================================================================

  describe('[@stream-card-coverage] Scan Mode', () => {
    it('renders scan mode selector in consume mode', () => {
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByLabelText('Scan mode')).toBeInTheDocument();
    });

    it('defaults to earliest-offset', () => {
      render(<StreamCard {...defaultProps} />);
      const select = screen.getByLabelText('Scan mode') as HTMLSelectElement;
      expect(select.value).toBe('earliest-offset');
    });

    it('changing scan mode calls updateStreamCardConfig', () => {
      const updateSpy = vi.fn();
      useWorkspaceStore.setState({ updateStreamCardConfig: updateSpy });
      render(<StreamCard {...defaultProps} />);
      const select = screen.getByLabelText('Scan mode');
      fireEvent.change(select, { target: { value: 'latest-offset' } });
      expect(updateSpy).toHaveBeenCalledWith('card-1', { scanMode: 'latest-offset' });
    });

    it('hides scan mode in produce-consume mode', () => {
      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Produce'));
      expect(screen.queryByLabelText('Scan mode')).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Duplicate Button
  // ========================================================================

  describe('[@stream-card-coverage] Duplicate', () => {
    it('duplicate button calls onDuplicate', () => {
      const onDuplicate = vi.fn();
      render(<StreamCard {...defaultProps} onDuplicate={onDuplicate} />);
      fireEvent.click(screen.getByLabelText('Duplicate card'));
      expect(onDuplicate).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Background Statement Status Rendering
  // ========================================================================

  describe('[@stream-card-coverage] Background Statement Status', () => {
    it('shows "No messages" when completed with no results', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'bg-1',
          contextId: 'card-1',
          statementName: 'stmt-1',
          sql: 'SELECT * FROM t',
          status: 'COMPLETED' as const,
          results: [],
          columns: [],
          createdAt: new Date(),
        }],
      });
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByText('No messages')).toBeInTheDocument();
    });

    it('shows error message when status is ERROR', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'bg-1',
          contextId: 'card-1',
          statementName: 'stmt-1',
          sql: 'SELECT * FROM t',
          status: 'ERROR' as const,
          results: [],
          columns: [],
          createdAt: new Date(),
          error: 'Table not found',
        }],
      });
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByText('Table not found')).toBeInTheDocument();
    });

    it('shows "Query failed" when ERROR has no error message', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'bg-1',
          contextId: 'card-1',
          statementName: 'stmt-1',
          sql: 'SELECT * FROM t',
          status: 'ERROR' as const,
          results: [],
          columns: [],
          createdAt: new Date(),
        }],
      });
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByText('Query failed')).toBeInTheDocument();
    });

    it('shows "Fetching messages..." when status is PENDING', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'bg-1',
          contextId: 'card-1',
          statementName: 'stmt-1',
          sql: 'SELECT * FROM t',
          status: 'PENDING' as const,
          results: [],
          columns: [],
          createdAt: new Date(),
        }],
      });
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByText('Fetching messages...')).toBeInTheDocument();
    });

    it('shows "Fetching messages..." when status is RUNNING with no results', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'bg-1',
          contextId: 'card-1',
          statementName: 'stmt-1',
          sql: 'SELECT * FROM t',
          status: 'RUNNING' as const,
          results: [],
          columns: [],
          createdAt: new Date(),
        }],
      });
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByText('Fetching messages...')).toBeInTheDocument();
    });

    it('shows "Refresh" button when statement exists', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'bg-1',
          contextId: 'card-1',
          statementName: 'stmt-1',
          sql: 'SELECT * FROM t',
          status: 'COMPLETED' as const,
          results: [],
          columns: [],
          createdAt: new Date(),
        }],
      });
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Live Auto-Refresh
  // ========================================================================

  describe('[@stream-card-coverage] Live Auto-Refresh', () => {
    it('Live button starts auto-refresh', async () => {
      const executeSpy = vi.fn().mockResolvedValue(undefined);
      useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

      render(<StreamCard {...defaultProps} />);
      const liveBtn = screen.getByLabelText('Start live stream');

      await act(async () => {
        fireEvent.click(liveBtn);
      });

      expect(executeSpy).toHaveBeenCalled();
      expect(screen.getByLabelText('Stop live stream')).toBeInTheDocument();
    });

    it('Stop button stops auto-refresh', async () => {
      const executeSpy = vi.fn().mockResolvedValue(undefined);
      useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

      render(<StreamCard {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Start live stream'));
      });

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Stop live stream'));
      });

      expect(screen.getByLabelText('Start live stream')).toBeInTheDocument();
    });

    it('fetch button disabled during auto-refresh', async () => {
      const executeSpy = vi.fn().mockResolvedValue(undefined);
      useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

      render(<StreamCard {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Start live stream'));
      });

      const fetchBtn = screen.getByTitle('Fetch messages');
      expect(fetchBtn).toBeDisabled();
    });
  });

  // ========================================================================
  // Mode Switching Safety
  // ========================================================================

  describe('[@stream-card-coverage] Mode Switching', () => {
    it('switching from produce to consume stops auto-refresh', async () => {
      const executeSpy = vi.fn().mockResolvedValue(undefined);
      useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

      render(<StreamCard {...defaultProps} />);

      // Start auto-refresh
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Start live stream'));
      });

      // Switch to produce mode (mode change should stop auto-refresh)
      fireEvent.click(screen.getByText('Produce'));

      // Should stop auto-refresh - Live button should show "Live" again
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('mode change calls updateStreamCardConfig', () => {
      const updateSpy = vi.fn();
      useWorkspaceStore.setState({ updateStreamCardConfig: updateSpy });

      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Produce'));
      expect(updateSpy).toHaveBeenCalledWith('card-1', { mode: 'produce-consume' });
    });
  });

  // ========================================================================
  // Initial Mode / Dataset
  // ========================================================================

  describe('[@stream-card-coverage] Initial Props', () => {
    it('renders in produce-consume mode when initialMode set', () => {
      render(<StreamCard {...defaultProps} initialMode="produce-consume" />);
      expect(screen.getByLabelText('Data source')).toBeInTheDocument();
    });

    it('pre-selects dataset when initialDatasetId provided', () => {
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

      render(<StreamCard {...defaultProps} initialMode="produce-consume" initialDatasetId="ds-1" />);
      // Data source should be 'dataset'
      const dataSourceSelect = screen.getByLabelText('Data source') as HTMLSelectElement;
      expect(dataSourceSelect.value).toBe('dataset');
    });
  });

  // ========================================================================
  // Fetch Error Handling
  // ========================================================================

  describe('[@stream-card-coverage] Fetch Error', () => {
    it('shows error when fetch fails', async () => {
      const executeSpy = vi.fn().mockRejectedValue(new Error('Fetch failed'));
      useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

      render(<StreamCard {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Fetch'));
      });

      expect(screen.getByText('Fetch failed')).toBeInTheDocument();
    });

    it('shows generic error for non-Error throws', async () => {
      const executeSpy = vi.fn().mockRejectedValue('string error');
      useWorkspaceStore.setState({ executeBackgroundStatement: executeSpy });

      render(<StreamCard {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Fetch'));
      });

      expect(screen.getByText('Failed to fetch messages')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Dataset Produce Controls
  // ========================================================================

  describe('[@stream-card-coverage] Dataset Produce', () => {
    beforeEach(() => {
      useWorkspaceStore.setState({
        schemaDatasets: [{
          id: 'ds-1',
          name: 'Loans Dataset',
          schemaSubject: 'test-topic-value',
          records: [{ a: 1 }, { a: 2 }, { a: 3 }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
      });
    });

    it('shows Burst and Loop checkboxes when dataset selected', () => {
      render(<StreamCard {...defaultProps} initialMode="produce-consume" initialDatasetId="ds-1" />);
      expect(screen.getByText('Burst')).toBeInTheDocument();
      expect(screen.getByText('Loop')).toBeInTheDocument();
    });

    it('hides Loop checkbox when Burst is checked', () => {
      render(<StreamCard {...defaultProps} initialMode="produce-consume" initialDatasetId="ds-1" />);
      const burstCheckbox = screen.getByText('Burst').closest('label')!.querySelector('input')!;
      fireEvent.click(burstCheckbox);
      expect(screen.queryByText('Loop')).not.toBeInTheDocument();
    });

    it('start button disabled when no dataset selected in dataset mode', () => {
      render(<StreamCard {...defaultProps} initialMode="produce-consume" />);
      fireEvent.change(screen.getByLabelText('Data source'), { target: { value: 'dataset' } });
      const startBtn = screen.getByLabelText('Start producer');
      expect(startBtn).toBeDisabled();
    });
  });

  // ========================================================================
  // Produce Error Code Check
  // ========================================================================

  describe('[@stream-card-coverage] Producer error_code path', () => {
    it('shows error when produce returns error_code >= 400', async () => {
      vi.mocked(schemaRegistryApi.getSchemaDetail).mockRejectedValue(new Error('Not found'));
      vi.mocked(flinkApi.getTableSchema).mockResolvedValue([{ name: 'v', type: 'INT' }]);
      vi.mocked(topicApi.produceRecord).mockResolvedValue({
        error_code: 403,
        message: 'Unauthorized',
      } as any);

      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Produce'));

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Start producer'));
      });

      // Advance timer for interval
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });
});
