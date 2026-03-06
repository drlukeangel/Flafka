import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StreamsPanel } from '../../components/StreamsPanel/StreamsPanel';
import { useWorkspaceStore } from '../../store/workspaceStore';

// Mock StreamCard to avoid circular dependencies in test
vi.mock('../../components/StreamsPanel/StreamCard', () => ({
  StreamCard: ({ topicName, onRemove }: { topicName: string; onRemove: () => void }) => (
    <div data-testid={`stream-card-${topicName}`}>
      <span>{topicName}</span>
      <button onClick={onRemove}>Remove</button>
    </div>
  ),
}));

describe('[@stream-panel] StreamsPanel', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      streamsPanelOpen: true,
      streamCards: [],
      backgroundStatements: [],
      topicList: [
        { topic_name: 'orders', is_internal: false, replication_factor: 3, partitions_count: 6 },
        { topic_name: 'payments', is_internal: false, replication_factor: 3, partitions_count: 3 },
        { topic_name: 'users', is_internal: false, replication_factor: 3, partitions_count: 12 },
        { topic_name: 'inventory', is_internal: false, replication_factor: 3, partitions_count: 3 },
        { topic_name: 'shipping', is_internal: false, replication_factor: 3, partitions_count: 6 },
        { topic_name: 'returns', is_internal: false, replication_factor: 3, partitions_count: 3 },
      ],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Streams label in search header', () => {
    render(<StreamsPanel />);
    // "Streams" appears in both the search label and the empty state heading
    const allStreams = screen.getAllByText('Streams');
    expect(allStreams.length).toBeGreaterThanOrEqual(1);
  });

  it('empty state shows when 0 stream cards exist', () => {
    render(<StreamsPanel />);
    expect(screen.getByText('Select a topic above to start streaming')).toBeTruthy();
  });

  it('topic list with checkboxes renders from topicList', () => {
    render(<StreamsPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(6);
  });

  it('checking topic adds a stream card', () => {
    render(<StreamsPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // orders
    // After clicking, a streamCard should be added for 'orders'
    const cards = useWorkspaceStore.getState().streamCards;
    expect(cards.some((c: { topicName: string }) => c.topicName === 'orders')).toBe(true);
  });

  it('unchecking topic removes stream cards for that topic', () => {
    useWorkspaceStore.setState({ streamCards: [{ id: 'card-1', topicName: 'orders' }] });
    render(<StreamsPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    // The first checkbox (orders) should be checked — click to uncheck
    fireEvent.click(checkboxes[0]);
    const cards = useWorkspaceStore.getState().streamCards;
    expect(cards.some((c: { topicName: string }) => c.topicName === 'orders')).toBe(false);
  });

  it('search input filters topic list', () => {
    render(<StreamsPanel />);
    const searchInput = screen.getByPlaceholderText('Search topics...');
    fireEvent.change(searchInput, { target: { value: 'pay' } });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(1);
    expect(screen.getByText('payments')).toBeTruthy();
  });

  it('max 10 enforcement: 11th checkbox is disabled with title', () => {
    // Create 10 stream cards
    const tenCards = Array.from({ length: 10 }, (_, i) => ({
      id: `card-${i}`,
      topicName: `topic-${i}`,
    }));
    useWorkspaceStore.setState({ streamCards: tenCards });
    render(<StreamsPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    // None of the 10 cards match the 6 topics in topicList, so all 6 checkboxes should be disabled
    const disabledCheckboxes = checkboxes.filter((cb) => (cb as HTMLInputElement).disabled);
    expect(disabledCheckboxes.length).toBe(6);
    expect(disabledCheckboxes[0]?.getAttribute('title')).toBe('Max 10 streams');
  });

  it('empty state visible when 0 stream cards', () => {
    render(<StreamsPanel />);
    expect(screen.getByText('Select a topic above to start streaming')).toBeTruthy();
  });

  it('renders StreamCard for each stream card entry', () => {
    useWorkspaceStore.setState({
      streamCards: [
        { id: 'card-orders', topicName: 'orders' },
        { id: 'card-payments', topicName: 'payments' },
      ],
    });
    render(<StreamsPanel />);
    expect(screen.getByTestId('stream-card-orders')).toBeTruthy();
    expect(screen.getByTestId('stream-card-payments')).toBeTruthy();
  });
});

describe('[@stream-nav-rail] NavRail streams integration', () => {
  // These tests validate that the streams button in NavRail works correctly
  // We test via the store since NavRail requires the full app context

  beforeEach(() => {
    useWorkspaceStore.setState({
      streamsPanelOpen: false,
      activeNavItem: 'workspace',
    });
  });

  it('toggleStreamsPanel does NOT change activeNavItem', () => {
    useWorkspaceStore.getState().toggleStreamsPanel();
    expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(true);
    expect(useWorkspaceStore.getState().activeNavItem).toBe('workspace');
  });

  it('streamsPanelOpen toggles independently of activeNavItem', () => {
    useWorkspaceStore.setState({ activeNavItem: 'topics' });
    useWorkspaceStore.getState().toggleStreamsPanel();
    expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(true);
    expect(useWorkspaceStore.getState().activeNavItem).toBe('topics');
  });
});
