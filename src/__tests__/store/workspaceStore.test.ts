import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkspaceStore } from '../../store/workspaceStore'

describe('[@store] [@core] workspaceStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test — must include all fields
    // that tests assert on, otherwise state leaks between tests in the same suite.
    useWorkspaceStore.setState({
      statements: [
        {
          id: 'stmt-1',
          code: 'SELECT 1',
          status: 'IDLE',
          createdAt: new Date(),
        },
      ],
      toasts: [],
      theme: 'light',
      sidebarCollapsed: false,
    })
  })

  describe('[@store] addStatement', () => {
    it('should add a new statement with IDLE status', () => {
      const store = useWorkspaceStore.getState()
      const initialCount = store.statements.length

      store.addStatement('SELECT * FROM table')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements).toHaveLength(initialCount + 1)

      const newStatement = updated.statements[updated.statements.length - 1]
      expect(newStatement.code).toBe('SELECT * FROM table')
      expect(newStatement.status).toBe('IDLE')
    })

    it('should add statement with default empty code if not provided', () => {
      const store = useWorkspaceStore.getState()
      store.addStatement()

      const updated = useWorkspaceStore.getState()
      const newStatement = updated.statements[updated.statements.length - 1]
      // The store fills in a template when no code is passed; the template
      // includes the current catalog and database from env.
      expect(newStatement.code).toBe(
        `-- Write your Flink SQL query here\nSELECT * FROM \`test_catalog\`.\`test_db\`.<table_name> LIMIT 10;`
      )
    })

    it('should add statement after specified ID', () => {
      const store = useWorkspaceStore.getState()
      const firstStmtId = store.statements[0]!.id

      store.addStatement('SELECT 2', firstStmtId)

      const updated = useWorkspaceStore.getState()
      // Should be inserted after the first statement
      expect(updated.statements[1]?.code).toBe('SELECT 2')
    })
  })

  describe('[@store] deleteStatement', () => {
    it('should delete statement by ID', () => {
      const store = useWorkspaceStore.getState()
      const stmtToDelete = store.statements[0]!.id

      store.deleteStatement(stmtToDelete)

      const updated = useWorkspaceStore.getState()
      expect(updated.statements.some((s) => s.id === stmtToDelete)).toBe(false)
    })

    it('should do nothing if statement ID does not exist', () => {
      const store = useWorkspaceStore.getState()
      const initialCount = store.statements.length

      store.deleteStatement('nonexistent-id')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements).toHaveLength(initialCount)
    })
  })

  describe('[@store] updateStatement', () => {
    it('should update statement code', () => {
      const store = useWorkspaceStore.getState()
      const stmtId = store.statements[0]!.id
      const newCode = 'SELECT 2, 3, 4'

      store.updateStatement(stmtId, newCode)

      const updated = useWorkspaceStore.getState()
      const stmt = updated.statements.find((s) => s.id === stmtId)
      expect(stmt?.code).toBe(newCode)
    })

    it('should set updatedAt to current time', () => {
      const store = useWorkspaceStore.getState()
      const stmtId = store.statements[0]!.id

      const before = new Date()
      store.updateStatement(stmtId, 'SELECT 999')
      const after = new Date()

      const updated = useWorkspaceStore.getState()
      const stmt = updated.statements.find((s) => s.id === stmtId)
      expect(stmt?.updatedAt).toBeDefined()
      expect(stmt?.updatedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(stmt?.updatedAt!.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe('[@store] toggleStatementCollapse', () => {
    it('should toggle isCollapsed from false to true', () => {
      const store = useWorkspaceStore.getState()
      const stmtId = store.statements[0]!.id

      store.toggleStatementCollapse(stmtId)

      const updated = useWorkspaceStore.getState()
      const stmt = updated.statements.find((s) => s.id === stmtId)
      expect(stmt?.isCollapsed).toBe(true)
    })

    it('should toggle isCollapsed from true to false', () => {
      const store = useWorkspaceStore.getState()
      const stmtId = store.statements[0]!.id

      store.toggleStatementCollapse(stmtId)
      store.toggleStatementCollapse(stmtId)

      const updated = useWorkspaceStore.getState()
      const stmt = updated.statements.find((s) => s.id === stmtId)
      expect(stmt?.isCollapsed).toBe(false)
    })
  })

  describe('[@store] reorderStatements', () => {
    it('should reorder statements by index', () => {
      const store = useWorkspaceStore.getState()
      store.addStatement('SELECT 2')
      store.addStatement('SELECT 3')

      const beforeOrder = useWorkspaceStore.getState().statements.map((s) => s.code)

      store.reorderStatements(0, 2)

      const afterOrder = useWorkspaceStore.getState().statements.map((s) => s.code)
      expect(afterOrder[2]).toBe(beforeOrder[0])
      expect(afterOrder[0]).toBe(beforeOrder[1])
    })
  })

  describe('[@store] addToast / removeToast', () => {
    it('should add a toast with generated ID', () => {
      const store = useWorkspaceStore.getState()

      store.addToast({ type: 'success', message: 'Operation complete' })

      const updated = useWorkspaceStore.getState()
      expect(updated.toasts).toHaveLength(1)
      expect(updated.toasts[0]?.message).toBe('Operation complete')
      expect(updated.toasts[0]?.type).toBe('success')
      expect(updated.toasts[0]?.id).toBeDefined()
    })

    it('should remove toast by ID', () => {
      const store = useWorkspaceStore.getState()
      store.addToast({ type: 'error', message: 'Error occurred' })

      const toastId = useWorkspaceStore.getState().toasts[0]!.id
      store.removeToast(toastId)

      const updated = useWorkspaceStore.getState()
      expect(updated.toasts).toHaveLength(0)
    })
  })

  describe('[@store] toggleTheme', () => {
    it('should toggle theme from light to dark', () => {
      const store = useWorkspaceStore.getState()
      expect(store.theme).toBe('light')

      store.toggleTheme()

      const updated = useWorkspaceStore.getState()
      expect(updated.theme).toBe('dark')
    })

    it('should toggle theme from dark to light', () => {
      const store = useWorkspaceStore.getState()
      store.toggleTheme()
      store.toggleTheme()

      const updated = useWorkspaceStore.getState()
      expect(updated.theme).toBe('light')
    })
  })

  describe('[@store] toggleSidebar', () => {
    it('should toggle sidebarCollapsed state', () => {
      const store = useWorkspaceStore.getState()
      expect(store.sidebarCollapsed).toBe(false)

      store.toggleSidebar()

      const updated = useWorkspaceStore.getState()
      expect(updated.sidebarCollapsed).toBe(true)

      store.toggleSidebar()

      const final = useWorkspaceStore.getState()
      expect(final.sidebarCollapsed).toBe(false)
    })
  })
})

describe('[@store] [@critical] workspaceStore critical path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({
      statements: [
        {
          id: 'stmt-1',
          code: 'SELECT 1',
          status: 'IDLE',
          createdAt: new Date(),
        },
      ],
      workspaceName: 'SQL Workspace',
      hasSeenOnboardingHint: false,
      lastSavedAt: null,
      computePoolPhase: null,
      computePoolCfu: null,
      toasts: [],
    })
  })

  describe('[@store] [@critical] deleteStatement - last statement fallback', () => {
    it('should allow deleting the last statement (no fallback inserted)', () => {
      const store = useWorkspaceStore.getState()
      expect(store.statements).toHaveLength(1)

      store.deleteStatement('stmt-1')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements).toHaveLength(0)
    })

    it('deleted statement should no longer be present', () => {
      useWorkspaceStore.getState().deleteStatement('stmt-1')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements.some((s) => s.id === 'stmt-1')).toBe(false)
    })
  })

  describe('[@store] [@critical] duplicateStatement', () => {
    it('should clone code but strip results, error, and statementName', () => {
      useWorkspaceStore.setState({
        statements: [
          {
            id: 'stmt-rich',
            code: 'SELECT 42',
            status: 'COMPLETED',
            results: [{ col_0: 42 }],
            error: 'some prior error',
            statementName: 'flink-stmt-abc123',
            createdAt: new Date(),
          },
        ],
      })

      useWorkspaceStore.getState().duplicateStatement('stmt-rich')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements).toHaveLength(2)

      const duplicate = updated.statements[1]!
      expect(duplicate.code).toBe('SELECT 42')
      expect(duplicate.results).toBeUndefined()
      expect(duplicate.error).toBeUndefined()
      expect(duplicate.statementName).toBeUndefined()
    })

    it('duplicate should receive IDLE status regardless of source status', () => {
      useWorkspaceStore.setState({
        statements: [
          {
            id: 'stmt-running',
            code: 'SELECT stream',
            status: 'RUNNING',
            createdAt: new Date(),
          },
        ],
      })

      useWorkspaceStore.getState().duplicateStatement('stmt-running')

      const updated = useWorkspaceStore.getState()
      const duplicate = updated.statements[1]!
      expect(duplicate.status).toBe('IDLE')
    })

    it('duplicate should have a different id from source', () => {
      useWorkspaceStore.getState().duplicateStatement('stmt-1')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements[1]!.id).not.toBe('stmt-1')
    })
  })

  describe('[@store] [@critical] addStatement with afterId', () => {
    it('should insert at position 1 when afterId is the last (and only) statement', () => {
      const store = useWorkspaceStore.getState()
      const firstId = store.statements[0]!.id

      store.addStatement('SELECT 2', firstId)

      const updated = useWorkspaceStore.getState()
      expect(updated.statements).toHaveLength(2)
      expect(updated.statements[0]!.id).toBe(firstId)
      expect(updated.statements[1]!.code).toBe('SELECT 2')
    })

    it('should maintain correct order 1st→2nd→3rd when inserting after 2nd', () => {
      const store = useWorkspaceStore.getState()
      const firstId = store.statements[0]!.id

      // Insert 2nd after 1st
      store.addStatement('SELECT 2', firstId)
      const afterFirst = useWorkspaceStore.getState()
      const secondId = afterFirst.statements[1]!.id

      // Insert 3rd after 2nd
      afterFirst.addStatement('SELECT 3', secondId)

      const final = useWorkspaceStore.getState()
      expect(final.statements).toHaveLength(3)
      expect(final.statements[0]!.id).toBe(firstId)
      expect(final.statements[1]!.id).toBe(secondId)
      expect(final.statements[2]!.code).toBe('SELECT 3')
    })

    it('should append to end when afterId is not found', () => {
      useWorkspaceStore.getState().addStatement('SELECT orphan', 'nonexistent-id')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements[updated.statements.length - 1]!.code).toBe('SELECT orphan')
    })
  })

  describe('[@store] [@critical] setWorkspaceName', () => {
    it('should update workspaceName in state', () => {
      useWorkspaceStore.getState().setWorkspaceName('My Workspace')

      const updated = useWorkspaceStore.getState()
      expect(updated.workspaceName).toBe('My Workspace')
    })

    it('should allow overwriting an existing workspace name', () => {
      useWorkspaceStore.getState().setWorkspaceName('First Name')
      useWorkspaceStore.getState().setWorkspaceName('Second Name')

      const updated = useWorkspaceStore.getState()
      expect(updated.workspaceName).toBe('Second Name')
    })
  })

  describe('[@store] [@critical] dismissOnboardingHint', () => {
    it('should start as false', () => {
      expect(useWorkspaceStore.getState().hasSeenOnboardingHint).toBe(false)
    })

    it('should set hasSeenOnboardingHint to true after dismiss', () => {
      useWorkspaceStore.getState().dismissOnboardingHint()

      expect(useWorkspaceStore.getState().hasSeenOnboardingHint).toBe(true)
    })

    it('should remain true if called again', () => {
      useWorkspaceStore.getState().dismissOnboardingHint()
      useWorkspaceStore.getState().dismissOnboardingHint()

      expect(useWorkspaceStore.getState().hasSeenOnboardingHint).toBe(true)
    })
  })

  describe('[@store] [@critical] partialize persistence snapshot', () => {
    it('should normalize RUNNING statements to IDLE when persisted', () => {
      useWorkspaceStore.setState({
        statements: [
          { id: 'stmt-a', code: 'SELECT running', status: 'RUNNING', createdAt: new Date() },
          { id: 'stmt-b', code: 'SELECT pending', status: 'PENDING', createdAt: new Date() },
          { id: 'stmt-c', code: 'SELECT idle', status: 'IDLE', createdAt: new Date() },
          { id: 'stmt-d', code: 'SELECT completed', status: 'COMPLETED', createdAt: new Date() },
          { id: 'stmt-e', code: 'SELECT error', status: 'ERROR', createdAt: new Date() },
        ],
      })

      // Trigger a write by calling an action that updates lastSavedAt
      useWorkspaceStore.getState().setWorkspaceName('persist-test')

      // Read what zustand-persist serialised into localStorage
      const raw = localStorage.getItem('flink-workspace')
      expect(raw).not.toBeNull()

      const persisted = JSON.parse(raw!) as {
        state: {
          tabs: Record<string, { statements: Array<{ id: string; status: string }> }>
          activeTabId: string
          computePoolPhase?: unknown
        }
      }

      // Partialize now persists under tabs — get statements from the active tab
      const activeTab = persisted.state.tabs[persisted.state.activeTabId]
      expect(activeTab).toBeDefined()
      const statuses = activeTab.statements.reduce<Record<string, string>>((acc, s) => {
        acc[s.id] = s.status
        return acc
      }, {})

      expect(statuses['stmt-a']).toBe('IDLE')
      expect(statuses['stmt-b']).toBe('IDLE')
      expect(statuses['stmt-c']).toBe('IDLE')
      expect(statuses['stmt-d']).toBe('COMPLETED')
      expect(statuses['stmt-e']).toBe('ERROR')
    })

    it('should exclude computePoolPhase from persisted state', () => {
      useWorkspaceStore.setState({ computePoolPhase: 'RUNNING', computePoolCfu: 4 })
      useWorkspaceStore.getState().setWorkspaceName('pool-exclude-test')

      const raw = localStorage.getItem('flink-workspace')
      const persisted = JSON.parse(raw!) as { state: Record<string, unknown> }

      expect(persisted.state).not.toHaveProperty('computePoolPhase')
      expect(persisted.state).not.toHaveProperty('computePoolCfu')
    })

    it('should include lastSavedAt in persisted tab state', () => {
      useWorkspaceStore.getState().setWorkspaceName('lastsaved-test')
      // Trigger a mutation that writes lastSavedAt
      useWorkspaceStore.getState().addStatement('SELECT 999')

      const raw = localStorage.getItem('flink-workspace')
      const persisted = JSON.parse(raw!) as {
        state: {
          tabs: Record<string, { lastSavedAt: string | null }>
          activeTabId: string
        }
      }

      // lastSavedAt is now inside the tab, not at root level
      const activeTab = persisted.state.tabs[persisted.state.activeTabId]
      expect(activeTab).toHaveProperty('lastSavedAt')
    })
  })
})

// ---------------------------------------------------------------------------
// Coverage expansion: untested actions, branches, and edge cases
// ---------------------------------------------------------------------------

describe('[@store-coverage] Tab management actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to a single-tab state
    const tabId = 'tab-1'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() },
          ],
          focusedStatementId: null,
          workspaceName: 'Tab 1',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
      toasts: [],
    })
  })

  describe('[@store-coverage] addTab', () => {
    it('should create a new tab and switch to it', () => {
      const newId = useWorkspaceStore.getState().addTab('New Tab')
      expect(newId).toBeTruthy()
      const state = useWorkspaceStore.getState()
      expect(state.activeTabId).toBe(newId)
      expect(state.tabOrder).toContain(newId)
      expect(state.tabs[newId]).toBeDefined()
      expect(state.tabs[newId].workspaceName).toBe('New Tab')
    })

    it('should use default name "Workspace" when no name provided', () => {
      const newId = useWorkspaceStore.getState().addTab()
      const tab = useWorkspaceStore.getState().tabs[newId]
      expect(tab.workspaceName).toBe('Workspace')
    })

    it('should enforce max 8 tabs', () => {
      // Add 7 more tabs (already have 1)
      for (let i = 0; i < 7; i++) {
        useWorkspaceStore.getState().addTab(`Tab ${i + 2}`)
      }
      expect(useWorkspaceStore.getState().tabOrder).toHaveLength(8)
      const result = useWorkspaceStore.getState().addTab('Tab 9')
      expect(result).toBe('')
      expect(useWorkspaceStore.getState().tabOrder).toHaveLength(8)
    })

    it('should create a new tab with an empty statements array', () => {
      const newId = useWorkspaceStore.getState().addTab('Test')
      const tab = useWorkspaceStore.getState().tabs[newId]
      expect(tab.statements).toHaveLength(0)
    })
  })

  describe('[@store-coverage] closeTab', () => {
    it('should close a non-active tab without switching', () => {
      const secondId = useWorkspaceStore.getState().addTab('Tab 2')
      // Switch back to first tab
      useWorkspaceStore.getState().switchTab('tab-1')
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-1')
      useWorkspaceStore.getState().closeTab(secondId)
      expect(useWorkspaceStore.getState().tabOrder).not.toContain(secondId)
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-1')
    })

    it('should switch to adjacent tab when closing the active tab', () => {
      const secondId = useWorkspaceStore.getState().addTab('Tab 2')
      useWorkspaceStore.getState().addTab('Tab 3')
      // Active is Tab 3
      useWorkspaceStore.getState().switchTab(secondId)
      const thirdTabId = useWorkspaceStore.getState().tabOrder[2]
      useWorkspaceStore.getState().switchTab(thirdTabId)
      useWorkspaceStore.getState().closeTab(thirdTabId)
      const state = useWorkspaceStore.getState()
      expect(state.tabOrder).not.toContain(thirdTabId)
      expect(state.activeTabId).toBeTruthy()
    })

    it('should create a fresh tab when closing the last tab', () => {
      useWorkspaceStore.getState().closeTab('tab-1')
      const state = useWorkspaceStore.getState()
      expect(state.tabOrder).toHaveLength(1)
      expect(state.tabs[state.activeTabId]).toBeDefined()
      expect(state.tabs[state.activeTabId].workspaceName).toBe('Workspace')
    })

    it('should do nothing for non-existent tab id', () => {
      const before = useWorkspaceStore.getState().tabOrder.length
      useWorkspaceStore.getState().closeTab('non-existent')
      expect(useWorkspaceStore.getState().tabOrder).toHaveLength(before)
    })
  })

  describe('[@store-coverage] switchTab', () => {
    it('should switch the active tab', () => {
      const secondId = useWorkspaceStore.getState().addTab('Tab 2')
      useWorkspaceStore.getState().switchTab('tab-1')
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-1')
      useWorkspaceStore.getState().switchTab(secondId)
      expect(useWorkspaceStore.getState().activeTabId).toBe(secondId)
    })

    it('should ignore switch to non-existent tab', () => {
      useWorkspaceStore.getState().switchTab('non-existent')
      expect(useWorkspaceStore.getState().activeTabId).toBe('tab-1')
    })
  })

  describe('[@store-coverage] reorderTabs', () => {
    it('should reorder tabs', () => {
      const secondId = useWorkspaceStore.getState().addTab('Tab 2')
      const thirdId = useWorkspaceStore.getState().addTab('Tab 3')
      // Order: tab-1, secondId, thirdId
      useWorkspaceStore.getState().reorderTabs(0, 2)
      const order = useWorkspaceStore.getState().tabOrder
      expect(order[0]).toBe(secondId)
      expect(order[2]).toBe('tab-1')
    })

    it('should be a no-op when fromIndex equals toIndex', () => {
      const before = [...useWorkspaceStore.getState().tabOrder]
      useWorkspaceStore.getState().reorderTabs(0, 0)
      expect(useWorkspaceStore.getState().tabOrder).toEqual(before)
    })
  })

  describe('[@store-coverage] renameTab', () => {
    it('should rename a tab', () => {
      useWorkspaceStore.getState().renameTab('tab-1', 'Renamed')
      expect(useWorkspaceStore.getState().tabs['tab-1'].workspaceName).toBe('Renamed')
    })

    it('should trim whitespace from name', () => {
      useWorkspaceStore.getState().renameTab('tab-1', '  Trimmed  ')
      expect(useWorkspaceStore.getState().tabs['tab-1'].workspaceName).toBe('Trimmed')
    })

    it('should ignore empty name', () => {
      useWorkspaceStore.getState().renameTab('tab-1', '   ')
      expect(useWorkspaceStore.getState().tabs['tab-1'].workspaceName).toBe('Tab 1')
    })
  })
})

describe('[@store-coverage] Workspace notes actions', () => {
  beforeEach(() => {
    const tabId = 'notes-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [],
          focusedStatementId: null,
          workspaceName: 'Notes Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
      toasts: [],
    })
  })

  describe('[@store-coverage] setWorkspaceNotes', () => {
    it('should set notes and open the notes panel', () => {
      useWorkspaceStore.getState().setWorkspaceNotes('My notes')
      const state = useWorkspaceStore.getState()
      expect(state.workspaceNotes).toBe('My notes')
      expect(state.workspaceNotesOpen).toBe(true)
    })

    it('should set notes to null without opening panel', () => {
      useWorkspaceStore.getState().setWorkspaceNotes('temp')
      useWorkspaceStore.getState().setWorkspaceNotes(null)
      const state = useWorkspaceStore.getState()
      expect(state.workspaceNotes).toBeNull()
    })
  })

  describe('[@store-coverage] toggleWorkspaceNotes', () => {
    it('should toggle notes panel open and closed', () => {
      expect(useWorkspaceStore.getState().workspaceNotesOpen).toBe(false)
      useWorkspaceStore.getState().toggleWorkspaceNotes()
      expect(useWorkspaceStore.getState().workspaceNotesOpen).toBe(true)
      useWorkspaceStore.getState().toggleWorkspaceNotes()
      expect(useWorkspaceStore.getState().workspaceNotesOpen).toBe(false)
    })
  })

  describe('[@store-coverage] updateSavedWorkspaceNotes', () => {
    it('should update notes on a saved workspace', () => {
      const id = 'saved-1'
      useWorkspaceStore.setState({
        savedWorkspaces: [
          { id, name: 'Test WS', createdAt: '2026-01-01', updatedAt: '2026-01-01', statementCount: 0, streamCardCount: 0, statements: [], streamCards: [] },
        ],
      })
      useWorkspaceStore.getState().updateSavedWorkspaceNotes(id, 'Updated notes')
      const ws = useWorkspaceStore.getState().savedWorkspaces.find((w) => w.id === id)
      expect(ws?.notes).toBe('Updated notes')
      expect(ws?.updatedAt).not.toBe('2026-01-01')
    })
  })
})

describe('[@store-coverage] navigateToExampleDetail', () => {
  it('should set selectedExampleId', () => {
    useWorkspaceStore.getState().navigateToExampleDetail('example-1')
    expect(useWorkspaceStore.getState().selectedExampleId).toBe('example-1')
  })

  it('should clear selectedExampleId when passed null', () => {
    useWorkspaceStore.getState().navigateToExampleDetail('example-1')
    useWorkspaceStore.getState().navigateToExampleDetail(null)
    expect(useWorkspaceStore.getState().selectedExampleId).toBeNull()
  })
})

describe('[@store-coverage] navigateToJobDetail', () => {
  it('should set activeNavItem to jobs and selectedJobName', () => {
    useWorkspaceStore.getState().navigateToJobDetail('stmt-abc')
    const state = useWorkspaceStore.getState()
    expect(state.activeNavItem).toBe('jobs')
    expect(state.selectedJobName).toBe('stmt-abc')
  })
})

describe('[@store-coverage] Snippet actions', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ snippets: [] })
  })

  describe('[@store-coverage] addSnippet', () => {
    it('should add a snippet sorted by name', () => {
      const result = useWorkspaceStore.getState().addSnippet('Z Snippet', 'SELECT z')
      expect(result.success).toBe(true)
      useWorkspaceStore.getState().addSnippet('A Snippet', 'SELECT a')
      const snippets = useWorkspaceStore.getState().snippets
      expect(snippets).toHaveLength(2)
      expect(snippets[0].name).toBe('A Snippet')
      expect(snippets[1].name).toBe('Z Snippet')
    })

    it('should reject when at 100 snippet limit', () => {
      const snippets = Array.from({ length: 100 }, (_, i) => ({
        id: `snip-${i}`,
        name: `Snippet ${i}`,
        sql: `SELECT ${i}`,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }))
      useWorkspaceStore.setState({ snippets })
      const result = useWorkspaceStore.getState().addSnippet('Overflow', 'SELECT x')
      expect(result.success).toBe(false)
      expect(result.error).toContain('100')
    })
  })

  describe('[@store-coverage] deleteSnippet', () => {
    it('should remove a snippet by id', () => {
      useWorkspaceStore.getState().addSnippet('Test', 'SELECT 1')
      const id = useWorkspaceStore.getState().snippets[0].id
      useWorkspaceStore.getState().deleteSnippet(id)
      expect(useWorkspaceStore.getState().snippets).toHaveLength(0)
    })
  })

  describe('[@store-coverage] renameSnippet', () => {
    it('should rename a snippet and re-sort', () => {
      useWorkspaceStore.getState().addSnippet('AAA', 'SELECT 1')
      useWorkspaceStore.getState().addSnippet('CCC', 'SELECT 2')
      const id = useWorkspaceStore.getState().snippets.find((s) => s.name === 'CCC')!.id
      useWorkspaceStore.getState().renameSnippet(id, 'BBB')
      const names = useWorkspaceStore.getState().snippets.map((s) => s.name)
      expect(names).toEqual(['AAA', 'BBB'])
    })

    it('should ignore empty name', () => {
      useWorkspaceStore.getState().addSnippet('Keep', 'SELECT 1')
      const id = useWorkspaceStore.getState().snippets[0].id
      useWorkspaceStore.getState().renameSnippet(id, '   ')
      expect(useWorkspaceStore.getState().snippets[0].name).toBe('Keep')
    })
  })
})

describe('[@store-coverage] Config audit log actions', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ configAuditLog: [] })
  })

  describe('[@store-coverage] addConfigAuditEntry', () => {
    it('should add an entry with auto-generated timestamp', () => {
      useWorkspaceStore.getState().addConfigAuditEntry({
        topicName: 'test-topic',
        configName: 'retention.ms',
        oldValue: '1000',
        newValue: '2000',
        action: 'update',
      })
      const log = useWorkspaceStore.getState().configAuditLog
      expect(log).toHaveLength(1)
      expect(log[0].timestamp).toBeDefined()
      expect(log[0].topicName).toBe('test-topic')
    })

    it('should prepend entries (newest first) and cap at 200', () => {
      for (let i = 0; i < 201; i++) {
        useWorkspaceStore.getState().addConfigAuditEntry({
          topicName: `topic-${i}`,
          configName: 'key',
          oldValue: 'a',
          newValue: 'b',
          action: 'update',
        })
      }
      const log = useWorkspaceStore.getState().configAuditLog
      expect(log).toHaveLength(200)
      // Most recent should be first
      expect(log[0].topicName).toBe('topic-200')
    })
  })

  describe('[@store-coverage] getConfigAuditLogForTopic', () => {
    it('should filter entries by topic name', () => {
      useWorkspaceStore.getState().addConfigAuditEntry({
        topicName: 'topic-a',
        configName: 'key',
        oldValue: 'a',
        newValue: 'b',
        action: 'update',
      })
      useWorkspaceStore.getState().addConfigAuditEntry({
        topicName: 'topic-b',
        configName: 'key',
        oldValue: 'c',
        newValue: 'd',
        action: 'update',
      })
      const filtered = useWorkspaceStore.getState().getConfigAuditLogForTopic('topic-a')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].topicName).toBe('topic-a')
    })
  })
})

describe('[@store-coverage] Bulk topic actions', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      isBulkMode: false,
      bulkSelectedTopics: [],
      topicList: [
        { topic_name: 'topic-1', partitions_count: 1, replication_factor: 3, is_internal: false },
        { topic_name: 'topic-2', partitions_count: 1, replication_factor: 3, is_internal: false },
        { topic_name: 'topic-3', partitions_count: 1, replication_factor: 3, is_internal: false },
      ] as any,
      toasts: [],
    })
  })

  describe('[@store-coverage] enterBulkMode / exitBulkMode', () => {
    it('should enter bulk mode with empty selection', () => {
      useWorkspaceStore.getState().enterBulkMode()
      const state = useWorkspaceStore.getState()
      expect(state.isBulkMode).toBe(true)
      expect(state.bulkSelectedTopics).toEqual([])
    })

    it('should exit bulk mode and clear selection', () => {
      useWorkspaceStore.getState().enterBulkMode()
      useWorkspaceStore.getState().toggleBulkTopicSelection('topic-1')
      useWorkspaceStore.getState().exitBulkMode()
      const state = useWorkspaceStore.getState()
      expect(state.isBulkMode).toBe(false)
      expect(state.bulkSelectedTopics).toEqual([])
    })
  })

  describe('[@store-coverage] toggleBulkTopicSelection', () => {
    it('should add a topic to selection', () => {
      useWorkspaceStore.getState().toggleBulkTopicSelection('topic-1')
      expect(useWorkspaceStore.getState().bulkSelectedTopics).toContain('topic-1')
    })

    it('should remove a topic from selection on second toggle', () => {
      useWorkspaceStore.getState().toggleBulkTopicSelection('topic-1')
      useWorkspaceStore.getState().toggleBulkTopicSelection('topic-1')
      expect(useWorkspaceStore.getState().bulkSelectedTopics).not.toContain('topic-1')
    })
  })

  describe('[@store-coverage] selectAllBulkTopics', () => {
    it('should select all topic names', () => {
      useWorkspaceStore.getState().selectAllBulkTopics()
      expect(useWorkspaceStore.getState().bulkSelectedTopics).toEqual(['topic-1', 'topic-2', 'topic-3'])
    })
  })

  describe('[@store-coverage] clearBulkSelection', () => {
    it('should clear all selected topics', () => {
      useWorkspaceStore.getState().selectAllBulkTopics()
      useWorkspaceStore.getState().clearBulkSelection()
      expect(useWorkspaceStore.getState().bulkSelectedTopics).toEqual([])
    })
  })
})

describe('[@store-coverage] setStatementScanMode', () => {
  beforeEach(() => {
    const tabId = 'scan-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() },
          ],
          focusedStatementId: null,
          workspaceName: 'Scan Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
    })
  })

  it('should set scan mode to timestamp with params', () => {
    useWorkspaceStore.getState().setStatementScanMode('stmt-1', 'timestamp', { timestampMillis: '12345' })
    const stmt = useWorkspaceStore.getState().statements.find((s) => s.id === 'stmt-1')
    expect(stmt?.scanMode).toBe('timestamp')
    expect(stmt?.scanTimestampMillis).toBe('12345')
  })

  it('should set scan mode to specific-offsets with params', () => {
    useWorkspaceStore.getState().setStatementScanMode('stmt-1', 'specific-offsets', { specificOffsets: 'partition:0,offset:5' })
    const stmt = useWorkspaceStore.getState().statements.find((s) => s.id === 'stmt-1')
    expect(stmt?.scanMode).toBe('specific-offsets')
    expect(stmt?.scanSpecificOffsets).toBe('partition:0,offset:5')
  })

  it('should set scan mode to group-offsets with groupId', () => {
    useWorkspaceStore.getState().setStatementScanMode('stmt-1', 'group-offsets', { groupId: 'my-group' })
    const stmt = useWorkspaceStore.getState().statements.find((s) => s.id === 'stmt-1')
    expect(stmt?.scanMode).toBe('group-offsets')
    expect(stmt?.scanGroupId).toBe('my-group')
  })

  it('should clear scan mode when set to null', () => {
    useWorkspaceStore.getState().setStatementScanMode('stmt-1', 'timestamp', { timestampMillis: '12345' })
    useWorkspaceStore.getState().setStatementScanMode('stmt-1', null)
    const stmt = useWorkspaceStore.getState().statements.find((s) => s.id === 'stmt-1')
    expect(stmt?.scanMode).toBeUndefined()
    expect(stmt?.scanTimestampMillis).toBeUndefined()
  })
})

describe('[@store-coverage] setLastFocusedTopicName', () => {
  it('should set lastFocusedTopicName', () => {
    useWorkspaceStore.getState().setLastFocusedTopicName('my-topic')
    expect(useWorkspaceStore.getState().lastFocusedTopicName).toBe('my-topic')
  })

  it('should clear lastFocusedTopicName', () => {
    useWorkspaceStore.getState().setLastFocusedTopicName('my-topic')
    useWorkspaceStore.getState().setLastFocusedTopicName(null)
    expect(useWorkspaceStore.getState().lastFocusedTopicName).toBeNull()
  })
})

describe('[@store-coverage] setStreamsPanelOpen', () => {
  it('should set streamsPanelOpen to true', () => {
    useWorkspaceStore.setState({ streamsPanelOpen: false })
    useWorkspaceStore.getState().setStreamsPanelOpen(true)
    expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(true)
  })

  it('should set streamsPanelOpen to false', () => {
    useWorkspaceStore.setState({ streamsPanelOpen: true })
    useWorkspaceStore.getState().setStreamsPanelOpen(false)
    expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(false)
  })
})

describe('[@store-coverage] clearSchemaRegistryError', () => {
  it('should clear schemaRegistryError', () => {
    useWorkspaceStore.setState({ schemaRegistryError: 'some error' })
    useWorkspaceStore.getState().clearSchemaRegistryError()
    expect(useWorkspaceStore.getState().schemaRegistryError).toBeNull()
  })
})

describe('[@store-coverage] removeStreamCardsByTopic', () => {
  beforeEach(() => {
    const tabId = 'stream-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [],
          focusedStatementId: null,
          workspaceName: 'Stream Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [
            { id: 'card-1', topicName: 'topic-a', mode: 'consume' } as any,
            { id: 'card-2', topicName: 'topic-b', mode: 'consume' } as any,
            { id: 'card-3', topicName: 'topic-a', mode: 'produce-consume' } as any,
          ],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
    })
  })

  it('should remove all cards for a given topic', () => {
    useWorkspaceStore.getState().removeStreamCardsByTopic('topic-a')
    const cards = useWorkspaceStore.getState().streamCards
    expect(cards).toHaveLength(1)
    expect(cards[0].topicName).toBe('topic-b')
  })
})

describe('[@store-coverage] clearWorkspace', () => {
  beforeEach(() => {
    const tabId = 'clear-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() },
            { id: 'stmt-2', code: 'SELECT 2', status: 'RUNNING', statementName: 'run-1', createdAt: new Date() },
          ],
          focusedStatementId: null,
          workspaceName: 'Clear Test',
          workspaceNotes: 'Some notes',
          workspaceNotesOpen: true,
          lastSavedAt: null,
          streamCards: [{ id: 'card-1', topicName: 'test' } as any],
          backgroundStatements: [
            { id: 'bg-1', contextId: 'ctx-1', statementName: 'bg-run-1', sql: 'SELECT 1', status: 'RUNNING', createdAt: new Date() },
          ],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
      toasts: [],
    })
  })

  it('should clear all statements, stream cards, background statements, and notes', () => {
    useWorkspaceStore.getState().clearWorkspace()
    const state = useWorkspaceStore.getState()
    expect(state.statements).toHaveLength(0)
    expect(state.streamCards).toHaveLength(0)
    expect(state.backgroundStatements).toHaveLength(0)
    expect(state.workspaceNotes).toBeNull()
    expect(state.workspaceNotesOpen).toBe(false)
  })

  it('should add an info toast', () => {
    useWorkspaceStore.getState().clearWorkspace()
    const toasts = useWorkspaceStore.getState().toasts
    expect(toasts.some((t) => t.type === 'info' && t.message === 'Workspace cleared')).toBe(true)
  })
})

describe('[@store-coverage] stopAllStatements', () => {
  beforeEach(() => {
    const tabId = 'stop-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'stmt-1', code: 'SELECT 1', status: 'RUNNING', statementName: 'run-1', createdAt: new Date() },
            { id: 'stmt-2', code: 'SELECT 2', status: 'PENDING', createdAt: new Date() },
            { id: 'stmt-3', code: 'SELECT 3', status: 'COMPLETED', createdAt: new Date() },
          ],
          focusedStatementId: null,
          workspaceName: 'Stop Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
      toasts: [],
    })
  })

  it('should mark RUNNING and PENDING statements as CANCELLED', async () => {
    await useWorkspaceStore.getState().stopAllStatements()
    const stmts = useWorkspaceStore.getState().statements
    expect(stmts.find((s) => s.id === 'stmt-1')?.status).toBe('CANCELLED')
    expect(stmts.find((s) => s.id === 'stmt-2')?.status).toBe('CANCELLED')
    expect(stmts.find((s) => s.id === 'stmt-3')?.status).toBe('COMPLETED')
  })

  it('should be a no-op when no active statements exist', async () => {
    const tabId = useWorkspaceStore.getState().activeTabId
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          ...useWorkspaceStore.getState().tabs[tabId],
          statements: [
            { id: 'idle-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() },
          ],
        },
      },
    })
    await useWorkspaceStore.getState().stopAllStatements()
    expect(useWorkspaceStore.getState().statements.find((s) => s.id === 'idle-1')?.status).toBe('IDLE')
  })
})

describe('[@store-coverage] cancelStatement', () => {
  beforeEach(() => {
    const tabId = 'cancel-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'stmt-1', code: 'SELECT 1', status: 'RUNNING', statementName: 'flink-stmt-1', createdAt: new Date() },
            { id: 'stmt-2', code: 'SELECT 2', status: 'RUNNING', createdAt: new Date() },
          ],
          focusedStatementId: null,
          workspaceName: 'Cancel Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
      toasts: [],
    })
  })

  it('should set statement status to CANCELLED and set lastExecutedAt', async () => {
    await useWorkspaceStore.getState().cancelStatement('stmt-1')
    const stmt = useWorkspaceStore.getState().statements.find((s) => s.id === 'stmt-1')
    expect(stmt?.status).toBe('CANCELLED')
    expect(stmt?.lastExecutedAt).toBeDefined()
  })

  it('should cancel statement without statementName (no API call)', async () => {
    await useWorkspaceStore.getState().cancelStatement('stmt-2')
    const stmt = useWorkspaceStore.getState().statements.find((s) => s.id === 'stmt-2')
    expect(stmt?.status).toBe('CANCELLED')
  })
})

describe('[@store-coverage] saveCurrentWorkspace edge cases', () => {
  beforeEach(() => {
    const tabId = 'save-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() },
          ],
          focusedStatementId: null,
          workspaceName: 'Save Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
      savedWorkspaces: [],
      toasts: [],
    })
  })

  it('should upsert an existing workspace by name', () => {
    useWorkspaceStore.getState().saveCurrentWorkspace('My WS')
    expect(useWorkspaceStore.getState().savedWorkspaces).toHaveLength(1)
    // Save again with same name — should upsert
    useWorkspaceStore.getState().saveCurrentWorkspace('My WS')
    expect(useWorkspaceStore.getState().savedWorkspaces).toHaveLength(1)
  })

  it('should reject when at 50 workspace limit for new names', () => {
    const existing = Array.from({ length: 50 }, (_, i) => ({
      id: `ws-${i}`,
      name: `WS ${i}`,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      statementCount: 0,
      streamCardCount: 0,
      statements: [],
      streamCards: [],
    }))
    useWorkspaceStore.setState({ savedWorkspaces: existing as any })
    useWorkspaceStore.getState().saveCurrentWorkspace('New WS')
    // Should still be 50 — rejected
    expect(useWorkspaceStore.getState().savedWorkspaces).toHaveLength(50)
    expect(useWorkspaceStore.getState().toasts.some((t) => t.type === 'error' && t.message.includes('Max 50'))).toBe(true)
  })

  it('should save with sourceTemplateId and notes', () => {
    useWorkspaceStore.getState().saveCurrentWorkspace('Template WS', 'tmpl-1', 'Template Name', 'Some notes')
    const ws = useWorkspaceStore.getState().savedWorkspaces[0]
    expect(ws.sourceTemplateId).toBe('tmpl-1')
    expect(ws.sourceTemplateName).toBe('Template Name')
    expect(ws.notes).toBe('Some notes')
  })
})

describe('[@store-coverage] reorderStatements edge case', () => {
  beforeEach(() => {
    const tabId = 'reorder-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'a', code: 'A', status: 'IDLE', createdAt: new Date() },
            { id: 'b', code: 'B', status: 'IDLE', createdAt: new Date() },
          ],
          focusedStatementId: null,
          workspaceName: 'Reorder',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
    })
  })

  it('should be a no-op when fromIndex equals toIndex', () => {
    const before = useWorkspaceStore.getState().statements.map((s) => s.id)
    useWorkspaceStore.getState().reorderStatements(0, 0)
    const after = useWorkspaceStore.getState().statements.map((s) => s.id)
    expect(after).toEqual(before)
  })
})

describe('[@store-coverage] addStatement with overrides', () => {
  beforeEach(() => {
    const tabId = 'override-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [],
          focusedStatementId: null,
          workspaceName: 'Override Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
    })
  })

  it('should apply status and statementName overrides', () => {
    const started = new Date()
    useWorkspaceStore.getState().addStatement('SELECT 1', undefined, 'my-label', {
      status: 'RUNNING',
      statementName: 'flink-stmt-1',
      startedAt: started,
    })
    const stmt = useWorkspaceStore.getState().statements[0]
    expect(stmt.status).toBe('RUNNING')
    expect(stmt.statementName).toBe('flink-stmt-1')
    expect(stmt.startedAt).toBe(started)
    expect(stmt.label).toBe('my-label')
  })
})

describe('[@store-coverage] duplicateStatement edge case', () => {
  beforeEach(() => {
    const tabId = 'dup-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date(), label: 'my-query' },
          ],
          focusedStatementId: null,
          workspaceName: 'Dup Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
    })
  })

  it('should not duplicate if statement ID not found', () => {
    useWorkspaceStore.getState().duplicateStatement('nonexistent')
    expect(useWorkspaceStore.getState().statements).toHaveLength(1)
  })

  it('should append -copy to label when duplicating', () => {
    useWorkspaceStore.getState().duplicateStatement('stmt-1')
    const dup = useWorkspaceStore.getState().statements[1]
    expect(dup.label).toBe('my-query-copy')
  })
})

describe('[@store-coverage] setSessionProperty edge cases', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      sessionProperties: { 'sql.local-time-zone': 'America/New_York' },
      toasts: [],
    })
  })

  it('should reject empty key', () => {
    const before = { ...useWorkspaceStore.getState().sessionProperties }
    useWorkspaceStore.getState().setSessionProperty('  ', 'value')
    expect(useWorkspaceStore.getState().sessionProperties).toEqual(before)
  })

  it('should reject reserved property sql.current-catalog', () => {
    useWorkspaceStore.getState().setSessionProperty('sql.current-catalog', 'test')
    expect(useWorkspaceStore.getState().sessionProperties).not.toHaveProperty('sql.current-catalog')
    expect(useWorkspaceStore.getState().toasts.some((t) => t.type === 'error')).toBe(true)
  })

  it('should reject reserved property sql.current-database', () => {
    useWorkspaceStore.getState().setSessionProperty('sql.current-database', 'test')
    expect(useWorkspaceStore.getState().sessionProperties).not.toHaveProperty('sql.current-database')
  })
})

describe('[@store-coverage] setDashboardHeight clamping', () => {
  it('should clamp height to min 120', () => {
    useWorkspaceStore.getState().setDashboardHeight(50)
    expect(useWorkspaceStore.getState().dashboardHeight).toBe(120)
  })

  it('should clamp height to max 600', () => {
    useWorkspaceStore.getState().setDashboardHeight(1000)
    expect(useWorkspaceStore.getState().dashboardHeight).toBe(600)
  })

  it('should accept height within range', () => {
    useWorkspaceStore.getState().setDashboardHeight(300)
    expect(useWorkspaceStore.getState().dashboardHeight).toBe(300)
  })
})

describe('[@store-coverage] setArtifactUploading', () => {
  it('should clear uploadProgress when uploading set to false', () => {
    useWorkspaceStore.setState({ uploadProgress: 50 })
    useWorkspaceStore.getState().setArtifactUploading(false)
    expect(useWorkspaceStore.getState().artifactUploading).toBe(false)
    expect(useWorkspaceStore.getState().uploadProgress).toBeNull()
  })
})

describe('[@store-coverage] randomStarterJoke', () => {
  it('should return a string from STARTER_JOKES', async () => {
    const { randomStarterJoke } = await import('../../store/workspaceStore')
    const joke = randomStarterJoke()
    expect(typeof joke).toBe('string')
    expect(joke.startsWith('--')).toBe(true)
  })
})

describe('[@store-coverage] addToast duration auto-removal', () => {
  it('should auto-remove toast after duration', async () => {
    vi.useFakeTimers()
    useWorkspaceStore.setState({ toasts: [] })
    useWorkspaceStore.getState().addToast({ type: 'info', message: 'Auto remove', duration: 100 })
    expect(useWorkspaceStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(200)
    expect(useWorkspaceStore.getState().toasts).toHaveLength(0)
    vi.useRealTimers()
  })

  it('should use default 5000ms duration', () => {
    vi.useFakeTimers()
    useWorkspaceStore.setState({ toasts: [] })
    useWorkspaceStore.getState().addToast({ type: 'info', message: 'Default' })
    expect(useWorkspaceStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(4999)
    expect(useWorkspaceStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(2)
    expect(useWorkspaceStore.getState().toasts).toHaveLength(0)
    vi.useRealTimers()
  })
})

describe('[@store-coverage] loadTreeNodeChildren', () => {
  it('should be callable without errors (dev-only log)', async () => {
    await useWorkspaceStore.getState().loadTreeNodeChildren('some-node')
    // Just verifying no errors thrown
  })
})

describe('[@store-coverage] updateStatementLabel edge cases', () => {
  beforeEach(() => {
    const tabId = 'label-tab'
    useWorkspaceStore.setState({
      tabs: {
        [tabId]: {
          statements: [
            { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date(), label: 'original' },
          ],
          focusedStatementId: null,
          workspaceName: 'Label Test',
          workspaceNotes: null,
          workspaceNotesOpen: false,
          lastSavedAt: null,
          streamCards: [],
          backgroundStatements: [],
          treeNodes: [],
          selectedNodeId: null,
          treeLoading: false,
          selectedTableSchema: [],
          selectedTableName: null,
          schemaLoading: false,
        },
      },
      activeTabId: tabId,
      tabOrder: [tabId],
    })
  })

  it('should set label to undefined when empty string is passed', () => {
    useWorkspaceStore.getState().updateStatementLabel('stmt-1', '   ')
    const stmt = useWorkspaceStore.getState().statements.find((s) => s.id === 'stmt-1')
    expect(stmt?.label).toBeUndefined()
  })

  it('should trim whitespace from label', () => {
    useWorkspaceStore.getState().updateStatementLabel('stmt-1', '  trimmed  ')
    const stmt = useWorkspaceStore.getState().statements.find((s) => s.id === 'stmt-1')
    expect(stmt?.label).toBe('trimmed')
  })
})

describe('[@store-coverage] toggleComputePoolDashboard', () => {
  it('should toggle dashboard open state', () => {
    useWorkspaceStore.setState({ computePoolDashboardOpen: false })
    useWorkspaceStore.getState().toggleComputePoolDashboard()
    expect(useWorkspaceStore.getState().computePoolDashboardOpen).toBe(true)
  })
})

describe('[@store-coverage] clearHistoryError', () => {
  it('should clear historyError', () => {
    useWorkspaceStore.setState({ historyError: 'some error' })
    useWorkspaceStore.getState().clearHistoryError()
    expect(useWorkspaceStore.getState().historyError).toBeNull()
  })
})

describe('[@store-coverage] runAllStreams', () => {
  it('should increment runAllStreamsSignal and show toast', () => {
    useWorkspaceStore.setState({ runAllStreamsSignal: 0, toasts: [] })
    useWorkspaceStore.getState().runAllStreams()
    expect(useWorkspaceStore.getState().runAllStreamsSignal).toBe(1)
    expect(useWorkspaceStore.getState().toasts.some((t) => t.message.includes('Starting all streams'))).toBe(true)
  })
})
