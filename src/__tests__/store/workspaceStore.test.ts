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
    it('should insert a blank fallback statement when the last statement is deleted', () => {
      const store = useWorkspaceStore.getState()
      expect(store.statements).toHaveLength(1)

      store.deleteStatement('stmt-1')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements).toHaveLength(1)
      expect(updated.statements[0]!.code).toBe('-- Write your Flink SQL query here')
      expect(updated.statements[0]!.status).toBe('IDLE')
    })

    it('fallback statement should have a fresh id different from the deleted one', () => {
      useWorkspaceStore.getState().deleteStatement('stmt-1')

      const updated = useWorkspaceStore.getState()
      expect(updated.statements[0]!.id).not.toBe('stmt-1')
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
          statements: Array<{ id: string; status: string }>
          computePoolPhase?: unknown
          lastSavedAt: string | null
        }
      }

      const statuses = persisted.state.statements.reduce<Record<string, string>>((acc, s) => {
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

    it('should include lastSavedAt in persisted state', () => {
      useWorkspaceStore.getState().setWorkspaceName('lastsaved-test')
      // Trigger a mutation that writes lastSavedAt
      useWorkspaceStore.getState().addStatement('SELECT 999')

      const raw = localStorage.getItem('flink-workspace')
      const persisted = JSON.parse(raw!) as { state: Record<string, unknown> }

      expect(persisted.state).toHaveProperty('lastSavedAt')
      expect(persisted.state['lastSavedAt']).not.toBeNull()
    })
  })
})
