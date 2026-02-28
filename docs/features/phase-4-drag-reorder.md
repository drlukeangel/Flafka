# Phase 4: Drag-to-Reorder Editor Cells

## Problem Statement
Users cannot reorder editor cells after creation. The only options are delete and duplicate, forcing users to manually recreate cells in the desired order. For multi-step SQL workflows, ordering matters.

## Proposed Solution
Add HTML5 drag-and-drop to editor cells via a grip handle icon. Cells become draggable; dropping one cell onto another reorders the statements array in the Zustand store.

## Files to Modify
| File | Change |
|------|--------|
| `src/store/workspaceStore.ts` | Add `reorderStatements(fromIndex, toIndex)` action + type declaration |
| `src/components/EditorCell/EditorCell.tsx` | Add drag handle, drag/drop event handlers, visual state |
| `src/App.css` | Add `.drag-handle`, `.cell-container.dragging`, `.cell-container.drag-over-top/bottom` styles |

## API Changes
None. This is purely client-side state manipulation.

## Type Changes
Add `reorderStatements: (fromIndex: number, toIndex: number) => void` to `WorkspaceState` interface.

## Implementation Details

### Store Action
```ts
reorderStatements: (fromIndex, toIndex) => {
  set((state) => {
    const statements = [...state.statements];
    const [removed] = statements.splice(fromIndex, 1);
    statements.splice(toIndex, 0, removed);
    return { statements, lastSavedAt: new Date().toISOString() };
  });
},
```

### EditorCell Changes
- Import `FiGripVertical` from `react-icons/fi`
- Add `reorderStatements` from store
- Local state: `isDragging: boolean`, `dragOver: 'top' | 'bottom' | null`
- Drag handle: `<span className="drag-handle" draggable onDragStart={...}>`
- Cell container: class names toggled based on drag state
- `onDragStart`: `dataTransfer.setData('text/plain', index.toString())`; set `isDragging = true`
- `onDragOver`: `e.preventDefault()`; determine top/bottom half and set `dragOver`
- `onDrop`: parse source index, call `reorderStatements`, clear state
- `onDragEnd`: clear `isDragging`
- `onDragLeave`: clear `dragOver`

### Top/Bottom Half Detection
Use `e.clientY` vs `getBoundingClientRect()` midpoint of the cell to determine whether to insert before or after.

### CSS Classes Applied to `.editor-cell`
- `.dragging` - applied to the cell being dragged (opacity 0.5)
- `.drag-over-top` - blue top border (drop before)
- `.drag-over-bottom` - blue bottom border (drop after)

## Acceptance Criteria
- [ ] Grip handle icon visible on left side of cell header
- [ ] Cursor changes to `grab` on hover, `grabbing` while dragging
- [ ] Dragging a cell over another shows top or bottom blue border indicator
- [ ] Dropping reorders cells correctly in all positions (first, last, middle)
- [ ] Dragging cell has reduced opacity (0.5)
- [ ] Drop on same position is a no-op (no state change)
- [ ] TypeScript compiles without errors
- [ ] Reorder persists to localStorage (auto via zustand persist)

## Edge Cases
- Drop on self: `fromIndex === toIndex` - skip set call
- Single cell: drag events fire but reorder is a no-op
- Drop after drag leave without drop: `dragOver` cleared by `onDragLeave`
- Monaco editor text drag: grip handle is the only draggable element, so accidental editor drags are prevented
- Collapsed cells: drag works the same regardless of collapse state

## Implementation Notes
- The `draggable` attribute is on the grip handle span only, NOT the whole cell, to avoid Monaco editor drag conflicts
- `onDragStart` must call `e.stopPropagation()` is not needed since handle is a separate element
- The cell `div` itself receives `onDragOver`, `onDrop`, `onDragLeave` for the drop target
