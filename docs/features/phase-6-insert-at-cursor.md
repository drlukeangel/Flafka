# Phase 6: Insert Column/Table Name at Cursor from Sidebar

**Date:** 2026-02-28
**Status:** DESIGN (awaiting review)

## Problem Statement

Users can currently copy column names and table names to clipboard (Phase 5.4), but must manually click the editor, position their cursor, and paste. This is inefficient for the common workflow of building SQL queries by referencing schema objects. A faster approach: clicking should INSERT directly into the focused editor at the current cursor position.

## Proposed Solution

Implement a two-click interaction model:
- **Single-click (existing):** Copy to clipboard (Phase 5.4 behavior preserved)
- **Double-click (new):** Insert at cursor in the focused editor

Use a module-level editor registry (Map<string, monaco.editor.IStandaloneCodeEditor>) to track editors, with module-level focus state to know which editor is active. This avoids storing editor instances in Zustand (per architect feedback on prior features).

## Files to Modify

| File | Change |
|------|--------|
| `src/components/EditorCell/editorRegistry.ts` | NEW: Shared module for editor registry (Map<string, IStandaloneCodeEditor>), focus tracking, insertTextAtCursor helper |
| `src/components/EditorCell/EditorCell.tsx` | Import registry, register/unregister editors on mount/dispose, track focus on onDidFocusEditorText and onDidDispose |
| `src/components/TreeNavigator/TreeNavigator.tsx` | Add onDoubleClick handler for schema columns; call insertTextAtCursor with column name |

## Implementation Details

### 1. EditorRegistry Module (New Shared File)

Create `src/components/EditorCell/editorRegistry.ts` (shared by Phase 6 and Phase 6.2):
```typescript
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
```

**Note:** This module is shared with Phase 6.2 (keyboard navigation). Both features use the same registry and focus tracking.

### 2. EditorCell Mount & Focus Tracking

In `EditorCell.tsx` (after keyboard shortcuts setup):
```typescript
import { editorRegistry, setFocusedEditorId } from './editorRegistry';

// Register this editor in module-level map
editorRegistry.set(statement.id, editor);

// Track focus state
editor.onDidFocusEditorText(() => {
  setFocusedEditorId(statement.id);
});

// DO NOT clear focusedEditorId on blur
// (blur fires before sidebar click, would null the editor before insert completes)

// Cleanup on dispose
editor.onDidDispose(() => {
  editorRegistry.delete(statement.id);
  // Only clear focusedEditorId if this disposed editor was the focused one
  // Import setFocusedEditorId from registry to clear safely
  const { focusedEditorId } = require('./editorRegistry');
  if (focusedEditorId === statement.id) {
    setFocusedEditorId(null);
  }
});
```

**Key Point:** `focusedEditorId` is never cleared on blur. It maintains "last focused editor" semantics. This prevents the blur handler from clearing the ID before a sidebar click handler can insert text.

### 3. TreeNavigator Schema Column Double-Click

In `TreeNavigator.tsx`, modify schema column rendering:
```typescript
import { insertTextAtCursor } from '../EditorCell/editorRegistry';

// In handleSchemaColumnDoubleClick handler (new)
const handleSchemaColumnDoubleClick = (columnName: string) => {
  const quoted = quoteIdentifierIfNeeded(columnName);

  const inserted = insertTextAtCursor(quoted);
  if (inserted) {
    addToast({ type: 'success', message: `Inserted: ${columnName}` });
  } else {
    // Editor either not focused, or editor is disposed/collapsed
    addToast({ type: 'warning', message: 'No active editor. Click an editor first.' });
  }
};

// Single-click handler (unchanged from Phase 5.4)
const handleSchemaColumnClick = async (columnName: string) => {
  // Single-click: copy to clipboard
  const quoted = quoteIdentifierIfNeeded(columnName);
  try {
    await navigator.clipboard.writeText(quoted);
    addToast({ type: 'success', message: `Copied: ${columnName}` });
    setCopiedColName(columnName);
    setTimeout(() => setCopiedColName(null), 600);
  } catch {
    addToast({ type: 'error', message: 'Failed to copy' });
  }
};

// In schema column JSX:
<div
  key={col.name}
  className={`schema-column${copiedColName === col.name ? ' schema-column--copied' : ''}`}
  onClick={() => handleSchemaColumnClick(col.name)}
  onDoubleClick={(e) => {
    e.preventDefault();  // Prevent text selection on double-click
    handleSchemaColumnDoubleClick(col.name);
  }}
  title="Single-click to copy, double-click to insert at cursor"
/>
```

**Pattern:** Use `onDoubleClick` handler directly (not e.detail === 2). This matches the existing TreeNodeComponent pattern and is cleaner.

### 4. Table Name Hover Copy Icon (No Change)

The existing table hover copy icon behavior remains unchanged:
- Hover over table → copy icon appears
- Click copy icon → copies to clipboard (not insert)

This preserves consistency with Phase 5.4.

## Acceptance Criteria

1. **Single-click column** → copies to clipboard (Phase 5.4 behavior preserved)
2. **Double-click column with focused editor** → inserts quoted column name at cursor
3. **Double-click column with NO focused editor** → shows warning toast: "No active editor"
4. **Insert preserves undo stack** → user can Ctrl+Z to undo the insert
5. **Table copy icon** → unchanged behavior, copies only
6. **Editor must be active** → focus is required; can test by: click editor → double-click column → text appears
7. **Multiple editors** → each tracks its own focus; only focused editor gets insert
8. **Toast feedback** → success/warning/error messages guide the user

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Double-click column, no editor focused | Warning toast: "No active editor" |
| Double-click column, focused editor is collapsed (disposed) | Warning toast: "No active editor" (editor not in registry) |
| Double-click column, editor not disposed but null selection | Warning toast: "No active editor" (getSelection() fails gracefully) |
| Column name requires quoting (spaces, dashes) | `quoteIdentifierIfNeeded()` handles; insert with backticks |
| Multiple editors visible, switch focus | Only focused editor receives inserts (correct behavior) |
| Insert at beginning of line | Works: cursor position is respected |
| Insert at end of line | Works: cursor position is respected |
| Insert mid-word (e.g., `SELECT col|umn`) | Works: `executeEdits()` inserts at cursor, may split word (user can undo) |
| Editor unmounts then re-mounts same statement | Registry re-registers fresh editor instance (correct) |
| Blur editor, then double-click column | Still works: `focusedEditorId` persists across blur (not cleared on blur) |
| Switch focus from Editor A to Editor B, double-click column | Inserts into Editor B (correct) |

## API Changes

None. No Zustand store changes, no API calls, no type modifications.

## Type Changes

No new types required. Uses existing `SQLStatement` and `Column` types.

---

## Review Checklist

- [ ] **Architect:** System design sound? Registry pattern appropriate? State management concerns?
- [ ] **Engineer:** Implementation approach simple? Edge cases handled? Undo/redo preservation?
- [ ] **QA:** All acceptance criteria testable? Edge cases covered in test plan?
