# Phase 9.1: Row Index Column

## Problem
Users viewing large result sets have no visual reference for the absolute row position. When scrolling through results or using search/filters, there is no clear way to identify which row number they are viewing in the original result set. This makes it difficult to:
- Reference specific rows in discussions or reports ("the third row has...")
- Track position while scrolling
- Correlate with external row numbering systems

## Solution
Add a frozen "#" column as the leftmost column in the results table. This column will:
- Display 1-based row indices (1, 2, 3, ...)
- Show the **original row position** (unaffected by sorting, filtering, or search)
- Be visually distinct with muted/gray text and reduced opacity
- Have a narrow, fixed width (~50px)
- Be non-interactive (non-sortable, non-copyable)
- Always remain visible and always appear first
- Be excluded from exports (CSV, JSON)
- Work seamlessly with both grid and list view modes
- Work correctly with virtual scrolling by maintaining index mapping

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ResultsTable/ResultsTable.tsx` | Main implementation: add index column to both grid and list views |
| `src/index.css` | Add styling for the row index column (muted text, fixed width, alignment) |

## Implementation Details

### 1. Component Logic (`ResultsTable.tsx`)

#### 1.1 Row Index Tracking
- Store the original row indices before filtering/sorting
- Create a precomputed mapping via `useMemo`: `originalIndexMap: Map<object, number>`
- Compute once over `data` array: `new Map(data.map((row, i) => [row, i + 1]))`
- Look up indices in O(1) time during render

**Algorithm:**
```
const originalIndexMap = useMemo(() => {
  return new Map(data.map((row, i) => [row, i + 1]));
}, [data]);

For each visible row:
- originalIndex = originalIndexMap.get(sortedData[virtualRow.index])

This reduces per-cell lookup from O(n) to O(1), critical for 10k+ row streaming.
```

**Rationale:** `data.indexOf()` is O(n) per lookup, causing O(n²) cost when rendering thousands of visible/virtual rows. Precomputing the map eliminates this bottleneck.

#### 1.2 Grid View (Virtual Scrolling)
- Add a `<colgroup>` at the start of `<table>` with first `<col style="width:50px">` to lock index column width
- Add a "#" header cell to the `<thead>` BEFORE other column headers
- For each `virtualRow`, prepend an index cell showing `originalIndex` (looked up from `originalIndexMap`)
- Update `colSpan` calculations in padding rows to include the index column
  - In paddingTop row: `colSpan={visibleColumnNames.length + 1}`
  - In paddingBottom row: `colSpan={visibleColumnNames.length + 1}`

**Table structure:**
```jsx
<table>
  <colgroup>
    <col style={{ width: '50px' }} /> {/* Locks index column width */}
    {/* other col elements for data columns */}
  </colgroup>
  <thead>
    <tr>
      <th className="results-index-cell">#</th>
      {/* other headers */}
    </tr>
  </thead>
  {/* tbody with virtualRow rendering */}
</table>
```

#### 1.3 List View (Non-Virtual)
- Add a `<colgroup>` at the start of `<table>` with first `<col style="width:50px">` (matches grid view)
- Add a "#" header cell to the `<thead>` BEFORE other column headers
- For each row in `sortedData`, prepend an index cell showing `originalIndex` (looked up from `originalIndexMap`)
- No virtual scrolling logic needed

#### 1.4 Index Cell Styling & Sticky Positioning
- Class: `results-index-cell` (new)
- Properties:
  - `text-align: center`
  - `user-select: none`
  - `cursor: default` (not clickable)
  - Apply on cell, not row
- Do NOT attach `onClick` handler to index cells
- Do NOT calculate `cellKey` for index cells (they are not copyable)

**Sticky positioning:** The `#` header cell in `<thead>` will inherit the existing sticky positioning from the table's `<thead>` CSS rules. The index cells in `<tbody>` will scroll normally with the table. If future requirements demand a frozen index column during horizontal scroll, add `position: sticky; left: 0;` to `.results-index-cell`.

### 2. Styling (`index.css`)

Add the following CSS rule:
```css
.results-index-cell {
  width: 50px;
  min-width: 50px;
  max-width: 50px;
  text-align: center;
  color: var(--color-text-tertiary);
  background-color: var(--color-surface-secondary);
  padding: 8px 4px;
  font-size: 13px;
  font-weight: 500;
  user-select: none;
  cursor: default;
  border-right: 1px solid var(--color-border);
  vertical-align: middle;
}

.results-index-cell:hover {
  background-color: var(--color-surface-secondary);
  color: var(--color-text-tertiary);
  cursor: default;
}
```

**Dark mode (inherited):** Uses `--color-text-tertiary` and `--color-surface-secondary` which have dark theme overrides, so no additional dark-mode CSS needed.

### 3. Export Handling

**No changes needed** – The current export logic uses `columns` array and `visibleColumnNames` which do not include the index column, so exports are automatically clean.

### 4. Column Visibility Toggle

**No changes needed** – The index column is not part of the `columnNames` or `hiddenColumns` state, so it is automatically excluded from the visibility toggle UI.

### 5. Virtual Scrolling Compatibility

The virtualizer's `colSpan` in padding rows must account for the index column:
- **Current:** `colSpan={visibleColumnNames.length}`
- **New:** `colSpan={visibleColumnNames.length + 1}`

This ensures padding spacer rows span the full table width including the index column.

## Acceptance Criteria

- [ ] Row index column renders as the first column (leftmost)
- [ ] Shows 1-based indices (1, 2, 3, ...) corresponding to original row order
- [ ] Index is stable when sorting by other columns (index doesn't change)
- [ ] Index is stable when filtering via search (index shows original position)
- [ ] Column has visually distinct styling: gray/muted text, fixed 50px width
- [ ] Clicking index cells does NOT copy to clipboard
- [ ] Index column is excluded from CSV export (no "#" column header or values)
- [ ] Index column is excluded from JSON export
- [ ] Index column is excluded from column visibility toggle UI
- [ ] Grid view with virtual scrolling: paddingTop and paddingBottom rows span full width
- [ ] List view: all rows display correct index
- [ ] No horizontal scroll shift or layout jump when enabling index column
- [ ] Works correctly with existing sort functionality (other columns)
- [ ] Search results still show correct original indices
- [ ] Empty results state still renders correctly

## Edge Cases

### 1. Filtered + Sorted Data
When a user searches for "foo" and then sorts by a column:
- Search filters to N results
- Sort reorders those N results
- Index shows the original position of each row in the unfiltered data
- **Expected:** Indices are scattered (e.g., 1, 5, 8, 12) in the filtered+sorted view

**Test:** Search for a term, sort by a column, verify indices reflect original positions.

### 2. Large Result Sets (Virtual Scrolling)
When data has 10,000+ rows and virtual scrolling kicks in:
- Only visible rows + overscan rows are rendered
- Index calculation must not depend on iterating full dataset
- **Implementation:** Use `data.indexOf(sortedData[virtualRow.index])` only for visible rows (computed in map)

**Test:** Load 10k rows, scroll through, verify correct indices appear, no performance regression.

### 3. Dynamic Data (Streaming Results)
When new rows are appended to results (streaming):
- New rows get next index (previous max + 1)
- Already-indexed rows keep their indices
- **No changes needed** – indices are calculated on render, based on position in `data` array

**Test:** Start streaming results, watch indices increment correctly as new rows arrive.

### 4. Empty Results
When query returns 0 rows:
- "Query executed successfully. No rows returned." message appears
- No table rendered, no index column
- **No changes needed** – ResultsTable returns early on empty data

**Test:** Execute query with no results, verify empty state renders.

### 5. Column Overflow (Horizontal Scroll)
When result columns overflow horizontally:
- Index column should remain visible at left (frozen)
- OR scroll with table (simpler to implement, acceptable trade-off)
- **Current plan:** Index column scrolls with table (no CSS position:sticky needed for MVP)

**Test:** With many columns, scroll horizontally, verify index column behavior is consistent.

### 6. All Columns Hidden Via Visibility Toggle
When user hides all data columns:
- Index column still visible (always)
- Table shows only "#" column
- **Expected behavior:** User can still see original data by unhiding columns

**Test:** Hide all columns in visibility toggle, verify index column and table still render.

## Implementation Order

1. **Step 1:** Add index column header and cells to grid view (virtual scrolling path)
2. **Step 2:** Add index column header and cells to list view
3. **Step 3:** Add CSS styling for `.results-index-cell`
4. **Step 4:** Update `colSpan` in paddingTop and paddingBottom rows
5. **Step 5:** Manual testing of all acceptance criteria and edge cases
6. **Step 6:** Document in this PRD any deviations or discoveries

## Notes

- **No state changes needed** – Index is derived from data position, not stored
- **No API changes** – This is purely a UI enhancement
- **No type changes** – The `Column` type remains unchanged
- **Performance:** Index lookup is O(1) per visible row via precomputed `originalIndexMap`. Eliminates O(n²) cost of repeated `indexOf()` calls at 10k+ rows.
- **Accessibility:** Consider `aria-label` on index cell: "Row 1" for screen readers (future enhancement)
