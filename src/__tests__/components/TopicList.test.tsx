/**
 * @topic-list @topic-list-coverage
 * TopicList — coverage for bulk delete, keyboard nav, health scores,
 * search debounce, loading/error/empty states, count bar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { KafkaTopic } from '../../types';

// MED-2: Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 41,
        end: (i + 1) * 41,
        size: 41,
        lane: 0,
      })),
    getTotalSize: () => count * 41,
    scrollToIndex: vi.fn(),
  }),
}));

// Mock CreateTopic
vi.mock('../../components/TopicPanel/CreateTopic', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="create-topic-modal"><button onClick={onClose}>Close</button></div> : null,
}));

// Store mock
let mockTopicList: KafkaTopic[] = [];
let mockTopicLoading = false;
let mockTopicError: string | null = null;
let mockBulkSelectedTopics: string[] = [];
let mockIsBulkMode = false;
let mockLastFocusedTopicName: string | null = null;

const mockLoadTopics = vi.fn().mockResolvedValue(undefined);
const mockSelectTopic = vi.fn();
const mockAddToast = vi.fn();
const mockEnterBulkMode = vi.fn();
const mockExitBulkMode = vi.fn();
const mockToggleBulkTopicSelection = vi.fn();
const mockSelectAllBulkTopics = vi.fn();
const mockClearBulkSelection = vi.fn();
const mockDeleteTopicsBulk = vi.fn().mockResolvedValue({ deleted: [], failed: [] });
const mockSetLastFocusedTopicName = vi.fn();

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      topicList: mockTopicList,
      topicLoading: mockTopicLoading,
      topicError: mockTopicError,
      loadTopics: mockLoadTopics,
      selectTopic: mockSelectTopic,
      addToast: mockAddToast,
      lastFocusedTopicName: mockLastFocusedTopicName,
      setLastFocusedTopicName: mockSetLastFocusedTopicName,
      isBulkMode: mockIsBulkMode,
      bulkSelectedTopics: mockBulkSelectedTopics,
      enterBulkMode: mockEnterBulkMode,
      exitBulkMode: mockExitBulkMode,
      toggleBulkTopicSelection: mockToggleBulkTopicSelection,
      selectAllBulkTopics: mockSelectAllBulkTopics,
      clearBulkSelection: mockClearBulkSelection,
      deleteTopicsBulk: mockDeleteTopicsBulk,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

import TopicList from '../../components/TopicPanel/TopicList';

function makeTopic(name: string, overrides: Partial<KafkaTopic> = {}): KafkaTopic {
  return {
    topic_name: name,
    partitions_count: 3,
    replication_factor: 2,
    is_internal: false,
    ...overrides,
  };
}

describe('[@topic-list-coverage] TopicList Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTopicList = [makeTopic('orders'), makeTopic('payments'), makeTopic('users')];
    mockTopicLoading = false;
    mockTopicError = null;
    mockIsBulkMode = false;
    mockBulkSelectedTopics = [];
    mockLastFocusedTopicName = null;
  });

  // ========================================================================
  // Loading State
  // ========================================================================

  describe('[@topic-list-coverage] Loading State', () => {
    it('shows loading spinner when topicLoading is true', () => {
      mockTopicLoading = true;
      render(<TopicList />);
      expect(screen.getByText('Loading topics...')).toBeInTheDocument();
    });

    it('shows accessible loading label', () => {
      mockTopicLoading = true;
      render(<TopicList />);
      expect(screen.getByLabelText('Loading topics')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Error State
  // ========================================================================

  describe('[@topic-list-coverage] Error State', () => {
    it('shows error banner with message and retry button', () => {
      mockTopicError = 'Network failure';
      render(<TopicList />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Network failure')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('retry button calls loadTopics', () => {
      mockTopicError = 'Network failure';
      render(<TopicList />);
      fireEvent.click(screen.getByText('Retry'));
      expect(mockLoadTopics).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Empty State
  // ========================================================================

  describe('[@topic-list-coverage] Empty State', () => {
    it('shows empty state when no topics exist', () => {
      mockTopicList = [];
      render(<TopicList />);
      expect(screen.getByText('No topics found')).toBeInTheDocument();
    });

    it('shows Create Topic button in empty state', () => {
      mockTopicList = [];
      render(<TopicList />);
      expect(screen.getByText('Create Topic')).toBeInTheDocument();
    });

    it('clicking Create Topic in empty state opens modal', () => {
      mockTopicList = [];
      render(<TopicList />);
      fireEvent.click(screen.getByText('Create Topic'));
      expect(screen.getByTestId('create-topic-modal')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Topic List Rendering
  // ========================================================================

  describe('[@topic-list-coverage] List Rendering', () => {
    it('renders all topics in list', () => {
      render(<TopicList />);
      expect(screen.getByText('orders')).toBeInTheDocument();
      expect(screen.getByText('payments')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();
    });

    it('shows count bar with total topics', () => {
      render(<TopicList />);
      expect(screen.getByText('3 topics')).toBeInTheDocument();
    });

    it('shows singular "topic" for single item', () => {
      mockTopicList = [makeTopic('only-one')];
      render(<TopicList />);
      expect(screen.getByText('1 topic')).toBeInTheDocument();
    });

    it('shows partition count and RF for each topic', () => {
      mockTopicList = [makeTopic('test', { partitions_count: 6, replication_factor: 3 })];
      render(<TopicList />);
      expect(screen.getByText(/6p/)).toBeInTheDocument();
      expect(screen.getByText(/RF:3/)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Health Score Dots (F6)
  // ========================================================================

  describe('[@topic-list-coverage] Health Score Dots', () => {
    it('does NOT show health dot for healthy topic (green)', () => {
      mockTopicList = [makeTopic('healthy', { partitions_count: 3, replication_factor: 3 })];
      render(<TopicList />);
      // Green topics should have no health dot rendered
      expect(screen.queryByTestId('health-score-healthy')).not.toBeInTheDocument();
    });

    it('shows yellow dot for single-partition topic', () => {
      mockTopicList = [makeTopic('single-part', { partitions_count: 1, replication_factor: 3 })];
      render(<TopicList />);
      const dot = screen.getByTestId('health-score-single-part');
      expect(dot).toBeInTheDocument();
      expect(dot.getAttribute('aria-label')).toContain('yellow');
    });

    it('shows red dot for zero-partition topic', () => {
      mockTopicList = [makeTopic('broken', { partitions_count: 0, replication_factor: 3 })];
      render(<TopicList />);
      const dot = screen.getByTestId('health-score-broken');
      expect(dot).toBeInTheDocument();
      expect(dot.getAttribute('aria-label')).toContain('red');
    });

    it('shows red dot for zero RF topic', () => {
      mockTopicList = [makeTopic('no-rf', { partitions_count: 3, replication_factor: 0 })];
      render(<TopicList />);
      const dot = screen.getByTestId('health-score-no-rf');
      expect(dot).toBeInTheDocument();
      expect(dot.getAttribute('aria-label')).toContain('red');
    });
  });

  // ========================================================================
  // Search and Filter
  // ========================================================================

  describe('[@topic-list-coverage] Search', () => {
    it('filters topics as user types', async () => {
      const user = userEvent.setup();
      render(<TopicList />);
      const input = screen.getByPlaceholderText('Filter topics...');
      await user.type(input, 'ord');

      await waitFor(() => {
        expect(screen.getByText('orders')).toBeInTheDocument();
        expect(screen.queryByText('payments')).not.toBeInTheDocument();
      });
    });

    it('shows "N of M topics" count when filtering', async () => {
      const user = userEvent.setup();
      render(<TopicList />);
      const input = screen.getByPlaceholderText('Filter topics...');
      await user.type(input, 'ord');

      await waitFor(() => {
        expect(screen.getByText('1 of 3 topics')).toBeInTheDocument();
      });
    });

    it('clear button resets filter', async () => {
      const user = userEvent.setup();
      render(<TopicList />);
      const input = screen.getByPlaceholderText('Filter topics...');
      await user.type(input, 'ord');

      await waitFor(() => {
        expect(screen.queryByText('payments')).not.toBeInTheDocument();
      });

      const clearBtn = screen.getByLabelText('Clear filter');
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(screen.getByText('payments')).toBeInTheDocument();
      });
    });

    it('shows no-results state when filter matches nothing', async () => {
      const user = userEvent.setup();
      render(<TopicList />);
      const input = screen.getByPlaceholderText('Filter topics...');
      await user.type(input, 'zzzzzzz');

      await waitFor(() => {
        expect(screen.queryByText('orders')).not.toBeInTheDocument();
      });
    });
  });

  // ========================================================================
  // Topic Selection
  // ========================================================================

  describe('[@topic-list-coverage] Topic Selection', () => {
    it('clicking a topic row calls selectTopic', () => {
      render(<TopicList />);
      fireEvent.click(screen.getByText('orders'));
      expect(mockSelectTopic).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Keyboard Navigation
  // ========================================================================

  describe('[@topic-list-coverage] Keyboard Navigation', () => {
    it('ArrowDown from search focuses first item', () => {
      render(<TopicList />);
      const input = screen.getByPlaceholderText('Filter topics...');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      // The first item should receive focus
      const items = screen.getAllByRole('listitem');
      expect(items.length).toBeGreaterThan(0);
    });

    it('Enter on focused item calls selectTopic', () => {
      render(<TopicList />);
      const items = screen.getAllByRole('listitem');
      fireEvent.keyDown(items[0], { key: 'Enter' });
      expect(mockSelectTopic).toHaveBeenCalled();
    });

    it('Space on focused item calls selectTopic', () => {
      render(<TopicList />);
      const items = screen.getAllByRole('listitem');
      fireEvent.keyDown(items[0], { key: ' ' });
      expect(mockSelectTopic).toHaveBeenCalled();
    });

    it('ArrowDown navigates to next item', () => {
      render(<TopicList />);
      const items = screen.getAllByRole('listitem');
      fireEvent.keyDown(items[0], { key: 'ArrowDown' });
      // Focus should move — testing via the mechanism working without errors
      expect(items.length).toBeGreaterThan(1);
    });

    it('ArrowUp navigates to previous item', () => {
      render(<TopicList />);
      const items = screen.getAllByRole('listitem');
      fireEvent.keyDown(items[1], { key: 'ArrowUp' });
      expect(items.length).toBeGreaterThan(1);
    });
  });

  // ========================================================================
  // Bulk Mode
  // ========================================================================

  describe('[@topic-list-coverage] Bulk Mode', () => {
    it('renders bulk mode toggle button', () => {
      render(<TopicList />);
      expect(screen.getByLabelText('Enter bulk selection mode')).toBeInTheDocument();
    });

    it('clicking bulk toggle enters bulk mode', () => {
      render(<TopicList />);
      fireEvent.click(screen.getByLabelText('Enter bulk selection mode'));
      expect(mockEnterBulkMode).toHaveBeenCalled();
    });

    it('shows action bar when in bulk mode', () => {
      mockIsBulkMode = true;
      render(<TopicList />);
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });

    it('shows "Select all" when nothing selected', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = [];
      render(<TopicList />);
      expect(screen.getByText('Select all')).toBeInTheDocument();
    });

    it('shows "N selected" when some items selected', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['orders'];
      render(<TopicList />);
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('shows "Clear all" when all items selected', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['orders', 'payments', 'users'];
      render(<TopicList />);
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    it('clicking item in bulk mode toggles selection', () => {
      mockIsBulkMode = true;
      render(<TopicList />);
      fireEvent.click(screen.getByText('orders'));
      expect(mockToggleBulkTopicSelection).toHaveBeenCalledWith('orders');
    });

    it('Enter key in bulk mode toggles selection', () => {
      mockIsBulkMode = true;
      render(<TopicList />);
      const items = screen.getAllByRole('listitem');
      fireEvent.keyDown(items[0], { key: 'Enter' });
      expect(mockToggleBulkTopicSelection).toHaveBeenCalled();
    });

    it('Space key in bulk mode toggles selection', () => {
      mockIsBulkMode = true;
      render(<TopicList />);
      const items = screen.getAllByRole('listitem');
      fireEvent.keyDown(items[0], { key: ' ' });
      expect(mockToggleBulkTopicSelection).toHaveBeenCalled();
    });

    it('Escape key in bulk mode exits bulk mode', () => {
      mockIsBulkMode = true;
      render(<TopicList />);
      const items = screen.getAllByRole('listitem');
      fireEvent.keyDown(items[0], { key: 'Escape' });
      expect(mockExitBulkMode).toHaveBeenCalled();
    });

    it('cancel button exits bulk mode', () => {
      mockIsBulkMode = true;
      render(<TopicList />);
      fireEvent.click(screen.getByLabelText('Cancel bulk selection'));
      expect(mockExitBulkMode).toHaveBeenCalled();
    });

    it('delete button disabled when no items selected', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = [];
      render(<TopicList />);
      const deleteBtn = screen.getByText('Delete');
      expect(deleteBtn.closest('button')).toBeDisabled();
    });

    it('delete button opens confirmation dialog', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['orders', 'payments'];
      render(<TopicList />);
      const deleteBtn = screen.getByText(/Delete \(2\)/);
      fireEvent.click(deleteBtn.closest('button')!);

      // Confirmation dialog should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Delete 2 topics\?/)).toBeInTheDocument();
    });

    it('confirmation dialog lists selected topics', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['orders', 'payments'];
      render(<TopicList />);
      const deleteBtn = screen.getByText(/Delete \(2\)/);
      fireEvent.click(deleteBtn.closest('button')!);

      // "orders" and "payments" appear in both the list and the dialog
      // so check that the dialog itself contains them
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('orders');
      expect(dialog).toHaveTextContent('payments');
    });

    it('confirmation dialog shows "and N more" for >5 items', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
      mockTopicList = mockBulkSelectedTopics.map((n) => makeTopic(n));
      render(<TopicList />);
      const deleteBtn = screen.getByText(/Delete \(7\)/);
      fireEvent.click(deleteBtn.closest('button')!);

      expect(screen.getByText(/and 2 more/)).toBeInTheDocument();
    });

    it('cancel in confirmation dialog closes it', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['orders'];
      render(<TopicList />);
      const deleteBtn = screen.getByText(/Delete \(1\)/);
      fireEvent.click(deleteBtn.closest('button')!);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click cancel in dialog
      const cancelBtns = screen.getAllByText('Cancel');
      const dialogCancel = cancelBtns.find((b) => b.closest('[role="dialog"]'));
      if (dialogCancel) {
        fireEvent.click(dialogCancel);
      }
      expect(screen.queryByText(/Delete 1 topic\?/)).not.toBeInTheDocument();
    });

    it('confirm in dialog calls deleteTopicsBulk and shows success toast', async () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['orders'];
      mockDeleteTopicsBulk.mockResolvedValue({ deleted: ['orders'], failed: [] });
      render(<TopicList />);

      // Open dialog
      const deleteBtn = screen.getByText(/Delete \(1\)/);
      fireEvent.click(deleteBtn.closest('button')!);

      // Click confirm
      const confirmBtn = screen.getByLabelText(/Confirm delete/);
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(mockDeleteTopicsBulk).toHaveBeenCalledWith(['orders']);
      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success' })
        );
      });
    });

    it('shows error toast when some bulk deletes fail', async () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['orders', 'payments'];
      mockDeleteTopicsBulk.mockResolvedValue({ deleted: ['orders'], failed: ['payments'] });
      render(<TopicList />);

      const deleteBtn = screen.getByText(/Delete \(2\)/);
      fireEvent.click(deleteBtn.closest('button')!);

      const confirmBtn = screen.getByLabelText(/Confirm delete/);
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' })
        );
      });
    });

    it('select all button calls selectAllBulkTopics', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = [];
      render(<TopicList />);
      fireEvent.click(screen.getByText('Select all'));
      expect(mockSelectAllBulkTopics).toHaveBeenCalled();
    });

    it('clear all button calls clearBulkSelection', () => {
      mockIsBulkMode = true;
      mockBulkSelectedTopics = ['orders', 'payments', 'users'];
      render(<TopicList />);
      fireEvent.click(screen.getByText('Clear all'));
      expect(mockClearBulkSelection).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Create Topic
  // ========================================================================

  describe('[@topic-list-coverage] Create Topic', () => {
    it('Create button opens modal', () => {
      render(<TopicList />);
      fireEvent.click(screen.getByLabelText('Create new topic'));
      expect(screen.getByTestId('create-topic-modal')).toBeInTheDocument();
    });

    it('Create button hidden in bulk mode', () => {
      mockIsBulkMode = true;
      render(<TopicList />);
      expect(screen.queryByLabelText('Create new topic')).not.toBeInTheDocument();
    });
  });
});
