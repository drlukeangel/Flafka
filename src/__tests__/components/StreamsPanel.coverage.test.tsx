/**
 * @stream-panel-coverage
 * StreamsPanel — additional coverage for resize, loadTopics guard,
 * duplicate card.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StreamsPanel } from '../../components/StreamsPanel/StreamsPanel';
import { useWorkspaceStore } from '../../store/workspaceStore';

// Mock StreamCard
vi.mock('../../components/StreamsPanel/StreamCard', () => ({
  StreamCard: ({
    topicName,
    onRemove,
    onDuplicate,
  }: {
    topicName: string;
    onRemove: () => void;
    onDuplicate: () => void;
  }) => (
    <div data-testid={`stream-card-${topicName}`}>
      <span>{topicName}</span>
      <button onClick={onRemove} data-testid={`remove-${topicName}`}>Remove</button>
      <button onClick={onDuplicate} data-testid={`duplicate-${topicName}`}>Duplicate</button>
    </div>
  ),
}));

describe('[@stream-panel-coverage] StreamsPanel Coverage', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      streamsPanelOpen: true,
      streamCards: [],
      backgroundStatements: [],
      topicList: [
        { topic_name: 'orders', is_internal: false, replication_factor: 3, partitions_count: 6 },
        { topic_name: 'payments', is_internal: false, replication_factor: 3, partitions_count: 3 },
      ],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================================================
  // loadTopics Guard
  // ========================================================================

  describe('[@stream-panel-coverage] loadTopics guard', () => {
    it('calls loadTopics when topic list is empty on mount', () => {
      const loadTopicsSpy = vi.fn();
      useWorkspaceStore.setState({
        topicList: [],
        loadTopics: loadTopicsSpy,
      });

      render(<StreamsPanel />);
      expect(loadTopicsSpy).toHaveBeenCalled();
    });

    it('does not call loadTopics when topic list is non-empty', () => {
      const loadTopicsSpy = vi.fn();
      useWorkspaceStore.setState({
        topicList: [
          { topic_name: 'orders', is_internal: false, replication_factor: 3, partitions_count: 6 },
        ],
        loadTopics: loadTopicsSpy,
      });

      render(<StreamsPanel />);
      expect(loadTopicsSpy).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Duplicate Card
  // ========================================================================

  describe('[@stream-panel-coverage] Duplicate', () => {
    it('clicking duplicate adds another card for same topic', () => {
      useWorkspaceStore.setState({
        streamCards: [{ id: 'card-orders', topicName: 'orders' }],
      });

      render(<StreamsPanel />);
      fireEvent.click(screen.getByTestId('duplicate-orders'));

      const cards = useWorkspaceStore.getState().streamCards;
      const orderCards = cards.filter((c: { topicName: string }) => c.topicName === 'orders');
      expect(orderCards.length).toBe(2);
    });
  });

  // ========================================================================
  // Remove Card
  // ========================================================================

  describe('[@stream-panel-coverage] Remove Card', () => {
    it('clicking remove calls removeStreamCard with correct id', () => {
      const removeSpy = vi.fn();
      useWorkspaceStore.setState({
        streamCards: [{ id: 'card-orders', topicName: 'orders' }],
        removeStreamCard: removeSpy,
      });

      render(<StreamsPanel />);
      fireEvent.click(screen.getByTestId('remove-orders'));
      expect(removeSpy).toHaveBeenCalledWith('card-orders');
    });
  });

  // ========================================================================
  // Topic Resize Handle
  // ========================================================================

  describe('[@stream-panel-coverage] Resize Handle', () => {
    it('resize handle renders with correct title', () => {
      render(<StreamsPanel />);
      expect(screen.getByTitle('Drag to resize topic list')).toBeInTheDocument();
    });

    it('mousedown on resize handle initiates resize', () => {
      render(<StreamsPanel />);
      const handle = screen.getByTitle('Drag to resize topic list');

      // Start drag
      fireEvent.mouseDown(handle, { clientY: 100 });

      // Simulate mouse move
      fireEvent.mouseMove(document, { clientY: 150 });
      fireEvent.mouseUp(document);

      // Should not throw and component should still render
      expect(screen.getByTitle('Drag to resize topic list')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Empty State
  // ========================================================================

  describe('[@stream-panel-coverage] Empty State', () => {
    it('shows Streams heading in empty state', () => {
      render(<StreamsPanel />);
      const headings = screen.getAllByText('Streams');
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('shows empty state message when no cards', () => {
      render(<StreamsPanel />);
      expect(screen.getByText('Select a topic above to start streaming')).toBeInTheDocument();
    });

    it('hides empty state when cards exist', () => {
      useWorkspaceStore.setState({
        streamCards: [{ id: 'card-1', topicName: 'orders' }],
      });
      render(<StreamsPanel />);
      expect(screen.queryByText('Select a topic above to start streaming')).not.toBeInTheDocument();
    });
  });
});
