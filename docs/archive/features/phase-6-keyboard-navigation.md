# Phase 6: Keyboard Navigation Between Editor Cells (Ctrl+Alt+Up/Down)

**Status:** Draft PRD
**Date:** 2026-02-28
**Feature ID:** keyboard-navigation

**Dependencies:** This feature depends on Phase 6.3 (Insert at Cursor) being implemented first. The shared editor registry module (`src/components/EditorCell/editorRegistry.ts`) must exist before this feature can be implemented.

---

## Problem Statement

Users currently have no keyboard shortcut to navigate between editor cells. When working with multiple SQL statements, switching focus between cells requires mouse clicks, which breaks workflow continuity and slows down complex query workflows.

---

## Proposed Solution

Add Ctrl+Alt+Up and Ctrl+Alt+Down keyboard shortcuts to move focus between editor cells. When triggered, the shortcut will:
- **Ctrl+Alt+Down:** Move focus to the next (lower) editor cell's Monaco editor
- **Ctrl+Alt+Up:** Move focus to the previous (upper) editor cell's Monaco editor
- **Wrap behavior:** Ctrl+Alt+Down on the last cell does nothing; Ctrl+Alt+Up on the first cell does nothing (no wrap-around)

The implementation will use Monaco's `editor.addAction()` API to register keybindings and read from a shared editor registry module (`src/components/EditorCell/editorRegistry.ts`) that is created and maintained by Phase 6.3 (Insert at Cursor feature). This registry tracks all active editors by statement ID, enabling cross-cell navigation without coupling.

**Keybinding choice rationale:** Alt+Down/Up are Monaco's built-in "Move Line Down/Up" actions and cannot be overridden. Ctrl+Alt+Down/Up do not conflict with Monaco defaults or Windows virtual desktop switching (Ctrl+Win+Arrow).

---

## Files to Modify

1. **src/components/EditorCell/EditorCell.tsx** (reads from shared registry)
   - Import `editorRegistry` and `focusedEditorId` from `src/components/EditorCell/editorRegistry.ts`
   - In `handleEditorMount`: register editor keybindings for Ctrl+Alt+Up and Ctrl+Alt+Down
   - Register/unregister editor in the shared registry on mount/unmount via `editorRegistry.set()` and `editorRegistry.delete()`
   - Implement navigation logic to find next/prev statement from store and focus its editor
   - Handle collapsed cells: if navigating to a collapsed cell, auto-expand it first via `toggleStatementCollapse(id)`, then defer focus to `requestAnimationFrame`

---

## Implementation Details

### Shared Editor Registry

The editor registry is defined in `src/components/EditorCell/editorRegistry.ts` and is created/maintained by Phase 6.3 (Insert at Cursor feature). This feature **reads from** the registry but does not create it.

**Registry exports:**
```typescript
export const editorRegistry: Map<string, monaco.editor.IStandaloneCodeEditor>;
export let focusedEditorId: string | null;
export function setFocusedEditorId(id: string | null): void;
```

### Keybinding Registration in handleEditorMount

Add two new `editor.addAction()` calls in the `handleEditorMount` function:

1. **Ctrl+Alt+Down (Navigate to Next Cell)**
   - Action ID: `navigate-next-cell`
   - Keybinding: `monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow` (or `ArrowDown` - verify with installed Monaco version)
   - Logic:
     - Get current statement from store
     - Find current statement's index
     - If index + 1 < statements.length, get next statement ID
     - If next statement is collapsed, call `toggleStatementCollapse(nextStatementId)` to expand it
     - Defer focus to next frame: `requestAnimationFrame(() => { nextEditor.focus() })`
     - If nextEditor not in registry, skip navigation (safe fail)

2. **Ctrl+Alt+Up (Navigate to Previous Cell)**
   - Action ID: `navigate-prev-cell`
   - Keybinding: `monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow` (or `ArrowUp` - verify with installed Monaco version)
   - Logic:
     - Get current statement from store
     - Find current statement's index
     - If index - 1 >= 0, get previous statement ID
     - If previous statement is collapsed, call `toggleStatementCollapse(prevStatementId)` to expand it
     - Defer focus to next frame: `requestAnimationFrame(() => { prevEditor.focus() })`
     - If prevEditor not in registry, skip navigation (safe fail)

### Editor Registration/Cleanup

In `handleEditorMount`:
- After `editorRef.current = editor`, register in shared map: `editorRegistry.set(statement.id, editor)`
- Set up `editor.onDidDispose()` listener to clean up: `editorRegistry.delete(statement.id)`

### Monaco KeyCode Verification

The keybinding uses `monaco.KeyCode.DownArrow` and `monaco.KeyCode.UpArrow`. **Implementer must verify** whether the installed Monaco version uses these names or `ArrowDown` / `ArrowUp`. Check the actual `monaco.d.ts` type definitions to confirm the correct enum names.

---

## Acceptance Criteria

1. **Ctrl+Alt+Down Focus Movement:** When cursor is in an editor cell and user presses Ctrl+Alt+Down, focus moves to the next cell's editor if one exists.
2. **Ctrl+Alt+Up Focus Movement:** When cursor is in an editor cell and user presses Ctrl+Alt+Up, focus moves to the previous cell's editor if one exists.
3. **Boundary Handling:** Ctrl+Alt+Down on the last cell does not cause an error and does nothing. Ctrl+Alt+Up on the first cell does not cause an error and does nothing.
4. **Editor State Preserved:** Navigating to another cell does not modify the code in either cell; cursor position and selection in the destination editor are preserved (Monaco default).
5. **Registry Cleanup:** When a cell is unmounted (deleted), its editor is removed from the shared registry.
6. **Collapsed Cell Auto-Expand:** Navigating to a collapsed cell automatically expands it (calls `toggleStatementCollapse()`), and focus is deferred to `requestAnimationFrame` to allow Monaco to mount.
7. **HMR Stability:** Vite Hot Module Replacement does not cause duplicate editor registrations or memory leaks. The registry is populated on editor mount, overwriting stale entries from previous HMR cycles.

---

## Edge Cases

1. **Single Cell:** User with only one statement can press Ctrl+Alt+Up/Down without error (no-op).
2. **Collapsed Cells:** Navigating to a collapsed cell auto-expands it first (via `toggleStatementCollapse()`). Focus is deferred to `requestAnimationFrame` to let Monaco mount the editor before focusing.
3. **Deleted Cell During Navigation:** If user deletes the next/prev cell between the time an action is called and the registry is accessed, the lookup returns `undefined` and no action is taken (safe fail).
4. **Rapid Key Presses:** Multiple Ctrl+Alt+Down presses in quick succession should move through cells sequentially without losing focus or errors.
5. **Editor Creation Timing:** All cells are mounted on initial render and on statement add. Navigation only works when both editors exist; if destination editor not yet in registry, navigation is skipped.
6. **HMR Remount:** When Vite HMR reloads EditorCell.tsx, the old editor reference is disposed (via `onDidDispose`), and the new editor is registered in the same Map entry. No cleanup required beyond the disposal listener.

---

## API & Type Changes

- Uses existing `toggleStatementCollapse(id)` store action for auto-expanding collapsed cells
- No new store actions needed
- No type changes required
- Monaco keybindings: `monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow` and `monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow` (verify KeyCode names with installed Monaco version)
- Depends on shared registry from `src/components/EditorCell/editorRegistry.ts` (created by Phase 6.3)

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Create 3+ statements in the workspace
- [ ] Position cursor in middle cell
- [ ] Press Ctrl+Alt+Down → focus moves to next cell's editor
- [ ] Press Ctrl+Alt+Down again → focus moves to next cell's editor
- [ ] Press Ctrl+Alt+Down at last cell → nothing happens, focus stays
- [ ] Press Ctrl+Alt+Up from current cell → focus moves to previous cell
- [ ] Press Ctrl+Alt+Up from first cell → nothing happens, focus stays
- [ ] Delete a cell in the middle → nearby cells' navigation still works
- [ ] Reload page → statement code is unchanged, navigation works on restore
- [ ] Verify Ctrl+Alt+Down/Up do not trigger Windows virtual desktop switching (they should not conflict)
- [ ] Type Ctrl+Alt+Down while editing text → should not trigger navigation (only at editor level)

### Edge Case Testing

- [ ] Create and delete cells rapidly, then test navigation
- [ ] Collapse a cell (hide its content), then navigate to it (should auto-expand and focus editor)
- [ ] Test with single statement (Ctrl+Alt+Up/Down should no-op)
- [ ] Modify code in a cell, navigate away, come back → code is unchanged
- [ ] Test HMR: edit the EditorCell.tsx file while app is running, verify keybindings still work after reload

---

## Performance Considerations

- **Registry Overhead:** Map lookup is O(1), negligible overhead
- **Memory Footprint:** One Map entry per open editor cell (typically 1-10 cells), minimal impact
- **HMR Safety:** Shared registry persists across Vite HMR. The primary safety mechanism is `editorRegistry.set()` overwriting stale entries on remount. The `onDidDispose` listener ensures cleanup of explicitly disposed editors.

---

## Future Enhancements

- Alt+Shift+Up/Down to reorder cells (move cell up/down in array)
- Tab/Shift+Tab to move focus between cells (if no in-editor Tab conflict)
- Jump to specific cell by number (Ctrl+J → cell selector)
