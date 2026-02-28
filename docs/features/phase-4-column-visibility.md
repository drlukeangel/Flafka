# Phase 4: Column Visibility Toggle

## Problem Statement
When a query returns many columns, the results table becomes wide and hard to read. Users need a way to temporarily hide irrelevant columns to focus on the data they care about.

## Proposed Solution
Add a "Columns" dropdown button in the results table toolbar (toolbar-right, next to the view toggle buttons). The dropdown shows a checkbox list of all column names. Toggling a checkbox hides/shows the corresponding column. Quick actions (Show All / Hide All) allow bulk operations.

## Files to Modify
- `src/components/ResultsTable/ResultsTable.tsx` - Add state, button, and dropdown UI; filter visible columns
- `src/App.css` - Add styles for columns dropdown, toggle items, and action links

## State Changes
- New `useState<Set<string>>('hiddenColumns', new Set())` — tracks which column names are hidden
- Resets implicitly when data/columns change (component re-mounts or columns prop changes)
- No persistence needed — column visibility is session-scoped per query result

## UI Changes
- "Columns" button in toolbar-right, uses `FiColumns` icon from `react-icons/fi`
- Button is toggled (open/close) on click
- Dropdown appears below button, closes on outside click
- Dropdown contains:
  - Header row with "Show All" and "Hide All" action links
  - Divider
  - Scrollable list of checkboxes (one per column), checked = visible
- Filtered `columnNames` (visible columns) are used in both `<thead>` and `<tbody>`

## API Changes
None.

## Type Changes
None.

## Acceptance Criteria
- [ ] "Columns" button visible in toolbar, opens/closes dropdown on click
- [ ] Dropdown lists all column names with checkboxes
- [ ] Unchecking a column removes it from both header and data rows
- [ ] "Hide All" hides all columns (empty table headers)
- [ ] "Show All" restores all columns
- [ ] Clicking outside the dropdown closes it
- [ ] Export still uses ALL columns (not filtered by visibility) — or visible only: TBD

## Edge Cases
- Zero columns: button still renders but dropdown is empty
- Single column: works normally
- Column names with special characters: handled by React key/label rendering
- Many columns: dropdown scrollable (max-height + overflow-y: auto)

## Implementation Notes
- Use `useRef` + `useEffect` for outside-click detection
- `visibleColumnNames` = `columnNames.filter(c => !hiddenColumns.has(c))`
- Export should export only visible columns for consistency with what user sees

## Final Notes
- Implemented in Phase 4 of the Flink SQL Workspace UI
- No subagent orchestration — implemented directly as a full-stack engineer task
