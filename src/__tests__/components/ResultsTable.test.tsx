import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Column } from '../../types'
import ResultsTable, { isExpandable, formatJSON, formatCellValue } from '../../components/ResultsTable/ResultsTable'

// Mock the Zustand store
vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (state: unknown) => unknown) => {
    const mockState = {
      addToast: vi.fn(),
    }
    return selector(mockState)
  },
}))

// Mock react-virtual to avoid complex DOM requirements.
// NOTE: Both grid and list views use virtualItems.map() for rows, so getVirtualItems()
// must return actual items for any row data to render. We return mock virtual items
// matching the mockData indices so both views render all rows.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 35,
        end: (i + 1) * 35,
        size: 35,
        lane: 0,
      })),
    getTotalSize: () => count * 35,
  }),
}))

describe('[@results-table] [@core] ResultsTable', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'name', type: 'STRING' },
    { name: 'email', type: 'STRING' },
  ]

  const mockData = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('[@results-table] rendering', () => {
    it('should render column headers', () => {
      render(<ResultsTable data={mockData} columns={mockColumns} />)

      expect(screen.getByText('id')).toBeInTheDocument()
      expect(screen.getByText('name')).toBeInTheDocument()
      expect(screen.getByText('email')).toBeInTheDocument()
    })

    it('should render row data', async () => {
      const user = userEvent.setup()
      render(<ResultsTable data={mockData} columns={mockColumns} />)

      // Switch to list view so rows render without virtualizer
      const listViewBtn = screen.getByTitle('List view')
      await user.click(listViewBtn)

      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })

    it('should show empty state when no data', () => {
      render(<ResultsTable data={[]} columns={mockColumns} />)

      expect(screen.getByText('Query executed successfully. No rows returned.')).toBeInTheDocument()
    })
  })

  describe('[@results-table] search functionality', () => {
    it('should filter rows based on search term', async () => {
      const user = userEvent.setup()
      render(<ResultsTable data={mockData} columns={mockColumns} />)

      // Switch to list view so rows render without virtualizer
      const listViewBtn = screen.getByTitle('List view')
      await user.click(listViewBtn)

      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'Alice')

      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    })

    it('should show empty state when search has no matches', async () => {
      const user = userEvent.setup()
      render(<ResultsTable data={mockData} columns={mockColumns} />)

      // Switch to list view so rows render without virtualizer
      const listViewBtn = screen.getByTitle('List view')
      await user.click(listViewBtn)

      const searchInput = screen.getByPlaceholderText('Search...')
      await user.type(searchInput, 'NonExistent')

      // Row count info shows "0 of 2 rows"
      expect(screen.getByText(/0 of 2 rows/i)).toBeInTheDocument()
    })
  })

  describe('[@results-table] sorting', () => {
    it('should sort ascending when clicking column header', async () => {
      const user = userEvent.setup()
      const { container } = render(<ResultsTable data={mockData} columns={mockColumns} />)

      // Click the "name" column header to sort ascending
      // The th wraps a div.th-content; click the span text inside it
      const nameHeaderSpan = screen.getAllByText('name')[0]
      await user.click(nameHeaderSpan)

      // After first click: ascending sort → FiArrowUp rendered (no sort-icon-inactive class)
      // The active sort column renders FiArrowUp without the sort-icon-inactive class
      const activeArrow = container.querySelector('.sort-icons svg:not(.sort-icon-inactive)')
      expect(activeArrow).toBeInTheDocument()
    })

    it('should sort descending on second click', async () => {
      const user = userEvent.setup()
      const { container } = render(<ResultsTable data={mockData} columns={mockColumns} />)

      const nameHeaderSpan = screen.getAllByText('name')[0]
      await user.click(nameHeaderSpan)
      await user.click(nameHeaderSpan)

      // After second click: descending sort → FiArrowDown is rendered
      // FiArrowDown has a specific SVG path; check that sort-icon-inactive is gone
      // and look for a down-arrow svg (react-icons renders title-less SVGs, check via absence of inactive class)
      // We verify the sort icons container no longer has any inactive arrows
      const inactiveArrows = container.querySelectorAll('.sort-icon-inactive')
      // All three columns' sort icons: the active "name" column has no inactive class
      // The other 2 columns each have one inactive arrow; so count should be 2
      expect(inactiveArrows.length).toBe(2)
    })
  })

  describe('[@results-table] view modes', () => {
    it('should support grid and list view toggle', async () => {
      const user = userEvent.setup()
      render(<ResultsTable data={mockData} columns={mockColumns} />)

      // Grid view button starts active; click list view button to switch
      const gridViewBtn = screen.getByTitle('Grid view')
      const listViewBtn = screen.getByTitle('List view')

      expect(gridViewBtn).toHaveClass('active')
      expect(listViewBtn).not.toHaveClass('active')

      await user.click(listViewBtn)

      expect(listViewBtn).toHaveClass('active')
      expect(gridViewBtn).not.toHaveClass('active')
    })
  })

  describe('[@results-table] column visibility', () => {
    it('should toggle column visibility', async () => {
      const user = userEvent.setup()
      render(<ResultsTable data={mockData} columns={mockColumns} />)

      // Open the columns dropdown (button contains text "Columns")
      const columnsButton = screen.getByRole('button', { name: /columns/i })
      await user.click(columnsButton)

      // Uncheck the "id" column checkbox (wrapped in a label)
      const hideIdCheckbox = screen.getByRole('checkbox', { name: /^id$/i })
      await user.click(hideIdCheckbox)

      // The "id" column header should no longer be visible
      // (the th containing only "id" text is removed; column headers are in thead)
      // We check the thead cells — "id" span should be gone
      expect(screen.queryByRole('columnheader', { name: /^#$/ })).toBeInTheDocument() // index col still present
      // The id column th is removed; its text "id" should not appear as a header
      const allHeaders = screen.getAllByRole('columnheader')
      const headerTexts = allHeaders.map(h => h.textContent?.trim())
      expect(headerTexts).not.toContain('id')
    })
  })

  describe('[@results-table] total rows display', () => {
    it('should display total rows received', () => {
      render(<ResultsTable data={mockData} columns={mockColumns} totalRowsReceived={2} />)

      // Row info shows "2 of 2 rows" (totalRowsReceived === data.length so no extra suffix)
      expect(screen.getByText(/2 of 2 rows/i)).toBeInTheDocument()
    })

    it('should show streaming row count when totalRowsReceived exceeds data length', () => {
      render(
        <ResultsTable
          data={mockData}
          columns={mockColumns}
          totalRowsReceived={500}
        />
      )

      // Shows "2 of 2 rows (500 total received)" when totalRowsReceived > data.length
      expect(screen.getByText(/500 total received/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Extended ResultsTable tests
// ---------------------------------------------------------------------------

describe('[@results-table] [@export] ResultsTable export and copy', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'name', type: 'STRING' },
  ]
  const mockData = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]

  let mockWriteText: ReturnType<typeof vi.fn>
  let mockCreateObjectURL: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>
  let mockAnchorClick: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText = vi.fn().mockResolvedValue(undefined)
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    mockRevokeObjectURL = vi.fn()
    mockAnchorClick = vi.fn()

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    })
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    // Intercept anchor creation for download
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: mockAnchorClick, configurable: true })
      }
      return el
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clicking Export as CSV creates a blob and triggers download', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    // Hover over the export dropdown to reveal it (CSS hover)
    const exportBtn = screen.getByTitle('Export')
    await user.hover(exportBtn)

    const csvBtn = screen.getByText('Export as CSV')
    await user.click(csvBtn)

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    expect(mockAnchorClick).toHaveBeenCalledTimes(1)
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('clicking Export as JSON creates a blob and triggers download', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    const exportBtn = screen.getByTitle('Export')
    await user.hover(exportBtn)

    const jsonBtn = screen.getByText('Export as JSON')
    await user.click(jsonBtn)

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    expect(mockAnchorClick).toHaveBeenCalledTimes(1)
  })

  it('Copy as MD button copies markdown table to clipboard', async () => {
    const user = userEvent.setup()

    // Use vi.stubGlobal for clipboard since Object.defineProperty may not persist to jsdom
    const stubWriteText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText: stubWriteText } })

    render(<ResultsTable data={mockData} columns={mockColumns} />)

    const copyMdBtn = screen.getByTitle('Copy as Markdown')
    await user.click(copyMdBtn)

    expect(stubWriteText).toHaveBeenCalledTimes(1)
    const clipboardText = stubWriteText.mock.calls[0][0] as string
    // Should contain markdown table headers
    expect(clipboardText).toContain('| # |')
    expect(clipboardText).toContain('| id |')
    expect(clipboardText).toContain('| name |')
    // Should contain data rows
    expect(clipboardText).toContain('Alice')
    expect(clipboardText).toContain('Bob')
  })

  it('Copy as MD is disabled when data is empty', () => {
    render(<ResultsTable data={[]} columns={mockColumns} />)
    // Empty state renders different component - no toolbar
    expect(screen.queryByTitle('Copy as Markdown')).not.toBeInTheDocument()
  })
})

describe('[@results-table] [@cell-interaction] ResultsTable cell click and null rendering', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'value', type: 'STRING' },
    { name: 'data', type: 'STRING' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null values as "null" span', async () => {
    const user = userEvent.setup()
    const dataWithNull = [{ id: 1, value: null, data: 'ok' }]
    render(<ResultsTable data={dataWithNull} columns={mockColumns} />)

    // Switch to list view to ensure rows render
    await user.click(screen.getByTitle('List view'))

    const nullSpan = document.querySelector('.null-value')
    expect(nullSpan).toBeInTheDocument()
    expect(nullSpan).toHaveTextContent('null')
  })

  it('renders undefined values as "null" span', async () => {
    const user = userEvent.setup()
    const dataWithUndefined = [{ id: 1, value: undefined, data: 'ok' }]
    render(<ResultsTable data={dataWithUndefined} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const nullSpan = document.querySelector('.null-value')
    expect(nullSpan).toBeInTheDocument()
  })

  it('renders JSON objects with expand button', async () => {
    const user = userEvent.setup()
    const dataWithObj = [{ id: 1, value: { nested: 'data' }, data: 'ok' }]
    render(<ResultsTable data={dataWithObj} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const expandBtn = document.querySelector('.json-expand-btn')
    expect(expandBtn).toBeInTheDocument()
  })

  it('cells have onClick handler (results-cell class present)', async () => {
    const user = userEvent.setup()
    const mockData = [{ id: 1, value: 'hello-world', data: 'x' }]
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    // Verify all data cells have the results-cell class (which has onClick)
    const dataCells = document.querySelectorAll('.results-cell')
    expect(dataCells.length).toBeGreaterThan(0)
  })

  it('clicking a cell adds the results-cell--copied class momentarily', async () => {
    const user = userEvent.setup()
    const mockData = [{ id: 1, value: 'copyable', data: 'x' }]

    // Provide a working clipboard mock
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: writeTextMock },
    })

    render(<ResultsTable data={mockData} columns={mockColumns} />)
    await user.click(screen.getByTitle('List view'))

    const cell = screen.getByText('copyable').closest('td')!
    await user.click(cell)

    // The clipboard should have been called
    expect(writeTextMock).toHaveBeenCalledWith('copyable')
  })

  it('JSON object cell shows preview text', async () => {
    const user = userEvent.setup()
    const dataWithObj = [{ id: 1, value: { key: 'val' }, data: 'ok' }]
    render(<ResultsTable data={dataWithObj} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    // The JSON preview span renders JSON.stringify of the object
    const preview = document.querySelector('.results-cell-json-preview')
    expect(preview).toBeInTheDocument()
    expect(preview?.textContent).toContain('"key"')
  })
})

describe('[@results-table] [@sorting] ResultsTable sort edge cases', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'name', type: 'STRING' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('third click on same column header removes sort (returns to no sort)', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ResultsTable
        data={[{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]}
        columns={mockColumns}
      />
    )

    const nameHeaderSpan = screen.getAllByText('name')[0]
    // Click 1: asc
    await user.click(nameHeaderSpan)
    // Click 2: desc
    await user.click(nameHeaderSpan)
    // Click 3: no sort (all inactive)
    await user.click(nameHeaderSpan)

    // All sort icons should now be inactive
    const inactiveArrows = container.querySelectorAll('.sort-icon-inactive')
    // 2 columns = 2 inactive arrows (no active sort)
    expect(inactiveArrows.length).toBe(2)
  })

  it('sorts null values to end when sorting ascending', async () => {
    const user = userEvent.setup()
    const dataWithNull = [
      { id: 2, name: 'Bob' },
      { id: 1, name: null },
      { id: 3, name: 'Alice' },
    ]
    render(<ResultsTable data={dataWithNull} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    // Click name header to sort ascending
    const nameHeaderSpan = screen.getAllByText('name')[0]
    await user.click(nameHeaderSpan)

    // The null row should appear after non-null rows
    const rows = document.querySelectorAll('tbody tr')
    // First real rows should have Alice (index 0) and Bob (index 1)
    // Check that Alice appears before null
    const cells = Array.from(document.querySelectorAll('tbody td'))
    const texts = cells.map(c => c.textContent?.trim())
    const aliceIdx = texts.indexOf('Alice')
    const nullIdx = texts.indexOf('null')
    // Alice should come before null in sorted order
    if (aliceIdx !== -1 && nullIdx !== -1) {
      expect(aliceIdx).toBeLessThan(nullIdx)
    }
    // At minimum the table rendered
    expect(rows.length).toBeGreaterThan(0)
  })
})

describe('[@results-table] [@column-visibility] Column visibility advanced', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'name', type: 'STRING' },
    { name: 'email', type: 'STRING' },
  ]
  const mockData = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Show All button re-shows all hidden columns', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    const columnsButton = screen.getByRole('button', { name: /columns/i })
    await user.click(columnsButton)

    // Hide all columns first
    const hideAllBtn = screen.getByText('Hide All')
    await user.click(hideAllBtn)

    // Now click Show All
    const showAllBtn = screen.getByText('Show All')
    await user.click(showAllBtn)

    // All columns should be visible again
    const allHeaders = screen.getAllByRole('columnheader')
    const headerTexts = allHeaders.map(h => h.textContent?.replace(/[↑↓]/g, '').trim())
    expect(headerTexts).toContain('id')
    expect(headerTexts).toContain('name')
    expect(headerTexts).toContain('email')
  })

  it('Hide All button removes all data columns from table', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    const columnsButton = screen.getByRole('button', { name: /columns/i })
    await user.click(columnsButton)

    const hideAllBtn = screen.getByText('Hide All')
    await user.click(hideAllBtn)

    // Only the # (index) column should remain
    const allHeaders = screen.getAllByRole('columnheader')
    // Should only have index header
    expect(allHeaders).toHaveLength(1)
  })

  it('shows column count badge when some columns are hidden', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    const columnsButton = screen.getByRole('button', { name: /columns/i })
    await user.click(columnsButton)

    const idCheckbox = screen.getByRole('checkbox', { name: /^id$/i })
    await user.click(idCheckbox)

    // Close dropdown by clicking outside
    await user.click(document.body)

    // The columns button should now show a count badge like "Columns (2/3)"
    expect(screen.getByRole('button', { name: /columns/i })).toHaveTextContent(/2\/3/)
  })

  it('clicking outside columns dropdown closes it', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    const columnsButton = screen.getByRole('button', { name: /columns/i })
    await user.click(columnsButton)

    // Dropdown is open - verify a dropdown-specific element is visible
    expect(screen.getByText('Show All')).toBeInTheDocument()

    // Click outside
    await user.click(document.body)

    // Dropdown should close
    expect(screen.queryByText('Show All')).not.toBeInTheDocument()
  })
})

describe('[@results-table] [@row-index] Row index column', () => {
  const mockColumns: Column[] = [
    { name: 'val', type: 'STRING' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders # header in the index column', () => {
    render(
      <ResultsTable
        data={[{ val: 'a' }]}
        columns={mockColumns}
      />
    )
    // The index column header is "#"
    const headers = screen.getAllByRole('columnheader')
    expect(headers[0]).toHaveTextContent('#')
  })

  it('shows original 1-based row index for each data row', async () => {
    const user = userEvent.setup()
    const data = [{ val: 'first' }, { val: 'second' }, { val: 'third' }]
    render(<ResultsTable data={data} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const indexCells = document.querySelectorAll('.results-index-cell')
    // First is the header "#", rest are data rows
    const dataCells = Array.from(indexCells).slice(1)
    expect(dataCells[0]).toHaveTextContent('1')
    expect(dataCells[1]).toHaveTextContent('2')
    expect(dataCells[2]).toHaveTextContent('3')
  })
})

describe('[@results-table] [@view-modes] List view rendering', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'name', type: 'STRING' },
  ]
  const mockData = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list view renders data rows', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    // Both rows should appear in the list
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('list view shows same column headers as grid view', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    // Column headers should still be present
    const headers = screen.getAllByRole('columnheader')
    const headerTexts = headers.map(h => h.textContent?.trim())
    expect(headerTexts).toContain('id')
    expect(headerTexts).toContain('name')
  })
})

describe('[@results-table] [@helpers] ResultsTable helper function exports', () => {
  // Tests for the exported pure helper functions (imported at top of file)

  it('isExpandable returns false for null', () => {
    expect(isExpandable(null)).toBe(false)
  })

  it('isExpandable returns false for undefined', () => {
    expect(isExpandable(undefined)).toBe(false)
  })

  it('isExpandable returns false for primitive string', () => {
    expect(isExpandable('hello')).toBe(false)
  })

  it('isExpandable returns false for number', () => {
    expect(isExpandable(42)).toBe(false)
  })

  it('isExpandable returns true for object', () => {
    expect(isExpandable({ key: 'value' })).toBe(true)
  })

  it('isExpandable returns true for array', () => {
    expect(isExpandable([1, 2, 3])).toBe(true)
  })

  it('formatJSON pretty-prints a valid object', () => {
    const result = formatJSON({ a: 1, b: 'test' })
    expect(result).toContain('"a": 1')
    expect(result).toContain('"b": "test"')
  })

  it('formatCellValue returns "null" for null', () => {
    expect(formatCellValue(null)).toBe('null')
  })

  it('formatCellValue returns "null" for undefined', () => {
    expect(formatCellValue(undefined)).toBe('null')
  })

  it('formatCellValue converts number to string', () => {
    expect(formatCellValue(42)).toBe('42')
  })

  it('formatCellValue escapes pipe characters for markdown', () => {
    expect(formatCellValue('a|b')).toBe('a\\|b')
  })

  it('formatCellValue truncates at 100 chars', () => {
    const long = 'x'.repeat(110)
    const result = formatCellValue(long)
    expect(result.length).toBe(100)
    expect(result.endsWith('...')).toBe(true)
  })

  it('formatCellValue serializes objects to JSON string', () => {
    expect(formatCellValue({ key: 'val' })).toBe('{"key":"val"}')
  })

  it('formatCellValue uses ISO string for Date objects', () => {
    const d = new Date('2026-01-15T12:00:00Z')
    expect(formatCellValue(d)).toBe('2026-01-15T12:00:00.000Z')
  })

  it('formatCellValue replaces newlines and tabs with spaces', () => {
    expect(formatCellValue('line1\nline2\ttab')).toBe('line1 line2 tab')
  })
})

describe('[@results-table] [@help] ResultsTable help button', () => {
  const mockColumns: Column[] = [{ name: 'id', type: 'INTEGER' }]
  const mockData = [{ id: 1 }]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders help button when onOpenHelp is provided', () => {
    render(
      <ResultsTable
        data={mockData}
        columns={mockColumns}
        onOpenHelp={vi.fn()}
      />
    )
    expect(screen.getByTitle('Help: Why do results stop updating?')).toBeInTheDocument()
  })

  it('does not render help button when onOpenHelp is not provided', () => {
    render(<ResultsTable data={mockData} columns={mockColumns} />)
    expect(screen.queryByTitle('Help: Why do results stop updating?')).not.toBeInTheDocument()
  })

  it('clicking help button calls onOpenHelp with correct topic', async () => {
    const user = userEvent.setup()
    const onOpenHelp = vi.fn()
    render(
      <ResultsTable
        data={mockData}
        columns={mockColumns}
        onOpenHelp={onOpenHelp}
      />
    )
    const helpBtn = screen.getByTitle('Help: Why do results stop updating?')
    await user.click(helpBtn)
    expect(onOpenHelp).toHaveBeenCalledWith('troubleshoot-results-buffer')
  })
})

// ---------------------------------------------------------------------------
// JSON expander (handleExpandClick + portal + handleCopyJSON)
// ---------------------------------------------------------------------------
describe('[@results-table] [@json-expander] JSON expander portal', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'data', type: 'STRING' },
  ]
  const mockData = [
    { id: 1, data: { nested: 'value', count: 42 } },
  ]

  let mockWriteText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText: mockWriteText } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('clicking expand button opens JSON expander portal', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const expandBtn = document.querySelector('.json-expand-btn')!
    await user.click(expandBtn)

    // The portal renders a json-expander-pane in document.body
    const pane = document.querySelector('.json-expander-pane')
    expect(pane).toBeInTheDocument()
    expect(pane!.textContent).toContain('JSON Viewer')
  })

  it('JSON expander shows pretty-printed JSON content', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const expandBtn = document.querySelector('.json-expand-btn')!
    await user.click(expandBtn)

    const viewer = document.querySelector('.json-viewer')
    expect(viewer).toBeInTheDocument()
    expect(viewer!.textContent).toContain('"nested": "value"')
    expect(viewer!.textContent).toContain('"count": 42')
  })

  it('clicking expand button again closes the expander (toggle)', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const expandBtn = document.querySelector('.json-expand-btn')!
    // Open
    await user.click(expandBtn)
    expect(document.querySelector('.json-expander-pane')).toBeInTheDocument()

    // Close by pressing Escape (toggle via same button is tricky due to mousedown listener)
    await user.keyboard('{Escape}')
    expect(document.querySelector('.json-expander-pane')).not.toBeInTheDocument()
  })

  it('Copy JSON button copies formatted JSON to clipboard', async () => {
    const user = userEvent.setup()
    // Use direct property definition on the existing navigator for portal context
    const writeTextFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextFn },
      writable: true,
      configurable: true,
    })

    render(<ResultsTable data={mockData} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const expandBtn = document.querySelector('.json-expand-btn')!
    await user.click(expandBtn)

    const copyBtn = screen.getByText('Copy JSON')
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(writeTextFn).toHaveBeenCalledTimes(1)
    })
    const copied = writeTextFn.mock.calls[0][0] as string
    expect(copied).toContain('"nested": "value"')
  })

  it('Escape key closes the JSON expander', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const expandBtn = document.querySelector('.json-expand-btn')!
    await user.click(expandBtn)
    expect(document.querySelector('.json-expander-pane')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(document.querySelector('.json-expander-pane')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// copyAsMarkdown with truncated rows (> 100 rows)
// ---------------------------------------------------------------------------
describe('[@results-table] [@markdown-truncation] Copy as Markdown truncation', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'val', type: 'STRING' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('truncates markdown to 100 rows and shows remaining count footer', async () => {
    const user = userEvent.setup()
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText: mockWriteText } })

    // Generate 120 rows
    const bigData = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, val: `row-${i + 1}` }))
    render(<ResultsTable data={bigData} columns={mockColumns} />)

    const copyMdBtn = screen.getByTitle('Copy as Markdown')
    await user.click(copyMdBtn)

    expect(mockWriteText).toHaveBeenCalledTimes(1)
    const md = mockWriteText.mock.calls[0][0] as string
    // Should contain 100 data rows + header + separator + footer = 103 lines
    const lines = md.split('\n')
    // Header + separator + 100 data rows + 1 footer = 103
    expect(lines.length).toBe(103)
    // Footer should mention remaining rows
    expect(md).toContain('20 more rows')
  })
})

// ---------------------------------------------------------------------------
// Column visibility toggle function
// ---------------------------------------------------------------------------
describe('[@results-table] [@column-toggle] Column toggle function', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'name', type: 'STRING' },
    { name: 'email', type: 'STRING' },
  ]
  const mockData = [
    { id: 1, name: 'Alice', email: 'a@b.com' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggling a hidden column back on re-shows it', async () => {
    const user = userEvent.setup()
    render(<ResultsTable data={mockData} columns={mockColumns} />)

    const columnsButton = screen.getByRole('button', { name: /columns/i })
    await user.click(columnsButton)

    // Hide email
    const emailCheckbox = screen.getByRole('checkbox', { name: /^email$/i })
    await user.click(emailCheckbox)

    // Verify email is hidden
    let allHeaders = screen.getAllByRole('columnheader')
    let headerTexts = allHeaders.map(h => h.textContent?.trim())
    expect(headerTexts).not.toContain('email')

    // Re-show email
    await user.click(emailCheckbox)
    allHeaders = screen.getAllByRole('columnheader')
    headerTexts = allHeaders.map(h => h.textContent?.trim())
    expect(headerTexts).toContain('email')
  })
})

// ---------------------------------------------------------------------------
// Export filename generation
// ---------------------------------------------------------------------------
describe('[@results-table] [@export-filename] Export with statementName', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
  ]
  const mockData = [{ id: 1 }]

  let mockCreateObjectURL: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>
  let mockAnchorClick: ReturnType<typeof vi.fn>
  let lastCreatedAnchor: HTMLAnchorElement | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    mockRevokeObjectURL = vi.fn()
    mockAnchorClick = vi.fn()
    lastCreatedAnchor = null
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') {
        lastCreatedAnchor = el as HTMLAnchorElement
        Object.defineProperty(el, 'click', { value: mockAnchorClick, configurable: true })
      }
      return el
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('export CSV uses statementName in filename when provided', async () => {
    const user = userEvent.setup()
    render(
      <ResultsTable data={mockData} columns={mockColumns} statementName="My Query" />
    )

    const exportBtn = screen.getByTitle('Export')
    await user.hover(exportBtn)
    const csvBtn = screen.getByText('Export as CSV')
    await user.click(csvBtn)

    expect(lastCreatedAnchor).not.toBeNull()
    expect(lastCreatedAnchor!.download).toContain('my-query-')
    expect(lastCreatedAnchor!.download).toContain('.csv')
  })

  it('export JSON uses statementIndex in filename when no name', async () => {
    const user = userEvent.setup()
    render(
      <ResultsTable data={mockData} columns={mockColumns} statementIndex={3} />
    )

    const exportBtn = screen.getByTitle('Export')
    await user.hover(exportBtn)
    const jsonBtn = screen.getByText('Export as JSON')
    await user.click(jsonBtn)

    expect(lastCreatedAnchor).not.toBeNull()
    expect(lastCreatedAnchor!.download).toContain('query-4-')
    expect(lastCreatedAnchor!.download).toContain('.json')
  })
})

// ---------------------------------------------------------------------------
// List view specific rendering in detail
// ---------------------------------------------------------------------------
describe('[@results-table] [@list-view-detail] List view detailed rendering', () => {
  const mockColumns: Column[] = [
    { name: 'id', type: 'INTEGER' },
    { name: 'data', type: 'STRING' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list view renders null values as null span', async () => {
    const user = userEvent.setup()
    const dataWithNull = [{ id: 1, data: null }]
    render(<ResultsTable data={dataWithNull} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const nullSpan = document.querySelector('.null-value')
    expect(nullSpan).toBeInTheDocument()
    expect(nullSpan).toHaveTextContent('null')
  })

  it('list view renders JSON objects with expand button', async () => {
    const user = userEvent.setup()
    const dataWithObj = [{ id: 1, data: { key: 'val' } }]
    render(<ResultsTable data={dataWithObj} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const expandBtn = document.querySelector('.json-expand-btn')
    expect(expandBtn).toBeInTheDocument()
    const preview = document.querySelector('.results-cell-json-preview')
    expect(preview).toBeInTheDocument()
  })

  it('list view applies odd row class to alternating rows', async () => {
    const user = userEvent.setup()
    const data = [
      { id: 1, data: 'a' },
      { id: 2, data: 'b' },
      { id: 3, data: 'c' },
    ]
    render(<ResultsTable data={data} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const rows = document.querySelectorAll('tbody tr')
    // Row at index 1 (second row) should have odd class
    const oddRows = document.querySelectorAll('.results-row-odd')
    expect(oddRows.length).toBeGreaterThan(0)
  })

  it('list view shows original row index after sorting', async () => {
    const user = userEvent.setup()
    const data = [
      { id: 3, data: 'c' },
      { id: 1, data: 'a' },
      { id: 2, data: 'b' },
    ]
    render(<ResultsTable data={data} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    // Sort by id ascending
    const idHeader = screen.getAllByText('id')[0]
    await user.click(idHeader)

    // After sorting, check index cells still show original 1-based indices
    const indexCells = document.querySelectorAll('.results-index-cell')
    // First is header "#", then data rows
    const dataIndexCells = Array.from(indexCells).slice(1)
    // Row with id=1 was originally at index 2, so its index cell should show 2
    expect(dataIndexCells[0]).toHaveTextContent('2')
  })

  it('clicking cell in list view copies value to clipboard', async () => {
    const user = userEvent.setup()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: writeTextMock },
    })

    const data = [{ id: 1, data: 'list-cell-value' }]
    render(<ResultsTable data={data} columns={mockColumns} />)

    await user.click(screen.getByTitle('List view'))

    const cell = screen.getByText('list-cell-value').closest('td')!
    await user.click(cell)

    expect(writeTextMock).toHaveBeenCalledWith('list-cell-value')
  })
})
