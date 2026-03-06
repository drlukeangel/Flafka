# Phase 5: Virtual Scrolling for Results Table

**Feature**: Virtualize the results table to handle large result sets (1000+ rows) without browser jank.

**Status**: Design phase

---

## Problem Statement

The `ResultsTable` component currently renders **all rows in the DOM simultaneously**, regardless of result set size. With the FIFO buffer capped at 5000 rows max, this causes:

- **Performance degradation**: Browser struggles to render 1000+ rows in the DOM tree
- **Memory overhead**: All row elements stay in memory even when offscreen
- **Jank during scroll**: Painting and reflow operations block the main thread
- **User experience**: Tables with large datasets feel sluggish and unresponsive

A previous virtualization attempt failed because `transform: translateY()` applied to `<tr>` elements within a standard `<tbody>` is not a supported virtualization technique for HTML tables.

---

## Proposed Solution

Implement virtual scrolling using **`@tanstack/react-virtual` v3** (already in `package.json`) with a correct table virtualization pattern:

1. **Scrollable container**: Wrap the table in a `<div>` with fixed max-height and `overflow-y: auto`
2. **Spacer rows**: Use empty `<tr>` elements with calculated heights to represent off-screen rows (not `translateY`)
3. **Overscan buffer**: Render visible rows + 10 rows above/below viewport for smoother scrolling
4. **Sticky header**: Keep `<thead>` fixed at top via CSS while scrolling through rows

This pattern respects the HTML table structure while virtualizing the `<tbody>` content.

---

## Architecture & Implementation

### Files to Modify

| File | Change | Scope |
|------|--------|-------|
| `src/components/ResultsTable/ResultsTable.tsx` | Import `useVirtualizer`, wrap table, add spacer rows | Core logic |
| `src/index.css` or `src/App.css` | Add `.results-table-container` styles | Styling |

### Implementation Approach

#### 1. Create a Scrollable Container

```tsx
// In ResultsTable.tsx
// The container MUST be .results-table-wrapper (inner div), NOT .results-table-container (outer wrapper)
const containerRef = useRef<HTMLDivElement>(null);

return (
  <div className="results-table-container">
    {/* Toolbar here */}
    <div
      ref={containerRef}
      className="results-table-wrapper"
      style={{ flex: 1, overflowY: 'auto' }}
    >
      <table>
        <thead>...</thead>
        <tbody>
          {/* Spacers and virtual rows here */}
        </tbody>
      </table>
    </div>
  </div>
);
```

**Critical**: `containerRef` must target `.results-table-wrapper` (the scrollable inner `<div>` at line 242 of ResultsTable.tsx), NOT `.results-table-container` (the outer wrapper that also contains the toolbar). The virtualizer's scroll listener depends on the correct container.

#### 2. Initialize the Virtualizer

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => containerRef.current,
  estimateSize: () => 35, // Approximate row height in px
  overscan: 10, // Render 10 rows beyond viewport
});

const virtualItems = virtualizer.getVirtualItems();
```

#### 3. Render with Spacers

```tsx
<tbody>
  {/* Top spacer: skip rows before first visible item */}
  {virtualItems.length > 0 && (
    <tr style={{ height: `${virtualItems[0].start}px` }} />
  )}

  {/* Render only visible rows with proper striping */}
  {virtualItems.map((virtualRow) => (
    <tr
      key={virtualRow.key}
      data-index={virtualRow.index}
      className={virtualRow.index % 2 === 0 ? '' : 'results-row-odd'}
    >
      {columns.map((colName) => {
        const cellKey = `${virtualRow.index}-${colName}`;
        return (
          <td key={cellKey}>{rows[virtualRow.index][colName]}</td>
        );
      })}
    </tr>
  ))}

  {/* Bottom spacer: skip rows after last visible item */}
  {virtualItems.length > 0 && (
    <tr
      style={{
        height: `${
          virtualItems.length > 0
            ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
            : 0
        }px`
      }}
    />
  )}
</tbody>
```

**Spacer formula fix**: Use the correct calculation for bottom spacer height:
```tsx
const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
const paddingBottom = virtualItems.length > 0
  ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
  : 0;
```

**Striping fix**: Use `virtualRow.index % 2 === 0` instead of CSS `tr:nth-child(even)` because nth-child will break with spacer rows. Apply the `.results-row-odd` class to odd-indexed rows.

**Stable cell key**: Use `virtualRow.index` (data array index) as part of the cell key to ensure consistency:
```tsx
const cellKey = `${virtualRow.index}-${colName}`;
```

#### 4. Sticky Header CSS

```css
/* Outer wrapper (contains toolbar + table) */
.results-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #e0e0e0;
}

/* Inner scrollable container - the actual scroll target */
.results-table-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
}

/* Sticky header stays visible during scroll */
.results-table-wrapper table thead {
  position: sticky;
  top: 0;
  background-color: #f5f5f5;
  z-index: 10;
}

/* Row striping: use class instead of nth-child to account for spacer rows */
.results-row-odd {
  background-color: #fafafa;
}
```

**Key CSS notes**:
- `.results-table-wrapper` uses `flex: 1; overflow: auto` (no hardcoded max-height needed; parent cell layout already constrains height)
- `.results-row-odd` replaces CSS `tr:nth-child(even)` to avoid conflicts with spacer rows
- `z-index: 10` on thead ensures sticky header appears above scrollbar

#### 5. Scroll-Lock for Streaming Data

When new rows are appended to a streaming result set, automatically scroll to the bottom if the user was already pinned to bottom:

```tsx
const isPinnedToBottomRef = useRef<boolean>(true);

// Track scroll position
const handleScroll = () => {
  if (containerRef.current) {
    const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
    const threshold = 100; // pixels from bottom
    isPinnedToBottomRef.current = scrollTop + clientHeight >= scrollHeight - threshold;
  }
};

// When new rows arrive
useEffect(() => {
  if (isPinnedToBottomRef.current && rows.length > 0) {
    virtualizer.scrollToIndex(rows.length - 1, { align: 'end' });
  }
}, [rows.length, virtualizer]);

// Attach scroll listener
useEffect(() => {
  const container = containerRef.current;
  if (container) {
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }
}, []);
```

#### 6. Integration Points

- **Search/Filter**: Works as-is; the `rows` array is already filtered, virtualizer counts `rows.length`
- **Sort**: Works as-is; re-ordering rows array automatically re-virtualizes
- **Column visibility**: Works as-is; CSS display changes don't affect row heights
- **Cell click-to-copy**: Attach click handlers to rendered cells normally; virtual items are real DOM elements
- **Export**: Export the full `rows` array (not `virtualItems`); the user has the unvirtualized data in state
- **List mode**: Virtualization applies to **grid mode only**. List mode remains unvirtualized (acceptable for small column counts)

---

## Acceptance Criteria

### Rendering
- [ ] Table renders **only ~30-50 visible rows** in DOM at any time, regardless of total row count
- [ ] Number of `<tr>` elements in DOM stays constant while scrolling
- [ ] Spacer rows correctly account for all off-screen rows
- [ ] Row striping (zebra) works correctly with `.results-row-odd` class

### Performance
- [ ] Scrolling through 5000 rows is **smooth** (60 FPS, no visible jank)
- [ ] Initial render time for 5000-row table is **<500ms**
- [ ] Memory usage does not grow with result set size beyond ~10 rendered rows

### Functionality
- [ ] **Sticky header**: `<thead>` stays visible when scrolling `<tbody>`
- [ ] **Search**: Filtering rows still works; virtualizer updates `count` based on filtered length
- [ ] **Sort**: Column sorting works; re-sorted rows array triggers re-virtualization
- [ ] **Column visibility**: Showing/hiding columns doesn't break virtualization
- [ ] **Cell click-to-copy**: Clicking any cell in any visible row copies to clipboard
- [ ] **Export**: Export button exports the full unvirtualized result set, not just visible rows
- [ ] **Scroll-lock for streaming**: When new rows arrive and user is pinned to bottom, automatically scroll to end
- [ ] **List mode**: Virtualization applies to grid mode only; list mode remains unvirtualized

### User Experience
- [ ] Smooth scrolling with overscan buffer (no "blank space" flashes)
- [ ] Scrollbar accurately reflects position in full dataset
- [ ] No layout shift when virtualizing/devilizualizing rows
- [ ] Scrollbar position stays accurate (with minor variance for rows with long JSON values)

---

## Edge Cases

| Case | Handling |
|------|----------|
| **0 rows** | `virtualizer.getVirtualItems()` returns empty array; no rows or spacers render |
| **Fewer rows than viewport** | Virtualizer renders all rows; spacers have 0 height; works correctly |
| **Rapid scrolling** | Overscan buffer (10 rows) prevents blank spaces during fast scroll |
| **Window resize** | Virtualizer automatically recalculates on scroll container resize; use ResizeObserver if needed |
| **Results update while scrolled** | New rows append to array; if scrolled to bottom, stays at bottom; if mid-scroll, maintains position |
| **Search filter during scroll** | Filtered array passed to virtualizer; count updates; scroll position resets (acceptable) |

---

## Type Changes

No new types needed. The existing `Row` type used in `rows.length` and `rows[index]` remains unchanged.

---

## API Changes

No API changes. All Flink API calls remain unchanged; virtualization is a client-side rendering optimization.

---

## Testing Strategy

1. **Unit tests**: Mock `useVirtualizer` to verify spacer height calculations
2. **Integration tests**: Render with 100, 1000, 5000 rows; verify DOM node count stays ~40
3. **Browser tests**:
   - Scroll to top, middle, bottom; verify correct rows visible
   - Filter mid-scroll; verify virtualization resets
   - Resize window; verify header stays sticky
   - Click cells in various scroll positions; verify copy works
4. **Performance tests**: Measure render time and FPS with DevTools for 5000-row dataset

---

## Dependencies

- **`@tanstack/react-virtual`**: Already in `package.json` (v3+), no new install needed

---

## Success Metrics

- **Before**: 5000 rows = 5000 DOM nodes, 200+ FPS drop during scroll
- **After**: 5000 rows = 40 DOM nodes, 55+ FPS maintained during scroll
- **User feedback**: "Scrolling feels responsive even with large result sets"

---

## Notes & Considerations

- **Row height assumption**: This PRD assumes fixed row heights (~35px). If rows have variable heights, `useVirtualizer` supports dynamic sizing via `measureElement`; upgrade if needed later.
- **Sticky header z-index**: Set `z-index: 10` to ensure header stays above scrollbar
- **Browser compatibility**: `@tanstack/react-virtual` v3 works on all modern browsers; IE11 not supported (acceptable)
- **Accessibility**: Ensure keyboard navigation (arrow keys, Page Up/Down) works correctly; test with screen readers
- **JSON/object cell values**: Known limitation: scrollbar position may be slightly inaccurate for rows with long JSON values since row heights are estimated at 35px (actual rendered height may be taller). This is acceptable for MVP; upgrade to dynamic row sizing if needed later.
- **Container height**: `.results-table-wrapper` uses `flex: 1; overflow-y: auto` (no hardcoded max-height). The parent cell layout already constrains height via flexbox, so the wrapper automatically fills available space.

---

## Deferred Scope

- Virtual scrolling for the **TreeNavigator** (sidebar) - separate feature if needed
- Virtual scrolling for **statement list** - can be added later if performance becomes an issue
- Dynamic row heights - use fixed heights for MVP, upgrade if variable-height rows needed
