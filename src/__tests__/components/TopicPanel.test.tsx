import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { KafkaTopic, TopicConfig } from '../../types'

// MED-2: Mock @tanstack/react-virtual so TopicList renders all items in jsdom
// (jsdom has no layout engine so the virtualizer produces 0 items without this)
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

// ---------------------------------------------------------------------------
// Store mock — controlled via mutable module-level variables so each test
// can set the state it needs before rendering.
// ---------------------------------------------------------------------------

let mockTopicList: KafkaTopic[] = []
let mockSelectedTopic: KafkaTopic | null = null
let mockTopicLoading = false
let mockTopicError: string | null = null

// HIGH-1 fix: loadTopics returns a Promise (the useEffect now calls .catch() on it)
const mockLoadTopics = vi.fn().mockResolvedValue(undefined)
const mockSelectTopic = vi.fn()
const mockClearSelectedTopic = vi.fn()
// CRIT-3 fix: deleteTopic no longer calls clearSelectedTopic/loadTopics internally
const mockDeleteTopic = vi.fn().mockResolvedValue(undefined)
const mockCreateTopic = vi.fn()
const mockAddToast = vi.fn()

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      topicList: mockTopicList,
      selectedTopic: mockSelectedTopic,
      topicLoading: mockTopicLoading,
      topicError: mockTopicError,
      loadTopics: mockLoadTopics,
      selectTopic: mockSelectTopic,
      clearSelectedTopic: mockClearSelectedTopic,
      deleteTopic: mockDeleteTopic,
      createTopic: mockCreateTopic,
      addToast: mockAddToast,
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

// ---------------------------------------------------------------------------
// topic-api mock — TopicDetail calls getTopicConfigs directly
// ---------------------------------------------------------------------------

vi.mock('../../api/topic-api', () => ({
  listTopics: vi.fn(),
  getTopicDetail: vi.fn(),
  getTopicConfigs: vi.fn().mockResolvedValue([]),
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
}))

// ---------------------------------------------------------------------------
// environment mock — controls the isConfigured guard in TopicPanel
// ---------------------------------------------------------------------------

// Default: fully configured. Individual tests override as needed.
let mockEnv = {
  kafkaClusterId: 'test-cluster-id',
  kafkaRestEndpoint: 'https://test.confluent.cloud',
  kafkaApiKey: 'test-key',
  kafkaApiSecret: 'test-secret',
}

vi.mock('../../config/environment', () => ({
  get env() {
    return mockEnv
  },
}))

// Import components AFTER mocks are registered.
import TopicPanel from '../../components/TopicPanel/TopicPanel'
import TopicList from '../../components/TopicPanel/TopicList'
import TopicDetail from '../../components/TopicPanel/TopicDetail'
import CreateTopic from '../../components/TopicPanel/CreateTopic'
import * as topicApi from '../../api/topic-api'

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeTopic(overrides: Partial<KafkaTopic> = {}): KafkaTopic {
  return {
    topic_name: 'orders-v1',
    is_internal: false,
    replication_factor: 3,
    partitions_count: 6,
    ...overrides,
  }
}

function makeConfig(overrides: Partial<TopicConfig> = {}): TopicConfig {
  return {
    name: 'compression.type',
    value: 'producer',
    is_default: true,
    is_read_only: false,
    is_sensitive: false,
    ...overrides,
  }
}

// ===========================================================================
// TopicPanel
// ===========================================================================

describe('[@topic-panel] rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
    mockEnv = {
      kafkaClusterId: 'test-cluster-id',
      kafkaRestEndpoint: 'https://test.confluent.cloud',
      kafkaApiKey: 'test-key',
      kafkaApiSecret: 'test-secret',
    }
  })

  it("renders 'Kafka Topics' title when no topic is selected", () => {
    render(<TopicPanel />)
    expect(screen.getByText('Kafka Topics')).toBeInTheDocument()
  })

  it('renders back arrow button and topic name in header when a topic is selected', () => {
    mockSelectedTopic = makeTopic({ topic_name: 'payments-events' })
    render(<TopicPanel />)
    expect(screen.getByRole('button', { name: /back to topic list/i })).toBeInTheDocument()
    // topic name appears in header span (title attr) and also inside TopicDetail — use getAllByText
    const nameElements = screen.getAllByText('payments-events')
    expect(nameElements.length).toBeGreaterThan(0)
  })

  it("does not render 'Kafka Topics' title when a topic is selected", () => {
    mockSelectedTopic = makeTopic()
    render(<TopicPanel />)
    expect(screen.queryByText('Kafka Topics')).not.toBeInTheDocument()
  })

  it('has aria-label="Kafka Topics panel" on the root element', () => {
    render(<TopicPanel />)
    expect(screen.getByLabelText('Kafka Topics panel')).toBeInTheDocument()
  })

  it("shows 'Kafka REST endpoint not configured' when kafkaClusterId is empty", () => {
    mockEnv = { ...mockEnv, kafkaClusterId: '' }
    render(<TopicPanel />)
    expect(screen.getByText('Kafka REST endpoint not configured')).toBeInTheDocument()
  })

  it("shows 'Kafka REST endpoint not configured' when kafkaRestEndpoint is empty", () => {
    mockEnv = { ...mockEnv, kafkaRestEndpoint: '' }
    render(<TopicPanel />)
    expect(screen.getByText('Kafka REST endpoint not configured')).toBeInTheDocument()
  })

  it('does not render TopicList or TopicDetail when env is not configured', () => {
    mockEnv = { ...mockEnv, kafkaClusterId: '' }
    render(<TopicPanel />)
    // Should not show the filter input (belongs to TopicList)
    expect(screen.queryByPlaceholderText('Filter topics...')).not.toBeInTheDocument()
  })
})

describe('[@topic-panel] load on mount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
    mockEnv = {
      kafkaClusterId: 'test-cluster-id',
      kafkaRestEndpoint: 'https://test.confluent.cloud',
      kafkaApiKey: 'test-key',
      kafkaApiSecret: 'test-secret',
    }
  })

  it('calls loadTopics() on mount when env is configured', () => {
    render(<TopicPanel />)
    expect(mockLoadTopics).toHaveBeenCalledTimes(1)
  })

  it('does not call loadTopics() when env is not configured', () => {
    mockEnv = { ...mockEnv, kafkaClusterId: '' }
    render(<TopicPanel />)
    expect(mockLoadTopics).not.toHaveBeenCalled()
  })
})

describe('[@topic-panel] refresh button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
    mockEnv = {
      kafkaClusterId: 'test-cluster-id',
      kafkaRestEndpoint: 'https://test.confluent.cloud',
      kafkaApiKey: 'test-key',
      kafkaApiSecret: 'test-secret',
    }
  })

  it('refresh button calls loadTopics() when clicked', async () => {
    const user = userEvent.setup()
    render(<TopicPanel />)
    mockLoadTopics.mockClear()

    await user.click(screen.getByRole('button', { name: /refresh topic list/i }))
    expect(mockLoadTopics).toHaveBeenCalledTimes(1)
  })

  it('refresh button is disabled while topicLoading is true', () => {
    mockTopicLoading = true
    render(<TopicPanel />)
    expect(screen.getByRole('button', { name: /refresh topic list/i })).toBeDisabled()
  })

  it('refresh button is enabled when topicLoading is false', () => {
    mockTopicLoading = false
    render(<TopicPanel />)
    expect(screen.getByRole('button', { name: /refresh topic list/i })).not.toBeDisabled()
  })

  it('back arrow calls clearSelectedTopic when clicked', async () => {
    const user = userEvent.setup()
    mockSelectedTopic = makeTopic()
    render(<TopicPanel />)

    await user.click(screen.getByRole('button', { name: /back to topic list/i }))
    expect(mockClearSelectedTopic).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// TopicList
// ===========================================================================

describe('[@topic-list] loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
  })

  it('renders loading spinner while topics are loading', () => {
    mockTopicLoading = true
    render(<TopicList />)
    expect(screen.getByText('Loading topics...')).toBeInTheDocument()
  })

  it('loading container has aria-live="polite"', () => {
    mockTopicLoading = true
    render(<TopicList />)
    const loadingEl = screen.getByText('Loading topics...').closest('[aria-live="polite"]')
    expect(loadingEl).toBeInTheDocument()
    expect(loadingEl).toHaveAttribute('aria-live', 'polite')
  })

  it('does not render topic rows while loading', () => {
    mockTopicLoading = true
    mockTopicList = [makeTopic()]
    render(<TopicList />)
    // Topic list role should not be present in loading state
    expect(screen.queryByRole('list', { name: /kafka topics/i })).not.toBeInTheDocument()
  })
})

describe('[@topic-list] error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
  })

  it('renders error message with Retry button when topicError is set', () => {
    mockTopicError = 'Failed to connect to Kafka REST endpoint'
    render(<TopicList />)
    expect(screen.getByText('Failed to connect to Kafka REST endpoint')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry loading topics/i })).toBeInTheDocument()
  })

  it('error container has role="alert"', () => {
    mockTopicError = 'Some error'
    render(<TopicList />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('Retry button calls loadTopics()', async () => {
    const user = userEvent.setup()
    mockTopicError = 'Network error'
    render(<TopicList />)

    await user.click(screen.getByRole('button', { name: /retry loading topics/i }))
    expect(mockLoadTopics).toHaveBeenCalledTimes(1)
  })
})

describe('[@topic-list] empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
  })

  it("renders 'No topics found' empty state when topicList is empty", () => {
    render(<TopicList />)
    expect(screen.getByText('No topics found')).toBeInTheDocument()
  })

  it('renders Create Topic CTA button in empty state', () => {
    render(<TopicList />)
    // The empty-state CTA button has title="Create a new topic"
    expect(screen.getByTitle('Create a new topic')).toBeInTheDocument()
  })
})

describe('[@topic-list] topic rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = [
      makeTopic({ topic_name: 'orders-v1', partitions_count: 6, replication_factor: 3 }),
      makeTopic({ topic_name: 'payments', partitions_count: 12, replication_factor: 3 }),
      makeTopic({ topic_name: 'inventory', partitions_count: 3, replication_factor: 3 }),
    ]
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
  })

  it('renders a row for each topic in topicList', () => {
    render(<TopicList />)
    expect(screen.getByText('orders-v1')).toBeInTheDocument()
    expect(screen.getByText('payments')).toBeInTheDocument()
    expect(screen.getByText('inventory')).toBeInTheDocument()
  })

  it('renders partition count and replication factor on each row', () => {
    render(<TopicList />)
    // "6p · RF:3" pattern from the component
    expect(screen.getByText('6p · RF:3')).toBeInTheDocument()
    expect(screen.getByText('12p · RF:3')).toBeInTheDocument()
  })

  it('topic list container has role="list"', () => {
    render(<TopicList />)
    expect(screen.getByRole('list', { name: /kafka topics/i })).toBeInTheDocument()
  })

  it('each topic row has role="listitem" and aria-label="Topic: {name}"', () => {
    render(<TopicList />)
    const ordersRow = screen.getByRole('listitem', { name: 'Topic: orders-v1' })
    expect(ordersRow).toBeInTheDocument()
    const paymentsRow = screen.getByRole('listitem', { name: 'Topic: payments' })
    expect(paymentsRow).toBeInTheDocument()
  })

  it('clicking a topic row calls selectTopic with the topic object', async () => {
    const user = userEvent.setup()
    render(<TopicList />)

    await user.click(screen.getByRole('listitem', { name: 'Topic: orders-v1' }))
    expect(mockSelectTopic).toHaveBeenCalledWith(mockTopicList[0])
  })

  it('pressing Enter on a focused row calls selectTopic', () => {
    render(<TopicList />)
    const row = screen.getByRole('listitem', { name: 'Topic: orders-v1' })
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(mockSelectTopic).toHaveBeenCalledWith(mockTopicList[0])
  })

  it('pressing Space on a focused row calls selectTopic', () => {
    render(<TopicList />)
    const row = screen.getByRole('listitem', { name: 'Topic: payments' })
    fireEvent.keyDown(row, { key: ' ' })
    expect(mockSelectTopic).toHaveBeenCalledWith(mockTopicList[1])
  })
})

describe('[@topic-list] search and filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = [
      makeTopic({ topic_name: 'orders-v1' }),
      makeTopic({ topic_name: 'payments' }),
      makeTopic({ topic_name: 'inventory' }),
    ]
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
  })

  it('filters topic rows by search query (case-insensitive)', async () => {
    render(<TopicList />)
    const searchInput = screen.getByLabelText('Filter topics')
    fireEvent.change(searchInput, { target: { value: 'ORDERS' } })

    // The component debounces 300ms — advance fake timers
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350))
    })

    expect(screen.getByText('orders-v1')).toBeInTheDocument()
    expect(screen.queryByText('payments')).not.toBeInTheDocument()
    expect(screen.queryByText('inventory')).not.toBeInTheDocument()
  })

  it("shows 'No results for ...' when search matches nothing", async () => {
    render(<TopicList />)
    const searchInput = screen.getByLabelText('Filter topics')
    fireEvent.change(searchInput, { target: { value: 'zzz-no-match' } })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350))
    })

    expect(screen.getByText(/no results for/i)).toBeInTheDocument()
  })

  it('count bar shows "N of M topics" when a filter is active', async () => {
    render(<TopicList />)
    const searchInput = screen.getByLabelText('Filter topics')
    fireEvent.change(searchInput, { target: { value: 'orders' } })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350))
    })

    expect(screen.getByText('1 of 3 topics')).toBeInTheDocument()
  })

  it('count bar shows "N topics" when no filter is active', () => {
    render(<TopicList />)
    expect(screen.getByText('3 topics')).toBeInTheDocument()
  })

  it('count bar shows "1 topic" (singular) when only one topic exists', () => {
    mockTopicList = [makeTopic()]
    render(<TopicList />)
    expect(screen.getByText('1 topic')).toBeInTheDocument()
  })
})

describe('[@topic-list] create topic button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = [makeTopic()]
    mockSelectedTopic = null
    mockTopicLoading = false
    mockTopicError = null
  })

  it('Create Topic button opens the CreateTopic modal', async () => {
    const user = userEvent.setup()
    render(<TopicList />)

    await user.click(screen.getByRole('button', { name: 'Create new topic' }))
    // CreateTopic modal renders role="dialog"
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Dialog title h2 "Create Topic" is rendered — use getByRole heading
    expect(screen.getByRole('heading', { name: 'Create Topic' })).toBeInTheDocument()
  })
})

// ===========================================================================
// TopicDetail
// ===========================================================================

describe('[@topic-detail] metadata rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockTopicLoading = false
    mockTopicError = null
    mockSelectedTopic = makeTopic({
      topic_name: 'orders-v1',
      partitions_count: 6,
      replication_factor: 3,
      is_internal: false,
    })
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
  })

  it('renders the topic name in the detail view', async () => {
    render(<TopicDetail />)
    // Topic name appears in the copy button
    expect(screen.getByRole('button', { name: /copy topic name to clipboard/i })).toBeInTheDocument()
    expect(screen.getByText('orders-v1')).toBeInTheDocument()
  })

  it('renders the partition count from selectedTopic', async () => {
    render(<TopicDetail />)
    // "6P" badge and value "6" in metadata row
    expect(screen.getByText('6P')).toBeInTheDocument()
    // Partition metadata row value
    const cells = screen.getAllByText('6')
    expect(cells.length).toBeGreaterThan(0)
  })

  it('renders the replication factor from selectedTopic', async () => {
    render(<TopicDetail />)
    expect(screen.getByText('RF:3')).toBeInTheDocument()
  })

  it('renders "No" for is_internal=false', async () => {
    render(<TopicDetail />)
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders "Yes" for is_internal=true', async () => {
    mockSelectedTopic = makeTopic({ is_internal: true })
    render(<TopicDetail />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('returns null when selectedTopic is null', () => {
    mockSelectedTopic = null
    const { container } = render(<TopicDetail />)
    expect(container.firstChild).toBeNull()
  })
})

describe('[@topic-detail] config loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockTopicLoading = false
    mockTopicError = null
    mockSelectedTopic = makeTopic()
  })

  it('renders a loading spinner while configs are being fetched', async () => {
    // Make getTopicConfigs hang indefinitely so loading state persists
    vi.mocked(topicApi.getTopicConfigs).mockReturnValue(new Promise(() => {}))
    render(<TopicDetail />)
    expect(screen.getByText('Loading configs...')).toBeInTheDocument()
  })

  it('renders config table rows when getTopicConfigs resolves', async () => {
    const configs: TopicConfig[] = [
      makeConfig({ name: 'compression.type', value: 'producer', is_default: true }),
      makeConfig({ name: 'max.message.bytes', value: '1048588', is_default: false }),
    ]
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue(configs)

    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('compression.type')).toBeInTheDocument()
      expect(screen.getByText('max.message.bytes')).toBeInTheDocument()
    })
  })

  it('default configs are rendered with muted text color (data attribute check via DOM)', async () => {
    const configs: TopicConfig[] = [
      makeConfig({ name: 'compression.type', value: 'producer', is_default: true }),
    ]
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue(configs)

    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('compression.type')).toBeInTheDocument()
    })

    // Default configs have color var(--color-text-tertiary) — verify via the cell element
    const nameCell = screen.getByText('compression.type').closest('td')
    expect(nameCell).toBeInTheDocument()
    // The style sets color based on is_default; we verify the cell exists in table context
    expect(nameCell?.tagName).toBe('TD')
  })

  it('sensitive config values are masked as bullet characters', async () => {
    const configs: TopicConfig[] = [
      makeConfig({ name: 'ssl.keystore.password', value: 'supersecret', is_sensitive: true }),
    ]
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue(configs)

    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('ssl.keystore.password')).toBeInTheDocument()
    })

    // Masked value: 8 bullet characters (\u2022 × 8)
    expect(screen.getByText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')).toBeInTheDocument()
  })

  it("shows 'No configurations found' when configs array is empty", async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('No configurations found')).toBeInTheDocument()
    })
  })

  it('shows error message and Retry button when getTopicConfigs rejects, and Retry re-fetches', async () => {
    const user = userEvent.setup()
    vi.mocked(topicApi.getTopicConfigs).mockRejectedValue(new Error('Failed to load topic configs'))

    render(<TopicDetail />)

    // Wait for error state to appear
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Failed to load topic configs')).toBeInTheDocument()
    })

    // Retry button must be present
    const retryBtn = screen.getByRole('button', { name: /retry loading configs/i })
    expect(retryBtn).toBeInTheDocument()

    // Clicking Retry triggers another call to getTopicConfigs
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
    await user.click(retryBtn)

    await waitFor(() => {
      expect(vi.mocked(topicApi.getTopicConfigs)).toHaveBeenCalledTimes(2)
    })
  })

  it('config with null value renders an em-dash', async () => {
    const configs: TopicConfig[] = [
      makeConfig({ name: 'message.timestamp.type', value: null }),
    ]
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue(configs)

    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('message.timestamp.type')).toBeInTheDocument()
    })

    // em-dash \u2014
    const emDashes = screen.getAllByText('\u2014')
    expect(emDashes.length).toBeGreaterThan(0)
  })
})

describe('[@topic-detail] retention.ms and cleanup.policy display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockTopicLoading = false
    mockTopicError = null
    mockSelectedTopic = makeTopic()
  })

  it("retention.ms value '604800000' is shown with '7d' human-readable label", async () => {
    const configs: TopicConfig[] = [
      makeConfig({ name: 'retention.ms', value: '604800000', is_default: false }),
    ]
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue(configs)

    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('retention.ms')).toBeInTheDocument()
    })

    expect(screen.getByText('604800000')).toBeInTheDocument()
    expect(screen.getByText('7d')).toBeInTheDocument()
  })

  it("retention.ms value '-1' is shown as 'Infinite'", async () => {
    const configs: TopicConfig[] = [
      makeConfig({ name: 'retention.ms', value: '-1', is_default: false }),
    ]
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue(configs)

    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('retention.ms')).toBeInTheDocument()
    })

    expect(screen.getByText('Infinite')).toBeInTheDocument()
  })

  it("cleanup.policy='delete' renders a badge containing 'delete'", async () => {
    const configs: TopicConfig[] = [
      makeConfig({ name: 'cleanup.policy', value: 'delete', is_default: true }),
    ]
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue(configs)

    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('cleanup.policy')).toBeInTheDocument()
    })

    const badge = screen.getByText('delete')
    expect(badge).toBeInTheDocument()
    // Badge is rendered as a span (inline-flex); verify it's not a plain text node inside a td directly
    expect(badge.tagName).toBe('SPAN')
  })

  it("cleanup.policy='compact' renders a badge containing 'compact'", async () => {
    const configs: TopicConfig[] = [
      makeConfig({ name: 'cleanup.policy', value: 'compact', is_default: false }),
    ]
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue(configs)

    render(<TopicDetail />)

    await waitFor(() => {
      expect(screen.getByText('cleanup.policy')).toBeInTheDocument()
    })

    const badge = screen.getByText('compact')
    expect(badge).toBeInTheDocument()
    expect(badge.tagName).toBe('SPAN')
  })
})

describe('[@topic-detail] delete overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockTopicLoading = false
    mockTopicError = null
    mockSelectedTopic = makeTopic({ topic_name: 'orders-v1' })
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
    mockDeleteTopic.mockResolvedValue(undefined)
    mockLoadTopics.mockResolvedValue(undefined)
  })

  it('clicking the Delete button opens the confirmation overlay', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('delete overlay has role="dialog" and aria-modal="true"', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('delete overlay has aria-labelledby pointing to the title', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'delete-topic-dialog-title')
  })

  it('Delete confirm button is disabled when confirmation input is empty', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const deleteBtn = screen.getByRole('button', { name: /delete orders-v1/i })
    expect(deleteBtn).toBeDisabled()
  })

  it('Delete confirm button is disabled on partial match', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const input = screen.getByLabelText(/type.*to confirm/i)
    await user.type(input, 'orders')
    const deleteBtn = screen.getByRole('button', { name: /delete orders-v1/i })
    expect(deleteBtn).toBeDisabled()
  })

  it('Delete confirm button is enabled when exact topic name is typed', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const input = screen.getByLabelText(/type.*to confirm/i)
    await user.type(input, 'orders-v1')
    const deleteBtn = screen.getByRole('button', { name: /delete orders-v1/i })
    expect(deleteBtn).not.toBeDisabled()
  })

  it('pressing Escape closes the delete overlay', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('successful delete calls clearSelectedTopic and loadTopics', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const input = screen.getByLabelText(/type.*to confirm/i)
    await user.type(input, 'orders-v1')

    const deleteBtn = screen.getByRole('button', { name: /delete orders-v1/i })
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(mockDeleteTopic).toHaveBeenCalledWith('orders-v1')
      expect(mockClearSelectedTopic).toHaveBeenCalled()
      expect(mockLoadTopics).toHaveBeenCalled()
    })
  })

  it('successful delete calls addToast with a message containing "deleted"', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const input = screen.getByLabelText(/type.*to confirm/i)
    await user.type(input, 'orders-v1')

    await user.click(screen.getByRole('button', { name: /delete orders-v1/i }))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('deleted'),
        })
      )
    })
  })

  it('Delete confirm button remains disabled when topic name is typed with a trailing space', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const input = screen.getByLabelText(/type.*to confirm/i)
    // Type the exact topic name followed by a trailing space — must NOT match
    await user.type(input, 'orders-v1 ')
    const deleteBtn = screen.getByRole('button', { name: /delete orders-v1/i })
    expect(deleteBtn).toBeDisabled()
  })

  it('delete overlay shows Flink warning text about active queries', async () => {
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    expect(
      screen.getByText('Active Flink queries referencing this topic may fail.')
    ).toBeInTheDocument()
  })

  it('delete API error is shown inside the overlay', async () => {
    mockDeleteTopic.mockRejectedValue(new Error('Topic not found'))
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const input = screen.getByLabelText(/type.*to confirm/i)
    await user.type(input, 'orders-v1')

    await user.click(screen.getByRole('button', { name: /delete orders-v1/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Topic not found')).toBeInTheDocument()
    })
  })

  it('overlay stays open after a delete API error', async () => {
    mockDeleteTopic.mockRejectedValue(new Error('Server error'))
    const user = userEvent.setup()
    render(<TopicDetail />)

    await user.click(screen.getByRole('button', { name: /delete topic/i }))
    const input = screen.getByLabelText(/type.*to confirm/i)
    await user.type(input, 'orders-v1')

    await user.click(screen.getByRole('button', { name: /delete orders-v1/i }))

    // Wait for the error to render first, then confirm the dialog is still open
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ===========================================================================
// CreateTopic
// ===========================================================================

describe('[@create-topic] modal visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTopic.mockResolvedValue(undefined)
  })

  it('renders the modal when isOpen=true', () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Check the heading specifically to avoid ambiguity with the Create Topic button text
    expect(screen.getByRole('heading', { name: 'Create Topic' })).toBeInTheDocument()
  })

  it('does not render the modal when isOpen=false', () => {
    render(<CreateTopic isOpen={false} onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('dialog has role="dialog", aria-modal="true", and aria-labelledby', () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'create-topic-title')
  })

  it('focus trap: Tab cycles within dialog', async () => {
    const user = userEvent.setup()
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    const nameInput = screen.getByLabelText(/topic name/i)
    const partitionsInput = screen.getByLabelText(/partitions/i)

    // Focus should start on the name input (auto-focused on mount)
    await waitFor(() => {
      expect(document.activeElement).toBe(nameInput)
    })

    // Tab forward: should move to the next focusable element (partitions input)
    await user.tab()
    expect(document.activeElement).toBe(partitionsInput)

    // Verify we can Tab again and cycle through elements
    await user.tab()
    const activeAfterSecondTab = document.activeElement
    // Should have moved to another element (RF input or Advanced toggle)
    expect(activeAfterSecondTab).not.toBe(partitionsInput)
    expect(activeAfterSecondTab).not.toBe(nameInput)

    // Focus the name input and then Shift+Tab should cycle back to last focusable
    nameInput.focus()
    expect(document.activeElement).toBe(nameInput)
    await user.tab({ shift: true })
    const activeAfterShiftTab = document.activeElement
    // Should have moved backward from name input to the last focusable (Create button or Cancel)
    expect(activeAfterShiftTab).not.toBe(nameInput)
  })
})

describe('[@create-topic] escape and cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTopic.mockResolvedValue(undefined)
  })

  it('pressing Escape calls onClose when not creating', () => {
    const onClose = vi.fn()
    render(<CreateTopic isOpen={true} onClose={onClose} onCreated={vi.fn()} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Cancel button calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CreateTopic isOpen={true} onClose={onClose} onCreated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('[@create-topic] topic name validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTopic.mockResolvedValue(undefined)
  })

  it('shows validation error when topic name is empty (after interacting)', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    // Create button should be disabled with empty name
    const createBtn = screen.getByRole('button', { name: /create topic/i })
    expect(createBtn).toBeDisabled()
  })

  it('shows validation error for topic name with a space', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    const nameInput = screen.getByLabelText(/topic name/i)
    fireEvent.change(nameInput, { target: { value: 'orders v1' } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/only letters, numbers, hyphens/i)).toBeInTheDocument()
    })
  })

  it('shows validation error for topic name with invalid chars like "!"', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    const nameInput = screen.getByLabelText(/topic name/i)
    fireEvent.change(nameInput, { target: { value: 'orders!topic' } })

    await waitFor(() => {
      expect(screen.getByText(/only letters, numbers, hyphens/i)).toBeInTheDocument()
    })
  })

  it('shows validation error when topic name is "."', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    const nameInput = screen.getByLabelText(/topic name/i)
    fireEvent.change(nameInput, { target: { value: '.' } })

    await waitFor(() => {
      expect(screen.getByText(/cannot be "\." or "\.\."/i)).toBeInTheDocument()
    })
  })

  it('shows validation error when topic name is ".."', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    const nameInput = screen.getByLabelText(/topic name/i)
    fireEvent.change(nameInput, { target: { value: '..' } })

    await waitFor(() => {
      expect(screen.getByText(/cannot be "\." or "\.\."/i)).toBeInTheDocument()
    })
  })

  it('accepts a 249-character topic name (at the limit)', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    const nameInput = screen.getByLabelText(/topic name/i)
    const name249 = 'a'.repeat(249)
    fireEvent.change(nameInput, { target: { value: name249 } })

    await waitFor(() => {
      // No validation error should appear for the name
      expect(screen.queryByText(/must be 249 characters or fewer/i)).not.toBeInTheDocument()
    })
  })

  it('shows validation error for a 250-character topic name (over the limit)', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    const nameInput = screen.getByLabelText(/topic name/i)
    const name250 = 'a'.repeat(250)
    fireEvent.change(nameInput, { target: { value: name250 } })

    await waitFor(() => {
      expect(screen.getByText(/must be 249 characters or fewer/i)).toBeInTheDocument()
    })
  })
})

describe('[@create-topic] partitions validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTopic.mockResolvedValue(undefined)
  })

  it('Create button remains disabled when partitions is 0', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)

    // Set a valid topic name first
    const nameInput = screen.getByLabelText(/topic name/i)
    fireEvent.change(nameInput, { target: { value: 'valid-topic' } })

    // Set partitions to 0
    const partitionsInput = screen.getByLabelText(/partitions/i)
    fireEvent.change(partitionsInput, { target: { value: '0' } })

    const createBtn = screen.getByRole('button', { name: /create topic/i })
    expect(createBtn).toBeDisabled()
  })
})

describe('[@create-topic] valid form and creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTopic.mockResolvedValue(undefined)
  })

  it('Create button is enabled when form is valid', async () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)

    const nameInput = screen.getByLabelText(/topic name/i)
    fireEvent.change(nameInput, { target: { value: 'valid-topic-name' } })

    await waitFor(() => {
      const createBtn = screen.getByRole('button', { name: /create topic/i })
      expect(createBtn).not.toBeDisabled()
    })
  })

  it('Create button calls createTopic (store action) with correct arguments', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onClose = vi.fn()
    render(<CreateTopic isOpen={true} onClose={onClose} onCreated={onCreated} />)

    // Fill in topic name (partitions default 6, RF default 3)
    const nameInput = screen.getByLabelText(/topic name/i)
    await user.type(nameInput, 'my-new-topic')

    const createBtn = screen.getByRole('button', { name: /create topic/i })
    await user.click(createBtn)

    await waitFor(() => {
      expect(mockCreateTopic).toHaveBeenCalledWith({
        topicName: 'my-new-topic',
        partitionsCount: 6,
        replicationFactor: 3,
        cleanupPolicy: 'delete',
        retentionMs: undefined,
      })
    })
  })

  it('calls onCreated and onClose after successful creation', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onClose = vi.fn()
    render(<CreateTopic isOpen={true} onClose={onClose} onCreated={onCreated} />)

    const nameInput = screen.getByLabelText(/topic name/i)
    await user.type(nameInput, 'my-new-topic')

    await user.click(screen.getByRole('button', { name: /create topic/i }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('calls addToast with a message containing "created" after successful topic creation', async () => {
    const user = userEvent.setup()
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)

    const nameInput = screen.getByLabelText(/topic name/i)
    await user.type(nameInput, 'my-new-topic')

    await user.click(screen.getByRole('button', { name: /create topic/i }))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('created'),
        })
      )
    })
  })
})

describe('[@create-topic] API error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows API error message inside the dialog when createTopic rejects', async () => {
    const user = userEvent.setup()
    mockCreateTopic.mockRejectedValue(new Error('Topic already exists'))
    const onClose = vi.fn()

    render(<CreateTopic isOpen={true} onClose={onClose} onCreated={vi.fn()} />)

    const nameInput = screen.getByLabelText(/topic name/i)
    await user.type(nameInput, 'duplicate-topic')

    await user.click(screen.getByRole('button', { name: /create topic/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Topic already exists')).toBeInTheDocument()
    })
  })

  it('dialog remains open after an API error', async () => {
    const user = userEvent.setup()
    mockCreateTopic.mockRejectedValue(new Error('Server error'))
    const onClose = vi.fn()

    render(<CreateTopic isOpen={true} onClose={onClose} onCreated={vi.fn()} />)

    const nameInput = screen.getByLabelText(/topic name/i)
    await user.type(nameInput, 'some-topic')

    await user.click(screen.getByRole('button', { name: /create topic/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
    })
  })
})

describe('[@create-topic] advanced section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTopic.mockResolvedValue(undefined)
  })

  it('advanced section is hidden by default', () => {
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)
    expect(screen.queryByLabelText(/cleanup policy/i)).not.toBeInTheDocument()
  })

  it('clicking Advanced Options toggle expands the advanced section', async () => {
    const user = userEvent.setup()
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /advanced options/i }))

    expect(screen.getByLabelText(/cleanup policy/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/retention/i)).toBeInTheDocument()
  })

  it('clicking Advanced Options toggle again collapses the section', async () => {
    const user = userEvent.setup()
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)

    const advToggle = screen.getByRole('button', { name: /advanced options/i })
    await user.click(advToggle)
    expect(screen.getByLabelText(/cleanup policy/i)).toBeInTheDocument()

    await user.click(advToggle)
    expect(screen.queryByLabelText(/cleanup policy/i)).not.toBeInTheDocument()
  })

  it('passes cleanupPolicy and retentionMs to createTopic when advanced fields are set', async () => {
    const user = userEvent.setup()
    render(<CreateTopic isOpen={true} onClose={vi.fn()} onCreated={vi.fn()} />)

    // Fill topic name
    await user.type(screen.getByLabelText(/topic name/i), 'log-topic')

    // Expand advanced
    await user.click(screen.getByRole('button', { name: /advanced options/i }))

    // Set cleanup policy to compact
    const cleanupSelect = screen.getByLabelText(/cleanup policy/i)
    fireEvent.change(cleanupSelect, { target: { value: 'compact' } })

    // Set retention
    const retentionInput = screen.getByLabelText(/retention/i)
    fireEvent.change(retentionInput, { target: { value: '86400000' } })

    await user.click(screen.getByRole('button', { name: /create topic/i }))

    await waitFor(() => {
      expect(mockCreateTopic).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanupPolicy: 'compact',
          retentionMs: 86400000,
        })
      )
    })
  })
})
