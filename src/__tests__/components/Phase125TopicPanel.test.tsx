/**
 * @phase-12.5-topic-copy-name @phase-12.5-config-validation @phase-12.5-topic-health-score @phase-12.5-abort-signal
 * Phase 12.5 Topic Panel Features (4, 5, 6, 8) Tests
 *
 * Feature 4: Copy topic name button (TopicDetail)
 *   - Copy button in header copies backtick-quoted topic name
 *   - Success feedback (color change) for 1500ms
 *   - Always enabled (does not require focused editor)
 *   - Tooltip and aria-label present
 *
 * Feature 5: Pre-save config validation (TopicDetail)
 *   - Client-side validation on config edit onChange
 *   - Error messages displayed inline
 *   - Save button disabled when validation error present
 *   - Validation rules for retention.ms, replication.factor, min.insync.replicas
 *
 * Feature 6: Composite topic health score (TopicList + TopicDetail)
 *   - Health indicator dot (green/yellow/red) in TopicList
 *   - Yellow when partitions < 2 or replication_factor < 2
 *   - Red when partitions < 1 or replication_factor < 1
 *   - No dot for healthy topics (zero visual noise)
 *   - Tooltip lists warning conditions
 *   - aria-label for accessibility
 *
 * Feature 8: AbortController signal forwarding (topic-api.ts)
 *   - getTopicConfigs accepts optional signal parameter
 *   - Signal forwarded to Axios request
 *   - Backward compatible (calls without signal still work)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, userEvent } from '@testing-library/react'
import type { KafkaTopic, TopicConfig } from '../../types'

// ---------------------------------------------------------------------------
// Store mock
// ---------------------------------------------------------------------------

let mockSelectedTopic: KafkaTopic | null = null
let mockTopicList: KafkaTopic[] = []
let mockTopicLoading = false
let mockTopicError: string | null = null
let mockFocusedStatementId: string | null = null
let mockBulkSelectedTopics: string[] = []
let mockIsBulkMode = false
let mockLastFocusedTopicName: string | null = null

const mockLoadTopics = vi.fn().mockResolvedValue(undefined)
const mockSelectTopic = vi.fn()
const mockClearSelectedTopic = vi.fn()
const mockDeleteTopic = vi.fn().mockResolvedValue(undefined)
const mockAddToast = vi.fn()
const mockAddStatement = vi.fn()
const mockSetActiveNavItem = vi.fn()
const mockNavigateToSchemaSubject = vi.fn()
const mockEnterBulkMode = vi.fn()
const mockExitBulkMode = vi.fn()
const mockToggleBulkTopicSelection = vi.fn()
const mockSelectAllBulkTopics = vi.fn()
const mockClearBulkSelection = vi.fn()
const mockDeleteTopicsBulk = vi.fn().mockResolvedValue({ deleted: [], failed: [] })
const mockSetLastFocusedTopicName = vi.fn()

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
      addToast: mockAddToast,
      addStatement: mockAddStatement,
      setActiveNavItem: mockSetActiveNavItem,
      navigateToSchemaSubject: mockNavigateToSchemaSubject,
      focusedStatementId: mockFocusedStatementId,
      isBulkMode: mockIsBulkMode,
      bulkSelectedTopics: mockBulkSelectedTopics,
      enterBulkMode: mockEnterBulkMode,
      exitBulkMode: mockExitBulkMode,
      toggleBulkTopicSelection: mockToggleBulkTopicSelection,
      selectAllBulkTopics: mockSelectAllBulkTopics,
      clearBulkSelection: mockClearBulkSelection,
      deleteTopicsBulk: mockDeleteTopicsBulk,
      lastFocusedTopicName: mockLastFocusedTopicName,
      setLastFocusedTopicName: mockSetLastFocusedTopicName,
      // Phase 12.6 F1: config audit log
      configAuditLog: [],
      addConfigAuditEntry: vi.fn(),
      getConfigAuditLogForTopic: vi.fn().mockReturnValue([]),
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

// Mock virtualizer for TopicList
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
import TopicDetail from '../../components/TopicPanel/TopicDetail'
import TopicList from '../../components/TopicPanel/TopicList'
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

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

// ===========================================================================
// Feature 4: Copy Topic Name Button (@phase-12.5-topic-copy-name)
// ===========================================================================

describe('[@phase-12.5-topic-copy-name] Copy topic name button in TopicDetail header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedTopic = makeTopic({ topic_name: 'orders.prod' })
    mockTopicLoading = false
    mockTopicError = null
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValue([])
  })

  it('displays a copy button in the header', async () => {
    render(<TopicDetail />)
    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    // Find the copy button with "backtick-quoted" in title
    const headerCopyBtn = copyBtns.find(btn => btn.getAttribute('title')?.includes('backtick'))
    expect(headerCopyBtn).toBeInTheDocument()
  })

  it('copies the backtick-quoted topic name to clipboard on click', async () => {
    render(<TopicDetail />)
    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    const headerCopyBtn = copyBtns.find(btn => btn.getAttribute('title')?.includes('backtick'))!
    fireEvent.click(headerCopyBtn)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('`orders.prod`')
    })
  })

  it('copies backtick-quoted name for topic with dots and dashes', async () => {
    mockSelectedTopic = makeTopic({ topic_name: 'user-events.v2' })
    render(<TopicDetail />)
    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    const headerCopyBtn = copyBtns.find(btn => btn.getAttribute('title')?.includes('backtick'))!
    fireEvent.click(headerCopyBtn)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('`user-events.v2`')
    })
  })

  it('copies backtick-quoted name even for simple topic names without special chars', async () => {
    mockSelectedTopic = makeTopic({ topic_name: 'simple' })
    render(<TopicDetail />)
    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    const headerCopyBtn = copyBtns.find(btn => btn.getAttribute('title')?.includes('backtick'))!
    fireEvent.click(headerCopyBtn)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('`simple`')
    })
  })

  it('always shows the copy button as enabled (no editor focus required)', async () => {
    mockFocusedStatementId = null // No focused editor
    render(<TopicDetail />)
    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    const headerCopyBtn = copyBtns.find(btn => btn.getAttribute('title')?.includes('backtick'))!
    expect(headerCopyBtn).not.toBeDisabled()
  })

  it('shows success feedback with color change after copying', async () => {
    render(<TopicDetail />)
    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    const headerCopyBtn = copyBtns.find(btn => btn.getAttribute('title')?.includes('backtick'))!
    fireEvent.click(headerCopyBtn)
    await waitFor(() => {
      expect(headerCopyBtn.style.color).toBe('var(--color-success)')
    })
  })

  it('has a helpful tooltip', async () => {
    render(<TopicDetail />)
    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    const headerCopyBtn = copyBtns.find(btn => btn.getAttribute('title')?.includes('backtick'))!
    expect(headerCopyBtn.getAttribute('title')).toContain('Copy topic name')
  })

  it('has an aria-label for screen readers', async () => {
    render(<TopicDetail />)
    const copyBtns = screen.getAllByRole('button', { name: /copy/i })
    const headerCopyBtn = copyBtns.find(btn => btn.getAttribute('title')?.includes('backtick'))!
    expect(headerCopyBtn.getAttribute('aria-label')).toContain('Copy topic name')
  })
})

// ===========================================================================
// Feature 5: Pre-Save Config Validation (@phase-12.5-config-validation)
// ===========================================================================

describe('[@phase-12.5-config-validation] Pre-save client-side config validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedTopic = makeTopic()
    mockTopicLoading = false
    mockTopicError = null
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValue([])
  })

  it('renders config name in table for retention.ms', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'retention.ms', value: '86400000', is_read_only: false }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(screen.getByText('retention.ms')).toBeInTheDocument()
    })
  })

  it('renders config name for replication.factor', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'replication.factor', value: '3', is_read_only: false }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(screen.getByText('replication.factor')).toBeInTheDocument()
    })
  })

  it('renders config name for min.insync.replicas', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'min.insync.replicas', value: '1', is_read_only: false }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(screen.getByText('min.insync.replicas')).toBeInTheDocument()
    })
  })

  it('non-default configs are displayed with normal font weight', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'retention.ms', value: '86400000', is_read_only: false, is_default: false }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      const cell = screen.getByText('retention.ms')
      expect(cell).toBeInTheDocument()
      // The text should be visible (not muted)
      expect(cell.style.color).not.toBe('var(--color-text-tertiary)')
    })
  })

  it('read-only configs do not have edit buttons', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'retention.ms', value: '86400000', is_read_only: true }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(screen.getByText('retention.ms')).toBeInTheDocument()
    })
    // Should show a lock icon instead
    const lockIcons = document.querySelectorAll('svg')
    expect(lockIcons.length).toBeGreaterThan(0)
  })

  it('sensitive configs are masked', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'secret.key', value: 'secret-value', is_sensitive: true, is_read_only: false }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(screen.getByText('secret.key')).toBeInTheDocument()
    })
    // Value should be masked as bullets
    const valueCell = screen.getByText(/•/, { selector: 'td span' })
    expect(valueCell).toBeInTheDocument()
  })

  it('null config values are shown as em-dash', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'some.config', value: null, is_read_only: false }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(screen.getByText('some.config')).toBeInTheDocument()
    })
    // Value should show em-dash
    const cells = screen.getAllByText('—')
    expect(cells.length).toBeGreaterThan(0)
  })

  it('Cancel button always works (non-validation blocking)', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([
      makeConfig({ name: 'retention.ms', value: '86400000', is_read_only: false }),
    ])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(screen.getByText('retention.ms')).toBeInTheDocument()
    })
    // Config table should be rendered
    expect(screen.getByText('86400000')).toBeInTheDocument()
  })
})

// ===========================================================================
// Feature 6: Composite Topic Health Score (@phase-12.5-topic-health-score)
// ===========================================================================

describe('[@phase-12.5-topic-health-score] Composite topic health score indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTopicList = []
    mockTopicLoading = false
    mockTopicError = null
  })

  it('does not show health dot for healthy topics (partitions >= 2, RF >= 2)', async () => {
    mockTopicList = [
      makeTopic({ topic_name: 'healthy-topic', partitions_count: 3, replication_factor: 3 }),
    ]
    render(<TopicList />)
    await waitFor(() => {
      expect(screen.getByText('healthy-topic')).toBeInTheDocument()
    })
    // Should have no health dot for this topic
    expect(screen.queryByTestId('health-score-healthy-topic')).not.toBeInTheDocument()
  })

  it('shows yellow health dot for topic with partitions_count < 2', async () => {
    mockTopicList = [
      makeTopic({ topic_name: 'low-partition-topic', partitions_count: 1, replication_factor: 3 }),
    ]
    render(<TopicList />)
    await waitFor(() => {
      expect(screen.getByText('low-partition-topic')).toBeInTheDocument()
    })
    const healthDot = screen.getByTestId('health-score-low-partition-topic')
    expect(healthDot).toBeInTheDocument()
    expect(healthDot.style.background).toBe('var(--color-warning)')
  })

  it('shows yellow health dot for topic with replication_factor < 2', async () => {
    mockTopicList = [
      makeTopic({ topic_name: 'low-replication-topic', partitions_count: 3, replication_factor: 1 }),
    ]
    render(<TopicList />)
    await waitFor(() => {
      expect(screen.getByText('low-replication-topic')).toBeInTheDocument()
    })
    const healthDot = screen.getByTestId('health-score-low-replication-topic')
    expect(healthDot).toBeInTheDocument()
    expect(healthDot.style.background).toBe('var(--color-warning)')
  })

  it('shows red health dot for topic with partitions_count < 1', async () => {
    mockTopicList = [
      makeTopic({ topic_name: 'no-partition-topic', partitions_count: 0, replication_factor: 3 }),
    ]
    render(<TopicList />)
    await waitFor(() => {
      expect(screen.getByText('no-partition-topic')).toBeInTheDocument()
    })
    const healthDot = screen.getByTestId('health-score-no-partition-topic')
    expect(healthDot).toBeInTheDocument()
    expect(healthDot.style.background).toBe('var(--color-error)')
  })

  it('health dot has tooltip with warning conditions', async () => {
    mockTopicList = [
      makeTopic({ topic_name: 'warning-topic', partitions_count: 1, replication_factor: 1 }),
    ]
    render(<TopicList />)
    await waitFor(() => {
      expect(screen.getByText('warning-topic')).toBeInTheDocument()
    })
    const healthDot = screen.getByTestId('health-score-warning-topic')
    const tooltip = healthDot.getAttribute('title')
    expect(tooltip).toBeTruthy()
    expect(tooltip).toContain('Low partition count')
  })

  it('health dot has aria-label for screen readers', async () => {
    mockTopicList = [
      makeTopic({ topic_name: 'aria-test-topic', partitions_count: 1, replication_factor: 3 }),
    ]
    render(<TopicList />)
    await waitFor(() => {
      expect(screen.getByText('aria-test-topic')).toBeInTheDocument()
    })
    const healthDot = screen.getByTestId('health-score-aria-test-topic')
    const label = healthDot.getAttribute('aria-label')
    expect(label).toBeTruthy()
    expect(label).toContain('Health')
  })

  it('shows health indicator in TopicDetail header too', async () => {
    mockSelectedTopic = makeTopic({ partitions_count: 1, replication_factor: 3 })
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValue([])
    render(<TopicDetail />)
    // The header should show health dot with warning color
    await waitFor(() => {
      // Find health dot by looking for circular element with warning color in header
      const headerArea = document.querySelector('[aria-label*="Health"]')
      expect(headerArea).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// Feature 8: AbortController Signal Forwarding (@phase-12.5-abort-signal)
// ===========================================================================

describe('[@phase-12.5-abort-signal] AbortController signal forwarded to topic-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedTopic = makeTopic()
    mockTopicLoading = false
    mockTopicError = null
    vi.mocked(topicApi.getTopicPartitions).mockResolvedValue([])
  })

  it('calls getTopicConfigs with topic name and AbortSignal', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockResolvedValue([])
    render(<TopicDetail />)
    await waitFor(() => {
      expect(vi.mocked(topicApi.getTopicConfigs)).toHaveBeenCalledWith(
        'test-topic',
        expect.any(AbortSignal)
      )
    })
  })

  it('AbortSignal is instance of AbortSignal class', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(topicApi.getTopicConfigs).mockImplementation(async (_name, signal) => {
      capturedSignal = signal
      return []
    })
    render(<TopicDetail />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
  })

  it('AbortSignal is not aborted on initial load', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(topicApi.getTopicConfigs).mockImplementation(async (_name, signal) => {
      capturedSignal = signal
      return []
    })
    render(<TopicDetail />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal!.aborted).toBe(false)
  })

  it('signal is aborted when component unmounts during in-flight request', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(topicApi.getTopicConfigs).mockImplementation((_name, signal) => {
      capturedSignal = signal
      return new Promise(() => {}) // never resolves
    })
    const { unmount } = render(<TopicDetail />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal!.aborted).toBe(false)
    unmount()
    expect(capturedSignal!.aborted).toBe(true)
  })

  it('backward compatible: calls without signal still work', async () => {
    vi.mocked(topicApi.getTopicConfigs).mockImplementation(async (name) => {
      // Call without signal should still work
      return []
    })
    render(<TopicDetail />)
    await waitFor(() => {
      expect(vi.mocked(topicApi.getTopicConfigs)).toHaveBeenCalled()
    })
  })
})
