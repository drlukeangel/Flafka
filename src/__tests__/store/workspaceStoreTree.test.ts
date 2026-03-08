/**
 * workspaceStoreTree.test.ts
 *
 * Tests for the tree navigation actions in workspaceStore:
 * loadTreeData, toggleTreeNode, selectTreeNode, loadTableSchema,
 * setCatalog/setDatabase side-effects, runAllStatements, session properties.
 *
 * Strategy: mock the entire flink-api module with vi.fn() stubs
 * so tests can configure per-call responses without hitting the network.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useWorkspaceStore } from '../../store/workspaceStore'

// ---------------------------------------------------------------------------
// Mock flink-api so no real network calls are made
// ---------------------------------------------------------------------------
vi.mock('../../api/flink-api', () => ({
  executeSQL: vi.fn(),
  getStatementStatus: vi.fn(),
  getStatementResults: vi.fn(),
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

import * as flinkApi from '../../api/flink-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useWorkspaceStore.setState({
    catalog: 'test_catalog',
    database: 'test_db',
    catalogs: ['test_catalog'],
    databases: ['test_db'],
    treeNodes: [],
    treeLoading: false,
    selectedNodeId: null,
    selectedTableSchema: [],
    selectedTableName: null,
    schemaLoading: false,
    statements: [
      { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() },
    ],
    toasts: [],
    historyLoading: false,
    historyError: null,
    statementHistory: [],
    jobsLastFetched: null,
    jobsCacheFilterMode: null,
    historyLastFetched: null,
    historyCacheFilterMode: null,
    _jobsFetchGen: 0,
    _historyFetchGen: 0,
    cacheTtlMinutes: 10,
    userLaunchedStatements: [],
    sessionProperties: {
      'sql.local-time-zone': 'UTC',
    },
  })
}

// ---------------------------------------------------------------------------
// loadTreeData tests
// ---------------------------------------------------------------------------

describe('[@store] [@tree] loadTreeData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('sets treeLoading=true at start and false after success', async () => {
    vi.mocked(flinkApi.getTables).mockResolvedValue(['orders', 'users'])
    vi.mocked(flinkApi.getViews).mockResolvedValue(['v_orders'])
    vi.mocked(flinkApi.getFunctions).mockResolvedValue(['udf_clean'])

    const promise = useWorkspaceStore.getState().loadTreeData()

    // Loading should be true right after calling
    expect(useWorkspaceStore.getState().treeLoading).toBe(true)

    await promise

    expect(useWorkspaceStore.getState().treeLoading).toBe(false)
  })

  it('builds a tree with catalog, database, tables, views, functions nodes', async () => {
    vi.mocked(flinkApi.getTables).mockResolvedValue(['orders', 'users'])
    vi.mocked(flinkApi.getViews).mockResolvedValue(['v_active'])
    vi.mocked(flinkApi.getFunctions).mockResolvedValue(['my_udf'])

    await useWorkspaceStore.getState().loadTreeData()

    const { treeNodes } = useWorkspaceStore.getState()
    expect(treeNodes).toHaveLength(1)

    const catalogNode = treeNodes[0]!
    expect(catalogNode.type).toBe('catalog')
    expect(catalogNode.name).toBe('test_catalog')

    const dbNode = catalogNode.children![0]!
    expect(dbNode.type).toBe('database')
    expect(dbNode.name).toBe('test_db')

    const tablesNode = dbNode.children!.find(n => n.type === 'tables')
    expect(tablesNode).toBeDefined()
    expect(tablesNode!.children).toHaveLength(2)
    expect(tablesNode!.children![0]!.name).toBe('orders')
    expect(tablesNode!.children![1]!.name).toBe('users')

    const viewsNode = dbNode.children!.find(n => n.type === 'views')
    expect(viewsNode).toBeDefined()
    expect(viewsNode!.children).toHaveLength(1)
    expect(viewsNode!.children![0]!.name).toBe('v_active')

    const funcNode = dbNode.children!.find(n => n.type === 'functions')
    expect(funcNode).toBeDefined()
    expect(funcNode!.children).toHaveLength(1)
    expect(funcNode!.children![0]!.name).toBe('my_udf')
  })

  it('creates table nodes with correct type and metadata', async () => {
    vi.mocked(flinkApi.getTables).mockResolvedValue(['my_table'])
    vi.mocked(flinkApi.getViews).mockResolvedValue([])
    vi.mocked(flinkApi.getFunctions).mockResolvedValue([])

    await useWorkspaceStore.getState().loadTreeData()

    const { treeNodes } = useWorkspaceStore.getState()
    const tablesNode = treeNodes[0]!.children![0]!.children!.find(n => n.type === 'tables')
    const tableNode = tablesNode!.children![0]!

    expect(tableNode.type).toBe('table')
    expect(tableNode.name).toBe('my_table')
    expect(tableNode.metadata?.catalog).toBe('test_catalog')
    expect(tableNode.metadata?.database).toBe('test_db')
  })

  it('sets treeLoading=false and shows error toast when API fails', async () => {
    vi.mocked(flinkApi.getTables).mockRejectedValue(new Error('Network error'))
    vi.mocked(flinkApi.getViews).mockRejectedValue(new Error('Network error'))
    vi.mocked(flinkApi.getFunctions).mockRejectedValue(new Error('Network error'))

    await useWorkspaceStore.getState().loadTreeData()

    const state = useWorkspaceStore.getState()
    expect(state.treeLoading).toBe(false)
    // Error toast should have been added
    expect(state.toasts.some(t => t.type === 'error')).toBe(true)
  })

  it('uses catalog and database from store state when calling APIs', async () => {
    vi.mocked(flinkApi.getTables).mockResolvedValue([])
    vi.mocked(flinkApi.getViews).mockResolvedValue([])
    vi.mocked(flinkApi.getFunctions).mockResolvedValue([])

    await useWorkspaceStore.getState().loadTreeData()

    expect(flinkApi.getTables).toHaveBeenCalledWith('test_catalog', 'test_db')
    expect(flinkApi.getViews).toHaveBeenCalledWith('test_catalog', 'test_db')
    expect(flinkApi.getFunctions).toHaveBeenCalledWith('test_catalog', 'test_db')
  })
})

// ---------------------------------------------------------------------------
// toggleTreeNode tests
// ---------------------------------------------------------------------------

describe('[@store] [@tree] toggleTreeNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()

    // Set up a tree with some nodes
    useWorkspaceStore.setState({
      treeNodes: [
        {
          id: 'cat-1',
          name: 'catalog1',
          type: 'catalog',
          isExpanded: true,
          children: [
            {
              id: 'db-1',
              name: 'db1',
              type: 'database',
              isExpanded: false,
              children: [],
            },
          ],
        },
      ],
    })
  })

  it('collapses an expanded node', () => {
    useWorkspaceStore.getState().toggleTreeNode('cat-1')

    const { treeNodes } = useWorkspaceStore.getState()
    expect(treeNodes[0]!.isExpanded).toBe(false)
  })

  it('expands a collapsed node', () => {
    // db-1 starts as collapsed (isExpanded=false)
    useWorkspaceStore.getState().toggleTreeNode('db-1')

    const { treeNodes } = useWorkspaceStore.getState()
    const dbNode = treeNodes[0]!.children![0]!
    expect(dbNode.isExpanded).toBe(true)
  })

  it('does not affect other nodes when toggling one', () => {
    useWorkspaceStore.getState().toggleTreeNode('db-1')

    const { treeNodes } = useWorkspaceStore.getState()
    // cat-1 should still be expanded
    expect(treeNodes[0]!.isExpanded).toBe(true)
  })

  it('double-toggle returns node to original state', () => {
    useWorkspaceStore.getState().toggleTreeNode('cat-1')
    useWorkspaceStore.getState().toggleTreeNode('cat-1')

    const { treeNodes } = useWorkspaceStore.getState()
    expect(treeNodes[0]!.isExpanded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// selectTreeNode tests
// ---------------------------------------------------------------------------

describe('[@store] [@tree] selectTreeNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()

    // Set up a tree with a table node
    useWorkspaceStore.setState({
      treeNodes: [
        {
          id: 'cat-1',
          name: 'catalog1',
          type: 'catalog',
          isExpanded: true,
          children: [
            {
              id: 'db-1',
              name: 'db1',
              type: 'database',
              isExpanded: true,
              children: [
                {
                  id: 'tables-1',
                  name: 'Tables',
                  type: 'tables',
                  isExpanded: true,
                  children: [
                    {
                      id: 'table-orders',
                      name: 'orders',
                      type: 'table',
                      metadata: { catalog: 'catalog1', database: 'db1' },
                    },
                    {
                      id: 'table-users',
                      name: 'users',
                      type: 'table',
                      metadata: { catalog: 'catalog1', database: 'db1' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('sets selectedNodeId to the clicked node', () => {
    vi.mocked(flinkApi.getTableSchema).mockResolvedValue([])

    useWorkspaceStore.getState().selectTreeNode('table-orders')

    expect(useWorkspaceStore.getState().selectedNodeId).toBe('table-orders')
  })

  it('triggers loadTableSchema when selecting a table node', () => {
    vi.mocked(flinkApi.getTableSchema).mockResolvedValue([])

    useWorkspaceStore.getState().selectTreeNode('table-orders')

    expect(flinkApi.getTableSchema).toHaveBeenCalledWith('catalog1', 'db1', 'orders')
  })

  it('sets selectedTableName to node name when selecting table', () => {
    vi.mocked(flinkApi.getTableSchema).mockResolvedValue([])

    useWorkspaceStore.getState().selectTreeNode('table-users')

    expect(useWorkspaceStore.getState().selectedTableName).toBe('users')
  })

  it('clears selectedTableName when selecting a non-table node', () => {
    // First select a table
    vi.mocked(flinkApi.getTableSchema).mockResolvedValue([])
    useWorkspaceStore.getState().selectTreeNode('table-orders')
    expect(useWorkspaceStore.getState().selectedTableName).toBe('orders')

    // Then select a non-table node (database)
    useWorkspaceStore.getState().selectTreeNode('db-1')

    expect(useWorkspaceStore.getState().selectedTableName).toBeNull()
    expect(useWorkspaceStore.getState().selectedTableSchema).toEqual([])
  })

  it('does not call loadTableSchema when selecting a non-table node', () => {
    useWorkspaceStore.getState().selectTreeNode('cat-1')

    expect(flinkApi.getTableSchema).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// loadTableSchema tests
// ---------------------------------------------------------------------------

describe('[@store] [@tree] loadTableSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('sets schemaLoading=true then false after success', async () => {
    const mockSchema = [
      { name: 'id', type: 'BIGINT', nullable: false },
      { name: 'name', type: 'STRING', nullable: true },
    ]
    vi.mocked(flinkApi.getTableSchema).mockResolvedValue(mockSchema)

    const promise = useWorkspaceStore.getState().loadTableSchema('cat', 'db', 'orders')

    expect(useWorkspaceStore.getState().schemaLoading).toBe(true)

    await promise

    expect(useWorkspaceStore.getState().schemaLoading).toBe(false)
  })

  it('stores schema columns in selectedTableSchema after success', async () => {
    const mockSchema = [
      { name: 'id', type: 'BIGINT', nullable: false },
      { name: 'email', type: 'STRING', nullable: true },
    ]
    vi.mocked(flinkApi.getTableSchema).mockResolvedValue(mockSchema)

    await useWorkspaceStore.getState().loadTableSchema('cat', 'db', 'orders')

    const { selectedTableSchema } = useWorkspaceStore.getState()
    expect(selectedTableSchema).toHaveLength(2)
    expect(selectedTableSchema[0]!.name).toBe('id')
    expect(selectedTableSchema[1]!.name).toBe('email')
  })

  it('clears selectedTableSchema on start of load', async () => {
    // Pre-populate schema
    useWorkspaceStore.setState({ selectedTableSchema: [{ name: 'old', type: 'STRING' }] })

    vi.mocked(flinkApi.getTableSchema).mockResolvedValue([])

    await useWorkspaceStore.getState().loadTableSchema('cat', 'db', 'new_table')

    expect(useWorkspaceStore.getState().selectedTableSchema).toEqual([])
  })

  it('sets schemaLoading=false on error', async () => {
    vi.mocked(flinkApi.getTableSchema).mockRejectedValue(new Error('Schema load failed'))

    await useWorkspaceStore.getState().loadTableSchema('cat', 'db', 'orders')

    expect(useWorkspaceStore.getState().schemaLoading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// setCatalog / setDatabase side effects
// ---------------------------------------------------------------------------

describe('[@store] [@catalog] setCatalog and setDatabase side effects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()

    // Set up API stubs for the chain calls
    vi.mocked(flinkApi.getDatabases).mockResolvedValue(['db1', 'db2'])
    vi.mocked(flinkApi.getTables).mockResolvedValue([])
    vi.mocked(flinkApi.getViews).mockResolvedValue([])
    vi.mocked(flinkApi.getFunctions).mockResolvedValue([])
  })

  it('setCatalog updates the catalog in state', () => {
    useWorkspaceStore.getState().setCatalog('new_catalog')

    expect(useWorkspaceStore.getState().catalog).toBe('new_catalog')
  })

  it('setCatalog triggers loadDatabases with the new catalog', async () => {
    useWorkspaceStore.getState().setCatalog('new_catalog')

    // Allow async calls to complete
    await vi.waitFor(() => {
      expect(flinkApi.getDatabases).toHaveBeenCalledWith('new_catalog')
    })
  })

  it('setCatalog triggers loadTreeData (calls getTables etc.)', async () => {
    useWorkspaceStore.getState().setCatalog('new_catalog')

    await vi.waitFor(() => {
      expect(flinkApi.getTables).toHaveBeenCalled()
    })
  })

  it('setDatabase updates the database in state', () => {
    useWorkspaceStore.getState().setDatabase('new_db')

    expect(useWorkspaceStore.getState().database).toBe('new_db')
  })

  it('setDatabase triggers loadTreeData', async () => {
    useWorkspaceStore.getState().setDatabase('new_db')

    await vi.waitFor(() => {
      expect(flinkApi.getTables).toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// loadCatalogs tests
// ---------------------------------------------------------------------------

describe('[@store] [@catalog] loadCatalogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('stores returned catalogs in state', async () => {
    vi.mocked(flinkApi.getCatalogs).mockResolvedValue(['catalog_a', 'catalog_b'])

    await useWorkspaceStore.getState().loadCatalogs()

    expect(useWorkspaceStore.getState().catalogs).toEqual(['catalog_a', 'catalog_b'])
  })

  it('adds error toast when getCatalogs fails', async () => {
    vi.mocked(flinkApi.getCatalogs).mockRejectedValue(new Error('API down'))

    await useWorkspaceStore.getState().loadCatalogs()

    const { toasts } = useWorkspaceStore.getState()
    expect(toasts.some(t => t.type === 'error' && t.message.includes('catalog'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// loadDatabases tests
// ---------------------------------------------------------------------------

describe('[@store] [@catalog] loadDatabases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('stores returned databases in state', async () => {
    vi.mocked(flinkApi.getDatabases).mockResolvedValue(['db_a', 'db_b', 'db_c'])

    await useWorkspaceStore.getState().loadDatabases('test_catalog')

    expect(useWorkspaceStore.getState().databases).toEqual(['db_a', 'db_b', 'db_c'])
  })

  it('adds error toast when getDatabases fails', async () => {
    vi.mocked(flinkApi.getDatabases).mockRejectedValue(new Error('API down'))

    await useWorkspaceStore.getState().loadDatabases('test_catalog')

    const { toasts } = useWorkspaceStore.getState()
    expect(toasts.some(t => t.type === 'error')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// loadStatementHistory tests
// ---------------------------------------------------------------------------

describe('[@store] [@history] loadStatementHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('sets historyLoading=true then stores results and sets historyLoading=false', async () => {
    const mockHistory = [
      { name: 'stmt-abc', spec: { statement: 'SELECT 1' }, status: { phase: 'COMPLETED' } },
    ]
    vi.mocked(flinkApi.listStatements).mockResolvedValue(mockHistory as Parameters<typeof flinkApi.listStatements>[0] extends number ? Awaited<ReturnType<typeof flinkApi.listStatements>> : never)

    const promise = useWorkspaceStore.getState().loadStatementHistory()

    expect(useWorkspaceStore.getState().historyLoading).toBe(true)

    await promise

    const state = useWorkspaceStore.getState()
    expect(state.historyLoading).toBe(false)
    expect(state.statementHistory).toHaveLength(1)
  })

  it('stores error message and sets historyLoading=false on failure', async () => {
    vi.mocked(flinkApi.listStatements).mockRejectedValue(new Error('API failure'))

    await useWorkspaceStore.getState().loadStatementHistory()

    const state = useWorkspaceStore.getState()
    expect(state.historyLoading).toBe(false)
    expect(state.historyError).toBe('API failure')
  })

  it('clearHistoryError resets historyError to null', async () => {
    useWorkspaceStore.setState({ historyError: 'some error' })

    useWorkspaceStore.getState().clearHistoryError()

    expect(useWorkspaceStore.getState().historyError).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// loadComputePoolStatus tests
// ---------------------------------------------------------------------------

describe('[@store] [@compute] loadComputePoolStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('stores phase and cfu from API response', async () => {
    vi.mocked(flinkApi.getComputePoolStatus).mockResolvedValue({
      phase: 'RUNNING',
      currentCfu: 8,
    })

    await useWorkspaceStore.getState().loadComputePoolStatus()

    const state = useWorkspaceStore.getState()
    expect(state.computePoolPhase).toBe('RUNNING')
    expect(state.computePoolCfu).toBe(8)
  })

  it('sets computePoolPhase=PROVISIONED on failure with no running statements', async () => {
    vi.mocked(flinkApi.getComputePoolStatus).mockRejectedValue(new Error('Pool error'))

    await useWorkspaceStore.getState().loadComputePoolStatus()

    const state = useWorkspaceStore.getState()
    expect(state.computePoolPhase).toBe('PROVISIONED')
    expect(state.computePoolCfu).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// runAllStatements tests
// ---------------------------------------------------------------------------

describe('[@store] [@execute] runAllStatements', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds an info toast with the count of eligible statements', async () => {
    vi.mocked(flinkApi.executeSQL).mockResolvedValue({ name: 'stmt-x', status: { phase: 'PENDING' } })
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ name: 'stmt-x', status: { phase: 'COMPLETED' } })
    vi.mocked(flinkApi.getStatementResults).mockResolvedValue({ results: { data: [] }, metadata: {} })

    useWorkspaceStore.setState({
      statements: [
        { id: 'a', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() },
        { id: 'b', code: 'SELECT 2', status: 'IDLE', createdAt: new Date() },
        { id: 'c', code: 'SELECT 3', status: 'RUNNING', createdAt: new Date() }, // not eligible
      ],
    })

    // Run all but don't await (it's async polling) — just start it
    useWorkspaceStore.getState().runAllStatements()

    // The info toast should be added synchronously at start
    await vi.waitFor(() => {
      const { toasts } = useWorkspaceStore.getState()
      expect(toasts.some(t => t.type === 'info' && t.message.includes('2'))).toBe(true)
    })
  })

  it('does nothing when no eligible statements exist', async () => {
    useWorkspaceStore.setState({
      statements: [
        { id: 'a', code: 'SELECT 1', status: 'RUNNING', createdAt: new Date() },
        { id: 'b', code: 'SELECT 2', status: 'PENDING', createdAt: new Date() },
      ],
    })

    await useWorkspaceStore.getState().runAllStatements()

    // No API calls, no toasts
    expect(flinkApi.executeSQL).not.toHaveBeenCalled()
    expect(useWorkspaceStore.getState().toasts).toHaveLength(0)
  })

  it('includes CANCELLED and ERROR statements as eligible', async () => {
    vi.mocked(flinkApi.executeSQL).mockResolvedValue({ name: 'stmt-x', status: { phase: 'PENDING' } })
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ name: 'stmt-x', status: { phase: 'COMPLETED' } })
    vi.mocked(flinkApi.getStatementResults).mockResolvedValue({ results: { data: [] }, metadata: {} })

    useWorkspaceStore.setState({
      statements: [
        { id: 'x', code: 'SELECT 1', status: 'ERROR', createdAt: new Date() },
        { id: 'y', code: 'SELECT 2', status: 'CANCELLED', createdAt: new Date() },
      ],
    })

    useWorkspaceStore.getState().runAllStatements()

    await vi.waitFor(() => {
      const { toasts } = useWorkspaceStore.getState()
      expect(toasts.some(t => t.type === 'info' && t.message.includes('2'))).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Session Properties tests
// ---------------------------------------------------------------------------

describe('[@store] [@session] session properties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('setSessionProperty adds a new property', () => {
    useWorkspaceStore.getState().setSessionProperty('execution.runtime-mode', 'STREAMING')

    const { sessionProperties } = useWorkspaceStore.getState()
    expect(sessionProperties['execution.runtime-mode']).toBe('STREAMING')
  })

  it('setSessionProperty overwrites existing property', () => {
    useWorkspaceStore.getState().setSessionProperty('sql.local-time-zone', 'America/New_York')

    expect(useWorkspaceStore.getState().sessionProperties['sql.local-time-zone']).toBe('America/New_York')
  })

  it('setSessionProperty does nothing for empty key', () => {
    const before = { ...useWorkspaceStore.getState().sessionProperties }
    useWorkspaceStore.getState().setSessionProperty('   ', 'value')

    expect(useWorkspaceStore.getState().sessionProperties).toEqual(before)
  })

  it('setSessionProperty blocks reserved key sql.current-catalog', () => {
    useWorkspaceStore.getState().setSessionProperty('sql.current-catalog', 'hacked')

    // Should not be set; should show error toast
    expect(useWorkspaceStore.getState().sessionProperties['sql.current-catalog']).toBeUndefined()
    const { toasts } = useWorkspaceStore.getState()
    expect(toasts.some(t => t.type === 'error')).toBe(true)
  })

  it('setSessionProperty blocks reserved key sql.current-database', () => {
    useWorkspaceStore.getState().setSessionProperty('sql.current-database', 'hacked')

    expect(useWorkspaceStore.getState().sessionProperties['sql.current-database']).toBeUndefined()
  })

  it('removeSessionProperty deletes a property', () => {
    useWorkspaceStore.getState().removeSessionProperty('sql.local-time-zone')

    expect(useWorkspaceStore.getState().sessionProperties['sql.local-time-zone']).toBeUndefined()
  })

  it('removeSessionProperty does nothing for non-existent key', () => {
    const before = Object.keys(useWorkspaceStore.getState().sessionProperties).length
    useWorkspaceStore.getState().removeSessionProperty('nonexistent.key')

    expect(Object.keys(useWorkspaceStore.getState().sessionProperties).length).toBe(before)
  })

  it('resetSessionProperties restores default properties', () => {
    useWorkspaceStore.getState().setSessionProperty('custom.key', 'custom-value')
    useWorkspaceStore.getState().resetSessionProperties()

    const { sessionProperties } = useWorkspaceStore.getState()
    expect(sessionProperties['sql.local-time-zone']).toBe('UTC')
    expect(sessionProperties['custom.key']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// setFocusedStatementId tests
// ---------------------------------------------------------------------------

describe('[@store] [@focus] setFocusedStatementId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
    useWorkspaceStore.setState({ focusedStatementId: null })
  })

  it('sets focusedStatementId', () => {
    useWorkspaceStore.getState().setFocusedStatementId('stmt-1')
    expect(useWorkspaceStore.getState().focusedStatementId).toBe('stmt-1')
  })

  it('clears focusedStatementId to null', () => {
    useWorkspaceStore.setState({ focusedStatementId: 'stmt-1' })
    useWorkspaceStore.getState().setFocusedStatementId(null)
    expect(useWorkspaceStore.getState().focusedStatementId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// updateStatementLabel tests
// ---------------------------------------------------------------------------

describe('[@store] [@label] updateStatementLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({
      statements: [
        { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() },
      ],
      toasts: [],
    })
  })

  it('sets the label on a statement', () => {
    useWorkspaceStore.getState().updateStatementLabel('stmt-1', 'My Query')

    const stmt = useWorkspaceStore.getState().statements.find(s => s.id === 'stmt-1')
    expect(stmt?.label).toBe('My Query')
  })

  it('trims whitespace from label', () => {
    useWorkspaceStore.getState().updateStatementLabel('stmt-1', '  My Query  ')

    const stmt = useWorkspaceStore.getState().statements.find(s => s.id === 'stmt-1')
    expect(stmt?.label).toBe('My Query')
  })

  it('sets label to undefined when given empty string', () => {
    useWorkspaceStore.getState().updateStatementLabel('stmt-1', '')

    const stmt = useWorkspaceStore.getState().statements.find(s => s.id === 'stmt-1')
    expect(stmt?.label).toBeUndefined()
  })

  it('sets label to undefined when given whitespace only', () => {
    useWorkspaceStore.getState().updateStatementLabel('stmt-1', '   ')

    const stmt = useWorkspaceStore.getState().statements.find(s => s.id === 'stmt-1')
    expect(stmt?.label).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// importWorkspace tests
// ---------------------------------------------------------------------------

describe('[@store] [@import] importWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(flinkApi.getTables).mockResolvedValue([])
    vi.mocked(flinkApi.getViews).mockResolvedValue([])
    vi.mocked(flinkApi.getFunctions).mockResolvedValue([])
    resetStore()
  })

  it('throws on invalid workspace data', () => {
    expect(() => {
      useWorkspaceStore.getState().importWorkspace({ invalid: 'data' })
    }).toThrow()
  })

  it('imports statements with IDLE status regardless of source status', () => {
    const validWorkspace = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workspaceName: 'Imported WS',
      catalog: 'cat1',
      database: 'db1',
      statements: [
        {
          id: 'old-id-1',
          code: 'SELECT imported',
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        },
      ],
    }

    useWorkspaceStore.getState().importWorkspace(validWorkspace)

    const { statements } = useWorkspaceStore.getState()
    expect(statements[0]?.code).toBe('SELECT imported')
    expect(statements[0]?.status).toBe('IDLE')
    // ID should be regenerated
    expect(statements[0]?.id).not.toBe('old-id-1')
  })

  it('updates catalog and database from imported workspace', () => {
    const validWorkspace = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workspaceName: 'New WS',
      catalog: 'imported_catalog',
      database: 'imported_db',
      statements: [
        { id: 'x', code: 'SELECT 1', status: 'IDLE', createdAt: new Date().toISOString() },
      ],
    }

    useWorkspaceStore.getState().importWorkspace(validWorkspace)

    expect(useWorkspaceStore.getState().catalog).toBe('imported_catalog')
    expect(useWorkspaceStore.getState().database).toBe('imported_db')
    expect(useWorkspaceStore.getState().workspaceName).toBe('New WS')
  })
})
