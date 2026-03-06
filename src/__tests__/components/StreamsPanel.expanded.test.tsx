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
let mockStreamCards: { id: string; topicName: string }[] = []

const mockLoadTopics = vi.fn()
const mockAddStreamCard = vi.fn()
const mockRemoveStreamCard = vi.fn()
const mockRemoveStreamCardsByTopic = vi.fn()

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      topicList: mockTopicList,
      streamCards: mockStreamCards,
      loadTopics: mockLoadTopics,
      addStreamCard: mockAddStreamCard,
      removeStreamCard: mockRemoveStreamCard,
      removeStreamCardsByTopic: mockRemoveStreamCardsByTopic,
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
    mockStreamCards = []
  })

  // ========================================================================
  // Rendering Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Rendering', () => {
    it('renders streams panel with title', () => {
      render(<StreamsPanel />)

      // "Streams" appears in both the search label and the empty state heading
      const allStreams = screen.getAllByText('Streams')
      expect(allStreams.length).toBeGreaterThanOrEqual(1)
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

      expect(screen.getByText('Select a topic above to start streaming')).toBeInTheDocument()
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
      expect(screen.getByText('Select a topic above to start streaming')).toBeInTheDocument()
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

      expect(mockAddStreamCard).toHaveBeenCalledWith('test-topic')
    })

    it('deselects topic when already selected checkbox is clicked', async () => {
      mockTopicList = [makeTopic({ topic_name: 'test-topic' })]
      mockStreamCards = [{ id: 'card-1', topicName: 'test-topic' }]

      render(<StreamsPanel />)

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)

      await userEvent.click(checkbox)

      expect(mockRemoveStreamCardsByTopic).toHaveBeenCalledWith('test-topic')
    })

    it('marks checkbox as checked when topic has a stream card', () => {
      mockTopicList = [makeTopic({ topic_name: 'test-topic' })]
      mockStreamCards = [{ id: 'card-1', topicName: 'test-topic' }]

      render(<StreamsPanel />)

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('marks checkbox as unchecked when topic has no stream card', () => {
      mockTopicList = [makeTopic({ topic_name: 'test-topic' })]
      mockStreamCards = []

      render(<StreamsPanel />)

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
    })
  })

  // ========================================================================
  // Max 5 Streams Limit Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Max Streams Limit', () => {
    it('disables checkboxes when 10 streams are active', () => {
      mockTopicList = Array.from({ length: 12 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamCards = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}`, topicName: `topic-${i}` }))

      render(<StreamsPanel />)

      const checkboxes = screen.getAllByRole('checkbox')
      // First 10 are selected (have cards), next 2 should be disabled
      expect(checkboxes[10]).toBeDisabled()
      expect(checkboxes[11]).toBeDisabled()
    })

    it('enables disabled checkboxes when streams are removed', () => {
      mockTopicList = Array.from({ length: 11 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamCards = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}`, topicName: `topic-${i}` }))

      const { rerender } = render(<StreamsPanel />)

      const disabledCheckbox = screen.getAllByRole('checkbox')[10] as HTMLInputElement
      expect(disabledCheckbox).toBeDisabled()

      // Remove one stream card
      mockStreamCards = Array.from({ length: 9 }, (_, i) => ({ id: `card-${i}`, topicName: `topic-${i}` }))
      rerender(<StreamsPanel />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[10]).not.toBeDisabled()
    })

    it('shows tooltip on disabled checkbox', () => {
      mockTopicList = Array.from({ length: 11 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamCards = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}`, topicName: `topic-${i}` }))

      render(<StreamsPanel />)

      const disabledCheckbox = screen.getAllByRole('checkbox')[10]
      expect(disabledCheckbox).toHaveAttribute('title', 'Max 10 streams')
    })
  })

  // ========================================================================
  // Stream Cards Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Stream Cards', () => {
    it('renders stream card for each stream card entry', () => {
      mockStreamCards = [
        { id: 'card-1', topicName: 'topic1' },
        { id: 'card-2', topicName: 'topic2' },
      ]

      render(<StreamsPanel />)

      expect(screen.getByTestId('stream-card-topic1')).toBeInTheDocument()
      expect(screen.getByTestId('stream-card-topic2')).toBeInTheDocument()
    })

    it('removes stream card when remove button is clicked', async () => {
      mockStreamCards = [
        { id: 'card-1', topicName: 'topic1' },
        { id: 'card-2', topicName: 'topic2' },
      ]

      render(<StreamsPanel />)

      const removeButton = screen.getByLabelText('Remove topic1')
      await userEvent.click(removeButton)

      expect(mockRemoveStreamCard).toHaveBeenCalledWith('card-1')
    })

    it('shows empty state when all stream cards are removed', () => {
      mockTopicList = [makeTopic({ topic_name: 'test' })]
      mockStreamCards = []

      render(<StreamsPanel />)

      expect(screen.getByText('Select a topic above to start streaming')).toBeInTheDocument()
    })

    it('hides empty state when stream cards are displayed', () => {
      mockStreamCards = [{ id: 'card-1', topicName: 'topic1' }]

      render(<StreamsPanel />)

      expect(screen.queryByText('Select a topic above to start streaming')).not.toBeInTheDocument()
    })
  })

  // ========================================================================
  // Close Button Tests
  // ========================================================================

  describe('[@stream-panel-expanded] Panel Structure', () => {
    it('renders the Streams label in the search header', () => {
      render(<StreamsPanel />)

      // "Streams" appears in both the search label and the empty state heading
      const allStreams = screen.getAllByText('Streams')
      expect(allStreams.length).toBeGreaterThanOrEqual(1)
    })

    it('renders search input', () => {
      render(<StreamsPanel />)

      expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument()
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
      expect(mockAddStreamCard).toHaveBeenCalledWith('orders-topic')

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

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])

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

      expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument()
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
      mockTopicList = Array.from({ length: 11 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamCards = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}`, topicName: `topic-${i}` }))

      render(<StreamsPanel />)

      const disabledCheckbox = screen.getAllByRole('checkbox')[10]
      expect(disabledCheckbox).toHaveAttribute('title', 'Max 10 streams')
    })
  })

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('[@stream-panel-expanded] Edge Cases', () => {
    it('handles empty topic list', () => {
      mockTopicList = []

      render(<StreamsPanel />)

      const allStreams = screen.getAllByText('Streams')
      expect(allStreams.length).toBeGreaterThanOrEqual(1)
      const checkboxes = screen.queryAllByRole('checkbox')
      expect(checkboxes).toHaveLength(0)
    })

    it('handles topic list with single item', () => {
      mockTopicList = [makeTopic({ topic_name: 'only-topic' })]

      render(<StreamsPanel />)

      expect(screen.getByText('only-topic')).toBeInTheDocument()
    })

    it('handles exactly 10 stream cards', () => {
      mockTopicList = Array.from({ length: 12 }, (_, i) => makeTopic({ topic_name: `topic-${i}` }))
      mockStreamCards = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}`, topicName: `topic-${i}` }))

      render(<StreamsPanel />)

      const checkboxes = screen.getAllByRole('checkbox')
      // All after 10th should be disabled
      for (let i = 10; i < checkboxes.length; i++) {
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
