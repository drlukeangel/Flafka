import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SQLStatement, Column } from '../../types'

// ---------------------------------------------------------------------------
// Store mock — controlled via module-level variables
// ---------------------------------------------------------------------------
const mockUpdateStatement = vi.fn()
const mockDeleteStatement = vi.fn()
const mockDuplicateStatement = vi.fn()
const mockToggleStatementCollapse = vi.fn()
const mockExecuteStatement = vi.fn()
const mockCancelStatement = vi.fn()
const mockAddStatement = vi.fn()
const mockDismissOnboardingHint = vi.fn()
const mockUpdateStatementLabel = vi.fn()
const mockReorderStatements = vi.fn()
const mockAddToast = vi.fn()

let mockTheme = 'light'

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      updateStatement: mockUpdateStatement,
      deleteStatement: mockDeleteStatement,
      duplicateStatement: mockDuplicateStatement,
      toggleStatementCollapse: mockToggleStatementCollapse,
      executeStatement: mockExecuteStatement,
      cancelStatement: mockCancelStatement,
      addStatement: mockAddStatement,
      reorderStatements: mockReorderStatements,
      dismissOnboardingHint: mockDismissOnboardingHint,
      updateStatementLabel: mockUpdateStatementLabel,
      addToast: mockAddToast,
      theme: mockTheme,
    }
    if (selector) return selector(state)
    return state
  },
}))

// ---------------------------------------------------------------------------
// editorRegistry mock — prevents monaco import errors; exposes named spies
// so tests can assert that register/dispose calls happen on the correct ids.
// vi.hoisted() is required because vi.mock factories are hoisted above const
// declarations, causing TDZ errors if we reference const fns directly.
// ---------------------------------------------------------------------------
const { mockRegistrySet, mockRegistryGet, mockRegistryDelete } = vi.hoisted(() => ({
  mockRegistrySet: vi.fn(),
  mockRegistryGet: vi.fn(() => null),
  mockRegistryDelete: vi.fn(),
}))

vi.mock('../../components/EditorCell/editorRegistry', () => ({
  editorRegistry: {
    set: mockRegistrySet,
    get: mockRegistryGet,
    delete: mockRegistryDelete,
  },
  getFocusedEditor: vi.fn(() => null),
  insertTextAtCursor: vi.fn(() => false),
}))

// ---------------------------------------------------------------------------
// ResultsTable mock — avoid virtualizer complexity inside EditorCell tests
// ---------------------------------------------------------------------------
vi.mock('../../components/ResultsTable/ResultsTable', () => ({
  default: ({
    data,
    columns,
  }: {
    data: Record<string, unknown>[]
    columns: Column[]
  }) => (
    <div data-testid="results-table">
      <span data-testid="results-row-count">{data.length} rows</span>
      <span data-testid="results-col-count">{columns.length} columns</span>
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// sqlFormatter mock — avoids regex-heavy side effects
// ---------------------------------------------------------------------------
vi.mock('../../utils/sqlFormatter', () => ({
  formatSQL: (sql: string) => sql,
}))

// Import component after mocks are registered
import EditorCell from '../../components/EditorCell/EditorCell'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeStatement = (overrides: Partial<SQLStatement> = {}): SQLStatement => ({
  id: 'stmt-1',
  code: 'SELECT 1',
  status: 'IDLE',
  createdAt: new Date('2026-02-28T10:00:00Z'),
  ...overrides,
})

const renderCell = (statement: SQLStatement, index = 0) =>
  render(<EditorCell statement={statement} index={index} />)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@editor-cell] EditorCell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTheme = 'light'
    // Reset registry spies between tests so assertions stay isolated
    mockRegistrySet.mockClear()
    mockRegistryGet.mockClear()
    mockRegistryDelete.mockClear()
  })

  // -------------------------------------------------------------------------
  // Rendering basics
  // -------------------------------------------------------------------------
  describe('[@editor-cell] cell number', () => {
    it('renders cell number as index + 1', () => {
      renderCell(makeStatement(), 0)
      expect(screen.getByText('#1')).toBeInTheDocument()
    })

    it('renders correct cell number for a non-zero index', () => {
      renderCell(makeStatement({ id: 'stmt-3' }), 2)
      expect(screen.getByText('#3')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Status UI states
  // -------------------------------------------------------------------------
  describe('[@editor-cell] IDLE status', () => {
    it('shows Run button when status is IDLE', () => {
      const { container } = renderCell(makeStatement({ status: 'IDLE' }))
      // Use class selector to avoid slow ARIA accessible-name traversal on first render
      expect(container.querySelector('.run-btn')).toBeInTheDocument()
      expect(container.querySelector('.run-btn')).toHaveTextContent('Run')
    })

    it('Run button is enabled when status is IDLE', () => {
      renderCell(makeStatement({ status: 'IDLE' }))
      const runBtn = screen.getByRole('button', { name: /run/i })
      expect(runBtn).not.toBeDisabled()
    })

    it('does not show the status bar when no startedAt', () => {
      renderCell(makeStatement({ status: 'IDLE', startedAt: undefined }))
      expect(screen.queryByText('START TIME:')).not.toBeInTheDocument()
    })
  })

  describe('[@editor-cell] PENDING status', () => {
    it('shows "Pending" status badge', () => {
      renderCell(makeStatement({ status: 'PENDING' }))
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('Stop button is shown and disabled when status is PENDING', () => {
      renderCell(makeStatement({ status: 'PENDING' }))
      // isRunning=true for PENDING so the button shows "Stop", not "Run", and is disabled
      const stopBtn = screen.getByRole('button', { name: /stop/i })
      expect(stopBtn).toBeDisabled()
    })
  })

  describe('[@editor-cell] RUNNING status', () => {
    it('shows Stop button instead of Run when status is RUNNING', () => {
      renderCell(makeStatement({ status: 'RUNNING' }))
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^run$/i })).not.toBeInTheDocument()
    })

    it('shows "Running" status badge', () => {
      renderCell(makeStatement({ status: 'RUNNING' }))
      expect(screen.getByText('Running')).toBeInTheDocument()
    })
  })

  describe('[@editor-cell] COMPLETED status', () => {
    it('shows "Completed" status badge', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:05Z'),
        })
      )
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('shows the status bar with START TIME label when startedAt is set', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:05Z'),
        })
      )
      expect(screen.getByText('START TIME:')).toBeInTheDocument()
    })

    it('shows FINISH TIME label when lastExecutedAt is set on COMPLETED status', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:05Z'),
        })
      )
      expect(screen.getByText('FINISH TIME:')).toBeInTheDocument()
    })

    it('shows the DURATION label when both startedAt and lastExecutedAt are set', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:05Z'),
        })
      )
      expect(screen.getByText('DURATION:')).toBeInTheDocument()
    })

    it('duration value is calculated correctly (finish - start = 5.0s)', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:05Z'),
        })
      )
      // formatDuration: (5000ms / 1000) → "5.0s"
      expect(screen.getByText('5.0s')).toBeInTheDocument()
    })
  })

  describe('[@editor-cell] ERROR status', () => {
    it('renders the error details panel when status is ERROR and error is set', () => {
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'Syntax error near SELECT',
        })
      )
      expect(screen.getByText('Error Details')).toBeInTheDocument()
    })

    it('error details panel is collapsed by default (content hidden)', () => {
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'Syntax error near SELECT',
        })
      )
      // Error message pre is only shown when expanded
      expect(screen.queryByText('Syntax error near SELECT')).not.toBeInTheDocument()
    })

    it('clicking error details header expands the panel and shows error message', async () => {
      const user = userEvent.setup()
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'Syntax error near SELECT',
        })
      )

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      expect(screen.getByText('Syntax error near SELECT')).toBeInTheDocument()
    })

    it('clicking error details header again collapses the panel', async () => {
      const user = userEvent.setup()
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'Some error message',
        })
      )

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      // Expand
      await user.click(header)
      expect(screen.getByText('Some error message')).toBeInTheDocument()

      // Collapse
      await user.click(header)
      expect(screen.queryByText('Some error message')).not.toBeInTheDocument()
    })

    it('shows "Error" status badge in cell header', () => {
      renderCell(makeStatement({ status: 'ERROR', error: 'oops' }))
      expect(screen.getByText('Error')).toBeInTheDocument()
    })

    it('Retry button is present inside the expanded error panel', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ status: 'ERROR', error: 'Table not found' }))

      // Must expand the panel to expose the retry button
      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  describe('[@editor-cell] CANCELLED status', () => {
    it('shows "Cancelled" status badge', () => {
      renderCell(makeStatement({ status: 'CANCELLED' }))
      expect(screen.getByText('Cancelled')).toBeInTheDocument()
    })

    it('shows Retry button when status is CANCELLED and no error', () => {
      renderCell(makeStatement({ status: 'CANCELLED', error: undefined }))
      // Retry button is rendered in the cancelled panel
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('shows the cancelled panel even when an error string is set (hasError is based on status=ERROR)', () => {
      // hasError = statement.status === 'ERROR', so CANCELLED with an error string
      // still shows the cancelled panel (not the error panel)
      renderCell(
        makeStatement({
          status: 'CANCELLED',
          error: 'Cancelled due to timeout',
        })
      )
      // The cancelled panel renders because status is CANCELLED (not ERROR)
      expect(screen.getByText('Statement was cancelled.')).toBeInTheDocument()
      // The error details panel does NOT render (requires status === 'ERROR')
      expect(screen.queryByText('Error Details')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Modified badge
  // -------------------------------------------------------------------------
  describe('[@editor-cell] Modified badge', () => {
    it('shows "Modified" badge when code differs from lastExecutedCode', () => {
      renderCell(
        makeStatement({
          code: 'SELECT 2',
          lastExecutedCode: 'SELECT 1',
        })
      )
      expect(screen.getByText('Modified')).toBeInTheDocument()
    })

    it('hides "Modified" badge when code matches lastExecutedCode', () => {
      renderCell(
        makeStatement({
          code: 'SELECT 1',
          lastExecutedCode: 'SELECT 1',
        })
      )
      expect(screen.queryByText('Modified')).not.toBeInTheDocument()
    })

    it('hides "Modified" badge when lastExecutedCode is null', () => {
      renderCell(
        makeStatement({
          code: 'SELECT 1',
          lastExecutedCode: null,
        })
      )
      expect(screen.queryByText('Modified')).not.toBeInTheDocument()
    })

    it('hides "Modified" badge when lastExecutedCode is undefined', () => {
      renderCell(
        makeStatement({
          code: 'SELECT 1',
          lastExecutedCode: undefined,
        })
      )
      expect(screen.queryByText('Modified')).not.toBeInTheDocument()
    })

    it('hides "Modified" badge when code and lastExecutedCode differ only by whitespace', () => {
      renderCell(
        makeStatement({
          code: '  SELECT 1  ',
          lastExecutedCode: 'SELECT 1',
        })
      )
      // trim() is applied before comparison
      expect(screen.queryByText('Modified')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Interaction: Delete flow
  // -------------------------------------------------------------------------
  describe('[@editor-cell] delete interaction', () => {
    it('first click on delete button shows Confirm Delete and Cancel buttons', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement())

      const deleteBtn = screen.getByTitle('Delete statement')
      await user.click(deleteBtn)

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('second click (on Confirm Delete) calls deleteStatement with the statement id', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-abc' }))

      // First click → show confirm
      const deleteBtn = screen.getByTitle('Delete statement')
      await user.click(deleteBtn)

      // Second click → confirm delete
      const confirmBtn = screen.getByRole('button', { name: /delete/i })
      await user.click(confirmBtn)

      expect(mockDeleteStatement).toHaveBeenCalledTimes(1)
      expect(mockDeleteStatement).toHaveBeenCalledWith('stmt-abc')
    })

    it('clicking Cancel after first delete click reverts to normal state', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement())

      // Show confirm buttons
      const deleteBtn = screen.getByTitle('Delete statement')
      await user.click(deleteBtn)

      // Cancel
      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelBtn)

      // Should be back to the normal delete icon button, no confirm buttons
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
      expect(screen.getByTitle('Delete statement')).toBeInTheDocument()
      expect(mockDeleteStatement).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Interaction: Collapse toggle
  // -------------------------------------------------------------------------
  describe('[@editor-cell] collapse toggle', () => {
    it('calls toggleStatementCollapse with statement id when collapse button clicked', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-xyz', isCollapsed: false }))

      const collapseBtn = screen.getByTitle('Collapse')
      await user.click(collapseBtn)

      expect(mockToggleStatementCollapse).toHaveBeenCalledTimes(1)
      expect(mockToggleStatementCollapse).toHaveBeenCalledWith('stmt-xyz')
    })

    it('collapse button shows Expand title when statement is collapsed', () => {
      renderCell(makeStatement({ isCollapsed: true }))
      expect(screen.getByTitle('Expand')).toBeInTheDocument()
    })

    it('collapse button shows Collapse title when statement is not collapsed', () => {
      renderCell(makeStatement({ isCollapsed: false }))
      expect(screen.getByTitle('Collapse')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Interaction: Duplicate
  // -------------------------------------------------------------------------
  describe('[@editor-cell] duplicate interaction', () => {
    it('calls duplicateStatement with statement id when duplicate button clicked', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-dup' }))

      const dupBtn = screen.getByTitle('Duplicate statement')
      await user.click(dupBtn)

      expect(mockDuplicateStatement).toHaveBeenCalledTimes(1)
      expect(mockDuplicateStatement).toHaveBeenCalledWith('stmt-dup')
    })
  })

  // -------------------------------------------------------------------------
  // Interaction: Run / Stop
  // -------------------------------------------------------------------------
  describe('[@editor-cell] run/stop interaction', () => {
    it('clicking Run calls dismissOnboardingHint and executeStatement when status is IDLE', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-run', status: 'IDLE' }))

      const runBtn = screen.getByRole('button', { name: /run/i })
      await user.click(runBtn)

      expect(mockDismissOnboardingHint).toHaveBeenCalledTimes(1)
      expect(mockExecuteStatement).toHaveBeenCalledTimes(1)
      expect(mockExecuteStatement).toHaveBeenCalledWith('stmt-run')
    })

    it('clicking Stop calls cancelStatement when status is RUNNING', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-stop', status: 'RUNNING' }))

      const stopBtn = screen.getByRole('button', { name: /stop/i })
      await user.click(stopBtn)

      expect(mockCancelStatement).toHaveBeenCalledTimes(1)
      expect(mockCancelStatement).toHaveBeenCalledWith('stmt-stop')
      expect(mockExecuteStatement).not.toHaveBeenCalled()
    })

    it('clicking Run calls executeStatement when status is COMPLETED', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-rerun', status: 'COMPLETED' }))

      const runBtn = screen.getByRole('button', { name: /run/i })
      await user.click(runBtn)

      expect(mockExecuteStatement).toHaveBeenCalledWith('stmt-rerun')
    })

    it('clicking Run calls executeStatement when status is CANCELLED', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-retry', status: 'CANCELLED' }))

      const runBtn = screen.getByRole('button', { name: /run/i })
      await user.click(runBtn)

      expect(mockExecuteStatement).toHaveBeenCalledWith('stmt-retry')
    })
  })

  // -------------------------------------------------------------------------
  // Interaction: Retry button (in CANCELLED panel)
  // -------------------------------------------------------------------------
  describe('[@editor-cell] retry button (cancelled panel)', () => {
    it('clicking Retry in cancelled panel calls executeStatement', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-cancelled', status: 'CANCELLED', error: undefined }))

      const retryBtn = screen.getByRole('button', { name: /retry/i })
      await user.click(retryBtn)

      expect(mockExecuteStatement).toHaveBeenCalledWith('stmt-cancelled')
    })
  })

  // -------------------------------------------------------------------------
  // Results rendering
  // -------------------------------------------------------------------------
  describe('[@editor-cell] results table rendering', () => {
    const testColumns: Column[] = [
      { name: 'id', type: 'INTEGER' },
      { name: 'value', type: 'STRING' },
    ]
    const testData = [
      { id: 1, value: 'alpha' },
      { id: 2, value: 'beta' },
    ]

    it('renders ResultsTable when results are present', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          results: testData,
          columns: testColumns,
        })
      )
      expect(screen.getByTestId('results-table')).toBeInTheDocument()
    })

    it('passes correct row count to ResultsTable', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          results: testData,
          columns: testColumns,
        })
      )
      expect(screen.getByTestId('results-row-count')).toHaveTextContent('2 rows')
    })

    it('passes correct column count to ResultsTable', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          results: testData,
          columns: testColumns,
        })
      )
      expect(screen.getByTestId('results-col-count')).toHaveTextContent('2 columns')
    })

    it('does not render ResultsTable when results are empty', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          results: [],
          columns: testColumns,
        })
      )
      expect(screen.queryByTestId('results-table')).not.toBeInTheDocument()
    })

    it('does not render ResultsTable when results are undefined', () => {
      renderCell(
        makeStatement({
          status: 'IDLE',
          results: undefined,
          columns: undefined,
        })
      )
      expect(screen.queryByTestId('results-table')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // CSS class states
  // -------------------------------------------------------------------------
  describe('[@editor-cell] CSS class states', () => {
    it('adds "collapsed" class when isCollapsed is true', () => {
      const { container } = renderCell(makeStatement({ isCollapsed: true }))
      expect(container.querySelector('.editor-cell')).toHaveClass('collapsed')
    })

    it('does not add "collapsed" class when isCollapsed is false', () => {
      const { container } = renderCell(makeStatement({ isCollapsed: false }))
      expect(container.querySelector('.editor-cell')).not.toHaveClass('collapsed')
    })

    it('adds "confirming" class when delete confirm is active', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement())

      const deleteBtn = screen.getByTitle('Delete statement')
      await user.click(deleteBtn)

      expect(container.querySelector('.editor-cell')).toHaveClass('confirming')
    })
  })

  // -------------------------------------------------------------------------
  // Collapsed preview
  // -------------------------------------------------------------------------
  describe('[@editor-cell] collapsed preview', () => {
    it('shows collapsed preview with SQL when collapsed and no label', () => {
      const { container } = renderCell(
        makeStatement({ code: 'SELECT * FROM users', isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview).toBeInTheDocument()
      expect(preview).toHaveTextContent('SELECT * FROM users')
    })

    it('shows label in collapsed preview when label is set', () => {
      const { container } = renderCell(
        makeStatement({ code: 'SELECT 1', isCollapsed: true, label: 'My Query' })
      )
      const labelEl = container.querySelector('.cell-collapsed-label')
      expect(labelEl).toBeInTheDocument()
      expect(labelEl).toHaveTextContent('My Query')
    })

    it('shows "(empty)" preview when code is empty and collapsed', () => {
      const { container } = renderCell(
        makeStatement({ code: '', isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview).toBeInTheDocument()
      expect(preview).toHaveTextContent('(empty)')
    })

    it('shows truncated SQL preview (60 chars max) when code is very long', () => {
      const longCode = 'SELECT id, name, email, phone, address, city, state FROM users'
      const { container } = renderCell(
        makeStatement({ code: longCode, isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      // Should truncate at 60 chars with "..."
      expect(preview?.textContent).toContain('...')
    })

    it('skips comment-only lines and shows first non-comment line in preview', () => {
      const codeWithComments = '-- This is a comment\n-- Another comment\nSELECT 1'
      const { container } = renderCell(
        makeStatement({ code: codeWithComments, isCollapsed: true })
      )
      const sqlPreview = container.querySelector('.cell-collapsed-sql')
      expect(sqlPreview).toHaveTextContent('SELECT 1')
    })

    it('shows row count in collapsed preview when results exist', () => {
      const { container } = renderCell(
        makeStatement({
          isCollapsed: true,
          results: [{ id: 1 }, { id: 2 }],
          columns: [{ name: 'id', type: 'INTEGER' }],
        })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview).toHaveTextContent('2 rows')
    })

    it('shows totalRowsReceived count when it exceeds buffer rows', () => {
      const { container } = renderCell(
        makeStatement({
          isCollapsed: true,
          results: Array.from({ length: 10 }, (_, i) => ({ id: i })),
          columns: [{ name: 'id', type: 'INTEGER' }],
          totalRowsReceived: 500,
        })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview).toHaveTextContent('500')
    })
  })

  // -------------------------------------------------------------------------
  // Label editing
  // -------------------------------------------------------------------------
  describe('[@editor-cell] label editing', () => {
    it('clicking label group enters edit mode showing input', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement({ label: 'My Query' }))

      const labelGroup = container.querySelector('.cell-label-group')!
      await user.click(labelGroup)

      const input = container.querySelector('.cell-label-input')
      expect(input).toBeInTheDocument()
    })

    it('shows label placeholder when no label is set', () => {
      const { container } = renderCell(makeStatement({ label: undefined }))
      const placeholder = container.querySelector('.cell-label-placeholder')
      expect(placeholder).toBeInTheDocument()
      expect(placeholder).toHaveTextContent('Add label...')
    })

    it('shows existing label text when label is set', () => {
      const { container } = renderCell(makeStatement({ label: 'Important Query' }))
      const labelEl = container.querySelector('.cell-label')
      expect(labelEl).toBeInTheDocument()
      expect(labelEl).toHaveTextContent('Important Query')
    })

    it('pressing Enter in label input calls updateStatementLabel and exits edit mode', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement({ id: 'stmt-label', label: 'Old Label' }))

      const labelGroup = container.querySelector('.cell-label-group')!
      await user.click(labelGroup)

      const input = container.querySelector('.cell-label-input') as HTMLInputElement
      await user.clear(input)
      await user.type(input, 'New Label')
      await user.keyboard('{Enter}')

      expect(mockUpdateStatementLabel).toHaveBeenCalledWith('stmt-label', 'New Label')
    })

    it('pressing Escape in label input cancels without saving', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement({ id: 'stmt-esc', label: 'Keep This' }))

      const labelGroup = container.querySelector('.cell-label-group')!
      await user.click(labelGroup)

      const input = container.querySelector('.cell-label-input') as HTMLInputElement
      await user.clear(input)
      await user.type(input, 'Discarded')
      await user.keyboard('{Escape}')

      // updateStatementLabel should NOT be called on escape
      expect(mockUpdateStatementLabel).not.toHaveBeenCalled()
    })

    it('input shows pre-filled value matching existing label', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement({ label: 'Pre-filled' }))

      const labelGroup = container.querySelector('.cell-label-group')!
      await user.click(labelGroup)

      const input = container.querySelector('.cell-label-input') as HTMLInputElement
      expect(input.value).toBe('Pre-filled')
    })
  })

  // -------------------------------------------------------------------------
  // Status bar edge cases
  // -------------------------------------------------------------------------
  describe('[@editor-cell] status bar edge cases', () => {
    it('does not show FINISH TIME or DURATION when status is RUNNING (no lastExecutedAt)', () => {
      renderCell(
        makeStatement({
          status: 'RUNNING',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: undefined,
        })
      )
      expect(screen.queryByText('FINISH TIME:')).not.toBeInTheDocument()
      expect(screen.queryByText('DURATION:')).not.toBeInTheDocument()
    })

    it('shows STATEMENT label in status bar when statementName is set', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:02Z'),
          statementName: 'flink-stmt-abc123',
        })
      )
      expect(screen.getByText('STATEMENT:')).toBeInTheDocument()
      expect(screen.getByText('flink-stmt-abc123')).toBeInTheDocument()
    })

    it('does not show STATEMENT label when statementName is undefined', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:02Z'),
          statementName: undefined,
        })
      )
      expect(screen.queryByText('STATEMENT:')).not.toBeInTheDocument()
    })

    it('shows FINISH TIME for ERROR status when lastExecutedAt is set', () => {
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'Table not found',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:03Z'),
        })
      )
      expect(screen.getByText('FINISH TIME:')).toBeInTheDocument()
    })

    it('shows FINISH TIME for CANCELLED status when lastExecutedAt is set', () => {
      renderCell(
        makeStatement({
          status: 'CANCELLED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:08Z'),
        })
      )
      expect(screen.getByText('FINISH TIME:')).toBeInTheDocument()
    })

    it('duration formats minutes correctly (1m 30s)', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:01:30Z'), // 90 seconds
        })
      )
      expect(screen.getByText('1m 30s')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Error panel - additional edge cases
  // -------------------------------------------------------------------------
  describe('[@editor-cell] error panel additional cases', () => {
    it('error panel shows STATEMENT field when statementName is set', async () => {
      const user = userEvent.setup()
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'Oops',
          statementName: 'flink-stmt-err',
          startedAt: new Date('2026-02-28T10:00:00Z'),
        })
      )

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      // STATEMENT label appears inside expanded error panel
      const stmtLabels = screen.getAllByText('STATEMENT:')
      expect(stmtLabels.length).toBeGreaterThanOrEqual(1)
    })

    it('error badge is clickable (status-badge-button) when status is ERROR', () => {
      const { container } = renderCell(
        makeStatement({ status: 'ERROR', error: 'Something went wrong' })
      )
      const badgeBtn = container.querySelector('.status-badge-button')
      expect(badgeBtn).toBeInTheDocument()
    })

    it('clicking error badge toggles error details panel', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(
        makeStatement({ status: 'ERROR', error: 'Click badge error' })
      )
      const badgeBtn = container.querySelector('.status-badge-button')!
      await user.click(badgeBtn)
      expect(screen.getByText('Click badge error')).toBeInTheDocument()

      // Click again to close
      await user.click(badgeBtn)
      expect(screen.queryByText('Click badge error')).not.toBeInTheDocument()
    })

    it('error panel does not render when status is ERROR but error string is empty', () => {
      // hasError = status === 'ERROR' AND statement.error is truthy
      renderCell(makeStatement({ status: 'ERROR', error: undefined }))
      expect(screen.queryByText('Error Details')).not.toBeInTheDocument()
    })

    it('Retry button in error panel calls executeStatement', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-retry-err', status: 'ERROR', error: 'fail' }))

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      const retryBtn = screen.getByRole('button', { name: /retry/i })
      await user.click(retryBtn)

      expect(mockExecuteStatement).toHaveBeenCalledWith('stmt-retry-err')
    })
  })

  // -------------------------------------------------------------------------
  // Results header - row count display
  // -------------------------------------------------------------------------
  describe('[@editor-cell] results row count display', () => {
    it('shows "N rows" count in header when results exist', () => {
      const { container } = renderCell(
        makeStatement({
          results: [{ id: 1 }, { id: 2 }, { id: 3 }],
          columns: [{ name: 'id', type: 'INTEGER' }],
        })
      )
      // Check the cell header center area for the results-count span
      const resultsCount = container.querySelector('.results-count')
      expect(resultsCount).toBeInTheDocument()
      expect(resultsCount).toHaveTextContent('3 rows')
    })

    it('shows "N of M rows" when totalRowsReceived exceeds buffer', () => {
      renderCell(
        makeStatement({
          results: Array.from({ length: 10 }, (_, i) => ({ id: i })),
          columns: [{ name: 'id', type: 'INTEGER' }],
          totalRowsReceived: 500,
        })
      )
      expect(screen.getByText('10 of 500 rows')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Add cell button
  // -------------------------------------------------------------------------
  describe('[@editor-cell] add cell button', () => {
    it('clicking "Insert cell below" calls addStatement with afterId', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-add-after' }))

      const addBtn = screen.getByTitle('Insert cell below')
      await user.click(addBtn)

      expect(mockAddStatement).toHaveBeenCalledWith(undefined, 'stmt-add-after')
    })
  })

  // -------------------------------------------------------------------------
  // Format button
  // -------------------------------------------------------------------------
  describe('[@editor-cell] format SQL button', () => {
    it('Format SQL button is disabled when code is empty', () => {
      const { container } = renderCell(makeStatement({ code: '' }))
      const formatBtn = container.querySelector('[title="Format SQL (Shift+Alt+F)"]') as HTMLButtonElement
      expect(formatBtn).toBeDisabled()
    })

    it('Format SQL button is enabled when code is non-empty', () => {
      const { container } = renderCell(makeStatement({ code: 'SELECT 1' }))
      const formatBtn = container.querySelector('[title="Format SQL (Shift+Alt+F)"]') as HTMLButtonElement
      expect(formatBtn).not.toBeDisabled()
    })
  })

  // -------------------------------------------------------------------------
  // Dark mode theme
  // -------------------------------------------------------------------------
  describe('[@editor-cell] theme prop', () => {
    it('renders without error in dark theme', () => {
      mockTheme = 'dark'
      const { container } = renderCell(makeStatement({ status: 'IDLE' }))
      expect(container.querySelector('.editor-cell')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // onOpenHelp callback
  // -------------------------------------------------------------------------
  describe('[@editor-cell] onOpenHelp callback', () => {
    it('renders help button when onOpenHelp prop is provided', () => {
      render(
        <EditorCell
          statement={makeStatement()}
          index={0}
          onOpenHelp={vi.fn()}
        />
      )
      const helpBtn = screen.getByTitle('Help: How do I autocomplete SQL?')
      expect(helpBtn).toBeInTheDocument()
    })

    it('does not render help button when onOpenHelp prop is absent', () => {
      renderCell(makeStatement())
      expect(screen.queryByTitle('Help: How do I autocomplete SQL?')).not.toBeInTheDocument()
    })

    it('clicking help button calls onOpenHelp with correct topic', async () => {
      const user = userEvent.setup()
      const onOpenHelp = vi.fn()
      render(
        <EditorCell
          statement={makeStatement()}
          index={0}
          onOpenHelp={onOpenHelp}
        />
      )
      const helpBtn = screen.getByTitle('Help: How do I autocomplete SQL?')
      await user.click(helpBtn)
      expect(onOpenHelp).toHaveBeenCalledWith('troubleshoot-autocomplete-limitation')
    })
  })

  // -------------------------------------------------------------------------
  // Drag-and-drop state classes
  // -------------------------------------------------------------------------
  describe('[@editor-cell] drag state CSS classes', () => {
    it('drag handle element is present in the header', () => {
      const { container } = renderCell(makeStatement())
      const dragHandle = container.querySelector('.drag-handle')
      expect(dragHandle).toBeInTheDocument()
    })

    it('drag handle has draggable attribute', () => {
      const { container } = renderCell(makeStatement())
      const dragHandle = container.querySelector('.drag-handle')
      expect(dragHandle).toHaveAttribute('draggable', 'true')
    })
  })

  // -------------------------------------------------------------------------
  // executionTime display
  // -------------------------------------------------------------------------
  describe('[@editor-cell] execution time display', () => {
    it('shows execution time in seconds when executionTime is set', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          executionTime: 3500, // ms
        })
      )
      expect(screen.getByText('3.50s')).toBeInTheDocument()
    })

    it('does not show execution time when executionTime is undefined', () => {
      renderCell(makeStatement({ status: 'IDLE', executionTime: undefined }))
      // No "s" suffix execution time should appear
      expect(screen.queryByText(/\d+\.\d+s/)).not.toBeInTheDocument()
    })
  })
})
