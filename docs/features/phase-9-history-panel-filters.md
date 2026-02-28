# Phase 9.3: History Panel Status Filters

## Problem
The history panel currently displays all statements in the history without any way to filter by status. Users cannot quickly find statements of interest (e.g., only failed queries, running queries), making it difficult to navigate large statement histories. The panel also lacks relative timestamps, making it hard to understand how old each statement is.

## Solution
Add a compact filter strip at the top of the history panel with status filter tabs:
- **All** - Show all statements (default)
- **Completed** - Show only statements with status COMPLETED
- **Failed** - Show only statements with status FAILED or CANCELLED
- **Running** - Show only statements with status RUNNING or PENDING

Each tab displays a count badge (e.g., "Failed (3)"). The active filter is highlighted with the accent color. Filtering is done client-side by matching on `statement.status.phase`.

If the API response includes timestamp metadata (e.g., `created_at`, `updated_at`), display relative time ("2m ago", "1h ago") next to each history item. This improves UX by showing statement recency without cluttering the UI.

## Files to Modify
1. **src/components/HistoryPanel/HistoryPanel.tsx** - Add filter state, filter logic, and render filter tabs
2. **src/api/flink-api.ts** - Enhance `StatementResponse` type to include timestamp fields if available from API
3. **src/index.css** - Add CSS classes for filter tabs and relative time styling

## Implementation Details

### Filter State & Logic
- Add local state: `activeFilter` (default: 'all')
- State type: `'all' | 'completed' | 'failed' | 'running'`
- Compute filtered list by mapping status phases to filter:
  ```
  'completed' → phase === 'COMPLETED'
  'failed'    → phase === 'FAILED' || phase === 'CANCELLED'
  'running'   → phase === 'RUNNING' || phase === 'PENDING'
  'all'       → no filter
  ```
- Compute status counts from the SQL-guarded list (after filtering `.filter(s => s.spec?.statement)`):
  ```
  completed: count where phase === 'COMPLETED' AND s.spec?.statement exists
  failed:    count where (phase === 'FAILED' || phase === 'CANCELLED') AND s.spec?.statement exists
  running:   count where (phase === 'RUNNING' || phase === 'PENDING') AND s.spec?.statement exists
  ```
- This ensures counts reflect only entries with actual SQL content, preventing inflated numbers from entries without `.spec?.statement`

### Filter UI
- Render a compact filter strip OUTSIDE the scrollable list to keep it fixed at the top
- Ensure the filter strip does NOT scroll with history items below
- HTML structure:
  ```html
  <div class="history-filter-strip">
    <button class="history-filter-tab" data-filter="all">
      All
    </button>
    <button class="history-filter-tab" data-filter="completed">
      Completed <span class="history-filter-count">(X)</span>
    </button>
    <button class="history-filter-tab" data-filter="failed">
      Failed <span class="history-filter-count">(X)</span>
    </button>
    <button class="history-filter-tab" data-filter="running">
      Running <span class="history-filter-count">(X)</span>
    </button>
  </div>
  <div class="history-list-scrollable">
    {/* filtered history items here */}
  </div>
  ```
- Active tab class: `history-filter-tab--active` (uses accent color background)
- Count badges are always shown (even if 0)
- CSS: Set `history-filter-strip` to `position: sticky; top: 0;` or place outside overflow container

### Relative Time Display
- Helper function: `getRelativeTime(isoDateString: string): string | null`
  - "now" if < 1 minute
  - "Xm ago" if < 1 hour (rounded down)
  - "Xh ago" if < 24 hours (rounded down)
  - "Xd ago" if >= 24 hours (rounded down)
  - `null` if date parsing fails (consistent with "don't display if unavailable")
- Display in `HistoryItem` after the status dot:
  ```html
  <div class="history-item-meta">
    <span class="history-status-dot" />
    {relativeTime && <span class="history-item-time">{relativeTime}</span>}
    <span class="history-item-name">statement-name</span>
  </div>
  ```
- Suppress the time element entirely when `getRelativeTime()` returns `null`
- Assume the API uses `metadata.create_time` or `status.create_time` (check actual API response)
- If timestamp is not available, do not display relative time

### Empty States
- **No history at all**: Show existing message "No statements found"
- **No results for current filter**: Show "{Status} filter has no statements" (e.g., "Failed (0) filter has no statements")
  - Only show this message when `filteredList.length === 0` AND `statementHistory.length > 0` (history exists but filtered list is empty)

### Preserve Existing Behavior
- Click "Load" button still loads the statement into a new editor cell and closes the panel
- Refresh button still loads all statements
- Error handling and loading state remain unchanged

## Acceptance Criteria
1. Filter tabs are rendered in a row at the top of the history list
2. "All" tab is the default active filter
3. Active tab is visually highlighted with accent color
4. Each tab shows a count badge with the number of matching statements
5. Clicking a filter tab updates the displayed list client-side instantly
6. The filtered list only includes statements matching the selected status filter
7. "Failed" filter includes both FAILED and CANCELLED statuses
8. "Running" filter includes both RUNNING and PENDING statuses
9. If available, relative timestamps are displayed for each history item (e.g., "2m ago")
10. Load button functionality is preserved for all filtered items
11. Existing error handling and empty states work with filters applied
12. All counts are correct and update dynamically

## Edge Cases
1. **Empty history after filter**: Show the existing empty state message ("No statements found")
2. **All counts are zero**: Show "All (0)" and other tabs with 0; "All" tab should still be clickable
3. **Missing timestamp in API response**: Skip relative time display for that statement
4. **Invalid timestamp format**: Fallback to not displaying time for that statement
5. **Rapid filter switching**: No race conditions (all logic is synchronous, client-side)
6. **Very large statement histories**: Filter logic is O(n), acceptable for client-side filtering
7. **Cancelled statements**: Must be grouped with failed status (not separate tab)
8. **Unknown status phase**: Treat as neutral, only show in "All" filter

## Notes
- This feature is purely UI/UX enhancement with no API changes
- Filter preference is NOT persisted (resets when panel is closed/reopened)
- No new dependencies required
- CSS should follow existing history panel styling (compact, minimal)
