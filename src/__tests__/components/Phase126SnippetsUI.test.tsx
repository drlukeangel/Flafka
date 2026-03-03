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
import { render, screen } from '@testing-library/react'
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
// NavRail — snippets nav item
// ---------------------------------------------------------------------------

describe('[@phase-12.6-snippets-ui] NavRail — snippets item', () => {
  it('renders a nav item with aria-label="Snippets"', () => {
    render(<NavRail />)
    const snippetsBtn = screen.getByLabelText('Snippets')
    expect(snippetsBtn).toBeTruthy()
  })
})
