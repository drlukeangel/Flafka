/**
 * @stream-card-table
 * StreamCardTable tests — comprehensive coverage of table rendering, sorting, and JSON expansion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StreamCardTable } from '../../components/StreamsPanel/StreamCardTable'
import type { Column } from '../../types'

// Mock ExpandableJsonPane
vi.mock('../../components/shared/ExpandableJsonPane', () => ({
  ExpandableJsonPane: ({ value, onClose }: { value: string; onClose: () => void }) => (
    <div data-testid="json-pane" role="dialog">
      <pre>{value}</pre>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

// Helpers
function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    name: 'test_column',
    type: 'string',
    ...overrides,
  }
}

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _ts: '2026-03-01T12:00:00Z',
    _partition: 0,
    _offset: 100,
    _key: 'key-1',
    value: 'test-value',
    ...overrides,
  }
}

describe('[@stream-card-table] StreamCardTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ========================================================================
  // Rendering Tests
  // ========================================================================

  describe('[@stream-card-table] Table Structure', () => {
    it('renders table with proper HTML structure', () => {
      const columns = [makeColumn({ name: 'name' }), makeColumn({ name: 'age' })]
      const data = [makeRow({ name: 'Alice', age: 30 })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('rowgroup')).toHaveLength(2) // thead, tbody
    })

    it('renders column headers in correct order (row number then metadata first)', () => {
      const columns = [
        makeColumn({ name: 'value' }),
        makeColumn({ name: '_ts' }),
        makeColumn({ name: '_key' }),
      ]
      const data = [makeRow({ value: 'test' })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      const headers = screen.getAllByRole('columnheader')
      // headers[0] is the row number '#' column
      expect(headers[0]).toHaveTextContent('#')
      expect(headers[1]).toHaveTextContent('_ts')
      expect(headers[2]).toHaveTextContent('_key')
      expect(headers[3]).toHaveTextContent('value')
    })

    it('renders all metadata columns when present', () => {
      const columns = [
        makeColumn({ name: '_ts' }),
        makeColumn({ name: '_partition' }),
        makeColumn({ name: '_offset' }),
        makeColumn({ name: '_key' }),
      ]
      const data = [makeRow()]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByText('_ts')).toBeInTheDocument()
      expect(screen.getByText('_partition')).toBeInTheDocument()
      expect(screen.getByText('_offset')).toBeInTheDocument()
      expect(screen.getByText('_key')).toBeInTheDocument()
    })

    it('renders rows for each data item', () => {
      const columns = [makeColumn({ name: 'name' })]
      const data = [makeRow({ name: 'Alice' }), makeRow({ name: 'Bob' }), makeRow({ name: 'Charlie' })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Data Formatting Tests
  // ========================================================================

  describe('[@stream-card-table] Data Formatting', () => {
    it('renders timestamp cells with formatted time', () => {
      const columns = [makeColumn({ name: '_ts' })]
      const data = [makeRow({ _ts: '2026-03-01T14:30:45Z' })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      // Should render table with timestamp
      expect(screen.getByRole('table')).toBeInTheDocument()
      // Timestamp should be formatted as time (HH:MM:SS)
      const table = screen.getByRole('table')
      expect(table.textContent).toMatch(/\d{2}:\d{2}:\d{2}/)
    })

    it('handles null timestamps gracefully', () => {
      const columns = [makeColumn({ name: '_ts' })]
      const data = [makeRow({ _ts: null })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('truncates string values longer than 40 characters', () => {
      const columns = [makeColumn({ name: 'text' })]
      const longText = 'a'.repeat(50)
      const data = [makeRow({ text: longText })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByText(/a+\.\.\./)).toBeInTheDocument()
    })

    it('handles key values in table', () => {
      const columns = [makeColumn({ name: '_key' })]
      const data = [makeRow({ _key: 'test-key' })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('shows "null" for null and undefined values', () => {
      const columns = [makeColumn({ name: 'value' })]
      const data = [makeRow({ value: null })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByText('null')).toBeInTheDocument()
    })

    it('formats object values as truncated JSON', () => {
      const columns = [makeColumn({ name: 'metadata' })]
      const obj = { key: 'value', nested: { prop: 123 } }
      const data = [makeRow({ metadata: obj })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      // Should render JSON representation
      expect(screen.getByText(/\{.*\}/)).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Sorting Tests
  // ========================================================================

  describe('[@stream-card-table] Sorting', () => {
    it('renders rows for timestamp-based data', () => {
      const columns = [makeColumn({ name: '_ts' })]
      const data = [
        makeRow({ _ts: '2026-03-01T10:00:00Z' }),
        makeRow({ _ts: '2026-03-01T20:00:00Z' }),
        makeRow({ _ts: '2026-03-01T15:00:00Z' }),
      ]

      const { container } = render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      // Should render all 3 rows
      const rows = container.querySelectorAll('tbody tr')
      expect(rows).toHaveLength(3)
    })

    it('handles missing timestamps in sort', () => {
      const columns = [makeColumn({ name: '_ts' })]
      const data = [
        makeRow({ _ts: '2026-03-01T15:00:00Z' }),
        makeRow({ _ts: null }),
        makeRow({ _ts: '2026-03-01T10:00:00Z' }),
      ]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      // Should not crash, renders all rows
      expect(screen.getAllByRole('row')).toHaveLength(4) // 1 header + 3 data rows
    })
  })

  // ========================================================================
  // JSON Expansion Tests
  // ========================================================================

  describe('[@stream-card-table] JSON Expansion', () => {
    it('shows expand button for object values', () => {
      const columns = [makeColumn({ name: 'data' })]
      const data = [makeRow({ data: { nested: 'value' } })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      // Should have expand/collapse button
      const expandBtn = screen.getByTitle('Expand JSON')
      expect(expandBtn).toBeInTheDocument()
    })

    it('does not show expand button for primitive values', () => {
      const columns = [
        makeColumn({ name: 'text' }),
        makeColumn({ name: 'number' }),
      ]
      const data = [makeRow({ text: 'simple', number: 42 })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      const expandBtns = screen.queryAllByTitle('Expand JSON')
      expect(expandBtns).toHaveLength(0)
    })

    it('opens JSON pane when expand button is clicked', async () => {
      const user = userEvent.setup()
      const columns = [makeColumn({ name: 'data' })]
      const data = [makeRow({ data: { key: 'value' } })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      const expandBtn = screen.getByTitle('Expand JSON')
      await user.click(expandBtn)

      // JSON pane should appear
      expect(screen.getByTestId('json-pane')).toBeInTheDocument()
    })

    it('closes JSON pane when expand button is clicked again', async () => {
      const user = userEvent.setup()
      const columns = [makeColumn({ name: 'data' })]
      const data = [makeRow({ data: { key: 'value' } })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      const expandBtn = screen.getByTitle('Expand JSON')
      // Open
      await user.click(expandBtn)
      expect(screen.getByTestId('json-pane')).toBeInTheDocument()

      // Close
      await user.click(expandBtn)
      expect(screen.queryByTestId('json-pane')).not.toBeInTheDocument()
    })

    it('closes JSON pane using close button', async () => {
      const user = userEvent.setup()
      const columns = [makeColumn({ name: 'data' })]
      const data = [makeRow({ data: { key: 'value' } })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      const expandBtn = screen.getByTitle('Expand JSON')
      await user.click(expandBtn)
      expect(screen.getByTestId('json-pane')).toBeInTheDocument()

      const closeBtn = within(screen.getByTestId('json-pane')).getByRole('button', {
        name: /close/i,
      })
      await user.click(closeBtn)
      expect(screen.queryByTestId('json-pane')).not.toBeInTheDocument()
    })

    it('displays JSON content correctly in pane', async () => {
      const user = userEvent.setup()
      const columns = [makeColumn({ name: 'data' })]
      const jsonData = { nested: { prop: 'value' }, array: [1, 2, 3] }
      const data = [makeRow({ data: jsonData })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      const expandBtn = screen.getByTitle('Expand JSON')
      await user.click(expandBtn)

      const pane = screen.getByTestId('json-pane')
      expect(pane.textContent).toContain('nested')
      expect(pane.textContent).toContain('prop')
      expect(pane.textContent).toContain('value')
    })
  })

  // ========================================================================
  // Column Width Tests
  // ========================================================================

  describe('[@stream-card-table] Column Width Assignment', () => {
    it('assigns correct width to metadata columns', () => {
      const columns = [
        makeColumn({ name: '_ts' }),
        makeColumn({ name: '_partition' }),
        makeColumn({ name: '_offset' }),
        makeColumn({ name: '_key' }),
      ]
      const data = [makeRow()]

      const { container } = render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      const cols = container.querySelectorAll('col')
      // cols[0] is the row number column (28px), metadata starts at index 1
      expect(cols[0]).toHaveAttribute('style', expect.stringContaining('28px')) // row number
      expect(cols[1]).toHaveAttribute('style', expect.stringContaining('80px')) // _ts
      expect(cols[2]).toHaveAttribute('style', expect.stringContaining('40px')) // _partition
      expect(cols[3]).toHaveAttribute('style', expect.stringContaining('55px')) // _offset
      expect(cols[4]).toHaveAttribute('style', expect.stringContaining('70px')) // _key
    })

    it('assigns auto width to non-metadata columns', () => {
      const columns = [makeColumn({ name: 'custom_col' })]
      const data = [makeRow({ custom_col: 'value' })]

      const { container } = render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      const cols = container.querySelectorAll('col')
      // cols[0] is the row number column (28px), cols[1] is the custom column
      expect(cols[1]).toHaveAttribute('style', expect.stringContaining('auto'))
    })
  })

  // ========================================================================
  // Empty State Tests
  // ========================================================================

  describe('[@stream-card-table] Empty Data Handling', () => {
    it('renders table even when data is empty', () => {
      const columns = [makeColumn({ name: 'value' })]
      const data: Record<string, unknown>[] = []

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('filters metadata columns based on what exists in columns prop', () => {
      const columns = [makeColumn({ name: '_ts' }), makeColumn({ name: 'value' })]
      const data = [makeRow()]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('_ts')).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Accessibility Tests
  // ========================================================================

  describe('[@stream-card-table] Accessibility', () => {
    it('renders table with proper ARIA roles', () => {
      const columns = [makeColumn({ name: 'value' })]
      const data = [makeRow()]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('rowgroup')).toHaveLength(2)
    })

    it('provides column titles via title attributes', () => {
      const columns = [makeColumn({ name: 'test_col' })]
      const data = [makeRow({ test_col: 'value' })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      expect(screen.getByTitle('test_col')).toBeInTheDocument()
    })

    it('provides timestamp title in cells', () => {
      const columns = [makeColumn({ name: '_ts' })]
      const data = [makeRow({ _ts: '2026-03-01T12:00:00Z' })]

      render(<StreamCardTable data={data} columns={columns} hiddenColumns={new Set()} />)

      // Formatted time should have title with full timestamp
      const timeCell = screen.getByTitle('2026-03-01T12:00:00Z')
      expect(timeCell).toBeInTheDocument()
    })
  })

  // ========================================================================
  // Memoization Tests
  // ========================================================================

  describe('[@stream-card-table] Performance (Memoization)', () => {
    it('updates when data prop changes', () => {
      const columns = [makeColumn({ name: '_ts' })]
      const data1 = [
        makeRow({ _ts: '2026-03-01T10:00:00Z' }),
        makeRow({ _ts: '2026-03-01T20:00:00Z' }),
      ]

      const { rerender, container } = render(<StreamCardTable data={data1} columns={columns} hiddenColumns={new Set()} />)

      // Verify initial render
      let rows = container.querySelectorAll('tbody tr')
      expect(rows).toHaveLength(2)

      // Update data with new timestamps
      const data2 = [
        makeRow({ _ts: '2026-03-01T15:00:00Z' }),
        makeRow({ _ts: '2026-03-01T10:00:00Z' }),
        makeRow({ _ts: '2026-03-01T30:00:00Z' }),
      ]

      rerender(<StreamCardTable data={data2} columns={columns} hiddenColumns={new Set()} />)

      // Should render with new number of rows
      rows = container.querySelectorAll('tbody tr')
      expect(rows).toHaveLength(3)
    })
  })
})
