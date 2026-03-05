import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkspaceStore } from '../../store/workspaceStore'
import * as flinkApi from '../../api/flink-api'

vi.mock('../../api/flink-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/flink-api')>()
  return {
    ...actual,
    cancelStatement: vi.fn().mockResolvedValue(undefined),
  }
})

/** Helper: set state on both root mirrors AND the active tab */
function setTabState(updates: Record<string, any>) {
  const state = useWorkspaceStore.getState()
  const tabId = state.activeTabId
  const tab = state.tabs[tabId]
  useWorkspaceStore.setState({
    ...updates,
    tabs: { ...state.tabs, [tabId]: { ...tab, ...updates } },
  })
}

describe('[@split-button-store] Split button store actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined)
    setTabState({
      statements: [],
      backgroundStatements: [],
      streamCards: [],
    })
    useWorkspaceStore.setState({
      toasts: [],
      runAllStreamsSignal: 0,
      stopAllStreamsSignal: 0,
    })
  })

  describe('[@split-button-store] stopAllStreams', () => {
    it('increments stopAllStreamsSignal', async () => {
      const before = useWorkspaceStore.getState().stopAllStreamsSignal
      await useWorkspaceStore.getState().stopAllStreams()
      expect(useWorkspaceStore.getState().stopAllStreamsSignal).toBe(before + 1)
    })

    it('sets RUNNING and PENDING background statements to CANCELLED', async () => {
      setTabState({
        backgroundStatements: [
          { statementName: 'bg-1', status: 'RUNNING', sql: 'SELECT 1' } as any,
          { statementName: 'bg-2', status: 'COMPLETED', sql: 'SELECT 2' } as any,
          { statementName: 'bg-3', status: 'PENDING', sql: 'SELECT 3' } as any,
        ],
      })

      await useWorkspaceStore.getState().stopAllStreams()
      const bgs = useWorkspaceStore.getState().backgroundStatements

      expect(bgs[0].status).toBe('CANCELLED')
      expect(bgs[1].status).toBe('COMPLETED')
      expect(bgs[2].status).toBe('CANCELLED')
    })

    it('shows plural toast when multiple active streams', async () => {
      setTabState({
        backgroundStatements: [
          { statementName: 'bg-1', status: 'RUNNING', sql: 'SELECT 1' } as any,
          { statementName: 'bg-2', status: 'RUNNING', sql: 'SELECT 2' } as any,
        ],
      })

      await useWorkspaceStore.getState().stopAllStreams()
      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].message).toContain('2 streams')
    })

    it('shows singular toast "Stopped 1 stream" when exactly 1 active', async () => {
      setTabState({
        backgroundStatements: [
          { statementName: 'bg-1', status: 'RUNNING', sql: 'SELECT 1' } as any,
          { statementName: 'bg-2', status: 'COMPLETED', sql: 'SELECT 2' } as any,
        ],
      })

      await useWorkspaceStore.getState().stopAllStreams()
      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].message).toBe('Stopped 1 stream')
      expect(toasts[0].message).not.toContain('streams')
    })

    it('calls flinkApi.cancelStatement for each active bg statement', async () => {
      setTabState({
        backgroundStatements: [
          { statementName: 'bg-1', status: 'RUNNING', sql: 'SELECT 1' } as any,
          { statementName: 'bg-2', status: 'PENDING', sql: 'SELECT 2' } as any,
          { statementName: 'bg-3', status: 'COMPLETED', sql: 'SELECT 3' } as any,
        ],
      })

      await useWorkspaceStore.getState().stopAllStreams()
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledWith('bg-1')
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledWith('bg-2')
    })

    it('handles cancelStatement rejection gracefully (Promise.allSettled)', async () => {
      vi.mocked(flinkApi.cancelStatement).mockRejectedValue(new Error('network'))
      setTabState({
        backgroundStatements: [
          { statementName: 'bg-1', status: 'RUNNING', sql: 'SELECT 1' } as any,
        ],
      })

      await expect(useWorkspaceStore.getState().stopAllStreams()).resolves.toBeUndefined()
    })

    it('does not show toast when no active streams', async () => {
      setTabState({
        backgroundStatements: [
          { statementName: 'bg-1', status: 'COMPLETED', sql: 'SELECT 1' } as any,
        ],
      })

      await useWorkspaceStore.getState().stopAllStreams()
      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts).toHaveLength(0)
    })
  })

  describe('[@split-button-store] clearStatements', () => {
    it('clears all statements', () => {
      setTabState({
        statements: [
          { id: 's1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() } as any,
          { id: 's2', code: 'SELECT 2', status: 'RUNNING', statementName: 'stmt-x', createdAt: new Date() } as any,
        ],
      })

      useWorkspaceStore.getState().clearStatements()
      expect(useWorkspaceStore.getState().statements).toHaveLength(0)
    })

    it('shows toast after clearing', () => {
      setTabState({
        statements: [{ id: 's1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date() } as any],
      })

      useWorkspaceStore.getState().clearStatements()
      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts.some((t: any) => t.message.includes('cleared'))).toBe(true)
    })

    it('calls cancelStatement for RUNNING/PENDING statements with statementName', () => {
      setTabState({
        statements: [
          { id: 's1', code: 'SELECT 1', status: 'RUNNING', statementName: 'stmt-1', createdAt: new Date() } as any,
          { id: 's2', code: 'SELECT 2', status: 'PENDING', statementName: 'stmt-2', createdAt: new Date() } as any,
        ],
      })

      useWorkspaceStore.getState().clearStatements()
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledWith('stmt-1')
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledWith('stmt-2')
    })

    it('does NOT call cancelStatement for IDLE statements', () => {
      setTabState({
        statements: [
          { id: 's1', code: 'SELECT 1', status: 'IDLE', statementName: 'stmt-1', createdAt: new Date() } as any,
        ],
      })

      useWorkspaceStore.getState().clearStatements()
      expect(vi.mocked(flinkApi.cancelStatement)).not.toHaveBeenCalled()
    })

    it('does NOT call cancelStatement for statements without statementName', () => {
      setTabState({
        statements: [
          { id: 's1', code: 'SELECT 1', status: 'RUNNING', createdAt: new Date() } as any,
        ],
      })

      useWorkspaceStore.getState().clearStatements()
      expect(vi.mocked(flinkApi.cancelStatement)).not.toHaveBeenCalled()
    })
  })

  describe('[@split-button-store] clearStreamCards', () => {
    it('clears all stream cards', async () => {
      setTabState({
        streamCards: [{ id: 'sc-1' } as any, { id: 'sc-2' } as any],
        backgroundStatements: [],
      })

      await useWorkspaceStore.getState().clearStreamCards()
      expect(useWorkspaceStore.getState().streamCards).toHaveLength(0)
    })

    it('shows toast after clearing', async () => {
      setTabState({
        streamCards: [{ id: 'sc-1' } as any],
        backgroundStatements: [],
      })

      await useWorkspaceStore.getState().clearStreamCards()
      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts.some((t: any) => t.message.includes('cleared'))).toBe(true)
    })

    it('cancels active bg statements via clearBackgroundStatements', async () => {
      setTabState({
        streamCards: [{ id: 'sc-1' } as any],
        backgroundStatements: [
          { statementName: 'bg-1', status: 'RUNNING', sql: 'SELECT 1' } as any,
          { statementName: 'bg-2', status: 'PENDING', sql: 'SELECT 2' } as any,
          { statementName: 'bg-3', status: 'COMPLETED', sql: 'SELECT 3' } as any,
        ],
      })

      await useWorkspaceStore.getState().clearStreamCards()
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledWith('bg-1')
      expect(vi.mocked(flinkApi.cancelStatement)).toHaveBeenCalledWith('bg-2')
      expect(useWorkspaceStore.getState().backgroundStatements).toHaveLength(0)
    })
  })

  describe('[@split-button-store] runAllStreams', () => {
    it('increments runAllStreamsSignal', () => {
      const before = useWorkspaceStore.getState().runAllStreamsSignal
      useWorkspaceStore.getState().runAllStreams()
      expect(useWorkspaceStore.getState().runAllStreamsSignal).toBe(before + 1)
    })

    it('shows toast on run', () => {
      useWorkspaceStore.getState().runAllStreams()
      const toasts = useWorkspaceStore.getState().toasts
      expect(toasts.some((t: any) => t.message.includes('Starting all streams'))).toBe(true)
    })

    it('signal increments are independent from stopAllStreams', async () => {
      useWorkspaceStore.getState().runAllStreams()
      expect(useWorkspaceStore.getState().runAllStreamsSignal).toBe(1)
      expect(useWorkspaceStore.getState().stopAllStreamsSignal).toBe(0)

      await useWorkspaceStore.getState().stopAllStreams()
      expect(useWorkspaceStore.getState().stopAllStreamsSignal).toBe(1)
      expect(useWorkspaceStore.getState().runAllStreamsSignal).toBe(1)
    })

    it('increments signal each time it is called', () => {
      useWorkspaceStore.getState().runAllStreams()
      useWorkspaceStore.getState().runAllStreams()
      useWorkspaceStore.getState().runAllStreams()
      expect(useWorkspaceStore.getState().runAllStreamsSignal).toBe(3)
    })
  })
})
