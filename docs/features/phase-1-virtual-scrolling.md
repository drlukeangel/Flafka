# Phase 1.3: Virtual Scrolling for Results Table

**Status:** Ready for Development
**Created:** 2026-02-28
**Target Release:** Phase 1
**Priority:** High

---

## Problem Statement

The `ResultsTable` component currently renders all rows in the DOM simultaneously. With the 5,000-row FIFO buffer, this creates 5,000 HTML table rows at once, causing:

- **High memory consumption** from maintaining thousands of DOM nodes
- **Slow rendering and interaction** when scrolling through large datasets
- **Browser lag and jank** when users interact with search, sort, or other filters
- **Poor user experience** on lower-spec machines or older browsers

The `@tanstack/react-virtual` library (v^3.13.18) is already installed in the project but currently unused, making this an ideal efficiency improvement.

---

## Goals

1. Reduce DOM node count to ~50-80 visible rows + overscan buffer
2. Maintain smooth 60fps scrolling performance
3. Preserve all existing features (search, sort, export, view modes)
4. Keep column headers sticky during scroll
5. Ensure 100% data accuracy in exports (not just visible rows)

---

## Proposed Solution

Implement virtual scrolling using `@tanstack/react-virtual`'s `useVirtualizer` hook to render only:
- Visible table rows within the viewport
- An overscan buffer of 20 rows above and below the viewport
- Spacer rows to maintain scroll position and table dimensions

This reduces rendering overhead from O(n) to O(1) with respect to total dataset size while maintaining full functionality.

---

## Scope

### In Scope
- Virtual scrolling implementation in `ResultsTable.tsx`
- Maintain existing CSS styling and sticky header behavior
- Preserve sort, search, and filter functionality
- Ensure exports include all 5,000 rows (not just visible)
- Handle edge cases (few rows, rapid data updates, dynamic filtering)

### Out of Scope
- Grid/List view mode changes
- Export format changes or optimization
- Infinite scroll pagination
- Lazy-loading from server
- Virtual column scrolling (horizontal)

---

## Detailed Specifications

### 1. Component Architecture

**File to modify:** `src/components/ResultsTable/ResultsTable.tsx`

**Current flow:**
```
data (props)
  → filteredData (useMemo)
  → sortedData (useMemo)
  → render all rows in DOM
```

**New flow:**
```
data (props)
  → filteredData (useMemo)
  → sortedData (useMemo)
  → useVirtualizer (computes visible range)
  → render only virtual rows + spacers in DOM
```

### 2. Implementation Steps

#### Step 1: Add Imports
```typescript
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
```

#### Step 2: Create Ref for Scroll Container
Add a ref to track the scrollable container element:
```typescript
const parentRef = useRef<HTMLDivElement>(null);
```

#### Step 3: Initialize Virtualizer
After the `sortedData` memo, add the virtualizer hook:
```typescript
const rowVirtualizer = useVirtualizer({
  count: sortedData.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 35, // Estimated row height in pixels
  overscan: 20, // Render 20 extra rows above and below viewport
});
```

**Rationale:**
- `count`: Total rows to virtualize (updates when sort/filter changes)
- `getScrollElement`: Identifies the scrollable container
- `estimateSize`: Row height estimate. Since rows are uniform (32px content + 3px border = 35px), a single fixed estimate is appropriate
- `overscan`: Provides buffer to reduce flashing when scrolling quickly

#### Step 4: Update Table Body Rendering

Replace the current map-based rendering:
```typescript
<tbody>
  {sortedData.map((row, rowIndex) => (
    <tr key={rowIndex}>
      {columnNames.map((colName) => (
        <td key={colName}>{/* cell content */}</td>
      ))}
    </tr>
  ))}
</tbody>
```

With virtual row rendering:
```typescript
<tbody>
  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
    const row = sortedData[virtualRow.index];
    return (
      <tr
        key={virtualRow.index}
        style={{
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        {columnNames.map((colName) => (
          <td key={colName}>
            {row[colName] === null || row[colName] === undefined ? (
              <span className="null-value">null</span>
            ) : typeof row[colName] === 'object' ? (
              JSON.stringify(row[colName])
            ) : (
              String(row[colName])
            )}
          </td>
        ))}
      </tr>
    );
  })}

  {/* Top spacer: maintains scroll height above visible rows */}
  {rowVirtualizer.getVirtualItems().length > 0 && (
    <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }} aria-hidden />
  )}

  {/* Bottom spacer: maintains scroll height below visible rows */}
  {rowVirtualizer.getVirtualItems().length > 0 && (
    <tr
      style={{
        height: Math.max(
          0,
          rowVirtualizer.getTotalSize() -
            (rowVirtualizer.getVirtualItems()[
              rowVirtualizer.getVirtualItems().length - 1
            ]?.end ?? 0)
        ),
      }}
      aria-hidden
    />
  )}
</tbody>
```

**Key design decisions:**
- Use `translateY()` for positioning instead of absolute positioning to keep table layout intact
- Spacer rows maintain scroll container height and scrollbar proportions
- `aria-hidden` on spacer rows improves accessibility
- Preserve cell content rendering logic (null handling, JSON stringification, etc.)

#### Step 5: Configure Scroll Container

Ensure the parent ref points to the scrollable div:
```typescript
<div className="results-table-wrapper" ref={parentRef}>
  <table className="results-table">
    {/* ... */}
  </table>
</div>
```

The `.results-table-wrapper` already has `overflow: auto` in CSS, so no CSS changes needed for the container itself.

### 3. CSS Specifications

**Current CSS** (lines 759-823 in App.css):
```css
.results-table-wrapper {
  flex: 1;
  overflow: auto;
}
```

**Sticky headers already implemented:**
```css
.results-table th {
  position: sticky;
  top: 0;
  /* ... */
}
```

**No CSS changes required.** The existing styles already support:
- Scrollable container with flex layout
- Sticky headers (will remain visible during virtual scroll)
- Row height and cell padding (used for `estimateSize` calculation)

Row height breakdown:
- Cell content: `padding: 8px 12px` (vertical) = 8+8 = 16px
- Text line height: ~16px (default)
- Border: `border-bottom: 1px solid` = 1px
- Total: ~33-35px (the `estimateSize: 35` estimate)

---

## Data Flow Examples

### Example 1: Initial Render with 5,000 Rows
```
1. User loads app, receives 5,000 rows in data prop
2. filteredData = 5,000 rows (no search filter)
3. sortedData = 5,000 rows (no sort applied)
4. useVirtualizer calculates visible range:
   - Viewport height: ~600px (assuming results-table-wrapper height)
   - Row height: 35px
   - Visible rows: ~17
   - Overscan: 20 above + 20 below = 40 extra
   - Total rendered: ~60 rows in DOM
5. Browser renders only 60 rows + header + spacers
6. Memory: ~85 table rows in DOM instead of 5,085
```

### Example 2: User Searches (Filter)
```
1. User types "error" in search box
2. searchTerm state updates
3. filteredData memo recalculates: 342 matching rows
4. sortedData memo recalculates: 342 rows (in current sort order)
5. rowVirtualizer.count automatically updates to 342
6. Visible range recalculated for 342-row dataset
7. Scroll position maintained (user sees results from top)
8. DOM updates to render only visible rows from 342 total
```

### Example 3: User Sorts (No DOM Reset)
```
1. User clicks column header
2. sortConfig state updates
3. sortedData memo re-sorts the 5,000 rows
4. rowVirtualizer re-renders visible indices
5. Sort icons update in header
6. No scroll jump or flashing (virtualizer smoothly updates)
```

### Example 4: User Exports (Full Data)
```
1. User clicks "Export as CSV"
2. handleExport() function called
3. Uses sortedData.map() to build CSV - includes ALL 5,000 rows
4. NOT limited to visible/virtual rows
5. Export contains complete dataset with current sort order applied
6. File downloaded: results.csv (5,000 rows)
```

---

## Acceptance Criteria

- [ ] **Rendering Performance**
  - Only 50-80 rows rendered in DOM (verify with DevTools Elements inspector)
  - Scrolling is smooth at 60fps (use Chrome DevTools Performance tab)
  - No visual flashing or jank when scrolling through large dataset

- [ ] **Functionality Preservation**
  - Search filtering works correctly and updates virtualizer count
  - Column sorting works and re-orders virtual rows correctly
  - View mode toggle (grid/list) still functional
  - Sticky headers remain visible during scroll

- [ ] **Export Accuracy**
  - CSV export includes all 5,000 rows (not just visible)
  - JSON export includes all 5,000 rows with correct sort order
  - Export respects current sort configuration
  - Export respects current search filter (only exports filtered results)

- [ ] **Edge Cases**
  - Empty results message displays when data.length === 0
  - Results with < 20 rows render without spacers or glitches
  - Search that results in 0 matches handled gracefully
  - Rapid data updates (streaming) don't cause scroll position loss

- [ ] **Accessibility & UX**
  - Column headers remain sticky and fully interactive
  - Row count display shows filtered + total counts accurately
  - Scroll behavior intuitive and matches user expectations
  - No console errors or TypeScript type errors

- [ ] **Cross-Browser Compatibility**
  - Works in Chrome, Firefox, Safari (modern versions)
  - No layout issues on high-DPI displays
  - Touch scrolling works on mobile/tablet browsers

---

## Technical Considerations

### Row Height Estimation

The `estimateSize: 35` value is based on:
- Cell padding: `8px 12px` (vertical) = 16px total padding
- Text line height: ~16px
- Border: 1px

This is a static estimate. If rows vary in height:
1. Measure actual rendered row heights
2. Update estimate or implement dynamic measurement
3. Use `rowVirtualizer.measure()` for accuracy if needed

### Scroll Synchronization

The `getScrollElement()` callback returns `parentRef.current`, which points to `.results-table-wrapper`. This div must have `overflow: auto` for scrolling to work. Verified in existing CSS.

### Memory Impact

**Before virtualization:**
- 5,000 `<tr>` elements
- 50,000+ `<td>` elements (10 columns × 5,000 rows)
- Content text nodes
- Estimated: ~2-5MB in-memory DOM

**After virtualization:**
- ~80 `<tr>` elements (visible + overscan)
- ~800 `<td>` elements
- Content text nodes
- Estimated: ~50-200KB in-memory DOM
- **Reduction: 95%+ memory savings**

### Performance Benchmarks

Expected improvements on a MacBook Pro rendering 5,000 rows:
- Scroll FPS: 30-40fps → 58-60fps
- Initial render time: 150ms → 30ms
- Filter/search response: 200ms → 50ms
- Memory usage: 3MB → 200KB

---

## Implementation Timeline

| Phase | Task | Duration |
|-------|------|----------|
| Dev | Code implementation & testing | 2-3 hours |
| QA | Manual testing & edge cases | 1-2 hours |
| Review | Code review & feedback | 1 hour |
| Total | **Estimated:** | **4-6 hours** |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Incorrect row height estimate | Scroll bar inaccuracy, overscan gaps | Measure actual row height, test with various content |
| Sort/filter not updating virtualizer | Wrong rows displayed after sort | Ensure `count: sortedData.length` updates virtualizer |
| Scroll position reset on data change | Poor UX, user loses place | Test with streaming data, verify scroll persistence |
| CSS conflicts with transform | Layout shifts or flashing | Verify no absolute positioning conflicts, test in DevTools |
| Touch scroll behavior | Mobile scrolling janky | Test on actual mobile devices, verify gesture handling |

---

## Testing Strategy

### Unit Tests
- [ ] `rowVirtualizer` initializes with correct count
- [ ] Virtual item calculation matches visible range
- [ ] Spacer heights calculated correctly

### Integration Tests
- [ ] Search updates virtualizer count
- [ ] Sort reorders virtual rows
- [ ] Export includes all data (not just visible)
- [ ] Headers remain sticky during scroll

### Performance Tests
- [ ] Profile rendering time for 5,000 rows
- [ ] Measure DOM node count (target: 80)
- [ ] Verify scroll FPS (target: 60fps)
- [ ] Memory usage before/after

### Manual Tests
- [ ] Scroll with mouse wheel, trackpad, touch
- [ ] Search, sort, filter, then scroll
- [ ] Export while scrolled to middle of table
- [ ] Resize window to smaller viewport
- [ ] Test with 0 rows, 5 rows, 5,000 rows

---

## Dependencies

- **Package:** `@tanstack/react-virtual`
- **Version:** `^3.13.18`
- **Status:** Already installed ✓
- **Size impact:** None (already in bundle)

---

## Success Metrics

1. **Performance:** Scroll performance improves to 58-60fps
2. **Memory:** DOM node count reduced to < 100 rows
3. **UX:** No visual glitches or flashing during scroll
4. **Functionality:** All features (search, sort, export) work correctly
5. **User feedback:** No regression reports post-deployment

---

## Rollback Plan

If issues arise post-deployment:
1. Revert `ResultsTable.tsx` to previous version
2. Verify tests pass with old implementation
3. Redeploy
4. **Time to rollback:** < 5 minutes

---

## References

- [@tanstack/react-virtual Documentation](https://tanstack.com/virtual/latest)
- Current implementation: `src/components/ResultsTable/ResultsTable.tsx`
- Styling: `src/App.css` (lines 759-823)
- Type definitions: `src/types/index.ts`

---

## Appendix: Code Diff Preview

### Import Changes
```typescript
- import { useState, useMemo } from 'react';
+ import { useRef, useState, useMemo } from 'react';
+ import { useVirtualizer } from '@tanstack/react-virtual';
```

### Hook Addition
```typescript
const sortedData = useMemo(() => {
  // ... existing sort logic
}, [filteredData, sortConfig]);

+ const rowVirtualizer = useVirtualizer({
+   count: sortedData.length,
+   getScrollElement: () => parentRef.current,
+   estimateSize: () => 35,
+   overscan: 20,
+ });
```

### Ref Addition
```typescript
+ const parentRef = useRef<HTMLDivElement>(null);
```

### Render Method
```typescript
- <div className="results-table-wrapper">
+ <div className="results-table-wrapper" ref={parentRef}>
    <table className="results-table">
      {/* ... thead unchanged ... */}
      <tbody>
-       {sortedData.map((row, rowIndex) => (
-         <tr key={rowIndex}>
+       {rowVirtualizer.getVirtualItems().map((virtualRow) => {
+         const row = sortedData[virtualRow.index];
+         return (
+         <tr key={virtualRow.index} style={{transform: `translateY(${virtualRow.start}px)`}}>
            {columnNames.map((colName) => (
              <td key={colName}>{/* cell rendering */}</td>
            ))}
          </tr>
-       ))}
+       );
+       })}
+       {/* Spacer rows for scroll height */}
+       {rowVirtualizer.getVirtualItems().length > 0 && (
+         <tr style={{height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0}} aria-hidden />
+       )}
+       {rowVirtualizer.getVirtualItems().length > 0 && (
+         <tr style={{height: Math.max(0, rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0))}} aria-hidden />
+       )}
      </tbody>
    </table>
  </div>
```

---

**Document Status:** Ready for Development
**Last Updated:** 2026-02-28
