# Phase 7: Cell Position Counter - Technical PRD

**Date:** 2026-02-28
**Status:** Design Phase

## Problem Statement

The footer bar currently displays "N statement(s)" and "Last saved at HH:MM:SS", providing limited context about the user's position within the workspace. When working with multiple SQL cells, users have no visual indicator of which cell is currently focused or their position relative to the total number of cells.

## Proposed Solution

Add a cell position counter to the footer that displays "Cell X of Y" when a cell is focused, updating reactively as the user navigates between cells. When no cell is focused, the footer shows only the total statement count as before.

## Files to Modify

- **`src/store/workspaceStore.ts`** - Add `focusedStatementId: string | null` to store state and action to update it
- **`src/api/editorRegistry.ts`** - Remove `focusedEditorId` and `setFocusedEditorId`; rewrite `getFocusedEditor()` to use `useWorkspaceStore.getState().focusedStatementId`
- **`src/components/EditorCell/EditorCell.tsx`** - Add blur handler, update focus tracking to use store
- **`src/components/FooterStatus/FooterStatus.tsx`** - NEW: Extract footer logic into scoped component
- **`src/App.tsx`** - Remove footer logic, replace with `<FooterStatus />` component
- **`src/App.css`** - Style the position counter display

## Implementation Details

### State Management

Add to `WorkspaceState` interface:
```typescript
focusedStatementId: string | null;  // Currently focused editor cell ID
setFocusedStatementId: (id: string | null) => void;  // Action to update focused ID
```

Initialize as `focusedStatementId: null` in the initial state object.

Add the action:
```typescript
setFocusedStatementId: (id) => {
  set({ focusedStatementId: id });
}
```

**Important:** `focusedStatementId` should NOT be included in the `partialize` function - it must NOT be persisted to localStorage since it's a transient runtime state.

### Editor Focus Integration

In `EditorCell.tsx`, the `onDidFocusEditorText` callback must call the Zustand store action:

```typescript
editor.onDidFocusEditorText(() => {
  useWorkspaceStore.getState().setFocusedStatementId(statement.id);
});
```

Add a blur handler to clear focus when clicking outside editors:

```typescript
editor.onDidBlurEditorText(() => {
  useWorkspaceStore.getState().setFocusedStatementId(null);
});
```

When the editor disposes, clear the focused state asynchronously via the dispose handler:

```typescript
editor.onDidDispose(() => {
  editorRegistry.delete(statement.id);
  // Dispose handler clears focusedStatementId asynchronously if this editor was focused
  useWorkspaceStore.getState().setFocusedStatementId(null);
});
```

**Important Note on `getState()` Pattern:** Use `useWorkspaceStore.getState()` inside Monaco event handlers (not hooks), as these callbacks execute outside React's hook lifecycle.

### Footer Component Extraction

Create a new `src/components/FooterStatus/FooterStatus.tsx` component that encapsulates all footer display logic:

```typescript
import { useWorkspaceStore } from '../../store/workspaceStore';

export function FooterStatus() {
  const { focusedStatementId, statements } = useWorkspaceStore();

  const focusedIndex = focusedStatementId
    ? statements.findIndex((s) => s.id === focusedStatementId)
    : -1;

  const cellPositionText = focusedIndex !== -1
    ? `Cell ${focusedIndex + 1} of ${statements.length}`
    : `${statements.length} statement(s)`;

  return (
    <div className="footer-status">
      <span className={`cell-count${focusedIndex !== -1 ? ' cell-count--focused' : ''}`}>
        {cellPositionText}
      </span>
      <span className="last-saved">Last saved at {getFormattedTime()}</span>
    </div>
  );
}
```

This component scopes re-renders to the footer only, avoiding full `App.tsx` re-renders on every focus change.

In `App.tsx`, replace the existing footer logic with:
```jsx
<FooterStatus />
```

### Styling

The position counter inherits existing footer styling and displays as a single block. No new CSS classes required - use existing `.cell-count` class. If visual distinction is desired (e.g., slightly different color or font weight when showing position), add `.cell-count--focused` modifier:

```css
.cell-count--focused {
  font-weight: 500;
  color: var(--primary-color);
}
```

Applied conditionally:
```jsx
<span className={`cell-count${focusedIndex !== -1 ? ' cell-count--focused' : ''}`}>
  {cellPositionText}
</span>
```

## API Changes

**Zustand Store (`WorkspaceState`):**
- New state: `focusedStatementId: string | null`
- New action: `setFocusedStatementId: (id: string | null) => void`

**editorRegistry.ts:**
- Remove: `focusedEditorId` state variable
- Remove: `setFocusedEditorId` function
- Update: `getFocusedEditor()` to read `useWorkspaceStore.getState().focusedStatementId` and return the corresponding editor from the registry

**New Component:**
- Add: `src/components/FooterStatus/FooterStatus.tsx` - Renders footer with position counter

## Type Changes

None required. `focusedStatementId` is a simple `string | null` that maps to existing statement IDs.

## Acceptance Criteria

- [ ] Footer displays "Cell X of Y" when a cell is focused
- [ ] Counter updates reactively when focus changes between cells
- [ ] Footer shows just "Y statement(s)" when no cell is focused
- [ ] `focusedStatementId` is NOT persisted to localStorage
- [ ] Counter clears when editor loses focus (blur handler)
- [ ] Counter clears when focused cell is deleted
- [ ] Counter updates when statements are reordered
- [ ] `FooterStatus` component re-renders only when `focusedStatementId` or `statements` changes
- [ ] `editorRegistry.getFocusedEditor()` works correctly using store state instead of local state

## Edge Cases

1. **Cell Deletion:** Visual counter clears immediately when `findIndex === -1` evaluates in FooterStatus. Store field `focusedStatementId` clears asynchronously via EditorCell's dispose handler.
2. **Editor Blur:** When clicking outside an editor (sidebar, header, etc.), the blur handler calls `setFocusedStatementId(null)`, making the "Cell X of Y" display disappear immediately.
3. **Statement Reordering:** Position updates immediately since computation runs from current index.
4. **Cell Collapse/Expand:** No effect on position counter - focus tracking remains independent.
5. **Multiple Cells:** If somehow multiple editors appear focused (shouldn't happen), store tracks the most recently focused ID.
6. **Cell Addition:** New cells don't affect current position counter.
7. **editorRegistry.getFocusedEditor():** Uses `useWorkspaceStore.getState().focusedStatementId` to retrieve focused editor by looking it up in the registry.

## Testing Strategy

**Manual Testing:**
1. Focus different cells and verify "Cell X of Y" updates correctly
2. Click elsewhere to unfocus and verify counter shows total count
3. Delete a focused cell and verify counter clears
4. Reorder cells via drag-drop and verify position updates
5. Reload page and verify `focusedStatementId` is NOT restored from localStorage
6. Create and delete multiple cells, verifying position always correct

**Edge Cases:**
- Focus → delete → verify counter resets
- Focus last cell → delete it → verify counter clears
- Rapid cell focus switching
- Collapse/expand focused cell

## Performance Implications

- Adding one store field has negligible impact
- Position computation is O(n) but with max ~50-100 statements, unnoticeable
- One additional store read per render of footer component
- No API calls required

## Non-Goals

- Keyboard shortcut to navigate to specific cell position
- Persistent cell position history
- Highlighting focused cell in viewport
