# Phase 5: Statement History Panel

## Problem Statement
Users currently have no visibility into statement execution history. The `listStatements()` API method is fully implemented but never called. When users refresh the page or close a cell, there is no way to:
- View previously executed statements
- Reconnect to running statements on the server
- Reload and re-run a previous query without retyping

This creates a poor user experience for iterative SQL development and debugging.

## Proposed Solution
Implement a Statement History Panel accessible via a clock icon button in the toolbar. The panel displays all server-side statements fetched via the existing `listStatements()` API. Users can load any previous statement's SQL back into a new editor cell with a single click.

### Architecture
- **State Management**: Add `statementHistory`, `historyLoading`, and `historyError` to Zustand store (async server state only). Add `showHistory` as `useState` in `App.tsx` for UI toggle state.
- **Data Fetch**: Lazy-load statement list when panel opens (not on app mount). Call `loadStatementHistory()` explicitly in the click handler when opening and data is empty.
- **UI Pattern**: Dropdown panel in toolbar, positioned next to settings panel, follows existing design patterns. Extract to dedicated `HistoryPanel` component.
- **Action**: "Load" button on each entry creates a new cell with that statement's SQL. Refresh button re-fetches the history list.
- **Persistence**: `showHistory`, `statementHistory`, `historyLoading`, and `historyError` are excluded from localStorage persistence.

## Files to Modify

### 1. `src/api/flink-api.ts`
Update the existing `listStatements()` function:
- Add optional `pageSize` parameter (default 50)
- Pass `?page_size=50` query parameter to the API call
- Return `StatementResponse[]` typed response

### 2. `src/store/workspaceStore.ts`
Add new state properties and action:
- `statementHistory: StatementResponse[]` - cached list of server statements (typed from flink-api)
- `historyLoading: boolean` - loading indicator during fetch
- `historyError: string | null` - error message if fetch fails
- `loadStatementHistory()` - async action calling `listStatements(50)` from flink-api
- `clearHistoryError()` - reset error state
- **Persist exclusions**: Add `statementHistory`, `historyLoading`, `historyError`, and `showHistory` to `partialize` exclusion list

### 3. `src/components/HistoryPanel/HistoryPanel.tsx` (NEW)
Extract history panel to dedicated component:
- Props: `isOpen: boolean`, `onClose: () => void`, `onLoad: (sql: string) => void`
- Local state: none (all state comes from Zustand store)
- Render: header with title + refresh button + close button, scrollable list, loading/error/empty states

### 4. `src/components/HistoryPanel/index.ts` (NEW)
Re-export component for consistency with other components

### 5. `src/App.tsx`
Add UI elements to the toolbar:
- `showHistory` as `useState(false)` (local UI state, NOT in Zustand)
- Clock icon button (FiClock from react-icons) that toggles `showHistory`
- Click handler: `if (!statementHistory.length && !historyLoading) loadStatementHistory()`
- Import and render `<HistoryPanel>` component conditionally
- Click-outside handler to close panel (close `showHistory`)
- Pass `onLoad={(sql) => addStatement(sql)}` to HistoryPanel

### 6. `src/App.css`
Add styles for history panel (if not using Tailwind):
- `.history-panel` - container, mirror settings panel styling (absolute positioned dropdown)
- `.history-panel-header` - title, refresh button, and close button
- `.history-list` - scrollable list container (max 400px height)
- `.history-item` - individual statement entry
- `.history-status-badge` - colored status dot (reuse color scheme)
- `.history-sql-preview` - truncated SQL text (80 chars max + ellipsis)
- `.history-load-btn` - button styling (secondary style)
- `.history-empty-state` - empty message styling
- `.history-error` - error message styling with retry button

## Implementation Details

### Store State Shape
```typescript
// Add to WorkspaceState
statementHistory: StatementResponse[];  // from flink-api.ts, NOT a custom type
historyLoading: boolean;
historyError: string | null;

// Persist exclusion (in partialize function)
// excludes: statementHistory, historyLoading, historyError, showHistory (the last is in App.tsx)
```

### Store Actions
```typescript
loadStatementHistory: async () => {
  // Set historyLoading = true
  // Call listStatements(50) from flink-api
  // On success: set statementHistory = response, set historyError = null, set historyLoading = false
  // On error: set historyError = error.message, set historyLoading = false, leave statementHistory unchanged
}

clearHistoryError: () => {
  // Reset historyError to null
}
```

### UI State (in App.tsx, not Zustand)
```typescript
const [showHistory, setShowHistory] = useState(false);

// Click handler for clock icon button:
const handleOpenHistory = () => {
  if (!showHistory) {
    // Opening panel
    if (!statementHistory.length && !historyLoading) {
      loadStatementHistory();
    }
  }
  setShowHistory(true);
};
```

### HistoryPanel Component
```typescript
interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  statements: StatementResponse[];
  isLoading: boolean;
  error: string | null;
  onLoad: (sql: string) => void;
  onRefresh: () => void;
}
```

### Panel Behavior
- Panel opens when user clicks clock icon
- On first open, automatically fetch statements (lazy load) if history is empty and not loading
- Subsequent opens use cached data (no automatic re-fetch, but refresh button available)
- Click outside panel closes it
- "Load" button on each statement: `onLoad(statement.spec?.statement)`
- "Refresh" button in header re-calls `loadStatementHistory()` (promotes Future Enhancement to base implementation)
- Max 50 statements shown (cap from API parameter passed to `listStatements(50)`)
- Statements displayed in order returned from API (no custom sorting)

### History Item Display
Each entry shows:
1. **Status badge** - colored circle based on `statement.status?.phase`:
   - green = COMPLETED
   - blue = RUNNING
   - yellow = PENDING
   - red = FAILED or CANCELLED
   - gray = other/unknown
2. **Statement name** - left-aligned, bold (from `statement.name`)
3. **SQL preview** - first 80 characters from `statement.spec?.statement`, truncated with ellipsis if longer
4. **Load button** - "Load" button with hover state (calls `onLoad(sql)`)
5. **No timestamp** - omitted for simplicity (StatementResponse has no created_at field)

### Error Handling
- **No statements**: Show empty state message "No statements yet"
- **API error**: Display error message in panel, retry button
- **Invalid statement data**: Skip entries with missing `spec.statement`
- **Network timeout**: Show "Failed to load history" message

## Acceptance Criteria
- [ ] Clock icon button visible in toolbar (right of settings icon)
- [ ] Clicking icon opens history panel
- [ ] On first open, `loadStatementHistory()` called automatically if history is empty and not loading
- [ ] Panel displays list of server-side statements fetched from API
- [ ] Each entry shows status badge (colored circle), name, and SQL preview (80 chars max)
- [ ] Status badges correct: green=COMPLETED, blue=RUNNING, yellow=PENDING, red=FAILED/CANCELLED, gray=other
- [ ] Status accessed as `statement.status?.phase` (NOT flat string)
- [ ] No timestamps shown (omitted per requirement)
- [ ] "Load" button creates new cell with statement SQL from `statement.spec?.statement`
- [ ] "Refresh" button in panel header re-calls `loadStatementHistory()`
- [ ] Panel closes on click outside or close button
- [ ] Loading spinner shown while fetching
- [ ] Empty state message when no statements returned
- [ ] Error message shown on API failure with retry capability (calls onRefresh)
- [ ] History cached after first fetch (subsequent opens don't auto-fetch)
- [ ] Panel positioned consistently with settings panel
- [ ] `statementHistory`, `historyLoading`, `historyError`, `showHistory` excluded from localStorage via partialize

## Edge Cases
- **Empty history**: Show "No statements yet" message instead of blank panel
- **No SQL in spec**: Show placeholder text "No SQL" or skip entry with warning log
- **Very long statements**: Truncate preview to 80 chars, optionally show full SQL in tooltip on hover
- **Very long history**: API call limited to 50 statements via `page_size=50` parameter
- **Statement name too long**: Truncate with ellipsis in UI
- **Missing status.phase**: Show gray status badge, treat as unknown phase
- **Missing spec.statement**: Show placeholder in preview
- **Page refresh**: History data and showHistory state lost (user must re-open panel to fetch, fresh state)
- **API timeout**: Show timeout error message, retry button calls onRefresh to re-fetch
- **Rapid open/close**: Loading flag prevents double-fetches during concurrent calls
- **Null/undefined statements**: Filter out before rendering, log warnings

## API Integration
**Updates to existing `listStatements()` from `src/api/flink-api.ts` (line ~168)**:
- Add optional `pageSize?: number` parameter (default: 50)
- Append `?page_size=${pageSize}` query parameter to API call
- Returns `StatementResponse[]` (already typed in flink-api.ts)
- Already handles Confluent Cloud auth via axios client
- No new API methods needed, only enhance existing function

## Type Changes
**NO new types to add**. Use `StatementResponse` directly from `src/api/flink-api.ts` which is already exported and fully typed:
```typescript
export interface StatementResponse {
  name: string;
  metadata?: { resource_version?: string };
  spec?: { statement?: string; statement_type?: string; compute_pool_id?: string; properties?: Record<string, string> };
  status?: { phase: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; detail?: string; traits?: {...} };
}
```

Status access: Use `statement.status?.phase` (NOT `statement.status` as a string).

## Performance Considerations
- Lazy load: history only fetched on first panel open, not on app mount
- Caching: subsequent panel opens use cached data (no re-fetch)
- Max 50 statements: prevents rendering huge lists
- Scrollable list container: handles long history gracefully

## Testing Strategy
- Verify clock icon renders in toolbar
- Test panel open/close with click handlers
- Verify `listStatements()` is called once per session
- Verify cached data used on re-open
- Test "Load" button creates new cell with correct SQL
- Test error states (empty, API error, timeout)
- Test truncation of long SQL/names
- Verify panel closes on click outside

## Future Enhancements
- Full SQL tooltip on hover
- Search/filter history by name or SQL text
- Delete statement from server via API
- Persist favorite statements to localStorage (separate from history)
- Sort by status, resource_version (as proxy for recency), or execution time
- Copy statement SQL to clipboard button per entry
- Batch load multiple statements at once
- Display statement type (QUERY, SINK, etc.) from `spec?.statement_type`
