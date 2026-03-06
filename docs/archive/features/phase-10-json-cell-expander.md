# Phase 10: JSON Cell Expander

**Feature Name**: JSON Cell Expander for Results Table

**Status**: Design Phase

**Date Created**: 2026-02-28

---

## Problem Statement

Currently, object and array values in the results table are rendered via `JSON.stringify()`, which produces a single long line of JSON. For complex or deeply nested objects, this is:
- **Hard to read**: No formatting, all in a single line
- **Poor UX**: Users must copy and paste elsewhere to inspect structure
- **Inefficient**: No way to view pretty-printed JSON without manual steps
- **Incomplete**: No quick copy-to-clipboard for the JSON content

When a user clicks a JSON cell to copy it, they get the entire stringified content, but cannot inspect its structure visually before copying.

---

## Proposed Solution

Add an **inline JSON viewer** that appears when clicking an object/array cell in the results table:

1. **Detection**: Identify cells with object or array values (not null, not primitives)
2. **Visual Indicator**: Display a small expand icon (chevron or similar) within object/array cells
3. **Expand Action**: Clicking the cell (or the expand icon) opens an inline expandable pane
4. **Display**: The pane shows pretty-printed JSON using `<pre>` with monospace font
5. **Copy Action**: A "Copy JSON" button copies the pretty-printed JSON to clipboard
6. **Close Action**: Clicking outside the pane, pressing Escape, or clicking the cell again closes it
7. **State Management**: Use local component state (`useState`) to track which cell is expanded
8. **Virtual Scrolling**: Must work correctly with `@tanstack/react-virtual` (no render issues when rows are virtualized)
9. **Dark Mode**: Use CSS variables for styling to support dark mode automatically

---

## Files to Modify

### Primary Changes

| File | Change | Impact |
|------|--------|--------|
| `src/components/ResultsTable/ResultsTable.tsx` | Add expand state, cell indicator rendering, pane UI, event handlers | Core feature implementation |
| `src/App.css` or new CSS module | Add styles for expand icon, pane container, button, dark mode support | Styling and dark mode |

### No Changes Required

- `src/store/workspaceStore.ts` — No global state needed (local state only)
- `src/types/index.ts` — No new types needed
- `src/api/flink-api.ts` — No API changes
- Other components — No dependencies

---

## Implementation Details

### State Shape

```typescript
// Local state: use cellKey string format to track expanded cell
// cellKey format: `${rowIndex}-${colName}`
const [expandedCell, setExpandedCell] = useState<string | null>(null);
```

### Helper Functions

```typescript
// Detect if a value should get an expand icon
const isExpandable = (value: unknown): boolean => {
  return value !== null && value !== undefined && typeof value === 'object';
};

// Format JSON for display
const formatJSON = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[Unable to display]';
  }
};

// Generate unique cell key for expand state comparison
const getCellKey = (rowIdx: number, colName: string): string => {
  return `${rowIdx}-${colName}`;
};
```

### Cell Rendering Changes

In the table body, for each cell:

1. Check if the value is expandable using `isExpandable()`
2. If expandable, render:
   - The JSON preview (truncated or stringified as before)
   - A separate `<button>` element inside the `<td>` with a small expand icon (chevron)
3. The expand button must call `e.stopPropagation()` to prevent triggering the cell's copy behavior
4. The cell itself remains clickable for copy behavior (existing functionality)

### Expand Pane UI and Portal Positioning

The pane must be rendered as a **React Portal into `document.body`** with absolute positioning to avoid virtual scrolling interference.

**Portal Implementation**:
1. **State key**: Use the `cellKey` string (`${rowIndex}-${colName}`) to track which cell is expanded
2. **Positioning**: On expand button click, call `getBoundingClientRect()` on the cell's `<td>` element
3. **Calculate position**:
   - `top = rect.bottom + window.scrollY` (position below the cell, accounting for page scroll)
   - `left = rect.left + window.scrollX` (align with cell start)
   - `width = rect.width` (match cell width, or expand to max-width)
4. **Portal render**: Use `ReactDOM.createPortal()` to render pane into `document.body` with calculated styles
5. **Close on scroll**: Add a scroll event listener to the table container; close pane if table scrolls
6. **Close on click outside**: Use useEffect with mousedown listener to close on clicks outside the pane
7. **Mutual exclusivity**: Close expander when columns dropdown opens and vice versa (set shared flag or close both on dropdown toggle)

The pane should:
- Display as an absolutely-positioned container with `z-index` to float above table
- Use `<pre className="json-viewer">` for formatting
- Include a "Copy JSON" button that reuses the existing clipboard+toast pattern (shared helper)
- Include a close button or detect Escape key and clicks outside
- Be scrollable if the JSON is very large (max-height: 400px, overflow-y: auto)
- Respect dark mode via CSS variables

### Event Handling

1. **Expand button click**: Call `e.stopPropagation()`, then set `expandedCell` to current cellKey (toggle if already open)
2. **Copy button click**: Reuse existing clipboard helper + toast pattern to copy formatted JSON
3. **Escape key**: Close pane (add useEffect with keydown listener)
4. **Click outside pane**: Close pane (add useEffect with mousedown listener, similar to columns dropdown)
5. **Scroll event**: Close pane if table scrolls (add scroll listener to table container)
6. **Columns dropdown interaction**: Close expander when columns dropdown opens, and close dropdown when expander opens (mutual exclusivity)

### Virtual Scrolling Compatibility

- The expand pane is rendered as a **React Portal into `document.body`** with absolute positioning, completely outside the virtual list
- This avoids all interference with virtualizer metrics and row height calculations
- When the table scrolls, the pane automatically closes via the scroll event listener
- No special virtualization handling needed beyond the portal + scroll close pattern

### Dark Mode Support

Use CSS variables for all styling:

```css
.json-expander-pane {
  background-color: var(--color-surface-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.json-viewer {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-family: "SF Mono", Monaco, Consolas, monospace;
  font-size: 12px;
  overflow-x: auto;
  padding: 8px;
  border-radius: 4px;
}

.json-expander-button {
  background-color: var(--color-primary);
  color: var(--color-surface);
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
}

.json-expander-button:hover {
  background-color: var(--color-primary-light);
}
```

---

## Acceptance Criteria

1. **Expand Icon Rendering**
   - [ ] Objects and arrays show a chevron expand icon in the cell
   - [ ] Primitives (strings, numbers, booleans, null) do NOT show an expand icon
   - [ ] Icon is subtle and positioned clearly (right side of cell or overlaid)

2. **Expand Pane Functionality**
   - [ ] Clicking the expand icon opens the pane
   - [ ] Pane displays pretty-printed JSON (2-space indentation)
   - [ ] Pane is below the expanded cell (or as a popover)
   - [ ] Pane is scrollable if JSON is large
   - [ ] Only one cell can be expanded at a time

3. **Copy Behavior**
   - [ ] "Copy JSON" button copies the formatted JSON to clipboard
   - [ ] Copy success shows a toast message
   - [ ] Copy failure shows an error toast

4. **Close Behavior**
   - [ ] Clicking the close button closes the pane
   - [ ] Pressing Escape closes the pane
   - [ ] Clicking outside the pane closes it
   - [ ] Clicking the expand icon again toggles the pane closed

5. **Grid Mode & Virtual Scrolling**
   - [ ] Expand icon and pane work correctly in grid view
   - [ ] Pane does not interfere with virtual scrolling metrics
   - [ ] Expanding a cell, then scrolling away, closes the pane gracefully
   - [ ] No console errors related to virtualizer

6. **List Mode**
   - [ ] Expand icon and pane work correctly in list view (no virtualization)
   - [ ] Pane displays correctly below the expanded cell

7. **Dark Mode**
   - [ ] All pane styling respects CSS variables
   - [ ] Text is readable in dark mode
   - [ ] Background contrasts properly in light and dark modes
   - [ ] Buttons and icons are visible in both modes

8. **Edge Cases**
   - [ ] Circular references in JSON are handled gracefully (stringify may throw)
   - [ ] Very large JSON objects don't break the pane layout
   - [ ] Empty objects `{}` and empty arrays `[]` display correctly
   - [ ] Null values do not show expand icon
   - [ ] Undefined values do not show expand icon

---

## Edge Cases & Mitigation

### Circular References
**Risk**: `JSON.stringify()` may throw an error if an object has circular references.

**Mitigation**:
- Wrap `JSON.stringify()` in try-catch
- If it fails, display an error message in the pane: "Cannot display circular reference"
- Fallback: show the original stringified value

### Very Large JSON Objects
**Risk**: Rendering a massive JSON string may cause performance issues.

**Mitigation**:
- Set a max-height on the pane (e.g., 400px) with overflow-y: auto
- Consider adding a "truncate" indicator if JSON exceeds a threshold (e.g., 10KB)
- Use `<pre>` with `overflow-x: auto` to handle wide content

### Virtual Scrolling Interference
**Risk**: If the pane is rendered inside the virtual list, it may interfere with row height calculations.

**Mitigation**:
- Render the pane **outside** the virtualized row, perhaps as a portal or sibling
- Alternatively, close the pane automatically when the row scrolls out of view
- Test with both grid and list modes

### Mobile / Narrow Viewports
**Risk**: Pane may be too large for small screens.

**Mitigation**:
- Ensure pane width adapts to viewport (use max-width, flex)
- On mobile, consider a full-screen modal instead of inline pane
- For this phase, assume desktop usage; mobile optimization can defer

### Existing Cell Click Behavior
**Risk**: Current implementation calls `handleCellClick()` on all clicks, which triggers copy behavior.

**Mitigation**:
- Distinguish between expand icon click and cell click
- Expand icon click should NOT trigger copy
- Cell click still triggers copy (existing UX preserved)
- Use event propagation control (`event.stopPropagation()`)

---

## Testing Strategy

### Unit Tests (if applicable)
- `isExpandable()` returns true for objects/arrays, false for primitives
- `formatJSON()` handles circular references gracefully
- `getCellKey()` generates unique keys for row/column pairs

### Integration Tests
- Expand icon renders only for expandable cells
- Clicking expand icon opens and closes pane
- Copy button copies formatted JSON correctly
- Escape key closes pane
- Click outside closes pane
- Expanding a new cell closes the previous one
- Virtual scrolling does not break expand behavior

### Manual Testing
- Inspect grid view with objects and primitives mixed
- Test expand behavior in list view
- Test dark mode styling
- Test with deeply nested objects
- Test with very large arrays
- Test keyboard navigation (Tab to expand icon, Enter to expand)

---

## Performance Considerations

1. **JSON Stringification**: Use `useMemo` to memoize the formatted JSON string, keyed on the expanded cell's value
2. **State Updates**: Only one cell expanded at a time, so minimal re-renders.
3. **DOM Size**: Pane is a single element when expanded, rendered as a portal so no impact on table rendering.
4. **Virtual Scrolling**: Pane positioned outside virtual list as a portal to avoid metric interference.
5. **Scroll Listener**: Lightweight scroll event listener on table container with debouncing if needed.

---

## Future Enhancements (Out of Scope)

- Syntax highlighting for JSON (would require a library like `react-syntax-highlighter`)
- Collapsible tree view for nested objects (more complex UX)
- Search within expanded JSON (find and highlight)
- Export expanded JSON as file
- Copy individual properties from nested object

---

## References

- Current cell rendering: `ResultsTable.tsx` lines 334-350 (grid mode), 397-414 (list mode)
- Current CSS variables: `index.css` (color, shadow, typography)
- Dark mode schema: `index.css` `[data-theme="dark"]` block
- Virtual scrolling: `@tanstack/react-virtual` docs
