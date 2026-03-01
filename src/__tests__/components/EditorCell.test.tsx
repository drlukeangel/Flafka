import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

// Shared ref for statements used in getState() — accessible from both mock and tests
const mockStatementsRef: { current: SQLStatement[] } = { current: [] }

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (state: unknown) => unknown) => {
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
    {
      getState: () => ({
        statements: mockStatementsRef.current,
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
        treeNodes: [],
        selectedTableSchema: [],
        focusedStatementId: null,
        setFocusedStatementId: vi.fn(),
      }),
    }
  ),
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
const mockFormatSQL = vi.fn((sql: string) => sql)
vi.mock('../../utils/sqlFormatter', () => ({
  formatSQL: (sql: string) => mockFormatSQL(sql),
}))

// ---------------------------------------------------------------------------
// Monaco Editor mock — renders a textarea AND calls onMount with a fake editor
// so that handleEditorMount code paths are exercised for coverage.
// ---------------------------------------------------------------------------
const mockEditorActions: Record<string, () => void> = {}
const mockEditorDisposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = []
const mockEditorInstance = {
  getValue: vi.fn(() => 'SELECT 1'),
  getContentHeight: vi.fn(() => 100),
  getModel: vi.fn(() => ({
    getFullModelRange: vi.fn(() => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 })),
    getWordUntilPosition: vi.fn(() => ({ word: '', startColumn: 1, endColumn: 1 })),
  })),
  executeEdits: vi.fn(),
  pushUndoStop: vi.fn(),
  addAction: vi.fn((action: { id: string; run: () => void }) => {
    mockEditorActions[action.id] = action.run
  }),
  onDidContentSizeChange: vi.fn(() => {
    const d = { dispose: vi.fn() }
    mockEditorDisposables.push(d)
    return d
  }),
  onDidDispose: vi.fn((cb: () => void) => {
    // Store the callback but don't invoke it
  }),
  onDidFocusEditorText: vi.fn(),
  onDidBlurEditorText: vi.fn(),
  focus: vi.fn(),
}

const mockMonacoInstance = {
  KeyMod: { CtrlCmd: 2048, Alt: 512, Shift: 1024 },
  KeyCode: { Enter: 3, Escape: 9, DownArrow: 18, UpArrow: 16, KeyF: 36 },
  languages: {
    CompletionItemKind: { Keyword: 17, Class: 5, Interface: 7, Field: 3 },
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  editor: { ITextModel: {} },
}

let capturedOnMount: ((editor: typeof mockEditorInstance, monaco: typeof mockMonacoInstance) => void) | null = null

vi.mock('@monaco-editor/react', () => ({
  default: (props: {
    value?: string
    onChange?: (value: string) => void
    onMount?: (editor: typeof mockEditorInstance, monaco: typeof mockMonacoInstance) => void
    height?: string
    theme?: string
    options?: Record<string, unknown>
    defaultLanguage?: string
  }) => {
    // Capture onMount so tests can trigger it
    if (props.onMount) {
      capturedOnMount = props.onMount
    }
    return (
      <textarea
        data-testid="monaco-editor"
        value={props.value ?? ''}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange?.(e.target.value)}
        style={{ height: props.height || '200px' }}
      />
    )
  },
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
    mockStatementsRef.current = []
    capturedOnMount = null
    // Reset registry spies between tests so assertions stay isolated
    mockRegistrySet.mockClear()
    mockRegistryGet.mockClear()
    mockRegistryDelete.mockClear()
    mockEditorInstance.getValue.mockReturnValue('SELECT 1')
    mockFormatSQL.mockImplementation((sql: string) => sql)
    // Clear stored action references
    Object.keys(mockEditorActions).forEach(k => delete mockEditorActions[k])
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

    it('error panel expands and shows error message when error status is set', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ status: 'ERROR', error: 'Table not found' }))

      // Panel starts collapsed
      expect(screen.queryByText('Table not found')).not.toBeInTheDocument()

      // Click to expand
      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      // Now error message is visible
      expect(screen.getByText('Table not found')).toBeInTheDocument()
    })
  })

  describe('[@editor-cell] CANCELLED status', () => {
    it('shows "Cancelled" status badge', () => {
      renderCell(makeStatement({ status: 'CANCELLED' }))
      expect(screen.getByText('Cancelled')).toBeInTheDocument()
    })

    it('shows cancelled message when status is CANCELLED and no error', () => {
      renderCell(makeStatement({ status: 'CANCELLED', error: undefined }))
      // Cancelled message is shown in the panel
      expect(screen.getByText('Statement was cancelled.')).toBeInTheDocument()
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
  // Interaction: Run button handles retry
  // -------------------------------------------------------------------------
  describe('[@editor-cell] run button retry (CANCELLED state)', () => {
    it('clicking Run button on CANCELLED statement calls executeStatement to retry', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-cancelled', status: 'CANCELLED', error: undefined }))

      const runBtn = screen.getByRole('button', { name: /run/i })
      await user.click(runBtn)

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

    it('clicking Run button on ERROR statement calls executeStatement to retry', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-retry-err', status: 'ERROR', error: 'fail' }))

      const runBtn = screen.getByRole('button', { name: /run/i })
      await user.click(runBtn)

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

  // -------------------------------------------------------------------------
  // formatDuration edge cases
  // -------------------------------------------------------------------------
  describe('[@editor-cell] formatDuration edge cases', () => {
    it('shows sub-second duration correctly (0.5s)', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00.000Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:00.500Z'),
        })
      )
      expect(screen.getByText('0.5s')).toBeInTheDocument()
    })

    it('shows zero duration as 0.0s when start equals finish', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:00Z'),
        })
      )
      expect(screen.getByText('0.0s')).toBeInTheDocument()
    })

    it('shows exactly 60 seconds as 1m 0s', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:01:00Z'),
        })
      )
      expect(screen.getByText('1m 0s')).toBeInTheDocument()
    })

    it('shows multi-minute duration correctly (5m 15s)', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:05:15Z'),
        })
      )
      expect(screen.getByText('5m 15s')).toBeInTheDocument()
    })

    it('does not show duration when only startedAt is set (no lastExecutedAt)', () => {
      renderCell(
        makeStatement({
          status: 'RUNNING',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: undefined,
        })
      )
      expect(screen.queryByText('DURATION:')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // getPreviewLine edge cases
  // -------------------------------------------------------------------------
  describe('[@editor-cell] getPreviewLine edge cases', () => {
    it('shows first non-empty line when code has leading blank lines', () => {
      const { container } = renderCell(
        makeStatement({ code: '\n\n  SELECT 42', isCollapsed: true })
      )
      const sqlPreview = container.querySelector('.cell-collapsed-sql')
      expect(sqlPreview).toHaveTextContent('SELECT 42')
    })

    it('shows (empty) when code is only whitespace', () => {
      const { container } = renderCell(
        makeStatement({ code: '   \n  \n  ', isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview).toHaveTextContent('(empty)')
    })

    it('falls back to first comment line content when all lines are comments', () => {
      const { container } = renderCell(
        makeStatement({ code: '-- only comments\n-- more comments', isCollapsed: true })
      )
      const sqlPreview = container.querySelector('.cell-collapsed-sql')
      // getPreviewLine falls through the loop and returns code.trim().slice(0,60)
      expect(sqlPreview).toHaveTextContent('-- only comments')
    })

    it('shows exactly 60 chars with ellipsis for long single line', () => {
      const longLine = 'A'.repeat(80)
      const { container } = renderCell(
        makeStatement({ code: longLine, isCollapsed: true })
      )
      const sqlPreview = container.querySelector('.cell-collapsed-sql')
      expect(sqlPreview?.textContent).toBe('A'.repeat(60) + '...')
    })
  })

  // -------------------------------------------------------------------------
  // Collapsed preview - status badge rendering
  // -------------------------------------------------------------------------
  describe('[@editor-cell] collapsed preview status badges', () => {
    it('shows Completed badge in collapsed preview', () => {
      const { container } = renderCell(
        makeStatement({
          status: 'COMPLETED',
          isCollapsed: true,
          startedAt: new Date(),
          lastExecutedAt: new Date(),
        })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview).toBeInTheDocument()
      expect(preview?.querySelector('.status-badge.completed')).toBeInTheDocument()
    })

    it('shows Running badge in collapsed preview', () => {
      const { container } = renderCell(
        makeStatement({ status: 'RUNNING', isCollapsed: true, startedAt: new Date() })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview?.querySelector('.status-badge.running')).toBeInTheDocument()
    })

    it('shows Error badge in collapsed preview', () => {
      const { container } = renderCell(
        makeStatement({ status: 'ERROR', error: 'fail', isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview?.querySelector('.status-badge.error')).toBeInTheDocument()
    })

    it('shows Cancelled badge in collapsed preview', () => {
      const { container } = renderCell(
        makeStatement({ status: 'CANCELLED', isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview?.querySelector('.status-badge.cancelled')).toBeInTheDocument()
    })

    it('shows Pending badge in collapsed preview', () => {
      const { container } = renderCell(
        makeStatement({ status: 'PENDING', isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview?.querySelector('.status-badge.pending')).toBeInTheDocument()
    })

    it('does not show status badge in collapsed preview when IDLE', () => {
      const { container } = renderCell(
        makeStatement({ status: 'IDLE', isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      expect(preview?.querySelector('.status-badge')).not.toBeInTheDocument()
    })

    it('collapsed preview does not show error badge as clickable button', () => {
      const { container } = renderCell(
        makeStatement({ status: 'ERROR', error: 'fail', isCollapsed: true })
      )
      const preview = container.querySelector('.cell-collapsed-preview')
      // getStatusBadge(false) is used in collapsed preview, so no .status-badge-button
      expect(preview?.querySelector('.status-badge-button')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Collapsed preview - row count with totalRowsReceived
  // -------------------------------------------------------------------------
  describe('[@editor-cell] collapsed preview row counts', () => {
    it('shows results length when totalRowsReceived is not set', () => {
      const { container } = renderCell(
        makeStatement({
          isCollapsed: true,
          results: [{ a: 1 }, { a: 2 }, { a: 3 }],
          columns: [{ name: 'a', type: 'INT' }],
        })
      )
      const rows = container.querySelector('.cell-collapsed-rows')
      expect(rows).toHaveTextContent('3 rows')
    })

    it('shows totalRowsReceived when it exceeds results length', () => {
      const { container } = renderCell(
        makeStatement({
          isCollapsed: true,
          results: [{ a: 1 }],
          columns: [{ name: 'a', type: 'INT' }],
          totalRowsReceived: 1000,
        })
      )
      const rows = container.querySelector('.cell-collapsed-rows')
      expect(rows).toHaveTextContent('1,000')
    })

    it('shows results length when totalRowsReceived equals results length', () => {
      const { container } = renderCell(
        makeStatement({
          isCollapsed: true,
          results: [{ a: 1 }, { a: 2 }],
          columns: [{ name: 'a', type: 'INT' }],
          totalRowsReceived: 2,
        })
      )
      const rows = container.querySelector('.cell-collapsed-rows')
      expect(rows).toHaveTextContent('2 rows')
    })

    it('does not show row count in collapsed preview when no results', () => {
      const { container } = renderCell(
        makeStatement({ isCollapsed: true, results: undefined })
      )
      expect(container.querySelector('.cell-collapsed-rows')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Drag and drop interactions
  // -------------------------------------------------------------------------
  describe('[@editor-cell] drag and drop', () => {
    it('adds "dragging" class when drag starts on handle', () => {
      const { container } = renderCell(makeStatement(), 0)
      const dragHandle = container.querySelector('.drag-handle')!

      fireEvent.dragStart(dragHandle, {
        dataTransfer: { setData: vi.fn(), effectAllowed: '' },
      })

      expect(container.querySelector('.editor-cell')).toHaveClass('dragging')
    })

    it('removes "dragging" class when drag ends', () => {
      const { container } = renderCell(makeStatement(), 0)
      const dragHandle = container.querySelector('.drag-handle')!

      fireEvent.dragStart(dragHandle, {
        dataTransfer: { setData: vi.fn(), effectAllowed: '' },
      })
      fireEvent.dragEnd(dragHandle)

      expect(container.querySelector('.editor-cell')).not.toHaveClass('dragging')
    })

    it('applies a drag-over class when dragging over cell', () => {
      const { container } = renderCell(makeStatement(), 1)
      const cell = container.querySelector('.editor-cell')!

      // In jsdom, getBoundingClientRect returns all zeros so midY=0.
      // Dragging over will set either drag-over-top or drag-over-bottom.
      fireEvent.dragOver(cell, {
        dataTransfer: { dropEffect: '' },
      })

      // Verify that one of the drag-over classes is applied
      const hasDragOverClass =
        cell.classList.contains('drag-over-top') || cell.classList.contains('drag-over-bottom')
      expect(hasDragOverClass).toBe(true)
    })

    it('adds drag-over-bottom class when dragging over bottom half of cell', () => {
      const { container } = renderCell(makeStatement(), 1)
      const cell = container.querySelector('.editor-cell')!

      const rect = cell.getBoundingClientRect()

      fireEvent.dragOver(cell, {
        clientY: rect.top + rect.height + 100,
        dataTransfer: { dropEffect: '' },
      })

      expect(cell).toHaveClass('drag-over-bottom')
    })

    it('calls reorderStatements on drop', () => {
      const { container } = renderCell(makeStatement(), 2)
      const cell = container.querySelector('.editor-cell')!

      fireEvent.drop(cell, {
        dataTransfer: { getData: () => '0' },
      })

      expect(mockReorderStatements).toHaveBeenCalled()
    })

    it('clears dragOver state on drag leave when leaving the cell', () => {
      const { container } = renderCell(makeStatement(), 1)
      const cell = container.querySelector('.editor-cell')!

      // First set dragOver
      fireEvent.dragOver(cell, {
        clientY: 0,
        dataTransfer: { dropEffect: '' },
      })

      // Now dragleave with relatedTarget outside the cell
      fireEvent.dragLeave(cell, {
        relatedTarget: document.body,
      })

      expect(cell).not.toHaveClass('drag-over-top')
      expect(cell).not.toHaveClass('drag-over-bottom')
    })

    it('does not reorder when drop data is not a number', () => {
      const { container } = renderCell(makeStatement(), 0)
      const cell = container.querySelector('.editor-cell')!

      fireEvent.drop(cell, {
        dataTransfer: { getData: () => 'not-a-number' },
      })

      expect(mockReorderStatements).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Label blur behavior
  // -------------------------------------------------------------------------
  describe('[@editor-cell] label blur saves', () => {
    it('blurring label input saves the label (handleLabelBlur)', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement({ id: 'stmt-blur', label: 'Original' }))

      const labelGroup = container.querySelector('.cell-label-group')!
      await user.click(labelGroup)

      const input = container.querySelector('.cell-label-input') as HTMLInputElement
      await user.clear(input)
      await user.type(input, 'Blurred Label')

      // Blur by clicking elsewhere
      await user.click(container.querySelector('.cell-number')!)

      expect(mockUpdateStatementLabel).toHaveBeenCalledWith('stmt-blur', 'Blurred Label')
    })

    it('blur after Escape does NOT save label (labelCancelledRef prevents it)', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement({ id: 'stmt-esc-blur', label: 'Keep' }))

      const labelGroup = container.querySelector('.cell-label-group')!
      await user.click(labelGroup)

      const input = container.querySelector('.cell-label-input') as HTMLInputElement
      await user.clear(input)
      await user.type(input, 'Should Not Save')
      await user.keyboard('{Escape}')

      // Escape sets labelCancelledRef=true and exits edit mode.
      // The blur handler checks labelCancelledRef and skips save.
      expect(mockUpdateStatementLabel).not.toHaveBeenCalled()
    })

    it('blurring with empty string saves empty label', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement({ id: 'stmt-empty', label: 'Has Label' }))

      const labelGroup = container.querySelector('.cell-label-group')!
      await user.click(labelGroup)

      const input = container.querySelector('.cell-label-input') as HTMLInputElement
      await user.clear(input)

      // Blur by clicking elsewhere
      await user.click(container.querySelector('.cell-number')!)

      expect(mockUpdateStatementLabel).toHaveBeenCalledWith('stmt-empty', '')
    })
  })

  // -------------------------------------------------------------------------
  // Error panel expanded content
  // -------------------------------------------------------------------------
  describe('[@editor-cell] error panel expanded fields', () => {
    it('shows STARTED AT field in expanded error panel when startedAt is set', async () => {
      const user = userEvent.setup()
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'Something failed',
          startedAt: new Date('2026-02-28T10:00:00Z'),
        })
      )

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      expect(screen.getByText('STARTED AT:')).toBeInTheDocument()
    })

    it('does not show STARTED AT field in error panel when startedAt is undefined', async () => {
      const user = userEvent.setup()
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'fail',
          startedAt: undefined,
        })
      )

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      expect(screen.queryByText('STARTED AT:')).not.toBeInTheDocument()
    })

    it('does not show STATEMENT in error panel when statementName is undefined', async () => {
      const user = userEvent.setup()
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'fail',
          statementName: undefined,
        })
      )

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      // Only the status bar might show STATEMENT, but the error panel should not
      expect(screen.queryByText('STATEMENT:')).not.toBeInTheDocument()
    })

    it('shows error message text in pre element when expanded', async () => {
      const user = userEvent.setup()
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'Detailed error: table "users" not found in catalog "default"',
        })
      )

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      const pre = screen.getByText('Detailed error: table "users" not found in catalog "default"')
      expect(pre.tagName).toBe('PRE')
    })

    it('shows collapse arrow ▼ when error panel is collapsed', () => {
      renderCell(makeStatement({ status: 'ERROR', error: 'fail' }))
      expect(screen.getByText('▼')).toBeInTheDocument()
    })

    it('shows expand arrow ▲ when error panel is expanded', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ status: 'ERROR', error: 'fail' }))

      const header = screen.getByText('Error Details').closest('.error-details-header')!
      await user.click(header)

      expect(screen.getByText('▲')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Status bar - STATUS field always present
  // -------------------------------------------------------------------------
  describe('[@editor-cell] status bar STATUS field', () => {
    it('shows STATUS label in status bar for RUNNING status', () => {
      renderCell(
        makeStatement({
          status: 'RUNNING',
          startedAt: new Date('2026-02-28T10:00:00Z'),
        })
      )
      expect(screen.getByText('STATUS:')).toBeInTheDocument()
      expect(screen.getByText('RUNNING')).toBeInTheDocument()
    })

    it('shows STATUS label in status bar for COMPLETED status', () => {
      renderCell(
        makeStatement({
          status: 'COMPLETED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:05Z'),
        })
      )
      expect(screen.getByText('STATUS:')).toBeInTheDocument()
      expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    })

    it('shows STATUS label in status bar for ERROR status', () => {
      renderCell(
        makeStatement({
          status: 'ERROR',
          error: 'fail',
          startedAt: new Date('2026-02-28T10:00:00Z'),
        })
      )
      expect(screen.getByText('STATUS:')).toBeInTheDocument()
      expect(screen.getByText('ERROR')).toBeInTheDocument()
    })

    it('shows STATUS label in status bar for CANCELLED status', () => {
      renderCell(
        makeStatement({
          status: 'CANCELLED',
          startedAt: new Date('2026-02-28T10:00:00Z'),
          lastExecutedAt: new Date('2026-02-28T10:00:03Z'),
        })
      )
      expect(screen.getByText('STATUS:')).toBeInTheDocument()
      expect(screen.getByText('CANCELLED')).toBeInTheDocument()
    })

    it('does not show status bar when startedAt is undefined', () => {
      renderCell(makeStatement({ status: 'RUNNING', startedAt: undefined }))
      expect(screen.queryByText('STATUS:')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Cancelled panel rendering
  // -------------------------------------------------------------------------
  describe('[@editor-cell] cancelled panel details', () => {
    it('cancelled panel shows "Statement was cancelled." message', () => {
      renderCell(makeStatement({ status: 'CANCELLED' }))
      expect(screen.getByText('Statement was cancelled.')).toBeInTheDocument()
    })

    it('cancelled panel shows correct message text', () => {
      renderCell(makeStatement({ status: 'CANCELLED' }))
      expect(screen.getByText('Statement was cancelled.')).toBeInTheDocument()
    })

    it('cancelled panel does not show when status is ERROR', () => {
      renderCell(makeStatement({ status: 'ERROR', error: 'some error' }))
      expect(screen.queryByText('Statement was cancelled.')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Results table with ResultsTable props
  // -------------------------------------------------------------------------
  describe('[@editor-cell] results table props', () => {
    it('does not render results section when results is null-like', () => {
      renderCell(makeStatement({ results: undefined, columns: undefined }))
      expect(screen.queryByTestId('results-table')).not.toBeInTheDocument()
    })

    it('renders results table inside .cell-results wrapper', () => {
      const { container } = renderCell(
        makeStatement({
          status: 'COMPLETED',
          results: [{ id: 1 }],
          columns: [{ name: 'id', type: 'INT' }],
        })
      )
      const cellResults = container.querySelector('.cell-results')
      expect(cellResults).toBeInTheDocument()
      expect(cellResults?.querySelector('[data-testid="results-table"]')).toBeInTheDocument()
    })

    it('renders results for RUNNING status (streaming scenario)', () => {
      renderCell(
        makeStatement({
          status: 'RUNNING',
          results: [{ id: 1 }, { id: 2 }],
          columns: [{ name: 'id', type: 'INT' }],
        })
      )
      expect(screen.getByTestId('results-table')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Cell content wrapper collapsed class
  // -------------------------------------------------------------------------
  describe('[@editor-cell] cell content wrapper', () => {
    it('cell-content-wrapper has collapsed class when isCollapsed', () => {
      const { container } = renderCell(makeStatement({ isCollapsed: true }))
      const wrapper = container.querySelector('.cell-content-wrapper')
      expect(wrapper).toHaveClass('collapsed')
    })

    it('cell-content-wrapper does not have collapsed class when expanded', () => {
      const { container } = renderCell(makeStatement({ isCollapsed: false }))
      const wrapper = container.querySelector('.cell-content-wrapper')
      expect(wrapper).not.toHaveClass('collapsed')
    })
  })

  // -------------------------------------------------------------------------
  // Header center - results count with totalRowsReceived
  // -------------------------------------------------------------------------
  describe('[@editor-cell] header results count edge cases', () => {
    it('shows simple row count when totalRowsReceived is undefined', () => {
      const { container } = renderCell(
        makeStatement({
          results: [{ a: 1 }],
          columns: [{ name: 'a', type: 'INT' }],
        })
      )
      const count = container.querySelector('.results-count')
      expect(count).toHaveTextContent('1 rows')
    })

    it('does not show results-count when no results', () => {
      const { container } = renderCell(makeStatement({ results: undefined }))
      expect(container.querySelector('.results-count')).not.toBeInTheDocument()
    })

    it('shows "N of M rows" format when totalRowsReceived > results.length', () => {
      renderCell(
        makeStatement({
          results: Array.from({ length: 5 }, (_, i) => ({ id: i })),
          columns: [{ name: 'id', type: 'INT' }],
          totalRowsReceived: 2500,
        })
      )
      expect(screen.getByText('5 of 2,500 rows')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Error details auto-close on status change
  // -------------------------------------------------------------------------
  describe('[@editor-cell] error details auto-close', () => {
    it('error panel is hidden by default (showErrorDetails starts false)', () => {
      renderCell(makeStatement({ status: 'ERROR', error: 'fail' }))
      // The error panel header is visible but content is not
      expect(screen.getByText('Error Details')).toBeInTheDocument()
      expect(screen.queryByText('fail')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Cell header confirming-delete class
  // -------------------------------------------------------------------------
  describe('[@editor-cell] header confirming-delete class', () => {
    it('cell-header has confirming-delete class when delete confirm is active', async () => {
      const user = userEvent.setup()
      const { container } = renderCell(makeStatement())

      const deleteBtn = screen.getByTitle('Delete statement')
      await user.click(deleteBtn)

      const header = container.querySelector('.cell-header')
      expect(header).toHaveClass('confirming-delete')
    })

    it('cell-header does not have confirming-delete class normally', () => {
      const { container } = renderCell(makeStatement())
      const header = container.querySelector('.cell-header')
      expect(header).not.toHaveClass('confirming-delete')
    })
  })

  // -------------------------------------------------------------------------
  // handleEditorMount — triggers onMount to cover editor setup code
  // -------------------------------------------------------------------------
  describe('[@editor-cell] handleEditorMount', () => {
    const triggerMount = () => {
      if (capturedOnMount) {
        capturedOnMount(mockEditorInstance as never, mockMonacoInstance as never)
      }
    }

    it('registers editor actions on mount (run, cancel, format, navigate)', () => {
      renderCell(makeStatement({ id: 'stmt-mount' }))
      triggerMount()

      expect(mockEditorInstance.addAction).toHaveBeenCalled()
      const actionIds = mockEditorInstance.addAction.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id)
      expect(actionIds).toContain('run-statement')
      expect(actionIds).toContain('cancel-statement')
      expect(actionIds).toContain('navigate-next-cell')
      expect(actionIds).toContain('navigate-prev-cell')
    })

    it('registers completion provider on mount', () => {
      renderCell(makeStatement({ id: 'stmt-mount-comp' }))
      triggerMount()

      expect(mockMonacoInstance.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
        'sql',
        expect.any(Object)
      )
    })

    it('registers editor in editorRegistry on mount', () => {
      renderCell(makeStatement({ id: 'stmt-reg' }))
      triggerMount()

      expect(mockRegistrySet).toHaveBeenCalledWith('stmt-reg', mockEditorInstance)
    })

    it('sets up content size change listener on mount', () => {
      renderCell(makeStatement())
      triggerMount()

      expect(mockEditorInstance.onDidContentSizeChange).toHaveBeenCalled()
    })

    it('sets up focus tracking on mount', () => {
      renderCell(makeStatement())
      triggerMount()

      expect(mockEditorInstance.onDidFocusEditorText).toHaveBeenCalled()
      expect(mockEditorInstance.onDidBlurEditorText).toHaveBeenCalled()
    })

    it('sets up dispose handler on mount', () => {
      renderCell(makeStatement())
      triggerMount()

      expect(mockEditorInstance.onDidDispose).toHaveBeenCalled()
    })

    it('registers sql-formatter action with correct id', () => {
      renderCell(makeStatement({ id: 'stmt-fmt-action' }))
      triggerMount()

      const actionIds = mockEditorInstance.addAction.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id)
      expect(actionIds).toContain('sql-formatter-stmt-fmt-action')
    })
  })

  // -------------------------------------------------------------------------
  // Editor action callbacks — invoke the run() functions stored via addAction
  // -------------------------------------------------------------------------
  describe('[@editor-cell] editor action callbacks', () => {
    const triggerMount = () => {
      if (capturedOnMount) {
        capturedOnMount(mockEditorInstance as never, mockMonacoInstance as never)
      }
    }

    const getAction = (id: string) => {
      const call = mockEditorInstance.addAction.mock.calls.find(
        (c: unknown[]) => (c[0] as { id: string }).id === id
      )
      return call ? (call[0] as { run: (ed?: unknown) => void }) : null
    }

    it('run-statement action calls executeStatement when statement is IDLE', () => {
      const stmt = makeStatement({ id: 'stmt-action-run', status: 'IDLE' })
      mockStatementsRef.current = [stmt]
      renderCell(stmt)
      triggerMount()

      const action = getAction('run-statement')
      action?.run()

      expect(mockDismissOnboardingHint).toHaveBeenCalled()
      expect(mockExecuteStatement).toHaveBeenCalledWith('stmt-action-run')
    })

    it('run-statement action does NOT execute when statement is RUNNING', () => {
      const stmt = makeStatement({ id: 'stmt-action-run2', status: 'RUNNING' })
      mockStatementsRef.current = [stmt]
      renderCell(stmt)
      triggerMount()

      const action = getAction('run-statement')
      action?.run()

      expect(mockExecuteStatement).not.toHaveBeenCalled()
    })

    it('cancel-statement action calls cancelStatement when RUNNING', () => {
      const stmt = makeStatement({ id: 'stmt-action-cancel', status: 'RUNNING' })
      mockStatementsRef.current = [stmt]
      renderCell(stmt)
      triggerMount()

      const action = getAction('cancel-statement')
      action?.run()

      expect(mockCancelStatement).toHaveBeenCalledWith('stmt-action-cancel')
    })

    it('cancel-statement action does nothing when IDLE', () => {
      const stmt = makeStatement({ id: 'stmt-action-cancel2', status: 'IDLE' })
      mockStatementsRef.current = [stmt]
      renderCell(stmt)
      triggerMount()

      const action = getAction('cancel-statement')
      action?.run()

      expect(mockCancelStatement).not.toHaveBeenCalled()
    })

    it('navigate-next-cell action focuses next editor', () => {
      const mockNextEditor = { focus: vi.fn() }
      mockRegistryGet.mockReturnValue(mockNextEditor)

      const stmt1 = makeStatement({ id: 'stmt-nav-1', status: 'IDLE' })
      const stmt2 = makeStatement({ id: 'stmt-nav-2', status: 'IDLE' })
      mockStatementsRef.current = [stmt1, stmt2]
      renderCell(stmt1, 0)
      triggerMount()

      const action = getAction('navigate-next-cell')
      action?.run()

      expect(mockRegistryGet).toHaveBeenCalledWith('stmt-nav-2')
      expect(mockNextEditor.focus).toHaveBeenCalled()
    })

    it('navigate-next-cell action does nothing at last cell', () => {
      const stmt1 = makeStatement({ id: 'stmt-nav-last', status: 'IDLE' })
      mockStatementsRef.current = [stmt1]
      renderCell(stmt1, 0)
      triggerMount()

      const action = getAction('navigate-next-cell')
      action?.run()

      expect(mockRegistryGet).not.toHaveBeenCalledWith(expect.any(String))
    })

    it('navigate-prev-cell action focuses previous editor', () => {
      const mockPrevEditor = { focus: vi.fn() }
      mockRegistryGet.mockReturnValue(mockPrevEditor)

      const stmt1 = makeStatement({ id: 'stmt-prev-1', status: 'IDLE' })
      const stmt2 = makeStatement({ id: 'stmt-prev-2', status: 'IDLE' })
      mockStatementsRef.current = [stmt1, stmt2]
      renderCell(stmt2, 1)
      triggerMount()

      const action = getAction('navigate-prev-cell')
      action?.run()

      expect(mockRegistryGet).toHaveBeenCalledWith('stmt-prev-1')
      expect(mockPrevEditor.focus).toHaveBeenCalled()
    })

    it('navigate-prev-cell action does nothing at first cell', () => {
      const stmt1 = makeStatement({ id: 'stmt-prev-first', status: 'IDLE' })
      mockStatementsRef.current = [stmt1]
      renderCell(stmt1, 0)
      triggerMount()

      const action = getAction('navigate-prev-cell')
      action?.run()

      // No editor get call since we're at index 0
      expect(mockRegistryGet).not.toHaveBeenCalledWith(expect.any(String))
    })

    it('sql-formatter action formats SQL and shows toast', () => {
      mockFormatSQL.mockImplementation(() => 'FORMATTED SQL')
      mockEditorInstance.getValue.mockReturnValue('SELECT 1')

      const stmt = makeStatement({ id: 'stmt-fmt-act' })
      renderCell(stmt)
      triggerMount()

      const action = getAction('sql-formatter-stmt-fmt-act')
      action?.run(mockEditorInstance)

      expect(mockEditorInstance.executeEdits).toHaveBeenCalled()
      expect(mockEditorInstance.pushUndoStop).toHaveBeenCalled()
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: 'SQL formatted' })
      )
    })

    it('sql-formatter action does nothing when SQL unchanged', () => {
      mockFormatSQL.mockImplementation((sql: string) => sql)
      mockEditorInstance.getValue.mockReturnValue('SELECT 1')

      const stmt = makeStatement({ id: 'stmt-fmt-noop' })
      renderCell(stmt)
      triggerMount()

      const action = getAction('sql-formatter-stmt-fmt-noop')
      action?.run(mockEditorInstance)

      expect(mockEditorInstance.executeEdits).not.toHaveBeenCalled()
    })

    it('navigate-next-cell expands collapsed next cell before focusing', () => {
      const mockNextEditor = { focus: vi.fn() }
      mockRegistryGet.mockReturnValue(mockNextEditor)

      const stmt1 = makeStatement({ id: 'stmt-exp-1', status: 'IDLE' })
      const stmt2 = makeStatement({ id: 'stmt-exp-2', status: 'IDLE', isCollapsed: true })
      mockStatementsRef.current = [stmt1, stmt2]
      renderCell(stmt1, 0)
      triggerMount()

      const action = getAction('navigate-next-cell')
      action?.run()

      expect(mockToggleStatementCollapse).toHaveBeenCalledWith('stmt-exp-2')
    })

    it('navigate-prev-cell expands collapsed previous cell before focusing', () => {
      const mockPrevEditor = { focus: vi.fn() }
      mockRegistryGet.mockReturnValue(mockPrevEditor)

      const stmt1 = makeStatement({ id: 'stmt-expp-1', status: 'IDLE', isCollapsed: true })
      const stmt2 = makeStatement({ id: 'stmt-expp-2', status: 'IDLE' })
      mockStatementsRef.current = [stmt1, stmt2]
      renderCell(stmt2, 1)
      triggerMount()

      const action = getAction('navigate-prev-cell')
      action?.run()

      expect(mockToggleStatementCollapse).toHaveBeenCalledWith('stmt-expp-1')
    })
  })

  // -------------------------------------------------------------------------
  // Autocomplete provider — invoke provideCompletionItems
  // -------------------------------------------------------------------------
  describe('[@editor-cell] autocomplete provider', () => {
    const triggerMount = () => {
      if (capturedOnMount) {
        capturedOnMount(mockEditorInstance as never, mockMonacoInstance as never)
      }
    }

    it('provideCompletionItems returns suggestions including Flink keywords', () => {
      renderCell(makeStatement())
      triggerMount()

      // Get the provider callback from registerCompletionItemProvider
      const providerCall = mockMonacoInstance.languages.registerCompletionItemProvider.mock.calls[0]
      const provider = providerCall[1] as { provideCompletionItems: (model: unknown, position: unknown) => { suggestions: unknown[] } }

      const mockModel = {
        getWordUntilPosition: vi.fn(() => ({ word: '', startColumn: 1, endColumn: 1 })),
      }
      const mockPosition = { lineNumber: 1 }

      const result = provider.provideCompletionItems(mockModel, mockPosition)
      expect(result.suggestions.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Format SQL button click — requires editorRef to be set via onMount
  // -------------------------------------------------------------------------
  describe('[@editor-cell] format SQL button click handler', () => {
    const triggerMount = () => {
      if (capturedOnMount) {
        capturedOnMount(mockEditorInstance as never, mockMonacoInstance as never)
      }
    }

    it('clicking format button with no change does not call addToast', async () => {
      const user = userEvent.setup()
      // formatSQL returns same string → no edit
      mockFormatSQL.mockImplementation((sql: string) => sql)
      mockEditorInstance.getValue.mockReturnValue('SELECT 1')

      const { container } = renderCell(makeStatement({ code: 'SELECT 1' }))
      triggerMount()

      const formatBtn = container.querySelector('[title="Format SQL (Shift+Alt+F)"]') as HTMLButtonElement
      await user.click(formatBtn)

      expect(mockEditorInstance.executeEdits).not.toHaveBeenCalled()
      expect(mockAddToast).not.toHaveBeenCalled()
    })

    it('clicking format button when SQL changes calls executeEdits and addToast', async () => {
      const user = userEvent.setup()
      mockFormatSQL.mockImplementation(() => 'SELECT\n  1')
      mockEditorInstance.getValue.mockReturnValue('SELECT 1')

      const { container } = renderCell(makeStatement({ code: 'SELECT 1' }))
      triggerMount()

      const formatBtn = container.querySelector('[title="Format SQL (Shift+Alt+F)"]') as HTMLButtonElement
      await user.click(formatBtn)

      expect(mockEditorInstance.executeEdits).toHaveBeenCalledWith(
        'sql-formatter',
        expect.arrayContaining([expect.objectContaining({ text: 'SELECT\n  1' })])
      )
      expect(mockEditorInstance.pushUndoStop).toHaveBeenCalled()
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: 'SQL formatted' })
      )
    })
  })

  // -------------------------------------------------------------------------
  // handleEditorChange — textarea onChange calls updateStatement
  // -------------------------------------------------------------------------
  describe('[@editor-cell] editor change handler', () => {
    it('typing in editor textarea calls updateStatement', async () => {
      const user = userEvent.setup()
      renderCell(makeStatement({ id: 'stmt-change', code: '' }))

      const textarea = screen.getByTestId('monaco-editor') as HTMLTextAreaElement
      await user.type(textarea, 'SELECT 2')

      // updateStatement should be called for each keystroke
      expect(mockUpdateStatement).toHaveBeenCalled()
    })
  })
})
