# Phase 11: Fix Duplicate Statement Position + Virtualize List View

**Date**: 2026-02-28
**Priority**: Medium (correctness fix + performance optimization)
**Complexity**: Low-Medium
**Bundled**: Two independent fixes (A: state management, B: rendering)

## Problem Statement

### Fix A: Duplicate Statement Inserts at End Instead of After Source

Currently, the `duplicateStatement` action in `workspaceStore.ts` appends the duplicated statement to the END of the statements array, regardless of where the source statement is located:

```typescript
// Current incorrect behavior (line 364-367)
set((state) => ({
  statements: [...state.statements, newStatement],
  lastSavedAt: new Date().toISOString(),
}));
```

**Expected behavior**: Duplicating cell #2 in a 10-cell workspace should insert the copy at position #3 (immediately after the source), not #11. This is the standard behavior in all notebook IDEs (Jupyter, Databricks, Colab, etc.).

**Impact**: Users must manually reorder statements after duplicating, breaking the intuitive workflow.

### Fix B: List View Mode Renders All Rows Without Virtualization

In `ResultsTable.tsx`, the virtualizer is configured to only apply in grid mode:

```typescript
// Current virtualizer config (line 145-149)
const virtualizer = useVirtualizer({
  count: viewMode === 'grid' ? sortedData.length : 0,
  getScrollElement: () => containerRef.current,
  estimateSize: () => 35,
  overscan: 10,
});
```

When users switch to **list view mode** (line 497-531), the component renders ALL rows via `sortedData.map()` with NO virtualization. For result sets with 1000+ rows, this causes:
- Visible lag during scroll
- High memory usage (all DOM nodes kept in memory)
- Slower search/filter responsiveness

**Impact**: List view becomes unusable for large datasets. Users are forced to stay in grid mode.

---

## Proposed Solution

### Fix A: Use Array Splice to Insert After Source Statement

Replace the append logic with a splice operation that inserts the duplicate immediately after the source:

```typescript
duplicateStatement: (id) => {
  const statement = get().statements.find((s) => s.id === id);
  if (!statement) return;

  const newStatement: SQLStatement = {
    ...statement,
    id: generateId(),
    status: 'IDLE',
    results: undefined,
    error: undefined,
    statementName: undefined,
    startedAt: undefined,
    lastExecutedCode: null,
    updatedAt: undefined,  // Clear updatedAt - don't carry over source timestamp
    label: statement.label ? `${statement.label} Copy` : undefined,
    createdAt: new Date(),
  };

  set((state) => {
    const sourceIndex = state.statements.findIndex(s => s.id === id);
    const newStatements = [...state.statements];
    newStatements.splice(sourceIndex + 1, 0, newStatement);
    return {
      statements: newStatements,
      lastSavedAt: new Date().toISOString(),
    };
  });
}
```

**Key changes**:
- Find the source statement's index via `findIndex()`
- Create a shallow copy of the statements array
- Use `splice(sourceIndex + 1, 0, newStatement)` to insert at position sourceIndex + 1
- Return the modified array
- Clear `updatedAt` on the duplicated statement (new statement gets its own timestamp)

**Edge cases handled**:
- Last cell: `sourceIndex` is at end of array, splice naturally appends (correct behavior)
- First cell: `sourceIndex` is 0, insert at position 1 (correct)
- Only 1 cell: becomes 2 cells, new one is positioned at #2 (correct)
- Label accumulation: If duplicating "Query A Copy", result is "Query A Copy Copy" (expected behavior, document for users)

---

### Fix B: Enable Virtualization in List View Mode

**Step 1**: Modify virtualizer configuration to always virtualize (line 145-149):

```typescript
const virtualizer = useVirtualizer({
  count: sortedData.length,  // Always count all rows
  getScrollElement: () => containerRef.current,
  estimateSize: () => 35,
  overscan: 10,
});
```

**Step 2**: Update list view rendering to use virtual items (replace line 497-531):

```typescript
// Instead of: sortedData.map((row, rowIndex) => ...)
// Use:
{paddingTop > 0 && (
  <tr><td colSpan={visibleColumnNames.length + 1} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
)}
{virtualItems.map((virtualRow, visibleRowIdx) => {
  const row = sortedData[virtualRow.index];
  const originalIndex = originalIndexMap.get(row);
  const isEvenRow = virtualRow.index % 2 === 0;  // Use virtualRow.index for row striping
  return (
    <tr key={`${virtualRow.index}-${visibleColumnNames.join('-')}`} className={isEvenRow ? 'even' : 'odd'}>
      <td className="results-index-cell">{originalIndex}</td>
      {visibleColumnNames.map((colName) => {
        const cellKey = `${virtualRow.index}-${colName}`;  // Unique: row index + column name
        return (
          <td
            key={cellKey}
            className={`results-cell${copiedCell === cellKey ? ' results-cell--copied' : ''}`}
            onClick={() => handleCellClick(row[colName], cellKey)}
          >
            {row[colName] === null || row[colName] === undefined ? (
              <span className="null-value">null</span>
            ) : typeof row[colName] === 'object' ? (
              <span className="results-cell-json">
                <span className="results-cell-json-preview">{JSON.stringify(row[colName])}</span>
                <button
                  className="json-expand-btn"
                  onClick={(e) => handleExpandClick(e, cellKey, row[colName], e.currentTarget.closest('td')!)}
                  title="Expand JSON"
                >
                  {expandedCell === cellKey ? '▲' : '▼'}
                </button>
              </span>
            ) : (
              String(row[colName])
            )}
          </td>
        );
      })}
    </tr>
  );
})}
{paddingBottom > 0 && (
  <tr><td colSpan={visibleColumnNames.length + 1} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
)}
```

**Key details on keys and row striping**:
- `key` is now a composite of `virtualRow.index` and column names to ensure uniqueness across grid/list modes
- `cellKey` format remains `${virtualRow.index}-${colName}` - matches grid mode key format for consistency
- Row striping uses `virtualRow.index % 2` (the virtual item's actual data index, not its display position) to maintain consistent coloring even during scroll

**Step 3**: Reset pinned state when switching view modes (line 161):

```typescript
// When viewMode changes, reset isPinnedToBottom to avoid unexpected auto-scroll behavior
useEffect(() => {
  isPinnedToBottom.current = false;
}, [viewMode]);
```

**Step 4**: Update scroll-lock logic to work in both modes (line 161-168):

```typescript
// Remove condition: if (viewMode !== 'grid') return;
// Change to:
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  if (isPinnedToBottom.current) {
    el.scrollTop = el.scrollHeight;
  }
}, [sortedData.length]);  // Remove viewMode dependency - works in both modes now
```

**Step 5**: Update scroll-tracking logic (line 171-181):

```typescript
// Remove condition: if (viewMode !== 'grid') return;
// The rest stays the same - passive listener on scroll event
```

**Key benefits**:
- Both grid and list modes now use the same virtualizer (code DRY)
- Only ~10-20 visible rows rendered, regardless of dataset size
- Scroll performance identical in both modes
- Scroll-lock (auto-scroll to bottom) works in list view too

---

## Files to Modify

1. **`src/store/workspaceStore.ts`** (lines 347-368)
   - Modify `duplicateStatement` action to use splice insertion

2. **`src/components/ResultsTable/ResultsTable.tsx`** (lines 145-149, 161-181, 497-531)
   - Change virtualizer config to always count rows
   - Update list mode rendering to use virtualItems
   - Remove `viewMode` conditionals from scroll-lock effects

---

## Implementation Details

### Duplicate Fix: Key Implementation Notes

- The `generateId()` function already exists and returns `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
- Zustand set() is already in use throughout the store, no API changes needed
- No database calls involved - purely in-memory operation
- `lastSavedAt` timestamp update triggers localStorage persistence (via zustand persist middleware)

### List Virtualization: Key Implementation Notes

- `@tanstack/react-virtual` package is already in dependencies (installed but not fully used)
- The `virtualizer` instance already computes `virtualItems`, `getTotalSize()`, etc.
- Both grid and list modes now use the SAME virtualizer - only the rendering loop differs
- Grid mode: renders cells in grid layout; list mode: renders `<tr>` with all columns
- The `originalIndexMap` (line 140-142) already caches original row indices for O(1) lookups
- Copy-to-clipboard and JSON expand features work identically in both modes
- `cellKey` format is `${row.index}-${colName}` in BOTH modes for consistency
- Row striping uses `row.index % 2`, not visible position, to maintain color continuity during scroll

**Row height assumptions**:
- Row heights are ESTIMATED at 35px (via `estimateSize: () => 35`)
- Heights are NOT dynamically measured (no `measureElement` callback)
- If actual row heights vary significantly (e.g., multi-line wrapped text), virtualizer may show small gaps during scroll
- This is acceptable for performance: we prioritize 60 FPS scroll over perfect gap elimination
- For this feature, assume row heights are consistent ~35px; if variance becomes a problem, can add `measureElement` in future

---

## Acceptance Criteria

### Fix A: Duplicate Position
- [ ] Duplicating statement at index N inserts new statement at index N+1
- [ ] Duplicating the last statement appends to end (position = length)
- [ ] Duplicating the only statement creates a second statement
- [ ] Order of all other statements remains unchanged
- [ ] lastSavedAt timestamp is updated
- [ ] `updatedAt` is cleared on the duplicated statement (new statement has no prior update timestamp)
- [ ] localStorage persists the new order
- [ ] UI focus should remain on the source statement (focus is NOT moved by duplicateStatement action)

### Fix B: List View Virtualization
- [ ] List view renders with virtualizer enabled (same as grid mode)
- [ ] Only ~10-20 visible rows are in the DOM (verify with DevTools Elements tab)
- [ ] Scroll performance is smooth at 60 FPS with 10,000+ rows
- [ ] Search/filter responsiveness does not degrade with large datasets
- [ ] Scroll-lock behavior works in list view (auto-scroll to bottom on new rows)
- [ ] Row index column displays correct original indices in list view
- [ ] JSON expand feature works in list view cells
- [ ] Copy-to-clipboard works in list view cells
- [ ] Row striping (alternating colors) works correctly during scroll
- [ ] cellKey format is consistent between grid and list modes
- [ ] Pinned state is reset when switching view modes (no unexpected auto-scroll)

### General
- [ ] No console errors or warnings
- [ ] No TypeScript compilation errors
- [ ] All existing tests pass (if applicable)

---

## Edge Cases

### Fix A Edge Cases

1. **Duplicate with focused statement**: If the source statement is focused (cursor in editor), focus should remain on source, not move to duplicate
2. **Rapid duplicate clicks**: If user double-clicks duplicate button, ensure both duplicates are inserted at correct positions
3. **Duplicate after deletion**: If statement is deleted, then undo occurs (hypothetically), duplicate still references correct source
4. **Label generation**: `${statement.label} Copy` should not accumulate ("Copy Copy Copy")

### Fix B Edge Cases

1. **Very large datasets (100k+ rows)**: Ensure browser doesn't crash; overscan=10 may need tuning
2. **Rapid sorting + scrolling**: Virtual items list must update correctly as sort changes order
3. **Search filter reducing rows**: If user filters from 10k to 10 rows, virtualizer count must update
4. **View mode toggle during scroll**: Reset `isPinnedToBottom` when switching modes to prevent unexpected auto-scroll; scroll position itself is not preserved (acceptable limitation)
5. **Expandable cells in list view**: JSON expand button should position popup correctly relative to list view's scroll container (portal positioning should handle this)
6. **Row height estimation**: Actual row heights are assumed to be ~35px (consistent, non-wrapped cells). If rows vary significantly or contain wrapped text, virtualizer may show small gaps during rapid scroll - acceptable for performance trade-off. If this becomes an issue, `measureElement` callback can be added in future iterations.
7. **Key collision**: cellKey format `${virtualRow.index}-${colName}` is unique across all rows and columns, preventing React key collisions between grid/list modes

---

## Testing Strategy

### Unit Tests (if applicable)

1. **Duplicate Position**:
   - Test: `duplicateStatement(id)` with middle statement → verify insert at N+1
   - Test: `duplicateStatement(id)` with last statement → verify append behavior
   - Test: `duplicateStatement(id)` with single statement → verify result has 2 statements

2. **Virtualizer Configuration**:
   - Test: `sortedData.length` matches virtualizer count
   - Test: `virtualItems` array contains correct indices when scrolled

### Integration/QA Tests

1. **Duplicate Workflow**:
   - Create 5 statements
   - Duplicate statement #2
   - Verify: new statement #3 contains same code as #2
   - Verify: original #3-5 are now #4-6
   - Verify: workspace localStorage updated

2. **List View Performance**:
   - Execute query returning 5000+ rows
   - Switch to list view
   - Open DevTools → Elements tab
   - Verify: only ~20 `<tr>` elements visible (not 5000)
   - Scroll through list → check for jank/stuttering
   - Search for value → verify filter applies to all 5000 rows (not just visible ones)

3. **Scroll-Lock in List View**:
   - Execute query returning 100+ rows
   - Switch to list view
   - Scroll to middle of table
   - Execute new query (appending rows to results)
   - Verify: table auto-scrolls to bottom if scroll was pinned

4. **JSON Expand in List View**:
   - Execute query with JSON column
   - Switch to list view
   - Click expand button on JSON cell
   - Verify: popup appears at correct position (not off-screen)

### Browser/Performance Testing

- Chrome DevTools → Performance tab: record scroll interaction, verify 60 FPS
- DevTools → Memory tab: compare DOM size before/after virtualization fix
- Test on low-end device (if available): ensure no lag with virtual scrolling

---

## Rollback Plan

If issues arise:

1. **Duplicate Position**: Revert `duplicateStatement` to append-only (`[...state.statements, newStatement]`)
2. **List Virtualization**: Revert virtualizer count to `viewMode === 'grid' ? sortedData.length : 0`, revert list rendering to `sortedData.map()`

Both changes are isolated; reverting one does not affect the other.

---

## Notes for Implementers

- **Fix A** is a state management change only - no UI/CSS impacts
  - Do NOT add focus management - duplicateStatement should not call `setFocusedStatementId`
  - Clear `updatedAt` field on the duplicated statement
  - Label accumulation is expected and documented (users can edit labels if needed)

- **Fix B** is a rendering optimization - should be invisible to user (same visual output, better performance)
  - Both grid and list modes use the SAME virtualizer instance
  - Remove ALL `viewMode === 'grid'` guards from virtualizer config and scroll-lock effects
  - Spacer rows (`paddingTop`/`paddingBottom`) are needed in BOTH modes, not just grid
  - Row striping uses `virtualRow.index % 2`, not visible position
  - cellKey format must be consistent: `${virtualRow.index}-${colName}`
  - Reset `isPinnedToBottom` when switching view modes
  - Do NOT implement scroll position preservation between modes (removed from acceptance criteria)
  - Row heights are estimated (fixed 35px), not dynamically measured; document this assumption

- Both fixes should be implemented in parallel if possible (no file conflicts)
- Consider adding a React DevTools inspection to verify `virtualItems.length` during testing
