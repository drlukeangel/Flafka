import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { TreeNode } from '../../types'

// ---------------------------------------------------------------------------
// Store mock — controlled via module-level variables so each test can mutate
// state before rendering.
// ---------------------------------------------------------------------------
let mockTreeNodes: TreeNode[] = []
let mockTreeLoading = false
let mockSelectedNodeId: string | null = null
let mockSelectedTableName: string | null = null
let mockSelectedTableSchema: { name: string; type: string }[] = []
let mockSchemaLoading = false

const mockToggleTreeNode = vi.fn()
const mockSelectTreeNode = vi.fn()
const mockAddStatement = vi.fn()
const mockLoadTableSchema = vi.fn()
const mockLoadTreeData = vi.fn()
const mockAddToast = vi.fn()

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    treeNodes: mockTreeNodes,
    treeLoading: mockTreeLoading,
    selectedNodeId: mockSelectedNodeId,
    selectedTableName: mockSelectedTableName,
    selectedTableSchema: mockSelectedTableSchema,
    schemaLoading: mockSchemaLoading,
    toggleTreeNode: mockToggleTreeNode,
    selectTreeNode: mockSelectTreeNode,
    addStatement: mockAddStatement,
    loadTreeData: mockLoadTreeData,
    loadTableSchema: mockLoadTableSchema,
    addToast: mockAddToast,
    catalog: 'prod',
    database: 'warehouse',
  }),
}))

// Mock editorRegistry — insertion behaviour is not under test here.
vi.mock('../../components/EditorCell/editorRegistry', () => ({
  insertTextAtCursor: vi.fn().mockReturnValue(false),
}))

// ---------------------------------------------------------------------------
// Re-implement the private pure functions under test.
// These mirror TreeNavigator.tsx exactly so we can unit-test them without
// exporting them from the component module.
// ---------------------------------------------------------------------------

/** Quote SQL identifiers that contain non-alphanumeric chars or start with a digit. */
function quoteIdentifierIfNeeded(name: string): string {
  if (/[^a-zA-Z0-9_]/.test(name) || /^[0-9]/.test(name)) {
    return `\`${name}\``
  }
  return name
}

/** Escape special regex characters in a user-supplied search string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Recursively filter tree nodes by name query.
 * Returns the original array reference when query is empty/whitespace.
 */
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes

  const lower = query.toLowerCase()

  return nodes.reduce<TreeNode[]>((acc, node) => {
    const nameMatches = node.name.toLowerCase().includes(lower)

    if (node.children && node.children.length > 0) {
      const filteredChildren = filterTree(node.children, query)
      if (nameMatches || filteredChildren.length > 0) {
        acc.push({
          ...node,
          isExpanded: filteredChildren.length > 0 ? true : node.isExpanded,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        })
      }
    } else {
      if (nameMatches) {
        acc.push(node)
      }
    }

    return acc
  }, [])
}

// ---------------------------------------------------------------------------
// Fixture factory — matches the task spec exactly:
//   catalog "prod"
//     database "warehouse"
//       Tables category
//         table "customers"
//         table "orders"
//       Views category
//         view "current_orders"
// ---------------------------------------------------------------------------

function makeTreeFixture(): TreeNode[] {
  return [
    {
      id: 'catalog-prod',
      name: 'prod',
      type: 'catalog',
      isExpanded: true,
      children: [
        {
          id: 'db-warehouse',
          name: 'warehouse',
          type: 'database',
          isExpanded: true,
          children: [
            {
              id: 'tables-cat',
              name: 'Tables',
              type: 'tables',
              isExpanded: true,
              children: [
                {
                  id: 'table-customers',
                  name: 'customers',
                  type: 'table',
                  children: [],
                },
                {
                  id: 'table-orders',
                  name: 'orders',
                  type: 'table',
                  children: [],
                },
              ],
            },
            {
              id: 'views-cat',
              name: 'Views',
              type: 'views',
              isExpanded: true,
              children: [
                {
                  id: 'view-current-orders',
                  name: 'current_orders',
                  type: 'view',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}

// Import after mocks are declared so the component picks up mocked modules.
import TreeNavigator from '../../components/TreeNavigator/TreeNavigator'

// ===========================================================================
// Part A: Pure utility unit tests — quoteIdentifierIfNeeded
// ===========================================================================

describe('[@tree-navigator] quoteIdentifierIfNeeded', () => {
  it('returns plain alphabetic name "users" unchanged', () => {
    expect(quoteIdentifierIfNeeded('users')).toBe('users')
  })

  it('returns plain alphanumeric name with underscores unchanged', () => {
    expect(quoteIdentifierIfNeeded('users_fact')).toBe('users_fact')
  })

  it('returns SQL keyword "table" unchanged — implementation is char-based, not keyword-based', () => {
    // The implementation only checks for non-alphanumeric characters or a
    // leading digit; it does NOT maintain a reserved-word list.  "table" is
    // pure alpha so it passes through unquoted.  This documents the actual
    // designed behaviour: callers must quote reserved-word identifiers
    // themselves if needed at the query-generation level.
    expect(quoteIdentifierIfNeeded('table')).toBe('table')
  })

  it('wraps a name containing a space in backticks', () => {
    expect(quoteIdentifierIfNeeded('my table')).toBe('`my table`')
  })

  it('wraps a name containing "$" in backticks', () => {
    expect(quoteIdentifierIfNeeded('user$')).toBe('`user$`')
  })

  it('wraps a name starting with a digit in backticks', () => {
    expect(quoteIdentifierIfNeeded('1table')).toBe('`1table`')
  })

  it('wraps a name containing a hyphen in backticks', () => {
    expect(quoteIdentifierIfNeeded('my-table')).toBe('`my-table`')
  })

  it('wraps a name containing a dot in backticks', () => {
    expect(quoteIdentifierIfNeeded('schema.table')).toBe('`schema.table`')
  })

  it('returns underscore-prefixed name unchanged', () => {
    expect(quoteIdentifierIfNeeded('_private')).toBe('_private')
  })
})

// ===========================================================================
// Part A: Pure utility unit tests — filterTree
// ===========================================================================

describe('[@tree-navigator] filterTree', () => {
  // ------------------------------------------------------------------
  // Flat leaf-only tree used for simple match/no-match scenarios.
  // ------------------------------------------------------------------
  const makeLeafTree = (): TreeNode[] => [
    { id: 'l1', name: 'users_fact', type: 'table', children: [] },
    { id: 'l2', name: 'orders_dim', type: 'table', children: [] },
  ]

  // ------------------------------------------------------------------
  // Deep nested tree used to verify ancestor preservation:
  //   catalog "analytics" → database "reporting" → table "events"
  //     → leaf "col_id"
  //     → leaf "event_ts"
  // ------------------------------------------------------------------
  const makeDeepTree = (): TreeNode[] => [
    {
      id: 'cat-1',
      name: 'analytics',
      type: 'catalog',
      isExpanded: false,
      children: [
        {
          id: 'db-1',
          name: 'reporting',
          type: 'database',
          isExpanded: false,
          children: [
            {
              id: 'tbl-1',
              name: 'events',
              type: 'table',
              isExpanded: false,
              children: [
                { id: 'col-1', name: 'col_id', type: 'table', children: [] },
                { id: 'col-2', name: 'event_ts', type: 'table', children: [] },
              ],
            },
          ],
        },
      ],
    },
  ]

  it('returns full tree unchanged (same reference) when query is empty string', () => {
    const nodes = makeLeafTree()
    expect(filterTree(nodes, '')).toBe(nodes)
  })

  it('returns full tree unchanged when query is whitespace only', () => {
    const nodes = makeLeafTree()
    expect(filterTree(nodes, '   ')).toBe(nodes)
  })

  it('returns empty array when query matches nothing', () => {
    const result = filterTree(makeLeafTree(), 'nonexistent')
    expect(result).toHaveLength(0)
  })

  it('keeps matching leaf node "users_fact" when searching "users"', () => {
    // "users" is a substring of "users_fact" — the node must survive filtering.
    const result = filterTree(makeLeafTree(), 'users')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('users_fact')
  })

  it('excludes leaf nodes that do not match the query', () => {
    const result = filterTree(makeLeafTree(), 'users')
    const names = result.map((n) => n.name)
    expect(names).not.toContain('orders_dim')
  })

  it('preserves all ancestors when deep leaf "col_id" matches search "col"', () => {
    // Deep tree: analytics → reporting → events → col_id
    // Searching "col" must return the full ancestor chain down to the matching leaf.
    const result = filterTree(makeDeepTree(), 'col')
    expect(result).toHaveLength(1)

    const catalog = result[0]
    expect(catalog.name).toBe('analytics')

    const database = catalog.children![0]
    expect(database.name).toBe('reporting')

    const table = database.children![0]
    expect(table.name).toBe('events')

    // Only "col_id" should remain; "event_ts" must be filtered out.
    expect(table.children).toHaveLength(1)
    expect(table.children![0].name).toBe('col_id')
  })

  it('sets isExpanded=true on parent nodes that have matching descendants', () => {
    // All collapsed ancestors must be forced open so the matching leaf is visible.
    const result = filterTree(makeDeepTree(), 'col')
    expect(result[0].isExpanded).toBe(true)
    expect(result[0].children![0].isExpanded).toBe(true)
    expect(result[0].children![0].children![0].isExpanded).toBe(true)
  })

  it('is case-insensitive', () => {
    const lower = filterTree(makeLeafTree(), 'users')
    const upper = filterTree(makeLeafTree(), 'USERS')
    const mixed = filterTree(makeLeafTree(), 'UsErS')

    expect(lower[0].name).toBe('users_fact')
    expect(upper[0].name).toBe('users_fact')
    expect(mixed[0].name).toBe('users_fact')
  })

  it('keeps parent when its own name matches even if no children match', () => {
    const result = filterTree(makeDeepTree(), 'analytics')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('analytics')
  })
})

// ===========================================================================
// Part A: HighlightedLabel — tested through TreeNavigator renders
// ===========================================================================
// HighlightedLabel is a private component inside TreeNavigator.tsx.  We
// exercise it by rendering TreeNavigator with a search query active and
// inspecting .tree-highlight spans in the produced DOM.

describe('[@tree-navigator] HighlightedLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTreeLoading = false
    mockSelectedNodeId = null
    mockSelectedTableName = null
    mockSelectedTableSchema = []
    mockSchemaLoading = false
    // Minimal tree: catalog with two leaf tables "users_fact" and "foo"
    mockTreeNodes = [
      {
        id: 'cat-1',
        name: 'catalog1',
        type: 'catalog',
        isExpanded: true,
        children: [
          { id: 'tbl-1', name: 'users_fact', type: 'table', children: [] },
          { id: 'tbl-2', name: 'foo', type: 'table', children: [] },
        ],
      },
    ]
  })

  it('renders plain text with no highlight spans when search query is empty', () => {
    render(<TreeNavigator />)

    const labels = document.querySelectorAll('.node-label')
    const usersLabel = Array.from(labels).find((el) => el.textContent === 'users_fact')
    expect(usersLabel).toBeTruthy()
    // No .tree-highlight span should exist inside a label without a search query
    expect(usersLabel!.querySelector('.tree-highlight')).toBeNull()
  })

  it('wraps matching substring "users" in .tree-highlight when searching "users"', async () => {
    const user = userEvent.setup()
    render(<TreeNavigator />)

    await user.type(screen.getByPlaceholderText('Filter objects...'), 'users')

    const highlights = document.querySelectorAll('.tree-highlight')
    const highlightTexts = Array.from(highlights).map((el) => el.textContent)
    expect(highlightTexts).toContain('users')
  })

  it('does NOT produce a .tree-highlight span for "foo" when searching "bar" (no match)', async () => {
    const user = userEvent.setup()
    render(<TreeNavigator />)

    // "bar" is absent from both "users_fact" and "foo"; both nodes should vanish.
    await user.type(screen.getByPlaceholderText('Filter objects...'), 'bar')

    expect(screen.queryByText('foo')).not.toBeInTheDocument()
    // No highlight spans at all should exist
    expect(document.querySelectorAll('.tree-highlight')).toHaveLength(0)
  })

  it('renders the non-matching portion of "users_fact" outside the highlight span', async () => {
    const user = userEvent.setup()
    render(<TreeNavigator />)

    await user.type(screen.getByPlaceholderText('Filter objects...'), 'users')

    const labels = document.querySelectorAll('.node-label')
    const usersLabel = Array.from(labels).find((el) => el.textContent === 'users_fact')
    expect(usersLabel).toBeTruthy()

    // Only "users" is highlighted; full label text is still "users_fact"
    const highlight = usersLabel!.querySelector('.tree-highlight')
    expect(highlight!.textContent).toBe('users')
    expect(usersLabel!.textContent).toBe('users_fact')
  })
})

// ===========================================================================
// Part B: Component tests — fixture: prod/warehouse/customers+orders/Views/current_orders
// ===========================================================================

describe('[@tree-navigator] TreeNavigator component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTreeLoading = false
    mockSelectedNodeId = null
    mockSelectedTableName = null
    mockSelectedTableSchema = []
    mockSchemaLoading = false
    mockTreeNodes = makeTreeFixture()
  })

  // -------------------------------------------------------------------------
  // B1. Loading state
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] loading state', () => {
    it('shows loading text when treeLoading is true', () => {
      mockTreeLoading = true
      mockTreeNodes = []

      render(<TreeNavigator />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('does not render tree nodes while loading', () => {
      mockTreeLoading = true
      mockTreeNodes = makeTreeFixture()

      render(<TreeNavigator />)

      expect(screen.queryByText('prod')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // B2. Empty state
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] empty state', () => {
    it('shows "No database objects found" when nodes array is empty and not loading', () => {
      mockTreeNodes = []

      render(<TreeNavigator />)

      expect(screen.getByText('No database objects found')).toBeInTheDocument()
    })

    it('does not show empty message when tree has nodes', () => {
      render(<TreeNavigator />)

      expect(screen.queryByText('No database objects found')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // B3. Tree renders all fixture nodes
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] tree rendering', () => {
    it('renders catalog node "prod"', () => {
      render(<TreeNavigator />)
      expect(screen.getByText('prod')).toBeInTheDocument()
    })

    it('renders database node "warehouse"', () => {
      render(<TreeNavigator />)
      expect(screen.getByText('warehouse')).toBeInTheDocument()
    })

    it('renders the Tables category node', () => {
      render(<TreeNavigator />)
      expect(screen.getByText('Tables')).toBeInTheDocument()
    })

    it('renders the Views category node', () => {
      render(<TreeNavigator />)
      expect(screen.getByText('Views')).toBeInTheDocument()
    })

    it('renders leaf table "customers"', () => {
      render(<TreeNavigator />)
      expect(screen.getByText('customers')).toBeInTheDocument()
    })

    it('renders leaf table "orders"', () => {
      render(<TreeNavigator />)
      expect(screen.getByText('orders')).toBeInTheDocument()
    })

    it('renders leaf view "current_orders"', () => {
      render(<TreeNavigator />)
      expect(screen.getByText('current_orders')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // B4. Node expansion — click toggles expansion and calls toggleTreeNode
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] node expansion', () => {
    it('clicking catalog node calls toggleTreeNode with catalog ID', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.click(screen.getByText('prod'))

      expect(mockToggleTreeNode).toHaveBeenCalledWith('catalog-prod')
    })

    it('clicking database node calls toggleTreeNode with database ID', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.click(screen.getByText('warehouse'))

      expect(mockToggleTreeNode).toHaveBeenCalledWith('db-warehouse')
    })

    it('clicking Tables category calls toggleTreeNode with Tables ID', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.click(screen.getByText('Tables'))

      expect(mockToggleTreeNode).toHaveBeenCalledWith('tables-cat')
    })

    it('clicking Views category calls toggleTreeNode with Views ID', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.click(screen.getByText('Views'))

      expect(mockToggleTreeNode).toHaveBeenCalledWith('views-cat')
    })
  })

  // -------------------------------------------------------------------------
  // B5. Node selection — click calls selectTreeNode with the node ID
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] node selection', () => {
    it('clicking "customers" calls selectTreeNode with its ID', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.click(screen.getByText('customers'))

      expect(mockSelectTreeNode).toHaveBeenCalledWith('table-customers')
    })

    it('clicking "orders" calls selectTreeNode with its ID', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.click(screen.getByText('orders'))

      expect(mockSelectTreeNode).toHaveBeenCalledWith('table-orders')
    })

    it('clicking "current_orders" calls selectTreeNode with its ID', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.click(screen.getByText('current_orders'))

      expect(mockSelectTreeNode).toHaveBeenCalledWith('view-current-orders')
    })
  })

  // -------------------------------------------------------------------------
  // B6. Double-click table/view — generates SELECT * SQL and calls addStatement
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] double-click table generates SELECT *', () => {
    it('double-clicking "customers" calls addStatement with the correct SELECT * query', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.dblClick(screen.getByText('customers'))

      expect(mockAddStatement).toHaveBeenCalledWith(
        'SELECT * FROM `prod`.`warehouse`.`customers` LIMIT 10;',
      )
    })

    it('double-clicking "orders" calls addStatement with the correct SELECT * query', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.dblClick(screen.getByText('orders'))

      expect(mockAddStatement).toHaveBeenCalledWith(
        'SELECT * FROM `prod`.`warehouse`.`orders` LIMIT 10;',
      )
    })

    it('double-clicking view "current_orders" calls addStatement with the correct SELECT * query', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.dblClick(screen.getByText('current_orders'))

      expect(mockAddStatement).toHaveBeenCalledWith(
        'SELECT * FROM `prod`.`warehouse`.`current_orders` LIMIT 10;',
      )
    })
  })

  // -------------------------------------------------------------------------
  // B7. Search — filters visible nodes, shows no-result message
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] search filtering', () => {
    it('typing filters tree to only matching nodes', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.type(screen.getByPlaceholderText('Filter objects...'), 'customers')

      expect(screen.getByText('customers')).toBeInTheDocument()
      expect(screen.queryByText('orders')).not.toBeInTheDocument()
    })

    it('shows "No results for X" when query matches nothing', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      await user.type(screen.getByPlaceholderText('Filter objects...'), 'nonexistent')

      expect(screen.getByText(/No results for/i)).toBeInTheDocument()
      expect(screen.getByText(/nonexistent/)).toBeInTheDocument()
    })

    it('shows all nodes again after clearing the search', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      const input = screen.getByPlaceholderText('Filter objects...')
      await user.type(input, 'customers')
      await user.clear(input)

      expect(screen.getByText('customers')).toBeInTheDocument()
      expect(screen.getByText('orders')).toBeInTheDocument()
      expect(screen.getByText('current_orders')).toBeInTheDocument()
    })

    it('clear button resets the input and restores all tree nodes', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      const input = screen.getByPlaceholderText('Filter objects...')
      await user.type(input, 'customers')

      await user.click(screen.getByRole('button', { name: /clear filter/i }))

      expect(input).toHaveValue('')
      expect(screen.getByText('orders')).toBeInTheDocument()
    })

    it('does not render clear button when search input is empty', () => {
      render(<TreeNavigator />)
      expect(screen.queryByRole('button', { name: /clear filter/i })).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // B8. Schema panel — visibility, column list, refresh button
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] schema panel', () => {
    it('schema panel is NOT rendered when selectedTableName is null', () => {
      mockSelectedTableName = null

      render(<TreeNavigator />)

      expect(screen.queryByRole('region', { name: /table schema/i })).not.toBeInTheDocument()
    })

    it('schema panel IS rendered when selectedTableName is set', () => {
      mockSelectedTableName = 'customers'
      mockSelectedTableSchema = [{ name: 'id', type: 'BIGINT' }]

      render(<TreeNavigator />)

      expect(screen.getByRole('region', { name: /table schema/i })).toBeInTheDocument()
    })

    it('schema panel header shows the selected table name', () => {
      mockSelectedTableName = 'customers'
      mockSelectedTableSchema = [{ name: 'id', type: 'BIGINT' }]

      render(<TreeNavigator />)

      const panel = screen.getByRole('region', { name: /table schema/i })
      expect(within(panel).getByText('customers')).toBeInTheDocument()
    })

    it('renders all schema columns and their types', () => {
      mockSelectedTableName = 'customers'
      mockSelectedTableSchema = [
        { name: 'id', type: 'BIGINT' },
        { name: 'name', type: 'VARCHAR' },
        { name: 'created_at', type: 'TIMESTAMP' },
      ]

      render(<TreeNavigator />)

      expect(screen.getByText('id')).toBeInTheDocument()
      expect(screen.getByText('BIGINT')).toBeInTheDocument()
      expect(screen.getByText('name')).toBeInTheDocument()
      expect(screen.getByText('VARCHAR')).toBeInTheDocument()
      expect(screen.getByText('created_at')).toBeInTheDocument()
      expect(screen.getByText('TIMESTAMP')).toBeInTheDocument()
    })

    it('shows "No columns found" when selectedTableSchema is empty', () => {
      mockSelectedTableName = 'empty_table'
      mockSelectedTableSchema = []

      render(<TreeNavigator />)

      expect(screen.getByText('No columns found')).toBeInTheDocument()
    })

    it('refresh button calls loadTableSchema with catalog, database and table name', async () => {
      const user = userEvent.setup()
      mockSelectedTableName = 'customers'
      mockSelectedTableSchema = [{ name: 'id', type: 'BIGINT' }]

      render(<TreeNavigator />)

      await user.click(screen.getByRole('button', { name: /refresh schema/i }))

      // store mock returns catalog='prod', database='warehouse'
      expect(mockLoadTableSchema).toHaveBeenCalledWith('prod', 'warehouse', 'customers')
    })

    it('refresh button is disabled while schemaLoading is true', () => {
      mockSelectedTableName = 'customers'
      mockSelectedTableSchema = []
      mockSchemaLoading = true

      render(<TreeNavigator />)

      expect(screen.getByRole('button', { name: /refresh schema/i })).toBeDisabled()
    })

    it('shows loading text inside schema panel while schemaLoading is true', () => {
      mockSelectedTableName = 'customers'
      mockSelectedTableSchema = []
      mockSchemaLoading = true

      render(<TreeNavigator />)

      const panel = screen.getByRole('region', { name: /table schema/i })
      expect(within(panel).getByText(/loading/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // B9. Category badges — count shown on Tables / Views nodes
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] category badges', () => {
    it('Tables badge shows count equal to number of child tables (2)', () => {
      render(<TreeNavigator />)

      const badges = document.querySelectorAll('.tree-node-badge')
      const badgeValues = Array.from(badges).map((el) => el.textContent)
      // Tables has 2 children: customers and orders
      expect(badgeValues).toContain('2')
    })

    it('Views badge shows count equal to number of child views (1)', () => {
      render(<TreeNavigator />)

      const badges = document.querySelectorAll('.tree-node-badge')
      const badgeValues = Array.from(badges).map((el) => el.textContent)
      // Views has 1 child: current_orders
      expect(badgeValues).toContain('1')
    })
  })

  // -------------------------------------------------------------------------
  // B10. Schema column click-to-copy
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] schema column click-to-copy', () => {
    beforeEach(() => {
      mockSelectedTableName = 'customers'
      mockSelectedTableSchema = [
        { name: 'id', type: 'BIGINT' },
        { name: 'user name', type: 'VARCHAR' },
      ]
    })

    it('clicking a schema column triggers clipboard copy and shows success toast', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText } })

      const user = userEvent.setup()
      render(<TreeNavigator />)

      const colDiv = screen.getByText('id').closest('.schema-column')!
      await user.click(colDiv)

      await vi.waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success', message: 'Copied: id' }),
        )
      })
    })

    it('clicking a schema column with special chars shows success toast with original name', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText } })

      const user = userEvent.setup()
      render(<TreeNavigator />)

      const colDiv = screen.getByText('user name').closest('.schema-column')!
      await user.click(colDiv)

      await vi.waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success', message: 'Copied: user name' }),
        )
      })
    })

    it('schema column has correct title tooltip', () => {
      render(<TreeNavigator />)

      const colDiv = screen.getByText('id').closest('.schema-column')!
      expect(colDiv).toHaveAttribute('title', 'Single-click to copy, double-click to insert at cursor')
    })

    it('applies schema-column--copied class after successful copy', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText } })

      const user = userEvent.setup()
      render(<TreeNavigator />)

      const colDiv = screen.getByText('id').closest('.schema-column')!
      await user.click(colDiv)

      await vi.waitFor(() => {
        // After clicking, the copiedColName state is set and the class is applied
        expect(colDiv).toHaveClass('schema-column--copied')
      })
    })
  })

  // -------------------------------------------------------------------------
  // B11. Schema column double-click to insert at cursor
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] schema column double-click insert', () => {
    beforeEach(() => {
      mockSelectedTableName = 'customers'
      mockSelectedTableSchema = [{ name: 'id', type: 'BIGINT' }]
      // Mock clipboard so single-click doesn't throw
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      })
    })

    it('double-clicking a schema column calls insertTextAtCursor', async () => {
      const { insertTextAtCursor } = await import('../../components/EditorCell/editorRegistry')
      const user = userEvent.setup()
      render(<TreeNavigator />)

      const colDiv = screen.getByText('id').closest('.schema-column')!
      await user.dblClick(colDiv)

      expect(insertTextAtCursor).toHaveBeenCalledWith('id')
    })

    it('shows warning toast when no editor is focused', async () => {
      const user = userEvent.setup()
      render(<TreeNavigator />)

      const colDiv = screen.getByText('id').closest('.schema-column')!
      await user.dblClick(colDiv)

      // insertTextAtCursor is mocked to return false
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning' }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // B12. Copy icon on tree nodes (table/view)
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] tree node copy icon', () => {
    it('copy icon is rendered for table nodes', () => {
      render(<TreeNavigator />)

      const copyBtn = screen.getByLabelText('Copy table name customers')
      expect(copyBtn).toBeInTheDocument()
    })

    it('copy icon has correct title with quoted name', () => {
      render(<TreeNavigator />)

      const copyBtn = screen.getByLabelText('Copy table name customers')
      expect(copyBtn).toHaveAttribute('title', 'Copy: customers')
    })

    it('clicking copy icon shows success toast', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...window.navigator, clipboard: { writeText } })

      const user = userEvent.setup()
      render(<TreeNavigator />)

      const copyBtn = screen.getByLabelText('Copy table name customers')
      await user.click(copyBtn)

      await vi.waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'success', message: 'Copied: customers' }),
        )
      })
    })

    it('clicking copy icon for view node is also available', () => {
      render(<TreeNavigator />)

      const copyBtn = screen.getByLabelText('Copy table name current_orders')
      expect(copyBtn).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // B13. Empty category rendering
  // -------------------------------------------------------------------------
  describe('[@tree-navigator] empty category rendering', () => {
    it('shows "No tables yet" when Tables category is expanded but has no children', () => {
      mockTreeNodes = [
        {
          id: 'catalog-prod',
          name: 'prod',
          type: 'catalog',
          isExpanded: true,
          children: [
            {
              id: 'db-warehouse',
              name: 'warehouse',
              type: 'database',
              isExpanded: true,
              children: [
                {
                  id: 'tables-cat',
                  name: 'Tables',
                  type: 'tables',
                  isExpanded: true,
                  children: [],
                },
              ],
            },
          ],
        },
      ]

      render(<TreeNavigator />)

      expect(screen.getByText('No tables yet')).toBeInTheDocument()
    })

    it('shows "No views yet" when Views category is expanded but has no children', () => {
      mockTreeNodes = [
        {
          id: 'catalog-prod',
          name: 'prod',
          type: 'catalog',
          isExpanded: true,
          children: [
            {
              id: 'db-warehouse',
              name: 'warehouse',
              type: 'database',
              isExpanded: true,
              children: [
                {
                  id: 'views-cat',
                  name: 'Views',
                  type: 'views',
                  isExpanded: true,
                  children: [],
                },
              ],
            },
          ],
        },
      ]

      render(<TreeNavigator />)

      expect(screen.getByText('No views yet')).toBeInTheDocument()
    })

    it('does not show empty message when category is collapsed', () => {
      mockTreeNodes = [
        {
          id: 'catalog-prod',
          name: 'prod',
          type: 'catalog',
          isExpanded: true,
          children: [
            {
              id: 'db-warehouse',
              name: 'warehouse',
              type: 'database',
              isExpanded: true,
              children: [
                {
                  id: 'tables-cat',
                  name: 'Tables',
                  type: 'tables',
                  isExpanded: false,
                  children: [],
                },
              ],
            },
          ],
        },
      ]

      render(<TreeNavigator />)

      expect(screen.queryByText('No tables yet')).not.toBeInTheDocument()
    })

    it('shows badge with 0 count for empty category', () => {
      mockTreeNodes = [
        {
          id: 'catalog-prod',
          name: 'prod',
          type: 'catalog',
          isExpanded: true,
          children: [
            {
              id: 'db-warehouse',
              name: 'warehouse',
              type: 'database',
              isExpanded: true,
              children: [
                {
                  id: 'tables-cat',
                  name: 'Tables',
                  type: 'tables',
                  isExpanded: true,
                  children: [],
                },
              ],
            },
          ],
        },
      ]

      render(<TreeNavigator />)

      const badges = document.querySelectorAll('.tree-node-badge')
      const badgeValues = Array.from(badges).map((el) => el.textContent)
      expect(badgeValues).toContain('0')
    })
  })
})

// ===========================================================================
// Part C: Pure utility — escapeRegex
// ===========================================================================

describe('[@tree-navigator] escapeRegex', () => {
  it('escapes dots', () => {
    expect(escapeRegex('a.b')).toBe('a\\.b')
  })

  it('escapes asterisks', () => {
    expect(escapeRegex('a*b')).toBe('a\\*b')
  })

  it('escapes plus signs', () => {
    expect(escapeRegex('a+b')).toBe('a\\+b')
  })

  it('escapes question marks', () => {
    expect(escapeRegex('a?b')).toBe('a\\?b')
  })

  it('escapes parentheses', () => {
    expect(escapeRegex('(a)')).toBe('\\(a\\)')
  })

  it('escapes square brackets', () => {
    expect(escapeRegex('[abc]')).toBe('\\[abc\\]')
  })

  it('escapes curly braces', () => {
    expect(escapeRegex('{a}')).toBe('\\{a\\}')
  })

  it('escapes caret and dollar', () => {
    expect(escapeRegex('^a$')).toBe('\\^a\\$')
  })

  it('escapes pipe', () => {
    expect(escapeRegex('a|b')).toBe('a\\|b')
  })

  it('escapes backslash', () => {
    expect(escapeRegex('a\\b')).toBe('a\\\\b')
  })

  it('returns plain text unchanged', () => {
    expect(escapeRegex('hello')).toBe('hello')
  })
})
