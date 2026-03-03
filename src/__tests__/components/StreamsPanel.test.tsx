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
      streamsSelectedTopics: [],
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

  it('renders Streams title', () => {
    render(<StreamsPanel />);
    expect(screen.getByText('Streams')).toBeTruthy();
  });

  it('close button calls toggleStreamsPanel', () => {
    const originalToggle = useWorkspaceStore.getState().toggleStreamsPanel;
    const toggleSpy = vi.fn(originalToggle);
    useWorkspaceStore.setState({ toggleStreamsPanel: toggleSpy });
    render(<StreamsPanel />);
    const closeBtn = screen.getByLabelText('Close streams panel');
    fireEvent.click(closeBtn);
    expect(toggleSpy).toHaveBeenCalled();
    useWorkspaceStore.setState({ toggleStreamsPanel: originalToggle });
  });

  it('topic list with checkboxes renders from topicList', () => {
    render(<StreamsPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(6);
  });

  it('checking topic adds to streamsSelectedTopics', () => {
    render(<StreamsPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // orders
    expect(useWorkspaceStore.getState().streamsSelectedTopics).toContain('orders');
  });

  it('unchecking topic removes from streamsSelectedTopics', () => {
    useWorkspaceStore.setState({ streamsSelectedTopics: ['orders'] });
    render(<StreamsPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    // The first checkbox (orders) should be checked — click to uncheck
    fireEvent.click(checkboxes[0]);
    expect(useWorkspaceStore.getState().streamsSelectedTopics).not.toContain('orders');
  });

  it('search input filters topic list', () => {
    render(<StreamsPanel />);
    const searchInput = screen.getByPlaceholderText('Search topics...');
    fireEvent.change(searchInput, { target: { value: 'pay' } });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(1);
    expect(screen.getByText('payments')).toBeTruthy();
  });

  it('max 5 enforcement: 6th checkbox is disabled with title', () => {
    useWorkspaceStore.setState({
      streamsSelectedTopics: ['orders', 'payments', 'users', 'inventory', 'shipping'],
    });
    render(<StreamsPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    // 'returns' is not selected, should be disabled
    const returnsCheckbox = checkboxes.find((cb) => !cb.closest('label')?.textContent?.match(/orders|payments|users|inventory|shipping/));
    expect(returnsCheckbox).toBeTruthy();
    expect(returnsCheckbox?.hasAttribute('disabled')).toBe(true);
    expect(returnsCheckbox?.getAttribute('title')).toBe('Max 5 streams');
  });

  it('empty state visible when 0 topics selected', () => {
    render(<StreamsPanel />);
    expect(screen.getByText('Select topics above to start monitoring')).toBeTruthy();
  });

  it('renders StreamCard for each selected topic', () => {
    useWorkspaceStore.setState({ streamsSelectedTopics: ['orders', 'payments'] });
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
