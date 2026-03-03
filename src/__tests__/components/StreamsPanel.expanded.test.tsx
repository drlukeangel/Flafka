/**
 * @stream-panel-expanded
 * StreamsPanel expanded coverage — topic selection, search, max limits, stream cards
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StreamsPanel } from '../../components/StreamsPanel/StreamsPanel'
import type { KafkaTopic } from '../../types'

// Mock StreamCard component
vi.mock('../../components/StreamsPanel/StreamCard', () => ({
  StreamCard: ({ topicName, onRemove }: { topicName: string; onRemove: () => void }) => (
    <div data-testid={`stream-card-${topicName}`} role="region">
      <span>{topicName}</span>
      <button onClick={onRemove} aria-label={`Remove ${topicName}`}>
        Remove
      </button>
    </div>
  ),
}))

// Mock store
let mockTopicList: KafkaTopic[] = []
let mockStreamsSelectedTopics: string[] = []

const mockLoadTopics = vi.fn()
const mockAddStreamsTopic = vi.fn()
const mockRemoveStreamsTopic = vi.fn()
const mockToggleStreamsPanel = vi.fn()

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      topicList: mockTopicList,
      streamsSelectedTopics: mockStreamsSelectedTopics,
      loadTopics: mockLoadTopics,
      addStreamsTopic: mockAddStreamsTopic,
      removeStreamsTopic: mockRemoveStreamsTopic,
      toggleStreamsPanel: mockToggleStreamsPanel,
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

describe('[@stream-panel-expanded] StreamsPanel Expanded Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockStreamsSelectedTopics = []
  })

  // ========================================================================
  // Rendering Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Rendering', () => {
    it('renders streams panel with title and close button', () => {
      render(<StreamsPanel />)

      expect(screen.getByText('Streams')).toBeInTheDocument()
      expect(screen.getByLabelText('Close streams panel')).toBeInTheDocument()
    })

    it('renders search input with placeholder', () => {
      render(<StreamsPanel />)

      const searchInput = screen.getByPlaceholderText('Search topics...')
      expect(searchInput).toBeInTheDocument()
    })

    it('renders topic list from store', () => {
      mockTopicList = [
        makeTopic({ topic_name: 'orders' }),
        makeTopic({ topic_name: 'payments' }),
        makeTopic({ topic_name: 'users' }),
      ]

      render(<StreamsPanel />)

      expect(screen.getByText('orders')).toBeInTheDocument()
      expect(screen.getByText('payments')).toBeInTheDocument()
      expect(screen.getByText('users')).toBeInTheDocument()
    })

    it('renders checkboxes for each topic', () => {
      mockTopicList = [
        makeTopic({ topic_name: 'topic1' }),
        makeTopic({ topic_name: 'topic2' }),
      ]

      render(<StreamsPanel />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThanOrEqual(2)
    })

    it('renders empty state when no topics selected', () => {
      mockTopicList = [makeTopic({ topic_name: 'test' })]

      render(<StreamsPanel />)

      expect(screen.getByText('Select topics above to start monitoring')).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Search Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Search Functionality', () => {
    it('filters topics by name as user types', async () => {
      mockTopicList = [
        makeTopic({ topic_name: 'orders-topic' }),
        makeTopic({ topic_name: 'payments-topic' }),
        makeTopic({ topic_name: 'users-topic' }),
      ]

      render(<StreamsPanel />)

      const searchInput = screen.getByPlaceholderText('Search topics...') as HTMLInputElement
      await userEvent.type(searchInput, 'orders')

      expect(screen.getByText('orders-topic')).toBeInTheDocument()
      expect(screen.queryByText('payments-topic')).not.toBeInTheDocument()
    })

    it('performs case-insensitive search', async () => {
      mockTopicList = [makeTopic({ topic_name: 'OrdersTopic' })]

      render(<StreamsPanel />)

      const searchInput = screen.getByPlaceholderText('Search topics...') as HTMLInputElement
      await userEvent.type(searchInput, 'orders')

      expect(screen.getByText('OrdersTopic')).toBeInTheDocument()
    })

    it('shows all topics when search is cleared', async () => {
      mockTopicList = [
        makeTopic({ topic_name: 'orders' }),
        makeTopic({ topic_name: 'payments' }),
      ]

      render(<StreamsPanel />)

      const searchInput = screen.getByPlaceholderText('Search topics...') as HTMLInputElement
      await userEvent.type(searchInput, 'orders')
      expect(screen.queryByText('payments')).not.toBeInTheDocument()

      await userEvent.clear(searchInput)
      expect(screen.getByText('orders')).toBeInTheDocument()
      expect(screen.getByText('payments')).toBeInTheDocument()
    })

    it('returns empty results when no match found', async () => {
      mockTopicList = [makeTopic({ topic_name: 'orders' })]

      render(<StreamsPanel />)

      const searchInput = screen.getByPlaceholderText('Search topics...') as HTMLInputElement
      await userEvent.type(searchInput, 'nonexistent')

      // Empty state should show
      expect(screen.getByText('Select topics above to start monitoring')).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Topic Selection Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Topic Selection', () => {
    it('selects topic when checkbox is clicked', async () => {
      mockTopicList = [makeTopic({ topic_name: 'test-topic' })]

      render(<StreamsPanel />)

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      await userEvent.click(checkbox)

      expect(mockAddStreamsTopic).toHaveBeenCalledWith('test-topic')
    })

    it('deselects topic when already selected checkbox is clicked', async () => {
      mockTopicList = [makeTopic({ topic_name: 'test-topic' })]
      mockStreamsSelectedTopics = ['test-topic']

      render(<StreamsPanel />)

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)

      await userEvent.click(checkbox)

      expect(mockRemoveStreamsTopic).toHaveBeenCalledWith('test-topic')
    })

    it('marks checkbox as checked when topic is selected', () => {
      mockTopicList = [makeTopic({ topic_name: 'test-topic' })]
      mockStreamsSelectedTopics = ['test-topic']

      render(<StreamsPanel />)

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('marks checkbox as unchecked when topic is not selected', () => {
      mockTopicList = [makeTopic({ topic_name: 'test-topic' })]
      mockStreamsSelectedTopics = []

      render(<StreamsPanel />)

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
    })
  })

  // ========================================================================
  // Max 5 Streams Limit Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Max Streams Limit', () => {
    it('disables checkboxes when 5 streams are selected', () => {
      mockTopicList = Array.from({ length: 7 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamsSelectedTopics = ['topic-0', 'topic-1', 'topic-2', 'topic-3', 'topic-4']

      render(<StreamsPanel />)

      const checkboxes = screen.getAllByRole('checkbox')
      // First 5 are selected, next 2 should be disabled
      expect(checkboxes[5]).toBeDisabled()
      expect(checkboxes[6]).toBeDisabled()
    })

    it('enables disabled checkboxes when streams are removed', () => {
      mockTopicList = Array.from({ length: 6 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamsSelectedTopics = ['topic-0', 'topic-1', 'topic-2', 'topic-3', 'topic-4']

      const { rerender } = render(<StreamsPanel />)

      const disabledCheckbox = screen.getAllByRole('checkbox')[5] as HTMLInputElement
      expect(disabledCheckbox).toBeDisabled()

      // Remove one stream
      mockStreamsSelectedTopics = ['topic-0', 'topic-1', 'topic-2', 'topic-3']
      rerender(<StreamsPanel />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[5]).not.toBeDisabled()
    })

    it('shows tooltip on disabled checkbox', () => {
      mockTopicList = Array.from({ length: 6 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamsSelectedTopics = Array.from({ length: 5 }, (_, i) => `topic-${i}`)

      render(<StreamsPanel />)

      const disabledCheckbox = screen.getAllByRole('checkbox')[5]
      expect(disabledCheckbox).toHaveAttribute('title', 'Max 5 streams')
    })
  })

  // ========================================================================
  // Stream Cards Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Stream Cards', () => {
    it('renders stream card for each selected topic', () => {
      mockStreamsSelectedTopics = ['topic1', 'topic2']

      render(<StreamsPanel />)

      expect(screen.getByTestId('stream-card-topic1')).toBeInTheDocument()
      expect(screen.getByTestId('stream-card-topic2')).toBeInTheDocument()
    })

    it('removes stream card when remove button is clicked', async () => {
      mockStreamsSelectedTopics = ['topic1', 'topic2']

      render(<StreamsPanel />)

      const removeButton = screen.getByLabelText('Remove topic1')
      await userEvent.click(removeButton)

      expect(mockRemoveStreamsTopic).toHaveBeenCalledWith('topic1')
    })

    it('shows empty state when all stream cards are removed', () => {
      mockTopicList = [makeTopic({ topic_name: 'test' })]
      mockStreamsSelectedTopics = []

      render(<StreamsPanel />)

      expect(screen.getByText('Select topics above to start monitoring')).toBeInTheDocument()
    })

    it('hides empty state when stream cards are displayed', () => {
      mockStreamsSelectedTopics = ['topic1']

      render(<StreamsPanel />)

      expect(screen.queryByText('Select topics above to start monitoring')).not.toBeInTheDocument()
    })
  })

  // ========================================================================
  // Close Button Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Close Button', () => {
    it('calls toggleStreamsPanel when close button is clicked', async () => {
      render(<StreamsPanel />)

      const closeButton = screen.getByLabelText('Close streams panel')
      await userEvent.click(closeButton)

      expect(mockToggleStreamsPanel).toHaveBeenCalled()
    })

    it('close button is always visible', () => {
      render(<StreamsPanel />)

      const closeButton = screen.getByLabelText('Close streams panel')
      expect(closeButton).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Integration Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Integration', () => {
    it('handles complete workflow: search, select, deselect', async () => {
      mockTopicList = [
        makeTopic({ topic_name: 'orders-topic' }),
        makeTopic({ topic_name: 'payments-topic' }),
      ]

      render(<StreamsPanel />)

      const searchInput = screen.getByPlaceholderText('Search topics...') as HTMLInputElement

      // Search for orders
      await userEvent.type(searchInput, 'orders')
      expect(screen.getByText('orders-topic')).toBeInTheDocument()

      // Select it
      const checkbox = screen.getByRole('checkbox')
      await userEvent.click(checkbox)
      expect(mockAddStreamsTopic).toHaveBeenCalledWith('orders-topic')

      // Clear search
      await userEvent.clear(searchInput)
      expect(screen.getByText('payments-topic')).toBeInTheDocument()
    })

    it('maintains search term while selecting topics', async () => {
      mockTopicList = [
        makeTopic({ topic_name: 'orders-a' }),
        makeTopic({ topic_name: 'orders-b' }),
        makeTopic({ topic_name: 'payments' }),
      ]

      render(<StreamsPanel />)

      const searchInput = screen.getByPlaceholderText('Search topics...') as HTMLInputElement
      await userEvent.type(searchInput, 'orders')

      const checkbox = screen.getByRole('checkbox')
      await userEvent.click(checkbox)

      // Search term should be preserved
      expect(searchInput.value).toBe('orders')
      expect(screen.getByText('orders-a')).toBeInTheDocument()
      expect(screen.queryByText('payments')).not.toBeInTheDocument()
    })
  })

  // ========================================================================
  // Accessibility Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Accessibility', () => {
    it('renders with proper ARIA labels', () => {
      mockTopicList = [makeTopic({ topic_name: 'test' })]

      render(<StreamsPanel />)

      const closeButton = screen.getByLabelText('Close streams panel')
      expect(closeButton).toBeInTheDocument()
    })

    it('topic items are properly labeled', () => {
      mockTopicList = [makeTopic({ topic_name: 'test-topic' })]

      render(<StreamsPanel />)

      expect(screen.getByText('test-topic')).toBeInTheDocument()
    })

    it('search input is keyboard accessible', async () => {
      render(<StreamsPanel />)

      const searchInput = screen.getByPlaceholderText('Search topics...') as HTMLInputElement
      searchInput.focus()

      expect(document.activeElement).toBe(searchInput)
    })

    it('disabled checkboxes have proper title attributes', () => {
      mockTopicList = Array.from({ length: 6 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamsSelectedTopics = Array.from({ length: 5 }, (_, i) => `topic-${i}`)

      render(<StreamsPanel />)

      const disabledCheckbox = screen.getAllByRole('checkbox')[5]
      expect(disabledCheckbox).toHaveAttribute('title', 'Max 5 streams')
    })
  })

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('[@stream-panel-expanded] Edge Cases', () => {
    it('handles empty topic list', () => {
      mockTopicList = []

      render(<StreamsPanel />)

      expect(screen.getByText('Streams')).toBeInTheDocument()
      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes).toHaveLength(0)
    })

    it('handles topic list with single item', () => {
      mockTopicList = [makeTopic({ topic_name: 'only-topic' })]

      render(<StreamsPanel />)

      expect(screen.getByText('only-topic')).toBeInTheDocument()
    })

    it('handles exactly 5 selected topics', () => {
      mockTopicList = Array.from({ length: 10 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamsSelectedTopics = Array.from({ length: 5 }, (_, i) => `topic-${i}`)

      render(<StreamsPanel />)

      const checkboxes = screen.getAllByRole('checkbox')
      // All after 5th should be disabled
      for (let i = 5; i < checkboxes.length; i++) {
        expect(checkboxes[i]).toBeDisabled()
      }
    })

    it('handles topic names with special characters', () => {
      mockTopicList = [makeTopic({ topic_name: 'topic-with-dashes_and_underscores' })]

      render(<StreamsPanel />)

      expect(screen.getByText('topic-with-dashes_and_underscores')).toBeInTheDocument()
    })
  })
})
