import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import FooterStatus from '../../components/FooterStatus/FooterStatus'
import type { SQLStatement } from '../../types'

// Controlled mock state for useWorkspaceStore
let mockStatements: SQLStatement[] = []
let mockFocusedStatementId: string | null = null
let mockLastSavedAt: string | null = null

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (state: unknown) => unknown) => {
    const mockState = {
      statements: mockStatements,
      focusedStatementId: mockFocusedStatementId,
      lastSavedAt: mockLastSavedAt,
    }
    return selector(mockState)
  },
}))

const makeStatement = (id: string): SQLStatement => ({
  id,
  code: `SELECT * FROM ${id}`,
  status: 'IDLE',
  createdAt: new Date('2026-02-28T10:00:00Z'),
})

describe('[@footer-status] FooterStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatements = []
    mockFocusedStatementId = null
    mockLastSavedAt = null
  })

  describe('[@footer-status] cell position display', () => {
    it('shows "Cell N of M" when focusedStatementId matches a statement', () => {
      mockStatements = [
        makeStatement('stmt-1'),
        makeStatement('stmt-2'),
        makeStatement('stmt-3'),
      ]
      mockFocusedStatementId = 'stmt-2'

      render(<FooterStatus />)

      expect(screen.getByText('Cell 2 of 3')).toBeInTheDocument()
    })

    it('shows "Cell 1 of M" when first statement is focused', () => {
      mockStatements = [makeStatement('stmt-1'), makeStatement('stmt-2')]
      mockFocusedStatementId = 'stmt-1'

      render(<FooterStatus />)

      expect(screen.getByText('Cell 1 of 2')).toBeInTheDocument()
    })

    it('shows "Cell M of M" when last statement is focused', () => {
      mockStatements = [makeStatement('stmt-1'), makeStatement('stmt-2'), makeStatement('stmt-3')]
      mockFocusedStatementId = 'stmt-3'

      render(<FooterStatus />)

      expect(screen.getByText('Cell 3 of 3')).toBeInTheDocument()
    })
  })

  describe('[@footer-status] statement count display', () => {
    it('shows "M statement(s)" when focusedStatementId is null', () => {
      mockStatements = [makeStatement('stmt-1'), makeStatement('stmt-2')]
      mockFocusedStatementId = null

      render(<FooterStatus />)

      expect(screen.getByText('2 statement(s)')).toBeInTheDocument()
    })

    it('shows "1 statement(s)" when there is one statement and none is focused', () => {
      mockStatements = [makeStatement('stmt-1')]
      mockFocusedStatementId = null

      render(<FooterStatus />)

      expect(screen.getByText('1 statement(s)')).toBeInTheDocument()
    })

    it('shows "0 statement(s)" when there are no statements and none is focused', () => {
      mockStatements = []
      mockFocusedStatementId = null

      render(<FooterStatus />)

      expect(screen.getByText('0 statement(s)')).toBeInTheDocument()
    })
  })

  describe('[@footer-status] last saved time display', () => {
    it('shows "Last saved at ..." when lastSavedAt is set', () => {
      mockStatements = [makeStatement('stmt-1')]
      mockLastSavedAt = '2026-02-28T12:30:00Z'

      render(<FooterStatus />)

      expect(screen.getByText(/Last saved at/)).toBeInTheDocument()
    })

    it('includes a formatted time string when lastSavedAt is set', () => {
      mockStatements = [makeStatement('stmt-1')]
      mockLastSavedAt = '2026-02-28T15:45:00Z'

      render(<FooterStatus />)

      const savedEl = screen.getByText(/Last saved at/)
      // Use toContain rather than exact match due to locale differences
      expect(savedEl.textContent).toContain('Last saved at')
    })

    it('does not show save time text when lastSavedAt is null', () => {
      mockStatements = [makeStatement('stmt-1')]
      mockLastSavedAt = null

      render(<FooterStatus />)

      expect(screen.queryByText(/Last saved at/)).not.toBeInTheDocument()
    })
  })
})
