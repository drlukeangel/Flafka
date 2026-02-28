// [@editor-registry]
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the workspaceStore module before importing the registry.
// monaco-editor is stubbed via the vite alias `monaco-editor → src/test/mocks/monaco-editor.ts`
// so no explicit vi.mock for it is needed here.
vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: vi.fn(),
  },
}))

import { editorRegistry, getFocusedEditor, insertTextAtCursor } from '../components/EditorCell/editorRegistry'
import { useWorkspaceStore } from '../store/workspaceStore'

const mockGetState = vi.mocked(useWorkspaceStore.getState)

// Helper to build a mock Monaco editor instance
const makeMockEditor = () => ({
  executeEdits: vi.fn(),
  focus: vi.fn(),
  getSelection: vi.fn(),
})

describe('[@editor-registry] editorRegistry', () => {
  beforeEach(() => {
    // Clear the shared registry map between tests
    editorRegistry.clear()
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // getFocusedEditor
  // ---------------------------------------------------------------------------

  describe('[@editor-registry] getFocusedEditor', () => {
    it('returns null when focusedStatementId is null', () => {
      mockGetState.mockReturnValue({ focusedStatementId: null } as ReturnType<typeof useWorkspaceStore.getState>)

      expect(getFocusedEditor()).toBeNull()
    })

    it('returns null when focusedStatementId is undefined', () => {
      mockGetState.mockReturnValue({ focusedStatementId: undefined as unknown as null } as ReturnType<typeof useWorkspaceStore.getState>)

      expect(getFocusedEditor()).toBeNull()
    })

    it('returns null when focusedStatementId is set but not present in registry', () => {
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-abc' } as ReturnType<typeof useWorkspaceStore.getState>)
      // Registry is empty – 'stmt-abc' was never registered

      expect(getFocusedEditor()).toBeNull()
    })

    it('returns the editor when focusedStatementId matches a registry entry', () => {
      const editor = makeMockEditor()
      editorRegistry.set('stmt-xyz', editor as never)
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-xyz' } as ReturnType<typeof useWorkspaceStore.getState>)

      expect(getFocusedEditor()).toBe(editor)
    })

    it('returns null when focusedStatementId points to a different ID than the one in the registry', () => {
      const editor = makeMockEditor()
      editorRegistry.set('stmt-1', editor as never)
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-2' } as ReturnType<typeof useWorkspaceStore.getState>)

      expect(getFocusedEditor()).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // insertTextAtCursor
  // ---------------------------------------------------------------------------

  describe('[@editor-registry] insertTextAtCursor', () => {
    it('returns false when no focused editor is available (focusedStatementId null)', () => {
      mockGetState.mockReturnValue({ focusedStatementId: null } as ReturnType<typeof useWorkspaceStore.getState>)

      expect(insertTextAtCursor('SELECT 1')).toBe(false)
    })

    it('returns false when focusedStatementId is set but not in registry', () => {
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-missing' } as ReturnType<typeof useWorkspaceStore.getState>)

      expect(insertTextAtCursor('SELECT 1')).toBe(false)
    })

    it('returns false when editor.getSelection() returns null', () => {
      const editor = makeMockEditor()
      editor.getSelection.mockReturnValue(null)
      editorRegistry.set('stmt-1', editor as never)
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-1' } as ReturnType<typeof useWorkspaceStore.getState>)

      expect(insertTextAtCursor('SELECT 1')).toBe(false)
      expect(editor.executeEdits).not.toHaveBeenCalled()
      expect(editor.focus).not.toHaveBeenCalled()
    })

    it('calls executeEdits with the correct arguments when editor and selection are available', () => {
      const fakeSelection = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }
      const editor = makeMockEditor()
      editor.getSelection.mockReturnValue(fakeSelection)
      editorRegistry.set('stmt-1', editor as never)
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-1' } as ReturnType<typeof useWorkspaceStore.getState>)

      const result = insertTextAtCursor('table_name')

      expect(editor.executeEdits).toHaveBeenCalledOnce()
      expect(editor.executeEdits).toHaveBeenCalledWith('sidebar-insert', [
        {
          range: fakeSelection,
          text: 'table_name',
          forceMoveMarkers: true,
        },
      ])
    })

    it('calls focus on the editor after inserting text', () => {
      const fakeSelection = { startLineNumber: 2, startColumn: 5, endLineNumber: 2, endColumn: 5 }
      const editor = makeMockEditor()
      editor.getSelection.mockReturnValue(fakeSelection)
      editorRegistry.set('stmt-1', editor as never)
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-1' } as ReturnType<typeof useWorkspaceStore.getState>)

      insertTextAtCursor('my_column')

      expect(editor.focus).toHaveBeenCalledOnce()
    })

    it('returns true on success', () => {
      const fakeSelection = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }
      const editor = makeMockEditor()
      editor.getSelection.mockReturnValue(fakeSelection)
      editorRegistry.set('stmt-1', editor as never)
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-1' } as ReturnType<typeof useWorkspaceStore.getState>)

      expect(insertTextAtCursor('SELECT *')).toBe(true)
    })

    it('passes the exact text string through to executeEdits unchanged', () => {
      const sql = 'SELECT * FROM `my-table` WHERE col = 1'
      const fakeSelection = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }
      const editor = makeMockEditor()
      editor.getSelection.mockReturnValue(fakeSelection)
      editorRegistry.set('stmt-1', editor as never)
      mockGetState.mockReturnValue({ focusedStatementId: 'stmt-1' } as ReturnType<typeof useWorkspaceStore.getState>)

      insertTextAtCursor(sql)

      const [, edits] = editor.executeEdits.mock.calls[0] as [string, Array<{ text: string }>]
      expect(edits[0].text).toBe(sql)
    })
  })
})
