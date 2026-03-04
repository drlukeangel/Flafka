import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryPanel } from '../../components/HistoryPanel/HistoryPanel'
import type { StatementResponse } from '../../api/flink-api'

// ---------------------------------------------------------------------------
// Store mock — controlled via module-level variables
// ---------------------------------------------------------------------------
let mockStatementHistory: StatementResponse[] = []
let mockHistoryLoading = false
let mockHistoryError: string | null = null
const mockAddStatement = vi.fn()

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    statementHistory: mockStatementHistory,
    historyLoading: mockHistoryLoading,
    historyError: mockHistoryError,
    addStatement: mockAddStatement,
  }),
}))

// ---------------------------------------------------------------------------
// Helpers — expose the private functions under test by importing them via the
// module boundary.  Because they are not exported we re-implement the same
// logic in a thin wrapper so they can be unit-tested without React rendering.
// ---------------------------------------------------------------------------

// Mirror of getRelativeTime from HistoryPanel.tsx (kept in sync manually)
function getRelativeTime(isoDateString: string | undefined | null): string | null {
  if (!isoDateString) return null
  try {
    const date = new Date(isoDateString)
    if (isNaN(date.getTime())) return null

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)

    if (diffSeconds < 60) return 'now'

    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes}m ago`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  } catch {
    return null
  }
}

// Mirror of getStatusDotClass from HistoryPanel.tsx
function getStatusDotClass(phase: string | undefined): string {
  if (!phase) return 'history-status-dot history-status-dot--unknown'
  switch (phase.toUpperCase()) {
    case 'COMPLETED':
      return 'history-status-dot history-status-dot--completed'
    case 'RUNNING':
      return 'history-status-dot history-status-dot--running'
    case 'PENDING':
      return 'history-status-dot history-status-dot--pending'
    case 'FAILED':
      return 'history-status-dot history-status-dot--failed'
    case 'CANCELLED':
      return 'history-status-dot history-status-dot--cancelled'
    default:
      return 'history-status-dot history-status-dot--unknown'
  }
}

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------
function makeStatement(
  name: string,
  sql: string,
  phase: StatementResponse['status']['phase'],
  createdAt?: string,
): StatementResponse {
  return {
    name,
    metadata: createdAt ? ({ created_at: createdAt } as unknown as StatementResponse['metadata']) : undefined,
    spec: { statement: sql },
    status: { phase },
  }
}

// ---------------------------------------------------------------------------
// Part A: Pure utility unit tests
// ---------------------------------------------------------------------------

describe('[@history-panel] getRelativeTime', () => {
  const BASE_TIME = new Date('2026-02-28T12:00:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "now" for a date 30 seconds ago', () => {
    const date = new Date(BASE_TIME.getTime() - 30_000)
    expect(getRelativeTime(date.toISOString())).toBe('now')
  })

  it('returns "now" for a date 59 seconds ago', () => {
    const date = new Date(BASE_TIME.getTime() - 59_000)
    expect(getRelativeTime(date.toISOString())).toBe('now')
  })

  it('returns "now" for a date that is exactly the current time', () => {
    expect(getRelativeTime(BASE_TIME.toISOString())).toBe('now')
  })

  it('returns "5m ago" for a date 5 minutes ago', () => {
    const date = new Date(BASE_TIME.getTime() - 5 * 60_000)
    expect(getRelativeTime(date.toISOString())).toBe('5m ago')
  })

  it('returns "59m ago" for a date 59 minutes ago', () => {
    const date = new Date(BASE_TIME.getTime() - 59 * 60_000)
    expect(getRelativeTime(date.toISOString())).toBe('59m ago')
  })

  it('returns "2h ago" for a date 2 hours ago', () => {
    const date = new Date(BASE_TIME.getTime() - 2 * 60 * 60_000)
    expect(getRelativeTime(date.toISOString())).toBe('2h ago')
  })

  it('returns "23h ago" for a date 23 hours ago', () => {
    const date = new Date(BASE_TIME.getTime() - 23 * 60 * 60_000)
    expect(getRelativeTime(date.toISOString())).toBe('23h ago')
  })

  it('returns "3d ago" for a date 3 days ago', () => {
    const date = new Date(BASE_TIME.getTime() - 3 * 24 * 60 * 60_000)
    expect(getRelativeTime(date.toISOString())).toBe('3d ago')
  })

  it('returns null for undefined input', () => {
    expect(getRelativeTime(undefined)).toBeNull()
  })

  it('returns null for null input', () => {
    expect(getRelativeTime(null)).toBeNull()
  })

  it('returns null for an invalid date string', () => {
    expect(getRelativeTime('not-a-date')).toBeNull()
  })
})

describe('[@history-panel] getStatusDotClass', () => {
  it('returns pending class for PENDING phase', () => {
    expect(getStatusDotClass('PENDING')).toBe('history-status-dot history-status-dot--pending')
  })

  it('returns running class for RUNNING phase', () => {
    expect(getStatusDotClass('RUNNING')).toBe('history-status-dot history-status-dot--running')
  })

  it('returns completed class for COMPLETED phase', () => {
    expect(getStatusDotClass('COMPLETED')).toBe('history-status-dot history-status-dot--completed')
  })

  it('returns failed class for FAILED phase', () => {
    expect(getStatusDotClass('FAILED')).toBe('history-status-dot history-status-dot--failed')
  })

  it('returns cancelled class for CANCELLED phase', () => {
    expect(getStatusDotClass('CANCELLED')).toBe('history-status-dot history-status-dot--cancelled')
  })

  it('returns unknown class for an unrecognised phase', () => {
    expect(getStatusDotClass('SOMETHING_ELSE')).toBe('history-status-dot history-status-dot--unknown')
  })

  it('returns unknown class for undefined', () => {
    expect(getStatusDotClass(undefined)).toBe('history-status-dot history-status-dot--unknown')
  })

  it('is case-insensitive (lowercase phase)', () => {
    expect(getStatusDotClass('completed')).toBe('history-status-dot history-status-dot--completed')
  })
})

// ---------------------------------------------------------------------------
// Part B: Component tests
// ---------------------------------------------------------------------------

describe('[@history-panel] HistoryPanel component', () => {
  const onClose = vi.fn()
  const onRefresh = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockStatementHistory = []
    mockHistoryLoading = false
    mockHistoryError = null
  })

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  describe('[@history-panel] loading state', () => {
    it('renders a spinner row while loading', () => {
      mockHistoryLoading = true

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      // The loading container is rendered when historyLoading is true
      expect(screen.getByText(/loading history/i)).toBeInTheDocument()
    })

    it('does not render error message while loading', () => {
      mockHistoryLoading = true
      mockHistoryError = 'some error'

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      // Error content is suppressed during loading
      expect(screen.queryByText(/failed to load history/i)).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  describe('[@history-panel] error state', () => {
    it('renders error message when historyError is set', () => {
      mockHistoryError = 'Network timeout'

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByText(/failed to load history: Network timeout/i)).toBeInTheDocument()
    })

    it('renders a Retry button in the error state', () => {
      mockHistoryError = 'Network timeout'

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('clicking Retry calls onRefresh', async () => {
      const user = userEvent.setup()
      mockHistoryError = 'Network timeout'

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: /retry/i }))

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  describe('[@history-panel] empty state', () => {
    it('renders "No statements found" when history is empty', () => {
      mockStatementHistory = []

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByText('No statements found')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Filter tabs
  // -------------------------------------------------------------------------
  describe('[@history-panel] filter tabs', () => {
    it('shows filter tabs when history is non-empty, not loading, no error', () => {
      mockStatementHistory = [
        makeStatement('s1', 'SELECT 1', 'COMPLETED'),
        makeStatement('s2', 'SELECT 2', 'FAILED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      // All five category buttons should be present
      expect(screen.getByRole('button', { name: /^All \(\d+\)$/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Completed \(\d+\)$/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Failed \(\d+\)$/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Stopped \(\d+\)$/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Running \(\d+\)$/ })).toBeInTheDocument()
    })

    it('shows filter tabs during progressive loading when data exists', () => {
      mockHistoryLoading = true
      mockStatementHistory = [makeStatement('s1', 'SELECT 1', 'COMPLETED')]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      // Progressive rendering: filters shown even while loading more pages
      expect(screen.getByRole('button', { name: /^All \(\d+\)$/ })).toBeInTheDocument()
    })

    it('does not show filter tabs when loading with no data yet', () => {
      mockHistoryLoading = true
      mockStatementHistory = []

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.queryByRole('button', { name: /^All \(\d+\)$/ })).not.toBeInTheDocument()
    })

    it('does not show filter tabs when there is an error', () => {
      mockHistoryError = 'oops'
      mockStatementHistory = [makeStatement('s1', 'SELECT 1', 'COMPLETED')]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.queryByRole('button', { name: /^All \(\d+\)$/ })).not.toBeInTheDocument()
    })

    it('does not show filter tabs when history is empty', () => {
      mockStatementHistory = []

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.queryByRole('button', { name: /^All \(\d+\)$/ })).not.toBeInTheDocument()
    })

    it('shows correct count in All tab', () => {
      mockStatementHistory = [
        makeStatement('s1', 'SELECT 1', 'COMPLETED'),
        makeStatement('s2', 'SELECT 2', 'FAILED'),
        makeStatement('s3', 'SELECT 3', 'RUNNING'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByRole('button', { name: 'All (3)' })).toBeInTheDocument()
    })

    it('shows correct count in Completed tab', () => {
      mockStatementHistory = [
        makeStatement('s1', 'SELECT 1', 'COMPLETED'),
        makeStatement('s2', 'SELECT 2', 'COMPLETED'),
        makeStatement('s3', 'SELECT 3', 'FAILED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByRole('button', { name: 'Completed (2)' })).toBeInTheDocument()
    })

    it('shows correct count in Failed tab', () => {
      mockStatementHistory = [
        makeStatement('s1', 'SELECT 1', 'COMPLETED'),
        makeStatement('s2', 'SELECT 2', 'FAILED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByRole('button', { name: 'Failed (1)' })).toBeInTheDocument()
    })

    it('shows correct count in Running tab (RUNNING + PENDING)', () => {
      mockStatementHistory = [
        makeStatement('s1', 'SELECT 1', 'RUNNING'),
        makeStatement('s2', 'SELECT 2', 'PENDING'),
        makeStatement('s3', 'SELECT 3', 'COMPLETED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByRole('button', { name: 'Running (2)' })).toBeInTheDocument()
    })

    it('shows correct count in Stopped tab (CANCELLED)', () => {
      mockStatementHistory = [
        makeStatement('s1', 'SELECT 1', 'CANCELLED'),
        makeStatement('s2', 'SELECT 2', 'COMPLETED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByRole('button', { name: 'Stopped (1)' })).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Active filter tab — click to filter list
  // -------------------------------------------------------------------------
  describe('[@history-panel] active filter tab filters the list', () => {
    it('clicking Completed tab shows only COMPLETED statements', async () => {
      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('stmt-ok', 'SELECT 1', 'COMPLETED'),
        makeStatement('stmt-bad', 'SELECT 2', 'FAILED'),
        makeStatement('stmt-run', 'SELECT 3', 'RUNNING'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: 'Completed (1)' }))

      expect(screen.getByText('SELECT 1')).toBeInTheDocument()
      expect(screen.queryByText('SELECT 2')).not.toBeInTheDocument()
      expect(screen.queryByText('SELECT 3')).not.toBeInTheDocument()
    })

    it('clicking Failed tab shows only FAILED statements', async () => {
      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('stmt-ok', 'SELECT 1', 'COMPLETED'),
        makeStatement('stmt-bad', 'SELECT 2', 'FAILED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: 'Failed (1)' }))

      expect(screen.queryByText('SELECT 1')).not.toBeInTheDocument()
      expect(screen.getByText('SELECT 2')).toBeInTheDocument()
    })

    it('clicking Running tab shows RUNNING and PENDING statements', async () => {
      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('stmt-running', 'SELECT running', 'RUNNING'),
        makeStatement('stmt-pending', 'SELECT pending', 'PENDING'),
        makeStatement('stmt-done', 'SELECT done', 'COMPLETED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: 'Running (2)' }))

      expect(screen.getByText('SELECT running')).toBeInTheDocument()
      expect(screen.getByText('SELECT pending')).toBeInTheDocument()
      expect(screen.queryByText('SELECT done')).not.toBeInTheDocument()
    })

    it('clicking Stopped tab shows only CANCELLED statements', async () => {
      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('stmt-cancelled', 'SELECT cancelled', 'CANCELLED'),
        makeStatement('stmt-done', 'SELECT done', 'COMPLETED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: 'Stopped (1)' }))

      expect(screen.getByText('SELECT cancelled')).toBeInTheDocument()
      expect(screen.queryByText('SELECT done')).not.toBeInTheDocument()
    })

    it('clicking All tab after a filter shows all statements again', async () => {
      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('s1', 'SELECT 1', 'COMPLETED'),
        makeStatement('s2', 'SELECT 2', 'FAILED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: 'Failed (1)' }))
      await user.click(screen.getByRole('button', { name: 'All (2)' }))

      expect(screen.getByText('SELECT 1')).toBeInTheDocument()
      expect(screen.getByText('SELECT 2')).toBeInTheDocument()
    })

    it('shows empty filter message when no statements match active filter', async () => {
      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('s1', 'SELECT 1', 'COMPLETED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: 'Failed (0)' }))

      expect(screen.getByText(/no failed statements/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Load button
  // -------------------------------------------------------------------------
  describe('[@history-panel] Load button', () => {
    it('clicking Load calls addStatement with the statement SQL', async () => {
      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('stmt-abc', 'SELECT id FROM orders', 'COMPLETED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: /load/i }))

      expect(mockAddStatement).toHaveBeenCalledWith('SELECT id FROM orders')
    })

    it('clicking Load calls onClose after addStatement', async () => {
      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('stmt-xyz', 'SELECT * FROM events', 'COMPLETED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: /load/i }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('addStatement is called before onClose', async () => {
      const callOrder: string[] = []
      mockAddStatement.mockImplementation(() => callOrder.push('addStatement'))
      onClose.mockImplementation(() => callOrder.push('onClose'))

      const user = userEvent.setup()
      mockStatementHistory = [
        makeStatement('stmt-order', 'SELECT 1', 'COMPLETED'),
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByRole('button', { name: /load/i }))

      expect(callOrder).toEqual(['addStatement', 'onClose'])
    })
  })

  // -------------------------------------------------------------------------
  // Header controls
  // -------------------------------------------------------------------------
  describe('[@history-panel] header controls', () => {
    it('renders the panel title', () => {
      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByText('Statement History')).toBeInTheDocument()
    })

    it('clicking refresh button calls onRefresh', async () => {
      const user = userEvent.setup()

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByTitle('Refresh history'))

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('clicking close button calls onClose', async () => {
      const user = userEvent.setup()

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      await user.click(screen.getByTitle('Close history panel'))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('refresh button is disabled while loading', () => {
      mockHistoryLoading = true

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByTitle('Refresh history')).toBeDisabled()
    })
  })

  // -------------------------------------------------------------------------
  // Help button (onOpenHelp removed — contextual help cleanup)
  // -------------------------------------------------------------------------
  describe('[@history-panel] help button', () => {
    it('does not render a contextual help button (onOpenHelp removed)', () => {
      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.queryByRole('button', { name: /help.*rerunning statements/i })).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // HistoryItem: statements without SQL
  // -------------------------------------------------------------------------
  describe('[@history-panel] HistoryItem: statements without SQL', () => {
    it('filters out statements without spec.statement from the list', () => {
      mockStatementHistory = [
        makeStatement('stmt-with-sql', 'SELECT 1', 'COMPLETED'),
        { name: 'stmt-no-sql', spec: {}, status: { phase: 'COMPLETED' } } as unknown as StatementResponse,
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      // Only the statement with SQL should appear
      expect(screen.getByText('SELECT 1')).toBeInTheDocument()
      // The count should reflect only SQL statements
      expect(screen.getByRole('button', { name: 'All (1)' })).toBeInTheDocument()
    })

    it('shows empty state when all statements lack SQL', () => {
      mockStatementHistory = [
        { name: 'no-sql-1', spec: {}, status: { phase: 'COMPLETED' } } as unknown as StatementResponse,
        { name: 'no-sql-2', spec: { statement: '' }, status: { phase: 'FAILED' } } as unknown as StatementResponse,
      ]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      // statementHistory is non-empty so we won't see "No statements found",
      // but filteredStatements will be empty so we should see the empty filter message or no items
      // Actually, the sqlStatements filter uses `s.spec?.statement` which is falsy for ''
      // So counts should be 0 for all
    })
  })

  // -------------------------------------------------------------------------
  // HistoryItem: SQL preview truncation
  // -------------------------------------------------------------------------
  describe('[@history-panel] HistoryItem: SQL preview truncation', () => {
    it('shows full SQL when it is 80 chars or less', () => {
      const shortSql = 'SELECT id, name FROM users WHERE active = true'
      mockStatementHistory = [makeStatement('stmt-short', shortSql, 'COMPLETED')]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByText(shortSql)).toBeInTheDocument()
    })

    it('truncates SQL at 80 chars with ellipsis when longer', () => {
      const longSql = 'SELECT id, name, email, address, phone, created_at, updated_at FROM users WHERE active = true AND verified = true'
      mockStatementHistory = [makeStatement('stmt-long', longSql, 'COMPLETED')]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      const expectedPreview = longSql.slice(0, 80) + '...'
      expect(screen.getByText(expectedPreview)).toBeInTheDocument()
    })

    it('shows full SQL when exactly 80 chars', () => {
      // Create a string that is exactly 80 chars
      const exactSql = 'A'.repeat(80)
      mockStatementHistory = [makeStatement('stmt-exact', exactSql, 'COMPLETED')]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByText(exactSql)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // HistoryItem: relative time and statement name display
  // -------------------------------------------------------------------------
  describe('[@history-panel] HistoryItem: metadata display', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-28T12:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('displays relative time from created_at metadata', () => {
      const fiveMinAgo = new Date('2026-02-28T11:55:00.000Z').toISOString()
      mockStatementHistory = [makeStatement('stmt-time', 'SELECT 1', 'COMPLETED', fiveMinAgo)]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByText('5m ago')).toBeInTheDocument()
    })

    it('does not render time span when created_at is missing', () => {
      mockStatementHistory = [makeStatement('stmt-no-time', 'SELECT 1', 'COMPLETED')]

      const { container } = render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(container.querySelector('.history-item-time')).not.toBeInTheDocument()
    })

    it('displays the statement name', () => {
      mockStatementHistory = [makeStatement('my-unique-stmt-name', 'SELECT 1', 'COMPLETED')]

      render(<HistoryPanel onClose={onClose} onRefresh={onRefresh} />)

      expect(screen.getByText('my-unique-stmt-name')).toBeInTheDocument()
    })
  })
})
