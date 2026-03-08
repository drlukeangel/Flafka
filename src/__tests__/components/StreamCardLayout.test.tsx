/**
 * @stream-card-layout
 * StreamCard layout tests — kebab menu, results bar, consumer controls,
 * producer controls, and mode selector.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { StreamCard } from '../../components/StreamsPanel/StreamCard';
import { useWorkspaceStore } from '../../store/workspaceStore';

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

describe('[@stream-card-layout] StreamCard Layout', () => {
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

  // ========================================================================
  // Kebab Menu Tests
  // ========================================================================

  describe('Kebab menu', () => {
    it('menu button renders with aria-label "Card actions"', () => {
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByLabelText('Card actions')).toBeInTheDocument();
    });

    it('clicking kebab opens dropdown with Duplicate, View Topic, View Schema, Remove Card', () => {
      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Card actions'));
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
      expect(screen.getByText('View Topic')).toBeInTheDocument();
      expect(screen.getByText('View Schema')).toBeInTheDocument();
      expect(screen.getByText('Remove Card')).toBeInTheDocument();
    });

    it('clicking Duplicate in menu calls onDuplicate', () => {
      const onDuplicate = vi.fn();
      render(<StreamCard {...defaultProps} onDuplicate={onDuplicate} />);
      fireEvent.click(screen.getByLabelText('Card actions'));
      fireEvent.click(screen.getByText('Duplicate'));
      expect(onDuplicate).toHaveBeenCalled();
    });

    it('clicking View Topic calls navigateToTopic with topic name', () => {
      const navigateToTopic = vi.fn().mockResolvedValue(undefined);
      useWorkspaceStore.setState({ navigateToTopic });
      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Card actions'));
      fireEvent.click(screen.getByText('View Topic'));
      expect(navigateToTopic).toHaveBeenCalledWith('test-topic');
    });

    it('clicking View Schema calls navigateToSchemaSubject with topicName-value', () => {
      const navigateToSchemaSubject = vi.fn();
      useWorkspaceStore.setState({ navigateToSchemaSubject });
      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Card actions'));
      fireEvent.click(screen.getByText('View Schema'));
      expect(navigateToSchemaSubject).toHaveBeenCalledWith('test-topic-value');
    });

    it('clicking Remove Card calls onRemove and stops background statement', () => {
      const onRemove = vi.fn();
      const cancelBackgroundStatement = vi.fn().mockResolvedValue(undefined);
      useWorkspaceStore.setState({ cancelBackgroundStatement });
      render(<StreamCard {...defaultProps} onRemove={onRemove} />);
      fireEvent.click(screen.getByLabelText('Card actions'));
      fireEvent.click(screen.getByText('Remove Card'));
      expect(cancelBackgroundStatement).toHaveBeenCalledWith('card-1');
      expect(onRemove).toHaveBeenCalled();
    });

    it('menu closes after action', () => {
      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Card actions'));
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Duplicate'));
      expect(screen.queryByText('View Topic')).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Results Bar Tests
  // ========================================================================

  describe('Results bar', () => {
    const bgStatementWithResults = {
      id: 'bg-1',
      contextId: 'card-1',
      statementName: 'stmt-1',
      sql: 'SELECT * FROM t',
      status: 'COMPLETED' as const,
      results: [
        { _ts: '2026-01-01T00:00:00Z', value: 'a' },
        { _ts: '2026-01-01T00:00:01Z', value: 'b' },
      ],
      columns: [
        { name: '_ts', type: 'STRING' },
        { name: 'value', type: 'STRING' },
      ],
      createdAt: new Date(),
    };

    it('results bar appears when there are results', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [bgStatementWithResults],
      });
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByLabelText('Hide results')).toBeInTheDocument();
    });

    it('results toggle hides/shows table', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [bgStatementWithResults],
      });
      render(<StreamCard {...defaultProps} />);
      // Table visible initially
      expect(screen.getByTestId('stream-card-table')).toBeInTheDocument();
      // Click to hide
      fireEvent.click(screen.getByLabelText('Hide results'));
      expect(screen.queryByTestId('stream-card-table')).not.toBeInTheDocument();
      // Click to show again
      fireEvent.click(screen.getByLabelText('Show results'));
      expect(screen.getByTestId('stream-card-table')).toBeInTheDocument();
    });

    it('columns button opens column visibility dropdown', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [bgStatementWithResults],
      });
      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Toggle columns'));
      expect(screen.getByText('Show All')).toBeInTheDocument();
      expect(screen.getByText('Hide All')).toBeInTheDocument();
    });

    it('export button opens export dropdown', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [bgStatementWithResults],
      });
      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Export data'));
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
      expect(screen.getByText('Export as JSON')).toBeInTheDocument();
      expect(screen.getByText('Copy as Markdown')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Consumer Controls Row Tests
  // ========================================================================

  describe('Consumer controls row', () => {
    it('consumer controls row visible in consume mode', () => {
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByLabelText('Scan mode')).toBeInTheDocument();
      expect(screen.getByLabelText('Fetch messages')).toBeInTheDocument();
      expect(screen.getByLabelText('Clear all results and stop streaming')).toBeInTheDocument();
    });

    it('consumer controls NOT visible when collapsed', () => {
      render(<StreamCard {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Collapse card'));
      expect(screen.queryByLabelText('Scan mode')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Fetch messages')).not.toBeInTheDocument();
    });

    it('scan mode dropdown present with Earliest/Latest', () => {
      render(<StreamCard {...defaultProps} />);
      const scanMode = screen.getByLabelText('Scan mode') as HTMLSelectElement;
      const options = Array.from(scanMode.querySelectorAll('option'));
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts).toContain('Earliest');
      expect(optionTexts).toContain('Latest');
    });

    it('fetch button has aria-label "Fetch messages"', () => {
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByLabelText('Fetch messages')).toBeInTheDocument();
    });

    it('clear button has aria-label "Clear all results and stop streaming"', () => {
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByLabelText('Clear all results and stop streaming')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Producer Controls Tests
  // ========================================================================

  describe('Producer controls', () => {
    it('source row shows Start button and data source dropdown', () => {
      render(<StreamCard {...defaultProps} initialMode="produce-consume" />);
      expect(screen.getByLabelText('Start producer')).toBeInTheDocument();
      expect(screen.getByLabelText('Data source')).toBeInTheDocument();
    });

    it('divider separates produce controls from fetch controls', () => {
      const { container } = render(<StreamCard {...defaultProps} initialMode="produce-consume" />);
      const dividers = container.querySelectorAll('.stream-card-divider');
      expect(dividers.length).toBeGreaterThanOrEqual(1);
    });

    it('dataset options row appears when dataset source selected', () => {
      render(<StreamCard {...defaultProps} initialMode="produce-consume" />);
      fireEvent.change(screen.getByLabelText('Data source'), { target: { value: 'dataset' } });
      expect(screen.getByLabelText('Select dataset')).toBeInTheDocument();
    });

    it('dataset selector and + button in dataset options row', () => {
      render(<StreamCard {...defaultProps} initialMode="produce-consume" />);
      fireEvent.change(screen.getByLabelText('Data source'), { target: { value: 'dataset' } });
      expect(screen.getByLabelText('Select dataset')).toBeInTheDocument();
      expect(screen.getByLabelText(`Open schema datasets for test-topic`)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Mode Selector Tests
  // ========================================================================

  describe('Mode selector', () => {
    it('mode selector renders Consume and Produce buttons', () => {
      render(<StreamCard {...defaultProps} />);
      expect(screen.getByText('Consume')).toBeInTheDocument();
      expect(screen.getByText('Produce')).toBeInTheDocument();
    });

    it('switching mode hides/shows appropriate controls', () => {
      render(<StreamCard {...defaultProps} />);
      // In consume mode: scan mode visible, no producer start button
      expect(screen.getByLabelText('Scan mode')).toBeInTheDocument();
      expect(screen.queryByLabelText('Start producer')).not.toBeInTheDocument();

      // Switch to produce mode
      fireEvent.click(screen.getByText('Produce'));
      // Producer controls visible, consumer scan mode hidden
      expect(screen.getByLabelText('Start producer')).toBeInTheDocument();
      expect(screen.getByLabelText('Data source')).toBeInTheDocument();
      expect(screen.queryByLabelText('Scan mode')).not.toBeInTheDocument();

      // Switch back to consume
      fireEvent.click(screen.getByText('Consume'));
      expect(screen.getByLabelText('Scan mode')).toBeInTheDocument();
      expect(screen.queryByLabelText('Start producer')).not.toBeInTheDocument();
    });
  });
});
