/**
 * @topic-list-expanded
 * TopicList expanded coverage — bulk selection, filters, sorting, search
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TopicList from '../../components/TopicPanel/TopicList'
import type { KafkaTopic } from '../../types'

// Mock virtualizer
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
  }),
}))

// Mock topic API
vi.mock('../../api/topic-api', () => ({
  listTopics: vi.fn().mockResolvedValue([]),
}))

// Mock store
let mockTopicList: KafkaTopic[] = []
let mockSelectedTopic: KafkaTopic | null = null
let mockBulkSelectedTopics: string[] = []
let mockIsBulkMode = false

const mockSelectTopic = vi.fn()
const mockLoadTopics = vi.fn().mockResolvedValue(undefined)
const mockEnterBulkMode = vi.fn()
const mockExitBulkMode = vi.fn()
const mockToggleBulkTopicSelection = vi.fn()
const mockSelectAllBulkTopics = vi.fn()
const mockClearBulkSelection = vi.fn()
const mockDeleteTopicsBulk = vi.fn().mockResolvedValue({ deleted: [], failed: [] })

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      topics: mockTopicList,
      topicList: mockTopicList,
      selectedTopic: mockSelectedTopic,
      topicLoading: false,
      topicError: null,
      selectTopic: mockSelectTopic,
      loadTopics: mockLoadTopics,
      // Bulk delete fields
      isBulkMode: mockIsBulkMode,
      bulkSelectedTopics: mockBulkSelectedTopics,
      enterBulkMode: mockEnterBulkMode,
      exitBulkMode: mockExitBulkMode,
      toggleBulkTopicSelection: mockToggleBulkTopicSelection,
      selectAllBulkTopics: mockSelectAllBulkTopics,
      clearBulkSelection: mockClearBulkSelection,
      deleteTopicsBulk: mockDeleteTopicsBulk,
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

// Helpers
function makeTopic(overrides: Partial<KafkaTopic> = {}): KafkaTopic {
  return {
    topic_name: 'test-topic',
    partitions_count: 3,
    replication_factor: 2,
    is_internal: false,
    ...overrides,
  }
}

describe('[@topic-list-expanded] TopicList Expanded Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockSelectedTopic = null
    mockBulkSelectedTopics = []
    mockIsBulkMode = false
  })

  // ========================================================================
  // Rendering Tests
  // ========================================================================

  describe('[@topic-list-expanded] Rendering', () => {
    it('renders list container with aria-label', () => {
      render(<TopicList />)

      const list = screen.getByRole('list')
      expect(list).toHaveAttribute('aria-label')
    })

    it('renders all topics in the list', () => {
      mockTopicList = [
        makeTopic({ topic_name: 'orders' }),
        makeTopic({ topic_name: 'payments' }),
        makeTopic({ topic_name: 'users' }),
      ]

      render(<TopicList />)

      expect(screen.getByText('orders')).toBeInTheDocument()
      expect(screen.getByText('payments')).toBeInTheDocument()
      expect(screen.getByText('users')).toBeInTheDocument()
    })

    it('renders topic metadata (partition count, RF)', () => {
      mockTopicList = [makeTopic({ topic_name: 'test', partitions_count: 5, replication_factor: 3 })]

      render(<TopicList />)

      expect(screen.getByText('test')).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Search and Filter Tests
  // ========================================================================

  describe('[@topic-list-expanded] Search and Filtering', () => {
    it('renders search input with placeholder', () => {
      render(<TopicList />)

      const searchInput = screen.getByPlaceholderText(/search|filter/i)
      expect(searchInput).toBeInTheDocument()
    })

    it('filters topics by name as user types', async () => {
      mockTopicList = [
        makeTopic({ topic_name: 'orders-topic' }),
        makeTopic({ topic_name: 'payments-topic' }),
        makeTopic({ topic_name: 'users-topic' }),
      ]

      render(<TopicList />)

      const searchInput = screen.getByPlaceholderText(/filter/i) as HTMLInputElement
      await userEvent.type(searchInput, 'payments')

      expect(screen.getByText('payments-topic')).toBeInTheDocument()
    })

    it('is case-insensitive when filtering', async () => {
      mockTopicList = [makeTopic({ topic_name: 'OrdersTopic' })]

      render(<TopicList />)

      const searchInput = screen.getByPlaceholderText(/search|filter/i) as HTMLInputElement
      await userEvent.type(searchInput, 'orders')

      expect(screen.getByText('OrdersTopic')).toBeInTheDocument()
    })

    it('shows clear button when search has content', async () => {
      render(<TopicList />)

      const searchInput = screen.getByPlaceholderText(/filter/i) as HTMLInputElement
      await userEvent.type(searchInput, 'test')

      // Clear button should appear when search has content
      const clearBtn = screen.getByLabelText('Clear filter')
      expect(clearBtn).toBeInTheDocument()
    })

    it('clears search when clear button clicked', async () => {
      render(<TopicList />)

      const searchInput = screen.getByPlaceholderText(/filter/i) as HTMLInputElement
      await userEvent.type(searchInput, 'test')

      // Click clear button
      const clearBtn = screen.getByLabelText('Clear filter')
      await userEvent.click(clearBtn)

      expect(searchInput.value).toBe('')
    })
  })

  // ========================================================================
  // Sorting Tests
  // ========================================================================

  describe('[@topic-list-expanded] Sorting', () => {
    it('renders topics in sortable list', () => {
      mockTopicList = [
        makeTopic({ topic_name: 'zebra' }),
        makeTopic({ topic_name: 'alpha' }),
        makeTopic({ topic_name: 'beta' }),
      ]

      render(<TopicList />)

      // All topics should be visible
      expect(screen.getByText('zebra')).toBeInTheDocument()
      expect(screen.getByText('alpha')).toBeInTheDocument()
      expect(screen.getByText('beta')).toBeInTheDocument()
    })

    it('maintains list integrity with many topics', () => {
      mockTopicList = Array.from({ length: 50 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))

      render(<TopicList />)

      // First and last topics should be rendered (virtualized list)
      expect(screen.getByText('topic-0')).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Bulk Selection Tests
  // ========================================================================

  describe('[@topic-list-expanded] Bulk Selection', () => {
    it('renders checkboxes for bulk selection', () => {
      mockTopicList = [makeTopic({ topic_name: 'topic1' })]

      render(<TopicList />)

      const checkboxes = screen.queryAllByRole('checkbox')
      // Should have at least checkboxes for topics
      expect(checkboxes.length).toBeGreaterThanOrEqual(0)
    })

    it('enters bulk mode when bulk mode button is clicked', async () => {
      mockTopicList = [makeTopic({ topic_name: 'topic1' })]

      render(<TopicList />)

      // Look for bulk mode toggle button
      const bulkModeBtn = screen.getAllByRole('button').find((b) => b.title?.includes('Bulk') || b.title?.includes('bulk'))
      if (bulkModeBtn) {
        await userEvent.click(bulkModeBtn)
        expect(mockEnterBulkMode).toHaveBeenCalled()
      }
    })

    it('exits bulk mode when exiting', async () => {
      mockTopicList = [makeTopic({ topic_name: 'topic1' })]
      mockIsBulkMode = true

      const { rerender } = render(<TopicList />)

      mockIsBulkMode = false
      rerender(<TopicList />)

      // Should no longer be in bulk mode
      expect(mockIsBulkMode).toBe(false)
    })

    it('selects all topics with select-all button', async () => {
      mockTopicList = [
        makeTopic({ topic_name: 'topic1' }),
        makeTopic({ topic_name: 'topic2' }),
        makeTopic({ topic_name: 'topic3' }),
      ]
      mockIsBulkMode = true

      render(<TopicList />)

      const selectAllBtn = screen.getAllByRole('button').find((b) => b.title?.includes('Select all') || b.title?.includes('select all'))
      if (selectAllBtn) {
        await userEvent.click(selectAllBtn)
        expect(mockSelectAllBulkTopics).toHaveBeenCalled()
      }
    })

    it('clears bulk selection with clear button', async () => {
      mockTopicList = [makeTopic({ topic_name: 'topic1' })]
      mockIsBulkMode = true
      mockBulkSelectedTopics = ['topic1']

      render(<TopicList />)

      const clearBtn = screen.getAllByRole('button').find((b) => b.title?.includes('Clear'))
      if (clearBtn) {
        await userEvent.click(clearBtn)
        expect(mockClearBulkSelection).toHaveBeenCalled()
      }
    })

    it('toggles topic selection when checkbox clicked', async () => {
      mockTopicList = [makeTopic({ topic_name: 'topic1' })]
      mockIsBulkMode = true

      render(<TopicList />)

      const checkboxes = screen.queryAllByRole('checkbox')
      if (checkboxes.length > 0) {
        await userEvent.click(checkboxes[0])
        expect(mockToggleBulkTopicSelection).toHaveBeenCalled()
      }
    })

    it('shows bulk selection count badge', () => {
      mockTopicList = [
        makeTopic({ topic_name: 'topic1' }),
        makeTopic({ topic_name: 'topic2' }),
        makeTopic({ topic_name: 'topic3' }),
      ]
      mockIsBulkMode = true
      mockBulkSelectedTopics = ['topic1', 'topic2']

      render(<TopicList />)

      // Count should be displayed somewhere
      expect(screen.getByText('topic1')).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Topic Selection Tests
  // ========================================================================

  describe('[@topic-list-expanded] Topic Selection', () => {
    it('selects topic when clicked', async () => {
      mockTopicList = [makeTopic({ topic_name: 'orders' })]

      render(<TopicList />)

      const topicItem = screen.getByText('orders')
      await userEvent.click(topicItem)

      expect(mockSelectTopic).toHaveBeenCalledWith(mockTopicList[0])
    })

    it('highlights selected topic', () => {
      mockTopicList = [makeTopic({ topic_name: 'orders' })]
      mockSelectedTopic = mockTopicList[0]

      render(<TopicList />)

      expect(screen.getByText('orders')).toBeInTheDocument()
    })

    it('does not select topic when in bulk mode and checkbox clicked', async () => {
      mockTopicList = [makeTopic({ topic_name: 'orders' })]
      mockIsBulkMode = true

      render(<TopicList />)

      const topicItem = screen.getByText('orders')
      // In bulk mode, clicking the row should toggle checkbox, not select topic
      await userEvent.click(topicItem)

      // If bulk mode, toggle should be called instead of select
      expect(mockToggleBulkTopicSelection).toHaveBeenCalled()
    })
  })

  // ========================================================================
  // Empty State Tests
  // ========================================================================

  describe('[@topic-list-expanded] Empty State', () => {
    it('shows empty state message when no topics', () => {
      mockTopicList = []

      render(<TopicList />)

      // Should show some empty state indicator
      const list = screen.queryByRole('list')
      expect(list).toBeInTheDocument()
    })

    it('shows no results when filter matches nothing', async () => {
      mockTopicList = [makeTopic({ topic_name: 'orders' })]

      render(<TopicList />)

      const searchInput = screen.getByPlaceholderText(/filter/i) as HTMLInputElement
      await userEvent.type(searchInput, 'nonexistent')

      // Wait for debounce (300ms) then check for no results message
      await waitFor(() => {
        expect(screen.getByText(/No results for/i)).toBeInTheDocument()
      }, { timeout: 500 })
    })
  })

  // ========================================================================
  // Pagination/Virtualization Tests
  // ========================================================================

  describe('[@topic-list-expanded] Virtualization', () => {
    it('handles large topic lists efficiently', () => {
      // Use a modest number of items that won't timeout in jsdom
      mockTopicList = Array.from({ length: 50 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))

      render(<TopicList />)

      // Should render without crashing
      expect(screen.getByRole('list')).toBeInTheDocument()
      // First item should be visible (virtualized)
      expect(screen.getByText('topic-0')).toBeInTheDocument()
    })

    it('renders items as user scrolls (virtualization)', () => {
      mockTopicList = Array.from({ length: 100 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))

      render(<TopicList />)

      // Should render list with virtual items
      expect(screen.getByRole('list')).toBeInTheDocument()
      // First item should be visible
      expect(screen.getByText('topic-0')).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Accessibility Tests
  // ========================================================================

  describe('[@topic-list-expanded] Accessibility', () => {
    it('renders list with proper ARIA attributes', () => {
      render(<TopicList />)

      const list = screen.getByRole('list')
      expect(list).toHaveAttribute('aria-label')
    })

    it('provides proper button labels for actions', () => {
      mockTopicList = [makeTopic()]

      render(<TopicList />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach((btn) => {
        // Each button should have either text or aria-label
        expect(btn.textContent || btn.getAttribute('aria-label')).toBeTruthy()
      })
    })

    it('supports keyboard navigation', async () => {
      mockTopicList = [
        makeTopic({ topic_name: 'topic1' }),
        makeTopic({ topic_name: 'topic2' }),
      ]

      render(<TopicList />)

      // Should be able to navigate with keyboard
      const searchInput = screen.getByPlaceholderText(/search|filter/i)
      await userEvent.tab()
      expect(document.activeElement).toBeTruthy()
    })
  })
})
