# Phase 11: Copy Results as Markdown Table

**Date**: 2026-02-28
**Status**: Design Phase
**Owner**: Orchestrator

## Problem Statement

Data engineers working in the Flink SQL Workspace frequently need to share query results with teammates across multiple platforms: Slack messages, GitHub issues, Notion documents, and internal wiki documentation. While the ResultsTable component currently supports exporting data as CSV and JSON files, there is no mechanism to quickly copy results as a markdown table—the de facto standard format for sharing structured data in collaborative tools.

Current workaround: Users must export to CSV, convert manually (often using external tools), or manually format the table in markdown—a tedious, error-prone process. This friction reduces productivity and encourages less sharing of query context.

**Goal**: Enable one-click copy of query results as a markdown table string, respecting all current filtering, sorting, and column visibility settings, with proper handling of special characters and large datasets.

---

## Solution Overview

### Core Feature
Add a "Copy as MD" button to the ResultsTable toolbar (adjacent to the existing Export dropdown) that:
1. Formats the currently visible, filtered, and sorted data as a valid markdown table
2. Respects column visibility settings (`visibleColumnNames`)
3. Respects active sort/filter state (`sortedData`)
4. Includes a row index column as the first column (`#`)
5. Copies the markdown string directly to the system clipboard
6. Displays a success toast on completion or error toast on failure
7. Handles truncation gracefully for tables larger than 100 rows

### Scope
- **In scope**: Markdown table format generation, clipboard copy, toast feedback, respecting current UI state
- **Out of scope**: Exporting markdown to file, advanced markdown features (cell alignment, emphasis), configurable row limits

---

## Files to Modify

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/components/ResultsTable/ResultsTable.tsx` | Enhancement | Add `copyAsMarkdown()` handler and toolbar button |

---

## Implementation Details

### 1. Markdown Table Generation Logic

The function should convert the current table state to a markdown table string following the format:

```
| # | column1 | column2 | column3 |
|---|---------|---------|---------|
| 1 | value1  | value2  | value3  |
| 2 | value4  | value5  | value6  |
| 3 | value7  | value8  | value9  |
```

**Algorithm**:
1. Extract headers from `visibleColumnNames` (the columns the user has not hidden)
2. Prepend a `#` column header for row indexing
3. Generate separator row with appropriate dash count per column
4. Iterate through `sortedData` (respects active sort/filter) and format each row
5. Limit to first 100 rows; if data exceeds this, append footer: `| | *[...N more rows]* | |`
6. Join all rows with newlines
7. Return markdown string

**Pseudo-code**:
```typescript
const copyAsMarkdown = () => {
  if (sortedData.length === 0) {
    addToast({ type: 'error', message: 'No data to copy' });
    return;
  }

  // Guard: check if any columns are visible
  if (!visibleColumnNames || visibleColumnNames.length === 0) {
    addToast({ type: 'error', message: 'No columns to copy' });
    return;
  }

  const headers = ['#', ...visibleColumnNames];
  const markdownLines: string[] = [];

  // Header row
  markdownLines.push('| ' + headers.join(' | ') + ' |');

  // Separator row
  const separators = headers.map((h) => '-'.repeat(Math.max(3, h.length)));
  markdownLines.push('| ' + separators.join(' | ') + ' |');

  // Data rows (max 100)
  const rowsToShow = Math.min(sortedData.length, 100);
  for (let i = 0; i < rowsToShow; i++) {
    const row = sortedData[i];
    // Use originalIndexMap to show correct row numbers matching screen display
    const displayRowNum = originalIndexMap ? originalIndexMap[i] : i + 1;
    const cells = [String(displayRowNum)]; // Row index

    for (const colName of visibleColumnNames) {
      let value = row[colName];

      // Format cell value
      if (value === null || value === undefined) {
        cells.push('null');
      } else if (typeof value === 'object') {
        cells.push(JSON.stringify(value));
      } else {
        cells.push(String(value));
      }
    }

    markdownLines.push('| ' + cells.join(' | ') + ' |');
  }

  // Footer if truncated (must have same column count as header)
  if (sortedData.length > 100) {
    const remaining = sortedData.length - 100;
    const footerCells = Array(headers.length).fill('');
    footerCells[0] = ''; // Empty # column
    footerCells[1] = `*[...${remaining} more rows]*`; // Truncation message in first data column
    markdownLines.push('| ' + footerCells.join(' | ') + ' |');
  }

  const markdown = markdownLines.join('\n');

  // Copy to clipboard
  navigator.clipboard.writeText(markdown)
    .then(() => {
      addToast({
        type: 'success',
        message: `Copied ${rowsToShow} rows as markdown`,
      });
    })
    .catch((err) => {
      console.error('Copy failed:', err);
      addToast({
        type: 'error',
        message: 'Failed to copy to clipboard',
      });
    });
};
```

### 2. Cell Value Formatting Rules

Apply transformations to each cell value in this order:

1. **Null/Undefined Handling**: Convert to literal string `"null"`
2. **Object Serialization**: Call `JSON.stringify(value)` for objects/arrays (single-line, no formatting)
3. **Newline Removal**: Replace all `\n`, `\r`, `\t` with spaces (prevent markdown table corruption)
4. **Pipe Character Escaping**: Replace `|` with `\|` (prevent column delimiter confusion)
5. **Truncation**: If resulting string exceeds 100 characters, slice to 97 chars and append `"..."`
6. **Stringification**: Convert primitives to string

**Implementation**:
```typescript
const formatCellValue = (value: unknown): string => {
  let str: string;

  // Check for null/undefined first
  if (value === null || value === undefined) {
    str = 'null';
  }
  // Check for objects/arrays (including TIMESTAMP objects)
  else if (typeof value === 'object') {
    // Format TIMESTAMP objects readably in ISO format if available
    if (value instanceof Date) {
      str = value.toISOString();
    } else {
      str = JSON.stringify(value);
    }
  }
  // Default to string conversion for primitives
  else {
    str = String(value);
  }

  // Remove newlines/tabs
  str = str.replace(/[\n\r\t]/g, ' ');

  // Escape pipe characters
  str = str.replace(/\|/g, '\\|');

  // Truncate to 100 chars
  if (str.length > 100) {
    str = str.substring(0, 97) + '...';
  }

  return str;
};
```

### 3. Toolbar Button

Add a button to the ResultsTable toolbar (same location as the existing Export dropdown):

**Position**: Immediately after or adjacent to the Export dropdown
**Icon**: Use `FiClipboard` from `react-icons/fi` (consistent with existing icon usage)
**Disabled State**: Button should be disabled when `sortedData.length === 0`
**Label**: "Copy as MD" or tooltip showing "Copy as Markdown"
**Interaction**: On click, immediately invoke `copyAsMarkdown()` (no confirmation dialog)

**JSX Example**:
```tsx
import { FiClipboard } from 'react-icons/fi';

<button
  onClick={copyAsMarkdown}
  disabled={sortedData.length === 0 || !visibleColumnNames || visibleColumnNames.length === 0}
  title="Copy as Markdown"
  className="export-btn"
>
  <FiClipboard className="inline mr-1" />
  Copy as MD
</button>
```

### 4. Respecting Current State

The function must use:
- **`sortedData`**: Already contains applied filters and sorts
- **`visibleColumnNames`**: Array of currently visible column names (excludes hidden columns)
- **`addToast()`**: Existing toast function from zustand store

This ensures the copied markdown exactly matches what the user sees on screen.

---

## Acceptance Criteria

### Core Functionality
- [ ] Button appears in ResultsTable toolbar, right of Export dropdown
- [ ] Button is disabled when `sortedData.length === 0` or `visibleColumnNames.length === 0`
- [ ] Button uses `export-btn` CSS class (matching existing export button pattern)
- [ ] On click, markdown table is generated with correct format (headers, separators, data rows)
- [ ] Markdown string is copied to clipboard without errors
- [ ] Success toast displays message like "Copied 50 rows as markdown"
- [ ] Error toast displays on clipboard copy failure

### Format Correctness
- [ ] Header row includes `#` column followed by visible column names
- [ ] Separator row has dashes matching header spacing and column count
- [ ] Data rows are correctly indexed using `originalIndexMap` (matching screen display)
- [ ] Footer row (if truncated) has same number of columns as header
- [ ] Row count in toast matches rows actually copied
- [ ] Markdown is valid and renders correctly when pasted into Slack, GitHub, Notion

### State Respect
- [ ] When columns are hidden via UI, hidden columns do not appear in markdown
- [ ] Active sort order is reflected in markdown row order
- [ ] Active search filter is respected (only filtered rows copied)
- [ ] Only filtered, visible columns and sorted rows appear in output

### Data Handling
- [ ] Null/undefined values display as `"null"` (checked first in formatCellValue)
- [ ] Date/TIMESTAMP objects are formatted as ISO strings (readably)
- [ ] Other objects/arrays are JSON-stringified inline
- [ ] Cell values with `|` characters are escaped as `\|`
- [ ] Newlines/tabs in cell values are replaced with spaces
- [ ] Cell values longer than 100 chars are truncated with `...`

### Truncation
- [ ] Tables with ≤100 rows show all rows, no footer message
- [ ] Tables with >100 rows show first 100 rows + footer: `*[...N more rows]*`
- [ ] Footer row has same number of columns as header (no broken table structure)

### Edge Cases Handled
- [ ] Empty table (0 rows) → button disabled, no action on click
- [ ] Single row → renders correctly
- [ ] Single column → renders correctly
- [ ] Very wide table (20+ columns) → renders correctly (wide markdown output)
- [ ] Very long cell values → truncated cleanly without corrupting markdown
- [ ] Special characters (quotes, backslashes, unicode) → preserved or escaped safely

### Toast Feedback
- [ ] Success toast shows number of rows copied
- [ ] Error toast on clipboard failure with clear message
- [ ] Toasts display for same duration as existing copy toast (standard duration)

---

## Edge Cases & Error Handling

### 1. Empty or Null Data
**Case**: `sortedData.length === 0`
**Behavior**: Button disabled, no action on click, no toast
**Rationale**: Nothing to copy; prevents confusing empty markdown

### 2. No Visible Columns
**Case**: All columns hidden (should not happen in normal flow, but defensible)
**Behavior**: Button disabled/hidden, show error toast "No columns to copy" if user somehow triggers action
**Rationale**: Graceful degradation; button already guarded by `visibleColumnNames.length === 0` check

### 3. Cell Value with Pipe Character
**Case**: `value = "foo | bar"`
**Behavior**: Escape as `foo \| bar` in markdown output
**Rationale**: Prevent markdown table parser confusion

### 4. Cell Value with Newlines
**Case**: `value = "line1\nline2\nline3"`
**Behavior**: Replace newlines with spaces → `"line1 line2 line3"`
**Rationale**: Preserve content while keeping markdown table structure valid

### 5. Large Cell Values (>100 chars)
**Case**: `value = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua"`
**Behavior**: Truncate to 97 chars + `"..."` → `"Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt..."`
**Rationale**: Prevent excessively wide markdown tables in tools like Slack

### 6. Large Datasets (>100 rows)
**Case**: `sortedData.length === 150`
**Behavior**: Copy first 100 rows, append footer `*[...50 more rows]*`, display toast "Copied 100 rows as markdown"
**Rationale**: Clipboard size/readability limits; footer indicates truncation

### 7. Clipboard API Unavailable
**Case**: Browser doesn't support Clipboard API or permission denied
**Behavior**: Catch error, display toast "Failed to copy to clipboard"
**Rationale**: User knows action didn't succeed

### 8. Object/Array Cell Values
**Case**: `value = { nested: { key: "value" } }` or `[1, 2, 3]`
**Behavior**: `JSON.stringify(value)` → single-line JSON in cell
**Rationale**: Preserves data structure readably; user can expand later if needed

### 9. Numeric Precision Loss
**Case**: Very large numbers (>2^53) or floats with rounding
**Behavior**: String conversion as-is (no special handling)
**Rationale**: Markdown tables are text-based; no precision loss in copy operation

### 10. Unicode and Special Characters
**Case**: Emoji, non-Latin scripts, mathematical symbols in cell values
**Behavior**: Preserved as-is in markdown string
**Rationale**: Markdown and modern browsers handle UTF-8 safely

---

## Testing Strategy

### Unit Tests (if applicable)
- Test `formatCellValue()` with each transformation type
- Test markdown generation with mock data
- Test truncation at 100-row boundary
- Test special character escaping

### Integration Tests
- Copy empty table → button disabled, no action
- Copy single row → correct markdown format
- Copy 50 rows with mixed data types → all rows included, all formats correct
- Copy 150 rows → first 100 copied, footer appended
- Hidden columns → not included in markdown
- Active sort → respected in markdown row order
- Active search filter → only matching rows copied
- All special character cases: pipes, newlines, unicode

### Manual QA Steps
1. **Basic Copy**
   - Execute a query with 10 results
   - Click "Copy as MD" button
   - Paste into text editor
   - Verify markdown table renders correctly

2. **Column Hiding**
   - Execute query with 5 columns
   - Hide 2 columns via UI
   - Click "Copy as MD"
   - Verify only 3 visible columns + `#` appear in markdown

3. **Filtering & Sorting**
   - Execute query with 50 results
   - Apply search filter → 25 matching results
   - Apply sort order
   - Click "Copy as MD"
   - Verify markdown has 25 rows in sorted order

4. **Large Dataset**
   - Execute query with 150 results
   - Click "Copy as MD"
   - Verify toast shows "Copied 100 rows as markdown"
   - Verify markdown has exactly 100 data rows + footer

5. **Special Characters**
   - Insert test data with pipes, newlines, unicode, long strings
   - Copy as markdown
   - Verify rendering in Slack, GitHub, Notion (if available)

6. **Clipboard Failure** (if testable)
   - Simulate clipboard permission denied
   - Click "Copy as MD"
   - Verify error toast appears

### Cross-Platform Testing
- Test on Chrome, Firefox, Safari (clipboard API support varies)
- Test paste in Slack, GitHub Issues, Notion, VS Code (markdown rendering)

---

## Technical Considerations

### Performance
- Markdown generation is O(n*m) where n = rows, m = columns (acceptable for <100 rows shown)
- Clipboard API is async; use `.then()/.catch()` pattern to handle completion
- No re-renders needed; toast feedback is independent

### Browser Compatibility
- `navigator.clipboard.writeText()` requires HTTPS or localhost
- Graceful error handling for older browsers without Clipboard API
- Fallback: could implement `document.execCommand('copy')` as fallback if needed (not required for initial version)

### Accessibility
- Button should have clear label/tooltip
- Toast announcement for feedback
- Disabled state clear to screen readers

### UX Polish
- No loading state needed (clipboard copy is immediate)
- No confirmation dialog (one-click action, not destructive)
- Toast auto-dismisses after 3-4 seconds
- Icon + text label on button for clarity

---

## Rollout Plan

1. **Design Review**: Architect and Engineer review this PRD for feasibility and integration
2. **Implementation**: Single haiku subagent implements button + markdown logic in ResultsTable.tsx
3. **QA Validation**: Sonnet QA agent verifies all acceptance criteria and edge cases
4. **UX Review**: Sonnet UX agent checks consistency and polish
5. **Docs & Commit**: Update feature PRD with implementation notes, commit to master

---

## Appendix: Example Markdown Output

### Simple Table (3 rows, 4 columns)
```
| # | id | name      | status    |
|---|----|-----------|-----------|
| 1 | 1  | Alice     | COMPLETED |
| 2 | 2  | Bob Smith | RUNNING   |
| 3 | 3  | Charlie   | PENDING   |
```

### Table with Special Characters
```
| # | query             | result                    |
|---|-------------------|---------------------------|
| 1 | SELECT * \| WHERE | 5 \| 10 \| 15 rows found |
| 2 | UPDATE tbl SET... | Affected 100 rows         |
```

### Large Table (101 rows, truncated)
```
| # | value | timestamp           |
|---|-------|---------------------|
| 1 | 100   | 2026-02-28T10:00:00Z |
| 2 | 101   | 2026-02-28T10:01:00Z |
| ... (98 more rows) ...
| 100 | 199   | 2026-02-28T11:39:00Z |
| | *[...1 more rows]* | |
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-28
