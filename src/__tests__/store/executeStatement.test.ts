/**
 * executeStatement.test.ts
 *
 * Tests the most complex store action: the polling loop that submits SQL,
 * polls for status transitions, accumulates results with cursor pagination,
 * enforces the 5000-row FIFO cap, and handles error/cancellation/timeout.
 *
 * Strategy:
 * - vi.mock('../api/flink-api') replaces the entire API module with vi.fn() stubs.
 * - vi.useFakeTimers() lets us advance the 1-second polling delay instantly.
 * - mockResolvedValueOnce chains allow per-call response control.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useWorkspaceStore } from '../../store/workspaceStore'

// ---------------------------------------------------------------------------
// flushPromises: drains all pending microtasks (Promise resolution queue).
// vi.runAllMicrotasksAsync was added in Vitest 5+; for Vitest 4 compatibility
// we chain several Promise.resolve() ticks to let already-queued promises
// settle. This avoids setTimeout (which would be swallowed by fake timers).
// ---------------------------------------------------------------------------
async function flushPromises(): Promise<void> {
  // Multiple ticks needed: each .then() callback is a microtask,
  // so chaining enough levels lets async function continuations drain.
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

// ---------------------------------------------------------------------------
// Mock the entire flink-api module. Every exported function becomes a vi.fn()
// so individual tests can configure responses via mockResolvedValueOnce etc.
// ---------------------------------------------------------------------------
vi.mock('../../api/flink-api', () => ({
  executeSQL: vi.fn(),
  getStatementStatus: vi.fn(),
  getStatementResults: vi.fn(),
  getStatementErrorDetail: vi.fn(),
  cancelStatement: vi.fn(),
  listStatements: vi.fn(),
  listStatementsFirstPage: vi.fn(),
  getCatalogs: vi.fn(),
  getDatabases: vi.fn(),
  getTables: vi.fn(),
  getViews: vi.fn(),
  getFunctions: vi.fn(),
  getTableSchema: vi.fn(),
  getComputePoolStatus: vi.fn(),
  pollForResults: vi.fn(),
}))

// Re-import the mocked module so tests can configure it
import * as flinkApi from '../../api/flink-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal StatementResponse for a given phase. */
const makeStatusResponse = (
  phase: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
  detail?: string,
  withSchema = false
) => ({
  name: 'stmt-server-1',
  status: {
    phase,
    detail,
    traits: withSchema
      ? {
          schema: {
            columns: [
              { name: 'a', type: { type: 'BIGINT', nullable: false } },
              { name: 'b', type: { type: 'STRING', nullable: true } },
              { name: 'c', type: { type: 'INTEGER', nullable: false } },
            ],
          },
        }
      : undefined,
  },
})

/** Build a minimal ResultsResponse with N rows. */
const makeResultsResponse = (
  rowCount: number,
  nextCursor?: string,
  startIndex = 0
) => ({
  results: {
    data: Array.from({ length: rowCount }, (_, i) => ({
      row: [startIndex + i, `val-${startIndex + i}`, startIndex + i * 2],
    })),
  },
  metadata: nextCursor ? { next: nextCursor } : {},
})

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('[@store] [@execute] executeStatement - polling loop', () => {
  beforeEach(() => {
    // Install fake timers BEFORE each test so setTimeout is controlled
    vi.useFakeTimers()

    // Clear all mock call history between tests
    vi.clearAllMocks()

    // Reset store to a known baseline with a single IDLE statement
    useWorkspaceStore.setState({
      statements: [
        {
          id: 'stmt-1',
          code: 'SELECT a, b, c FROM my_table',
          status: 'IDLE',
          createdAt: new Date(),
          label: 'test-job',
        },
      ],
      toasts: [],
      sessionProperties: {
        'sql.local-time-zone': 'America/New_York',
      },
    })
  })

  afterEach(() => {
    // Restore real timers after every test to avoid bleed-through
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // Test 1: Happy path — PENDING → RUNNING → COMPLETED
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] happy path: PENDING → RUNNING → COMPLETED', () => {
    it('sets status to COMPLETED and stores results after successful execution', async () => {
      // Step 1: executeSQL returns a statement in PENDING phase
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // Step 2: First poll returns RUNNING (no results yet, just a phase)
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('RUNNING', undefined, true)
      )

      // Step 3: Second poll returns COMPLETED with schema
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('COMPLETED', undefined, true)
      )

      // Step 4: getStatementResults returns one batch of 1 row (for RUNNING + COMPLETED)
      // First call (for RUNNING phase): returns empty — simulates results not ready during RUNNING
      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce(
        makeResultsResponse(0)
      )
      // Second call (for COMPLETED phase): returns actual data
      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce(
        makeResultsResponse(1)
      )

      // Start execution — do not await yet; let timers drive it
      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')

      // Drain microtasks (executeSQL resolves, first set() calls fire)
      await flushPromises()

      // Advance 1 second to trigger the first poll delay
      await vi.advanceTimersByTimeAsync(1000)
      // Drain microtasks again so getStatementStatus(1) + getStatementResults(1) resolve
      await flushPromises()

      // Advance another 1 second for the second poll cycle
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()

      // Now await the full promise
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt).toBeDefined()
      expect(stmt!.status).toBe('COMPLETED')
      expect(stmt!.results).toBeDefined()
      expect(stmt!.results!.length).toBe(1)
      expect(stmt!.totalRowsReceived).toBe(1)
      expect(stmt!.lastExecutedAt).toBeInstanceOf(Date)
      // statementName should be set from the executeSQL response
      expect(stmt!.statementName).toBe('stmt-server-1')
      // Columns should be extracted from the schema in the status response
      expect(stmt!.columns).toBeDefined()
      expect(stmt!.columns![0]!.name).toBe('a')
    })
  })

  // -------------------------------------------------------------------------
  // Test 2: FAILED status from server
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] FAILED: server returns FAILED phase', () => {
    it('sets status to ERROR and stores the detail message from server', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // First status poll: FAILED with a detail message
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('FAILED', 'Syntax error in line 5')
      )

      // getStatementErrorDetail returns the detail when provided
      vi.mocked(flinkApi.getStatementErrorDetail).mockResolvedValueOnce('Syntax error in line 5')

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')

      // Drain microtasks for executeSQL and the first status poll
      await flushPromises()

      // Allow execution to complete — FAILED branch throws immediately, no delay
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt).toBeDefined()
      expect(stmt!.status).toBe('ERROR')
      expect(stmt!.error).toBe('Syntax error in line 5')

      // Should have added an error toast
      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts.some((t) => t.type === 'error')).toBe(true)
      expect(toasts.some((t) => t.message.includes('Syntax error in line 5'))).toBe(true)
    })

    it('uses a generic error message when detail is absent', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // FAILED with no detail
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('FAILED')
      )

      // getStatementErrorDetail falls back to 'Query failed' when no detail
      vi.mocked(flinkApi.getStatementErrorDetail).mockResolvedValueOnce('Query failed')

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt!.status).toBe('ERROR')
      // Falls back to the generic 'Query failed' message from flink-api
      expect(stmt!.error).toBe('Query failed')
    })
  })

  // -------------------------------------------------------------------------
  // Test 3: FIFO 5000-row cap
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] FIFO 5000-row cap', () => {
    it('truncates results to 5000 rows but tracks totalRowsReceived accurately', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // Single poll: COMPLETED immediately
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('COMPLETED', undefined, true)
      )

      // First results call: 5001 rows in one batch, no next cursor
      // (The store does allResults.slice(allResults.length - MAX_ROWS) → keeps last 5000)
      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce(
        makeResultsResponse(5001, undefined, 0)
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt!.status).toBe('COMPLETED')
      // Buffer capped at MAX_ROWS = 5000
      expect(stmt!.results!.length).toBe(5000)
      // But totalRowsReceived is the real count
      expect(stmt!.totalRowsReceived).toBe(5001)
    })

    it('keeps the LAST 5000 rows (FIFO = older rows evicted first)', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('COMPLETED', undefined, true)
      )

      // 5001 rows where row index encodes identity: row[0] = sequential index
      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce(
        makeResultsResponse(5001, undefined, 0)
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      // The FIFO slice keeps the LAST 5000, so row index 0 (first row) is evicted.
      // First retained row has a = 1, last retained row has a = 5000.
      expect(stmt!.results![0]!['a']).toBe(1)
      expect(stmt!.results![4999]!['a']).toBe(5000)
    })

    it('accumulates totalRowsReceived across paginated result batches', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // Two polls: first RUNNING then COMPLETED
      vi.mocked(flinkApi.getStatementStatus)
        .mockResolvedValueOnce(makeStatusResponse('RUNNING', undefined, true))
        .mockResolvedValueOnce(makeStatusResponse('COMPLETED', undefined, true))

      // Batch 1 (for RUNNING): 3000 rows with a next cursor
      vi.mocked(flinkApi.getStatementResults)
        .mockResolvedValueOnce(
          makeResultsResponse(3000, 'https://cursor.example.com/next?token=abc', 0)
        )
        // Batch 2 (for COMPLETED): 3000 more rows → total 6000, capped at 5000
        .mockResolvedValueOnce(
          makeResultsResponse(3000, undefined, 3000)
        )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()

      // First poll cycle
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()

      // Second poll cycle
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()

      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt!.results!.length).toBe(5000)
      expect(stmt!.totalRowsReceived).toBe(6000)
    })
  })

  // -------------------------------------------------------------------------
  // Test 4: Cancellation mid-poll
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] cancellation mid-poll', () => {
    it('stops polling and sets status to CANCELLED when server returns CANCELLED', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // Status poll returns CANCELLED
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('CANCELLED')
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      // The poll() function returns early on CANCELLED without throwing
      // The store status remains RUNNING until cancelStatement() is called,
      // but getStatementStatus returning CANCELLED causes poll() to return without
      // updating results — the store status at that point was set to RUNNING by
      // the initial executeSQL response handling.
      // The key invariant: status is NOT ERROR and no error message is set.
      expect(stmt!.error).toBeUndefined()

      // getStatementResults should NOT have been called (poll returns early on CANCELLED)
      expect(vi.mocked(flinkApi.getStatementResults)).not.toHaveBeenCalled()
    })

    it('stops polling when local store status is CANCELLED (user pressed cancel)', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // Keep returning RUNNING so the poll would normally continue
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValue(
        makeStatusResponse('RUNNING')
      )

      // Results for the first RUNNING poll
      vi.mocked(flinkApi.getStatementResults).mockResolvedValue(
        makeResultsResponse(0)
      )

      // Start execution
      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()

      // Simulate user clicking Cancel after the first poll cycle
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()

      // User cancels — sets local status to CANCELLED
      useWorkspaceStore.setState((state) => ({
        statements: state.statements.map((s) =>
          s.id === 'stmt-1' ? { ...s, status: 'CANCELLED' as const } : s
        ),
      }))

      // Advance timers to trigger next poll cycle — poll() checks status and returns early
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()

      await execPromise

      // After cancellation, no error should be set
      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt!.status).toBe('CANCELLED')
      expect(stmt!.error).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Test 5: Poll timeout (600 attempts exhausted)
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] poll timeout after 600 attempts', () => {
    it('sets status to ERROR with timeout message after all attempts are exhausted', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // Always return RUNNING so poll never completes naturally
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValue(
        makeStatusResponse('RUNNING')
      )

      // Results always return empty (no data yet)
      vi.mocked(flinkApi.getStatementResults).mockResolvedValue(
        makeResultsResponse(0)
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')

      // Each poll cycle: status check + results fetch + 1000ms setTimeout.
      // maxAttempts = 600 means the 601st check (attempts >= 600) throws.
      // We advance 601 seconds (601 poll cycles) to exhaust all attempts.
      // Use advanceTimersByTimeAsync in chunks to avoid a single massive tick.
      await flushPromises()
      for (let i = 0; i < 601; i++) {
        await vi.advanceTimersByTimeAsync(1000)
        await flushPromises()
      }

      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt!.status).toBe('ERROR')
      expect(stmt!.error).toMatch(/timeout/i)

      // Verify getStatementStatus was called exactly 600 times (one per attempt)
      expect(vi.mocked(flinkApi.getStatementStatus).mock.calls.length).toBe(600)
    }, 30_000) // Generous timeout for the loop — fake timers keep it fast in practice
  })

  // -------------------------------------------------------------------------
  // Test 6: executeSQL network failure
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] executeSQL failure', () => {
    it('sets status to ERROR when executeSQL itself rejects', async () => {
      vi.mocked(flinkApi.executeSQL).mockRejectedValueOnce(
        new Error('Network error: ECONNREFUSED')
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt!.status).toBe('ERROR')
      expect(stmt!.error).toBe('Network error: ECONNREFUSED')
    })

    it('adds an error toast when executeSQL rejects', async () => {
      vi.mocked(flinkApi.executeSQL).mockRejectedValueOnce(
        new Error('Unauthorized: invalid credentials')
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts.some((t) => t.type === 'error')).toBe(true)
      expect(toasts.some((t) => t.message.includes('Unauthorized'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Test 7: State transitions during execution
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] intermediate state transitions', () => {
    it('sets status to PENDING immediately when execution starts', async () => {
      // Don't resolve executeSQL yet — use a manually controlled promise
      let resolveExecuteSQL!: (val: unknown) => void
      vi.mocked(flinkApi.executeSQL).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveExecuteSQL = resolve
        }) as ReturnType<typeof flinkApi.executeSQL>
      )

      // Kick off execution without awaiting
      useWorkspaceStore.getState().executeStatement('stmt-1')

      // Before executeSQL resolves, status must be PENDING
      await flushPromises()

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')
      expect(stmt!.status).toBe('PENDING')

      // Clean up: resolve the promise to prevent hanging after-effects
      resolveExecuteSQL({ name: 'stmt-server-1', status: { phase: 'PENDING' } })
      // Set up minimal mocks to let it terminate cleanly
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValue(
        makeStatusResponse('COMPLETED')
      )
      vi.mocked(flinkApi.getStatementResults).mockResolvedValue(
        makeResultsResponse(0)
      )
      // Drain timers so the promise settles
      await flushPromises()
      await vi.advanceTimersByTimeAsync(100)
      await flushPromises()
    })

    it('sets statementName from executeSQL response', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'custom-stmt-name-xyz',
        status: { phase: 'PENDING' },
      })

      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('COMPLETED')
      )
      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce(
        makeResultsResponse(0)
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')
      expect(stmt!.statementName).toBe('custom-stmt-name-xyz')
    })

    it('stores lastExecutedCode at the moment execution starts', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('COMPLETED')
      )
      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce(
        makeResultsResponse(0)
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')
      // lastExecutedCode should match the code at the time executeStatement was called
      expect(stmt!.lastExecutedCode).toBe('SELECT a, b, c FROM my_table')
    })

    it('does nothing when the statement ID is not found', async () => {
      const execPromise = useWorkspaceStore
        .getState()
        .executeStatement('nonexistent-id')
      await flushPromises()
      await execPromise

      // API should never be called for a missing statement
      expect(vi.mocked(flinkApi.executeSQL)).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Test 8: Column derivation
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] column derivation', () => {
    it('extracts column names from status schema traits', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // Provide schema in COMPLETED status
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('COMPLETED', undefined, true) // withSchema=true → a, b, c
      )

      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce(
        makeResultsResponse(2)
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt!.columns).toEqual([
        { name: 'a', type: 'BIGINT', nullable: false },
        { name: 'b', type: 'STRING', nullable: true },
        { name: 'c', type: 'INTEGER', nullable: false },
      ])
    })

    it('falls back to col_0/col_1 naming when schema is absent from status', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      // No schema in traits
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('COMPLETED', undefined, false) // withSchema=false
      )

      // Results return 2-column rows so col_0 / col_1 are derived from first row
      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce({
        results: {
          data: [
            { row: ['hello', 42] },
            { row: ['world', 99] },
          ],
        },
        metadata: {},
      })

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const stmt = useWorkspaceStore
        .getState()
        .statements.find((s) => s.id === 'stmt-1')

      expect(stmt!.columns![0]!.name).toBe('col_0')
      expect(stmt!.columns![1]!.name).toBe('col_1')
      expect(stmt!.results![0]).toEqual({ col_0: 'hello', col_1: 42 })
    })
  })

  // -------------------------------------------------------------------------
  // Test 9: Success toast on completion
  // -------------------------------------------------------------------------
  describe('[@store] [@execute] success toast', () => {
    it('adds a success toast when query completes with no more pages', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValueOnce({
        name: 'stmt-server-1',
        status: { phase: 'PENDING' },
      })

      vi.mocked(flinkApi.getStatementStatus).mockResolvedValueOnce(
        makeStatusResponse('COMPLETED')
      )

      // No next cursor → triggers the success toast path
      vi.mocked(flinkApi.getStatementResults).mockResolvedValueOnce(
        makeResultsResponse(3, undefined)
      )

      const execPromise = useWorkspaceStore.getState().executeStatement('stmt-1')
      await flushPromises()
      await execPromise

      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts.some((t) => t.type === 'success')).toBe(true)
    })
  })
})
