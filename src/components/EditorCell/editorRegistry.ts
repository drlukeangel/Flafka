import * as monaco from 'monaco-editor';

export const editorRegistry = new Map<string, monaco.editor.IStandaloneCodeEditor>();
export let focusedEditorId: string | null = null;

export function setFocusedEditorId(id: string | null) {
  focusedEditorId = id;
}

export function getFocusedEditor(): monaco.editor.IStandaloneCodeEditor | undefined {
  if (!focusedEditorId) return undefined;
  return editorRegistry.get(focusedEditorId);
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
