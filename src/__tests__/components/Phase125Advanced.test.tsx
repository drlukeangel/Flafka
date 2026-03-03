/**
 * @phase-12.5-schema-colors @phase-12.5-abort-signal
 * Phase 12.5 Advanced Features (7 & 8) Tests
 *
 * Feature 7: SchemaTreeView CSS custom properties
 *   - record, array, map badge colors use CSS vars (--color-schema-record,
 *     --color-schema-array, --color-schema-map) instead of hardcoded hex/rgba
 *
 * Feature 8: AbortController signal forwarded to Axios in getTopicConfigs
 *   - getTopicConfigs(topicName, signal?) accepts AbortSignal
 *   - TopicDetail passes controller.signal so HTTP requests are cancelled
 *     on rapid topic switching or component unmount
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { KafkaTopic, TopicConfig } from '../../types'

// ---------------------------------------------------------------------------
// Store mock shared across Topic tests in this file
// ---------------------------------------------------------------------------

let mockSelectedTopic: KafkaTopic | null = null
let mockTopicLoading = false
let mockTopicError: string | null = null
let mockTopicList: KafkaTopic[] = []
const mockLoadTopics = vi.fn().mockResolvedValue(undefined)
const mockSelectTopic = vi.fn()
const mockClearSelectedTopic = vi.fn()
const mockDeleteTopic = vi.fn().mockResolvedValue(undefined)
const mockAddToast = vi.fn()
const mockAddStatement = vi.fn()
const mockSetActiveNavItem = vi.fn()
const mockNavigateToSchemaSubject = vi.fn()
const mockBulkSelectedTopics: string[] = []
const mockIsBulkMode = false
const mockToggleBulkTopicSelection = vi.fn()
const mockSetBulkMode = vi.fn()
const mockDeleteTopicsBulk = vi.fn().mockResolvedValue({ deleted: [], failed: [] })
const mockFocusedStatementId: string | null = null

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      topics: mockTopicList,
      selectedTopic: mockSelectedTopic,
      topicLoading: mockTopicLoading,
      topicError: mockTopicError,
      loadTopics: mockLoadTopics,
      selectTopic: mockSelectTopic,
      clearSelectedTopic: mockClearSelectedTopic,
      deleteTopic: mockDeleteTopic,
      addToast: mockAddToast,
      addStatement: mockAddStatement,
      setActiveNavItem: mockSetActiveNavItem,
      navigateToSchemaSubject: mockNavigateToSchemaSubject,
      focusedStatementId: mockFocusedStatementId,
      bulkSelectedTopics: mockBulkSelectedTopics,
      isBulkMode: mockIsBulkMode,
      toggleBulkTopicSelection: mockToggleBulkTopicSelection,
      setBulkMode: mockSetBulkMode,
      deleteTopicsBulk: mockDeleteTopicsBulk,
      lastFocusedTopicName: null,
      getConfigAuditLogForTopic: vi.fn().mockReturnValue([]),
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

// Mock virtualizer (jsdom has no layout engine)
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

vi.mock('../../api/schema-registry-api', () => ({
  getSubjectsByTopic: vi.fn().mockResolvedValue([]),
  listSubjects: vi.fn().mockResolvedValue([]),
}))

vi.mock('../EditorCell/editorRegistry', () => ({
  insertTextAtCursor: vi.fn().mockReturnValue(false),
}), { virtual: true })

vi.mock('../../components/EditorCell/editorRegistry', () => ({
  insertTextAtCursor: vi.fn().mockReturnValue(false),
}))

vi.mock('../../config/environment', () => ({
  env: {
    kafkaClusterId: 'test-cluster',
    kafkaRestEndpoint: 'https://test.confluent.cloud',
    schemaRegistryUrl: '',
    flinkRestEndpoint: '',
    flinkApiKey: '',
    flinkApiSecret: '',
  },
}))

vi.mock('../../api/topic-api', () => ({
  listTopics: vi.fn().mockResolvedValue([]),
  getTopicDetail: vi.fn(),
  getTopicConfigs: vi.fn().mockResolvedValue([]),
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
  alterTopicConfig: vi.fn().mockResolvedValue(undefined),
  getTopicPartitions: vi.fn().mockResolvedValue([]),
  getPartitionOffsets: vi.fn().mockResolvedValue({ beginning_offset: '0', end_offset: '0' }),
  produceRecord: vi.fn(),
}))

// Import components AFTER mocks are registered
import SchemaTreeView from '../../components/SchemaPanel/SchemaTreeView'
import TopicDetail from '../../components/TopicPanel/TopicDetail'
import * as topicApi from '../../api/topic-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTopic(overrides: Partial<KafkaTopic> = {}): KafkaTopic {
  return {
    topic_name: 'test-topic',
    partitions_count: 3,
    replication_factor: 3,
    is_internal: false,
    ...overrides,
  }
}

function makeConfig(overrides: Partial<TopicConfig> = {}): TopicConfig {
  return {
    name: 'compression.type',
    value: 'producer',
    is_default: true,
    is_sensitive: false,
    is_read_only: false,
    source: 'DEFAULT_CONFIG',
    synonyms: [],
    ...overrides,
  }
}

const AVRO_WITH_RECORD = JSON.stringify({
  type: 'record',
  name: 'Order',
  namespace: 'com.example',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'amount', type: 'double' },
    { name: 'tags', type: { type: 'array', items: 'string' } },
    {
      name: 'metadata',
      type: { type: 'map', values: 'string' },
    },
    {
      name: 'address',
      type: {
        type: 'record',
        name: 'Address',
        fields: [
          { name: 'street', type: 'string' },
        ],
      },
    },
  ],
})

// ===========================================================================
// Feature 7: SchemaTreeView CSS custom properties (@phase-12.5-schema-colors)
// ===========================================================================

describe('[@phase-12.5-schema-colors] SchemaTreeView uses CSS vars for type badge colors', () => {
  it('renders array type badge using var(--color-schema-array) for color', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    // The "array<string>" badge should be present
    const badges = screen.getAllByTitle(/Type: array/)
    expect(badges.length).toBeGreaterThan(0)
    // Inline style should use CSS var, not hardcoded hex
    const badgeEl = badges[0]
    expect(badgeEl.style.color).toBe('var(--color-schema-array)')
  })

  it('renders map type badge using var(--color-schema-map) for color', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    const badges = screen.getAllByTitle(/Type: map/)
    expect(badges.length).toBeGreaterThan(0)
    const badgeEl = badges[0]
    expect(badgeEl.style.color).toBe('var(--color-schema-map)')
  })

  it('renders record type badge using var(--color-schema-record) for color', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    // The address field has type record<Address>
    const badges = screen.getAllByTitle(/Type: record/)
    expect(badges.length).toBeGreaterThan(0)
    const badgeEl = badges[0]
    expect(badgeEl.style.color).toBe('var(--color-schema-record)')
  })

  it('record badge background uses var(--color-schema-record-bg), not hardcoded rgba', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    const badges = screen.getAllByTitle(/Type: record/)
    expect(badges.length).toBeGreaterThan(0)
    const badgeEl = badges[0]
    // Must not contain raw hex or rgba(139 values
    expect(badgeEl.style.background).not.toContain('#8B5CF6')
    expect(badgeEl.style.background).not.toContain('rgba(139')
    expect(badgeEl.style.background).toBe('var(--color-schema-record-bg)')
  })

  it('array badge background uses var(--color-schema-array-bg), not hardcoded rgba', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    const badges = screen.getAllByTitle(/Type: array/)
    expect(badges.length).toBeGreaterThan(0)
    const badgeEl = badges[0]
    expect(badgeEl.style.background).not.toContain('#14B8A6')
    expect(badgeEl.style.background).not.toContain('rgba(20')
    expect(badgeEl.style.background).toBe('var(--color-schema-array-bg)')
  })

  it('map badge background uses var(--color-schema-array-bg), not hardcoded rgba', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    const badges = screen.getAllByTitle(/Type: map/)
    expect(badges.length).toBeGreaterThan(0)
    const badgeEl = badges[0]
    expect(badgeEl.style.background).not.toContain('#14B8A6')
    expect(badgeEl.style.background).not.toContain('rgba(20')
    expect(badgeEl.style.background).toBe('var(--color-schema-array-bg)')
  })

  it('string badge still uses rgba (non-schema-type) — not affected by Feature 7', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    // The string badge uses rgba directly, confirm it still renders
    const stringBadges = screen.getAllByTitle(/Type: string/)
    expect(stringBadges.length).toBeGreaterThan(0)
  })

  it('renders all 5 field names from the composite schema', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('amount')).toBeInTheDocument()
    expect(screen.getByText('tags')).toBeInTheDocument()
    expect(screen.getByText('metadata')).toBeInTheDocument()
    expect(screen.getByText('address')).toBeInTheDocument()
  })

  it('schema-tree-view renders without --color-view reference for type badges (record now uses dedicated var)', () => {
    render(<SchemaTreeView schema={AVRO_WITH_RECORD} />)
    const badges = screen.getAllByTitle(/Type: record/)
    // Should use --color-schema-record, NOT --color-view
    badges.forEach((badge) => {
      expect(badge.style.color).toBe('var(--color-schema-record)')
      expect(badge.style.color).not.toBe('var(--color-view)')
    })
  })
})

// ===========================================================================
// Feature 8: AbortController signal forwarded to Axios (@phase-12.5-abort-signal)
// ===========================================================================

describe('[@phase-12.5-abort-signal] getTopicConfigs accepts and forwards AbortSignal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedTopic = makeTopic({ topic_name: 'abort-test-topic' })
    mockTopicLoading = false
    mockTopicError = null
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValue([])
  })

  it('getTopicConfigs is called with topic name and an AbortSignal', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(vi.mocked(topicApi.getTopicConfigs)).toHaveBeenCalledWith(
        'abort-test-topic',
        expect.any(AbortSignal)
      )
    })
  })

  it('the AbortSignal passed to getTopicConfigs is not already aborted on initial load', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(topicApi.getTopicConfigs).mockImplementation(async (_name, signal) => {
      capturedSignal = signal
      return []
    })
    render(<TopicDetail />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal!.aborted).toBe(false)
  })

  it('the AbortSignal is an actual AbortSignal instance (not a plain object)', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(topicApi.getTopicConfigs).mockImplementation(async (_name, signal) => {
      capturedSignal = signal
      return []
    })
    render(<TopicDetail />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
  })

  it('signal is aborted when component unmounts during an in-flight request', async () => {
    let capturedSignal: AbortSignal | undefined
    // Simulate a slow / never-resolving network call
    vi.mocked(topicApi.getTopicConfigs).mockImplementation((_name, signal) => {
      capturedSignal = signal
      return new Promise(() => {}) // hangs forever
    })
    const { unmount } = render(<TopicDetail />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal!.aborted).toBe(false)
    unmount()
    // After unmount the controller must have been aborted
    expect(capturedSignal!.aborted).toBe(true)
  })

  it('a second render with the same topic does not abort signal prematurely', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'compression.type', value: 'producer' }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(vi.mocked(topicApi.getTopicConfigs)).toHaveBeenCalledWith(
        'abort-test-topic',
        expect.any(AbortSignal)
      )
    })
    // Config row should render correctly — signal was not aborted mid-flight
    await waitFor(() => {
      expect(screen.getByText('compression.type')).toBeInTheDocument()
    })
  })

  it('getTopicConfigs is only called once on initial mount (no double-fetch)', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(vi.mocked(topicApi.getTopicConfigs)).toHaveBeenCalledTimes(1)
    })
  })
})
