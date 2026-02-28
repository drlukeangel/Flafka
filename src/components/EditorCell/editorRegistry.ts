import * as monaco from 'monaco-editor';
import { useWorkspaceStore } from '../../store/workspaceStore';

export const editorRegistry = new Map<string, monaco.editor.IStandaloneCodeEditor>();

export function getFocusedEditor(): monaco.editor.IStandaloneCodeEditor | null {
  const focusedId = useWorkspaceStore.getState().focusedStatementId;
  if (!focusedId) return null;
  return editorRegistry.get(focusedId) || null;
}

export function insertTextAtCursor(text: string): boolean {
  const editor = getFocusedEditor();
  if (!editor) return false;

  const selection = editor.getSelection();
  if (!selection) return false;

  // Use executeEdits to insert at cursor (preserves undo stack)
  editor.executeEdits('sidebar-insert', [{
    range: selection,
    text,
    forceMoveMarkers: true,
  }]);
  editor.focus();
  return true;
}
