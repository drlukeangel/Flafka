/**
 * @phase-12.6-snippets-ui
 * Phase 12.6 F6 — SnippetsPanel Component + NavRail UI Tests
 *
 * Covers:
 *   - SnippetsPanel renders snippet list with role="list" / role="listitem"
 *   - SnippetsPanel renders search input with aria-label="Search snippets"
 *   - SnippetsPanel renders empty state with role="status" when no snippets
 *   - "Save new snippet" button has aria-label
 *   - NavRail item 'snippets' renders with aria-label="Snippets"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Snippet } from '../../types'

// ---------------------------------------------------------------------------
// Shared store mock state
// ---------------------------------------------------------------------------

let mockSnippets: Snippet[] = []
const mockAddSnippet = vi.fn().mockReturnValue({ success: true })
const mockDeleteSnippet = vi.fn()
const mockRenameSnippet = vi.fn()
const mockAddStatement = vi.fn()
const mockAddToast = vi.fn()

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      snippets: mockSnippets,
      addSnippet: mockAddSnippet,
      deleteSnippet: mockDeleteSnippet,
      renameSnippet: mockRenameSnippet,
      addStatement: mockAddStatement,
      focusedStatementId: null,
      addToast: mockAddToast,
      // NavRail state
      activeNavItem: 'workspace' as const,
      navExpanded: false,
      setActiveNavItem: vi.fn(),
      toggleNavExpanded: vi.fn(),
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

vi.mock('../../components/EditorCell/editorRegistry', () => ({
  editorRegistry: new Map(),
}))

// Import after mocks
import { SnippetsPanel } from '../../components/SnippetsPanel/SnippetsPanel'
import { NavRail } from '../../components/NavRail/NavRail'

// ---------------------------------------------------------------------------
// SnippetsPanel component tests
// ---------------------------------------------------------------------------

describe('[@phase-12.6-snippets-ui] SnippetsPanel — empty state', () => {
  beforeEach(() => {
    mockSnippets = []
  })

  it('renders empty state with role="status" when no snippets', { timeout: 15000 }, () => {
    render(<SnippetsPanel />)
    const emptyState = screen.getByRole('status')
    expect(emptyState).toBeTruthy()
  })

  it('renders search input with aria-label="Search snippets"', () => {
    render(<SnippetsPanel />)
    const input = screen.getByLabelText('Search snippets')
    expect(input).toBeTruthy()
  })

  it('"Save new snippet" button has aria-label="Save new snippet"', () => {
    render(<SnippetsPanel />)
    const btn = screen.getByLabelText('Save new snippet')
    expect(btn).toBeTruthy()
  })
})

describe('[@phase-12.6-snippets-ui] SnippetsPanel — with snippets', () => {
  beforeEach(() => {
    mockSnippets = [
      {
        id: 's1',
        name: 'My Query',
        sql: 'SELECT 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 's2',
        name: 'Another Query',
        sql: 'SELECT 2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
  })

  it('renders snippet list with role="list"', () => {
    render(<SnippetsPanel />)
    const list = screen.getByRole('list')
    expect(list).toBeTruthy()
  })

  it('renders snippet items with role="listitem"', () => {
    render(<SnippetsPanel />)
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)
  })

  it('renders snippet names', () => {
    render(<SnippetsPanel />)
    expect(screen.getByText('My Query')).toBeTruthy()
    expect(screen.getByText('Another Query')).toBeTruthy()
  })

  it('renders insert button for each snippet with aria-label', () => {
    render(<SnippetsPanel />)
    expect(screen.getByLabelText('Insert snippet My Query')).toBeTruthy()
    expect(screen.getByLabelText('Insert snippet Another Query')).toBeTruthy()
  })

  it('renders delete button for each snippet with aria-label', () => {
    render(<SnippetsPanel />)
    expect(screen.getByLabelText('Delete snippet My Query')).toBeTruthy()
    expect(screen.getByLabelText('Delete snippet Another Query')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// SnippetsPanel — search filtering
// ---------------------------------------------------------------------------

describe('[@phase-12.6-snippets-ui] SnippetsPanel — search filtering', () => {
  beforeEach(() => {
    mockSnippets = [
      { id: 's1', name: 'My Query', sql: 'SELECT 1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 's2', name: 'Another Query', sql: 'SELECT 2 FROM orders', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]
  })

  it('filters snippets by name', async () => {
    render(<SnippetsPanel />)
    const input = screen.getByLabelText('Search snippets')
    await userEvent.type(input, 'Another')
    expect(screen.getByText('Another Query')).toBeTruthy()
    expect(screen.queryByText('My Query')).toBeNull()
  })

  it('filters snippets by sql content', async () => {
    render(<SnippetsPanel />)
    const input = screen.getByLabelText('Search snippets')
    await userEvent.type(input, 'orders')
    expect(screen.getByText('Another Query')).toBeTruthy()
    expect(screen.queryByText('My Query')).toBeNull()
  })

  it('shows "No snippets match" when search has no results', async () => {
    render(<SnippetsPanel />)
    const input = screen.getByLabelText('Search snippets')
    await userEvent.type(input, 'zzzzz_nonexistent')
    expect(screen.getByText('No snippets match your search.')).toBeTruthy()
  })

  it('shows clear button when search is non-empty and clears on click', async () => {
    render(<SnippetsPanel />)
    const input = screen.getByLabelText('Search snippets')
    await userEvent.type(input, 'test')
    const clearBtn = screen.getByLabelText('Clear search')
    expect(clearBtn).toBeTruthy()
    await userEvent.click(clearBtn)
    // Both snippets should be visible again
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('does not show clear button when search is empty', () => {
    render(<SnippetsPanel />)
    expect(screen.queryByLabelText('Clear search')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SnippetsPanel — snippet actions (insert, delete, rename)
// ---------------------------------------------------------------------------

describe('[@phase-12.6-snippets-ui] SnippetsPanel — snippet actions', () => {
  beforeEach(() => {
    mockSnippets = [
      { id: 's1', name: 'My Query', sql: 'SELECT 1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]
    vi.clearAllMocks()
  })

  it('calls deleteSnippet and addToast when delete is clicked', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Delete snippet My Query'))
    expect(mockDeleteSnippet).toHaveBeenCalledWith('s1')
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info', message: expect.stringContaining('deleted') }))
  })

  it('calls addStatement when insert is clicked with no focused editor', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Insert snippet My Query'))
    expect(mockAddStatement).toHaveBeenCalledWith('SELECT 1')
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ message: 'Snippet added as new statement.' }))
  })

  it('enters rename mode when rename button is clicked', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Rename snippet My Query'))
    const input = screen.getByLabelText('Rename snippet')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('My Query')
  })

  it('commits rename on Enter key', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Rename snippet My Query'))
    const input = screen.getByLabelText('Rename snippet')
    await userEvent.clear(input)
    await userEvent.type(input, 'Renamed Query')
    await userEvent.keyboard('{Enter}')
    expect(mockRenameSnippet).toHaveBeenCalledWith('s1', 'Renamed Query')
  })

  it('cancels rename on Escape key', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Rename snippet My Query'))
    await userEvent.keyboard('{Escape}')
    expect(mockRenameSnippet).not.toHaveBeenCalled()
    // Should exit rename mode — snippet name visible again
    expect(screen.getByText('My Query')).toBeTruthy()
  })

  it('commits rename on blur', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Rename snippet My Query'))
    const input = screen.getByLabelText('Rename snippet')
    await userEvent.clear(input)
    await userEvent.type(input, 'Blurred Name')
    fireEvent.blur(input)
    expect(mockRenameSnippet).toHaveBeenCalledWith('s1', 'Blurred Name')
  })

  it('does not commit rename with empty value on blur', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Rename snippet My Query'))
    const input = screen.getByLabelText('Rename snippet')
    await userEvent.clear(input)
    fireEvent.blur(input)
    expect(mockRenameSnippet).not.toHaveBeenCalled()
  })

  it('shows confirm and cancel buttons during rename', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Rename snippet My Query'))
    expect(screen.getByLabelText('Save rename')).toBeTruthy()
    expect(screen.getByLabelText('Cancel rename')).toBeTruthy()
  })

  it('commits rename when confirm button clicked', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Rename snippet My Query'))
    const input = screen.getByLabelText('Rename snippet')
    await userEvent.clear(input)
    await userEvent.type(input, 'Confirmed')
    await userEvent.click(screen.getByLabelText('Save rename'))
    expect(mockRenameSnippet).toHaveBeenCalledWith('s1', 'Confirmed')
  })

  it('shows cancel rename button while in rename mode', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Rename snippet My Query'))
    expect(screen.getByLabelText('Cancel rename')).toBeTruthy()
    expect(screen.getByLabelText('Save rename')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// SnippetsPanel — save dialog
// ---------------------------------------------------------------------------

describe('[@phase-12.6-snippets-ui] SnippetsPanel — save dialog', () => {
  beforeEach(() => {
    mockSnippets = []
    vi.clearAllMocks()
  })

  it('opens save dialog when "Save Snippet" button clicked', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Save new snippet'))
    expect(document.querySelector('.snippets-dialog')).toBeTruthy()
    expect(screen.getByPlaceholderText(/latest events/)).toBeTruthy()
    expect(screen.getByPlaceholderText(/SELECT \* FROM/)).toBeTruthy()
  })

  it('Save button is disabled when name and sql are empty', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Save new snippet'))
    const dialogSave = document.querySelector('.snippets-dialog-btn--save') as HTMLButtonElement
    expect(dialogSave).toBeTruthy()
    expect(dialogSave.disabled).toBe(true)
  })

  it('closes dialog when Cancel is clicked', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Save new snippet'))
    expect(document.querySelector('.snippets-dialog')).toBeTruthy()
    await userEvent.click(screen.getByText('Cancel'))
    expect(document.querySelector('.snippets-dialog')).toBeNull()
  })

  it('closes dialog when close button is clicked', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Save new snippet'))
    expect(document.querySelector('.snippets-dialog')).toBeTruthy()
    await userEvent.click(screen.getByLabelText('Close dialog'))
    expect(document.querySelector('.snippets-dialog')).toBeNull()
  })

  it('closes dialog on overlay click', async () => {
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Save new snippet'))
    const overlay = document.querySelector('.snippets-dialog-overlay')!
    // Click on the overlay itself (not child dialog)
    fireEvent.click(overlay)
    expect(document.querySelector('.snippets-dialog')).toBeNull()
  })

  it('saves snippet successfully and shows toast', async () => {
    mockAddSnippet.mockReturnValue({ success: true })
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Save new snippet'))
    await userEvent.type(screen.getByPlaceholderText(/latest events/), 'Test Snippet')
    await userEvent.type(screen.getByPlaceholderText(/SELECT \* FROM/), 'SELECT 1')
    // Click Save in dialog footer
    const allSaveBtns = screen.getAllByText('Save')
    const dialogSave = allSaveBtns.find(el => el.closest('.snippets-dialog-footer'))!
    await userEvent.click(dialogSave)
    expect(mockAddSnippet).toHaveBeenCalledWith('Test Snippet', 'SELECT 1')
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success', message: expect.stringContaining('saved') }))
  })

  it('shows error when addSnippet returns failure', async () => {
    mockAddSnippet.mockReturnValue({ success: false, error: 'Limit reached' })
    render(<SnippetsPanel />)
    await userEvent.click(screen.getByLabelText('Save new snippet'))
    await userEvent.type(screen.getByPlaceholderText(/latest events/), 'Test')
    await userEvent.type(screen.getByPlaceholderText(/SELECT \* FROM/), 'SELECT 1')
    const allSaveBtns = screen.getAllByText('Save')
    const dialogSave = allSaveBtns.find(el => el.closest('.snippets-dialog-footer'))!
    await userEvent.click(dialogSave)
    expect(screen.getByText('Limit reached')).toBeTruthy()
  })

  it('disables "Save Snippet" button when snippet limit reached', () => {
    mockSnippets = Array.from({ length: 100 }, (_, i) => ({
      id: `s${i}`,
      name: `Snippet ${i}`,
      sql: `SELECT ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    render(<SnippetsPanel />)
    const btn = screen.getByLabelText('Save new snippet')
    expect(btn).toHaveProperty('disabled', true)
  })

  it('shows snippet count badge', () => {
    mockSnippets = [
      { id: 's1', name: 'A', sql: 'SELECT 1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]
    render(<SnippetsPanel />)
    expect(screen.getByText('1/100')).toBeTruthy()
  })

  it('truncates long SQL preview at 200 chars', () => {
    const longSql = 'SELECT ' + 'x'.repeat(250)
    mockSnippets = [
      { id: 's1', name: 'Long', sql: longSql, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]
    render(<SnippetsPanel />)
    const preview = document.querySelector('.snippet-sql-preview')
    expect(preview?.textContent).toContain('...')
    expect(preview?.textContent!.length).toBeLessThanOrEqual(204) // 200 + "..."
  })
})

// ---------------------------------------------------------------------------
// NavRail — snippets nav item
// ---------------------------------------------------------------------------

describe('[@phase-12.6-snippets-ui] NavRail — snippets item', () => {
  it('renders a nav item with aria-label="Snippets"', () => {
    render(<NavRail />)
    const snippetsBtn = screen.getByLabelText('Snippets')
    expect(snippetsBtn).toBeTruthy()
  })
})
