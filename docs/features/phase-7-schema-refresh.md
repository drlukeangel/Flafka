# Phase 7: Schema Panel Refresh Button

**Date:** 2026-02-28
**Feature:** Add refresh capability to schema panel
**Status:** Design Phase

## Problem Statement

Currently, when a user clicks a table in the tree navigator, the schema panel displays the table's columns. However, if the table schema changes (e.g., new columns added upstream), there's no way to refresh the schema without clicking away and clicking back. This requires a two-step interaction that's disruptive to the workflow.

Confluent Cloud's schema panels include a refresh icon for this exact use case. Users expect a simple one-click refresh button to fetch fresh schema data.

## Proposed Solution

Add a refresh icon button (FiRefreshCw from react-icons) in the schema panel header next to the column count. Clicking it will:
1. Set a loading state (spin the icon)
2. Re-fetch the table schema using the existing `getTableSchema()` API call
3. Replace the current schema data with fresh data on success
4. Show an error toast on failure

The refresh icon should be visually distinct but consistent with the existing UI patterns (icon buttons like those in the toolbar).

## Files to Modify

### Primary Changes
- `src/components/TreeNavigator/TreeNavigator.tsx` - Add refresh button to schema panel header section (lines 209-237)
- `src/App.css` - Add CSS for refresh button styling and spin animation (after line 743, in schema section)

### No Changes Required
- `src/store/workspaceStore.ts` - Existing `loadTableSchema()` action already exists and handles loading state correctly
- `src/api/flink-api.ts` - Existing `getTableSchema()` function already implements the DESCRIBE logic

## API Contract

**Existing API Used:**
```typescript
// Already exists in flink-api.ts line 251
export const getTableSchema = async (
  catalog: string,
  database: string,
  table: string
): Promise<Column[]>
```

No API changes needed. The refresh button simply calls the existing `loadTableSchema()` store action with the currently selected table info.

## Type Changes

No new types needed. Uses existing:
- `Column` type from `src/types/index.ts` (already has `name`, `type`, `nullable`)
- Existing store state: `selectedTableSchema`, `selectedTableName`, `schemaLoading`

## Implementation Details

### TreeNavigator.tsx Changes

**Location:** Schema panel header section (lines 209-237)

**Current structure:**
```tsx
<div className="schema-panel" role="region" aria-label="Table schema">
  <div className="schema-header">
    <h4>{selectedTableName}</h4>  // Just the table name
  </div>
  {schemaLoading ? ...}
  ...
</div>
```

**New structure:**
```tsx
<div className="schema-panel" role="region" aria-label="Table schema">
  <div className="schema-header">
    <h4>{selectedTableName}</h4>
    <button
      className={`schema-refresh-btn ${schemaLoading ? 'loading' : ''}`}
      onClick={handleSchemaRefresh}
      disabled={schemaLoading}
      title="Refresh schema"
      aria-label={`Refresh schema for ${selectedTableName}`}
    >
      <FiRefreshCw size={16} />
    </button>
  </div>
  ...
</div>
```

**New handler function** (add after `handleSchemaColumnDoubleClick`):

**CRITICAL:** Add `catalog`, `database`, and `loadTableSchema` to the existing `useWorkspaceStore()` destructure in TreeNavigator (around line 98-112). Do NOT call useWorkspaceStore inside the handler.

```typescript
const handleSchemaRefresh = () => {
  if (selectedTableName && catalog && database) {
    loadTableSchema(catalog, database, selectedTableName);
  }
};
```

This handler assumes `catalog`, `database`, `selectedTableName`, and `loadTableSchema` are already destructured from the store at the top of the component. Do not call `useWorkspaceStore()` inside the event handler function - this would cause unnecessary re-subscriptions.

**Import Changes:**
- Add `FiRefreshCw` to the existing react-icons import on line 6-19

### App.css Changes

**Add after `.schema-empty` (around line 743):**

```css
/* Schema Refresh Button */
.schema-refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  padding: 0;
  flex-shrink: 0;
}

.schema-refresh-btn:hover:not(:disabled) {
  background-color: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.schema-refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.schema-refresh-btn.loading svg {
  animation: history-spin 0.8s linear infinite;
}
```

## Acceptance Criteria

- [x] Refresh icon (FiRefreshCw) is visible in schema panel header, right-aligned next to table name
- [x] Icon has proper spacing (gap in schema-header flexbox) and sizing (16px or 24px button)
- [x] Click on icon triggers `loadTableSchema()` store action with current catalog, database, and table name
- [x] Icon spins during loading (CSS animation while `schemaLoading === true`)
- [x] Button is disabled while loading (cannot trigger duplicate requests)
- [x] Schema content updates with fresh data on success (store reactivity handles this)
- [x] Error handling inherited from store (no explicit error toast needed, UI shows empty state if failure)
- [x] Tooltip shows "Refresh schema" on hover
- [x] Keyboard accessible (button element, proper aria-label)
- [x] Consistent with existing icon button patterns in the app

## Edge Cases & Error Handling

**Case 1: User clicks refresh while already loading**
- Button is disabled during loading, so no double-request possible

**Case 2: Refresh fails (API error)**
- Store's `loadTableSchema()` logs error to console
- `schemaLoading` becomes false
- UI shows "No columns found" state
- User can retry by clicking again
- No error toast shown (keep silent failure to avoid toast spam)

**Case 3: User selects a new table while refresh is in progress**
- New selection triggers `selectTreeNode()` which calls `loadTableSchema()` with new table
- Aborts old in-flight request implicitly (new store action replaces it)
- UI updates with new table schema

**Case 4: Large schemas (100+ columns)**
- No performance change - `loadTableSchema()` already fetches via DESCRIBE
- Panel scrolls with existing max-height: 250px and overflow-y: auto

**Case 5: Schema panel unmounts during refresh**
- User clicks a non-table node in tree while schema refresh is in-flight
- In-flight `loadTableSchema()` promise resolves normally, but schema panel no longer renders
- Store state updates (new table is now selected), no memory leaks or orphaned requests
- Harmless - store handles concurrent requests cleanly

## Testing Strategy

### Unit Tests (Not required for design)
- Mock `loadTableSchema` store action
- Verify click handler calls action with correct params
- Verify button disabled state tracks `schemaLoading`

### Manual QA Tests
1. Click a table in tree → schema loads → click refresh icon → schema re-fetches ✓
2. While refresh loading → icon spins, button disabled ✓
3. Refresh completes → icon stops spinning, schema updated ✓
4. Refresh fails → silent fail, UI shows empty state, can retry ✓
5. Click new table while refresh in progress → switches to new table schema ✓
6. Hover refresh button → tooltip shows, background highlight ✓
7. Keyboard: Tab to button → Space/Enter triggers refresh ✓

## Performance Implications

**Negligible:**
- One additional API call per user refresh action (user-initiated, not automatic)
- Reuses existing `getTableSchema()` which executes a simple DESCRIBE statement
- No new polling or background fetches introduced
- Loading state prevents double-requests

## Dependencies & Risks

**Zero external dependencies added**
- Uses existing `FiRefreshCw` from react-icons (already in package.json)
- Uses existing CSS animation patterns (`@keyframes`) from other parts of app
- Uses existing button styling classes and patterns

**No breaking changes**
- Adds to existing schema panel header, doesn't change structure
- Backward compatible - schema loading behavior unchanged

## Notes

- The store action `loadTableSchema()` was already designed to handle loading state and error handling
- CSS animation `history-spin` is already defined in App.css and reused by other spinners in the app
- Consider future enhancement: add a "last refreshed" timestamp in schema header for transparency
