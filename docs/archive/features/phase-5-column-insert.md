# Phase 5: Column/Table Click-to-Copy from Schema Panel

**Date**: 2026-02-28
**Status**: Design Phase
**Priority**: Medium

## Problem Statement

The schema panel in the TreeNavigator displays column names and table names when a user selects a table, but these elements are non-interactive. Users must manually type column and table names into the SQL editor, which is error-prone and reduces productivity. There is no way to quickly copy identifiers from the schema panel to the clipboard.

## Proposed Solution

Implement click-to-copy interactions for identifiers in the schema panel to improve discovery and workflow:

1. **Schema Columns**: Single-click a column name in the schema panel to copy to clipboard
2. **Table Names**: Hover over a table name in the tree to reveal a copy icon; click the icon to copy the table name

Both interactions provide immediate visual feedback via toast message and optional CSS flash animation.

## Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `src/components/TreeNavigator/TreeNavigator.tsx` | Add onClick handler to schema columns, add hover-revealed copy icon to table names | Medium - adds interactivity to schema elements |
| `src/App.css` | Add styles for copy icon, hover state, and optional flash animation on schema columns | Low - visual styling only |

## Implementation Details

### 1. Backtick Quoting Utility (TreeNavigator.tsx)

Add a lightweight helper function to quote identifiers containing special characters:

```typescript
/**
 * Quote SQL identifiers if they contain non-alphanumeric chars or start with digit.
 * Matches the pattern: [^a-zA-Z0-9_] or starts with [0-9]
 */
function quoteIdentifierIfNeeded(name: string): string {
  if (/[^a-zA-Z0-9_]/.test(name) || /^[0-9]/.test(name)) {
    return `\`${name}\``;
  }
  return name;
}
```

This ensures that column/table names with spaces, hyphens, or other special characters are wrapped in backticks for SQL compatibility.

### 2. Click-to-Copy on Schema Columns (TreeNavigator.tsx)

**Current Behavior**: Column names in the `.schema-column` rows are static text.

**New Behavior**:
- Each column name becomes clickable
- onClick handler:
  - Gets the column name from the DOM
  - Applies `quoteIdentifierIfNeeded()` to the name
  - Calls `navigator.clipboard.writeText(quotedName)`
  - Triggers visual feedback via `addToast({ type: 'success', message: 'Copied: columnName' })`
  - Optionally adds a 600ms CSS flash (background color) to the `.schema-column` row
- Error handling:
  - Catch clipboard errors and show `addToast({ type: 'error', message: 'Failed to copy' })`
  - Do NOT use console.warn (match ResultsTable pattern)

**Code Pattern**:
```typescript
const handleSchemaColumnClick = async (columnName: string) => {
  const quoted = quoteIdentifierIfNeeded(columnName);
  try {
    await navigator.clipboard.writeText(quoted);
    addToast({ type: 'success', message: `Copied: ${columnName}` });
    // Trigger optional 600ms flash animation on the row
  } catch (err) {
    addToast({ type: 'error', message: 'Failed to copy' });
  }
};
```

### 3. Hover Copy Icon on Table Names (TreeNavigator.tsx)

**Scope**: Tree nodes that represent tables or views should show a copy icon on hover.

**Implementation**:
- In the `.tree-node` row for table/view nodes, add a `<FiCopy>` icon
- Icon is positioned on the right side of the row, only visible on hover
- Icon click handler:
  - Uses `e.stopPropagation()` to prevent triggering the node's `onSelect` or `onToggle`
  - Gets the table/view name from `node.name`
  - Applies `quoteIdentifierIfNeeded(name)`
  - Calls `navigator.clipboard.writeText(quotedName)`
  - Shows toast feedback (success or error)
- Cursor changes to `pointer` on icon hover

**Code Pattern**:
```typescript
const handleTableCopyClick = async (e: React.MouseEvent, tableName: string) => {
  e.stopPropagation();
  const quoted = quoteIdentifierIfNeeded(tableName);
  try {
    await navigator.clipboard.writeText(quoted);
    addToast({ type: 'success', message: `Copied: ${tableName}` });
  } catch (err) {
    addToast({ type: 'error', message: 'Failed to copy' });
  }
};
```

**CSS**: The icon should only appear on hover:
```css
.tree-node .copy-icon {
  display: none;
  cursor: pointer;
  margin-left: auto;
  padding: 0 4px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.tree-node:hover .copy-icon {
  display: flex;
  align-items: center;
}

.tree-node .copy-icon:hover {
  opacity: 1;
}
```

## API Changes

None. No backend changes required.

## Type Changes

None. No new types or state required.

## Acceptance Criteria

- [ ] Clicking a column name in the schema panel copies the backtick-quoted name to clipboard
- [ ] Toast feedback appears on successful copy: "Copied: columnName"
- [ ] Toast error appears on clipboard failure: "Failed to copy"
- [ ] Hovering over a table/view node reveals a copy icon on the right side
- [ ] Clicking the copy icon copies the backtick-quoted table/view name to clipboard
- [ ] Copy icon click does NOT trigger node selection or toggle
- [ ] Names with special characters or starting with digits are wrapped in backticks
- [ ] Simple alphanumeric names (a-z, A-Z, 0-9, _) are NOT quoted
- [ ] No console errors if Clipboard API is unavailable (toast error shown instead)
- [ ] Multiple rapid clicks do not cause errors
- [ ] Schema panel updates do not break click handlers

## Edge Cases

1. **Clipboard API Unavailable**: In HTTP (non-HTTPS) contexts, Clipboard API may be unavailable
   - Show error toast: "Failed to copy"
   - Do not crash the app
   - Do NOT log to console

2. **Rapid Clicks**: User rapidly clicks same or different columns/tables
   - Each click is independent and processed normally
   - Optional flash animation resets for each click
   - No queuing or batching needed

3. **Schema Panel Updates**: While user is hovering or about to click, the schema updates
   - React re-renders the schema panel
   - Click handlers remain attached via `onClick` props
   - No special key management needed (already keyed by `col.name`)

4. **Special Characters in Names**: Column/table names with spaces, quotes, hyphens, etc.
   - Automatically wrapped in backticks by `quoteIdentifierIfNeeded()`
   - Regex: `/[^a-zA-Z0-9_]/.test(name) || /^[0-9]/.test(name)`
   - Example: `my-table` → `` `my-table` ``, `2data` → `` `2data` ``

5. **Tree Node Click vs Copy Icon**: Single-click on tree node already triggers selection/toggle
   - Copy icon click uses `e.stopPropagation()` to prevent bubbling
   - Tree node selection is NOT triggered by copy icon click
   - Only the icon itself is clickable (right-side positioning)

## Testing Strategy

### Unit Tests
- `quoteIdentifierIfNeeded()` function:
  - Alphanumeric names (a-z, A-Z, 0-9, _): no quoting
  - Names with spaces: quoted
  - Names with hyphens: quoted
  - Names starting with digit: quoted
  - Names with quotes or special chars: quoted

### UI Tests (Browser Automation)
- Click column name in schema panel → verify clipboard content matches quoted name
- Hover over table node → verify copy icon appears
- Click copy icon → verify clipboard content matches quoted table name
- Copy icon click does NOT select/toggle the tree node
- Toast success message appears on copy
- Toast error message appears on copy failure
- Multiple rapid clicks work correctly
- Schema panel re-renders do not break handlers

### Edge Case Tests
- Disable Clipboard API (via devtools) → verify error toast appears
- Click column/table with special characters → verify backtick quoting
- Click while schema panel is updating
- Rapid successive clicks on different columns

## Performance Implications

- **Minimal**: Adding onClick handlers and hover styles is trivial
- **Clipboard writes**: Async but fast, no blocking
- **CSS animations**: 600ms flash is GPU-accelerated, no layout impact
- **No re-renders**: Click handlers do not trigger state changes in the store
- **No polling**: Hover effects are pure CSS, no JS overhead

## Future Enhancements

1. **Insert at Cursor**: When editor focus tracking is added (Phase N), modify handler to insert at cursor position instead of just copying
2. **Insert with Alias**: Right-click context menu to insert with alias (e.g., `SELECT column AS alias...`)
3. **Bulk Selection**: Shift+click to select multiple columns and copy as comma-separated list
4. **Drag-and-Drop**: Drag column names to editor to insert

## Rollback Plan

If this feature introduces bugs:
1. Remove onClick handlers from schema column rows in TreeNavigator
2. Remove copy icon and hover styles from table nodes in TreeNavigator
3. Remove `quoteIdentifierIfNeeded()` utility function
4. Revert `App.css` changes (copy icon styles)
5. Revert to previous behavior (non-interactive schema panel)

No data loss or state corruption risk.

## Dependencies

- Existing: React, TypeScript, react-icons (FiCopy), Zustand
- New: None (Clipboard API is standard browser API)

## Effort Estimate

- Design: Complete
- Implementation: 1-2 Haiku agents (small, focused tasks):
  - Task 1: Add quoting utility and schema column click handler to TreeNavigator
  - Task 2: Add hover copy icon to table nodes in TreeNavigator + CSS styles
- QA: 1 Sonnet agent
- UX Review: 1 Sonnet agent
- Total: ~2-3 hours

---

**Next Steps**:
1. Architect Review (system design, state management)
2. Engineer Review (implementation approach, error handling)
3. Revise if needed
4. Implement after both reviews approve
