# Phase 11: SQL Formatter (Format on Command)

**Date**: 2026-02-28
**Status**: Design Phase
**Author**: Opus (Orchestrator)

## Problem Statement

Users writing SQL queries in the Flink SQL Workspace editor often create messy, inconsistently formatted code. Without built-in formatting, queries become hard to read, especially complex ones with multiple joins, subqueries, and clauses. Users must manually clean up formatting or work with poorly formatted code. This reduces readability and increases cognitive load when debugging or reviewing SQL statements.

## Solution Overview

Implement a SQL formatter that provides one-command formatting of SQL code in the editor. The formatter will:

1. **Auto-uppercase SQL keywords** for consistency and readability
2. **Add strategic newlines** before major clauses (FROM, WHERE, JOIN, GROUP BY, etc.)
3. **Normalize whitespace** by collapsing multiple spaces and trimming
4. **Preserve code integrity** by protecting string literals, comments, and identifiers
5. **Integrate with Monaco editor** via a keyboard shortcut (Shift+Alt+F) and toolbar button
6. **Provide visual feedback** with a toast notification

### Example Transformation

**Before:**
```sql
select name, count(*) as cnt from users where status='active' group by name order by cnt desc
```

**After:**
```sql
SELECT name, count(*) as cnt
FROM users
WHERE status = 'active'
GROUP BY name
ORDER BY cnt DESC
```

## Files to Modify

| File | Type | Purpose |
|------|------|---------|
| `src/utils/sqlFormatter.ts` | **NEW** | Core formatSQL pure function |
| `src/components/EditorCell/EditorCell.tsx` | MODIFY | Register Monaco action, add toolbar button |
| `src/App.css` | MODIFY (Optional) | Button styling if needed |

## Implementation Details

### 1. Core Formatter Function (`src/utils/sqlFormatter.ts`)

A pure function `formatSQL(code: string): string` that:

**Input**: Raw SQL string
**Output**: Formatted SQL string
**Side Effects**: None

```typescript
/**
 * Formats SQL code by uppercasing keywords, adding newlines before clauses,
 * and normalizing whitespace while preserving string literals and comments.
 */
export function formatSQL(code: string): string {
  if (!code || !code.trim()) return code;

  // Implementation logic:
  // 1. Tokenize preserving string literals and comments
  // 2. Uppercase keywords while preserving quoted content
  // 3. Insert newlines before major clauses
  // 4. Normalize whitespace
  // 5. Return formatted string
}
```

#### Algorithm Approach

1. **Preserve Protected Regions**:
   - Identify and extract string literals (`'...'`, `"..."`)
   - Identify and extract comments (`--...`, `/* ... */`)
   - Identify and extract backtick identifiers (`` `...` ``)
   - Replace with placeholders: `__STRING_0__`, `__COMMENT_0__`, `__IDENTIFIER_0__`

2. **Process Main Content**:
   - Split by whitespace and keywords
   - Uppercase SQL keywords from the predefined list
   - Collect text into tokens

3. **Insert Newlines**:
   - Before major clause keywords: FROM, WHERE, JOIN variants, GROUP BY, ORDER BY, HAVING, LIMIT, UNION, EXCEPT, INTERSECT
   - After closing parentheses of major subqueries (heuristic: `)` followed by non-comma char)

4. **Normalize Whitespace**:
   - Collapse multiple consecutive spaces to single space
   - Trim leading/trailing whitespace
   - Preserve meaningful newlines

5. **Restore Protected Regions**:
   - Replace placeholders back with original content

#### SQL Keywords to Uppercase

```typescript
const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'ALTER', 'DROP', 'SHOW', 'DESCRIBE', 'EXPLAIN',
  'WITH', 'AS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
  'BETWEEN', 'LIKE', 'IS', 'NULL', 'TRUE', 'FALSE',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'DISTINCT',
  'TABLE', 'VIEW', 'INDEX', 'FUNCTION',
  'LATERAL', 'TUMBLE', 'HOP', 'CUMULATE', 'SESSION',
  'WATERMARK', 'PROCTIME', 'ROWTIME', 'TIME', 'TIMESTAMP',
  'MATCH_RECOGNIZE',
]);
```

#### Newline Insertion Keywords

```typescript
const NEWLINE_BEFORE = new Set([
  'FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'INTERSECT', 'EXCEPT',
  'MATCH_RECOGNIZE',
]);
```

**Critical Handling - Multi-word Keywords**:

The formatter MUST treat the following as atomic units and insert newlines only when the complete phrase is present:
- `LEFT JOIN`, `RIGHT JOIN`, `INNER JOIN`, `OUTER JOIN`, `CROSS JOIN`, `FULL JOIN`
- `GROUP BY`, `ORDER BY`
- `LATERAL TABLE`, `LATERAL JOIN`
- `MATCH_RECOGNIZE`

**Lookahead Rules for Single-word Keywords**:
- `LEFT`, `RIGHT`, `INNER`, `OUTER`, `CROSS`, `FULL` → Insert newline ONLY if followed by `JOIN`. Otherwise preserve inline (e.g., in window functions: `TUMBLE`, `HOP`, `SESSION`).
- `WITH` → Do NOT insert newline before (used in CTEs and inline clauses like `WITH (property = value)`).
- `WINDOW` → Do NOT insert newline before (used as inline window clause modifier, e.g., `TUMBLE WINDOW`).

**Pre-processing Step** (before applying NEWLINE_BEFORE rules):
Join these multi-word phrases into single tokens so they're treated atomically:
```
LEFT JOIN → LEFT_JOIN
RIGHT JOIN → RIGHT_JOIN
INNER JOIN → INNER_JOIN
OUTER JOIN → OUTER_JOIN
CROSS JOIN → CROSS_JOIN
FULL JOIN → FULL_JOIN
GROUP BY → GROUP_BY
ORDER BY → ORDER_BY
LATERAL TABLE → LATERAL_TABLE
LATERAL JOIN → LATERAL_JOIN
MATCH_RECOGNIZE → MATCH_RECOGNIZE
```

Then apply newline rules. When writing output, restore underscores to spaces.

### 2. Monaco Editor Integration (`src/components/EditorCell/EditorCell.tsx`)

#### A. Register Format Action

Register a Monaco editor action on component mount. Use `editorRef` (not `monacoRef`) which is the existing pattern in EditorCell. Use `editor.executeEdits()` to preserve undo history and avoid store desync.

```typescript
// In EditorCell.tsx useEffect hook for action registration
useEffect(() => {
  const editor = editorRef.current;
  if (!editor) return;

  // Register format action
  const actionDisposal = editor.addAction({
    id: `sql-formatter.format-${statement.id}`, // Unique ID per editor instance
    label: 'Format SQL',
    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
    contextMenuGroupId: '1_modification',
    run: (editor) => {
      const sql = editor.getValue();
      const formatted = formatSQL(sql);

      if (formatted !== sql) {
        // Use executeEdits instead of setValue to preserve undo history
        const fullRange = editor.getModel()?.getFullModelRange();
        if (fullRange) {
          editor.executeEdits('sql-formatter', [{
            range: fullRange,
            text: formatted,
          }]);
          editor.pushUndoStop(); // Create undo checkpoint
        }

        // DO NOT dispatch to store here - onChange handler will update it automatically
        showToast('SQL formatted', 'success');
      }
    },
  });

  // Dispose action on unmount to prevent memory leaks
  return () => {
    actionDisposal.dispose();
  };
}, [statement.id, showToast]);
```

**Critical Notes**:
- Use `editorRef.current` (existing pattern), NOT `monacoRef.current` (doesn't exist)
- Use `editor.executeEdits()` with `editor.pushUndoStop()` to preserve undo/redo history
- Do NOT call `editor.setValue()` - it breaks undo history and causes store desync
- Do NOT manually dispatch to store - the Monaco `onChange` handler will update state automatically when `executeEdits()` triggers it
- Include `statement.id` in action ID to ensure uniqueness per editor instance
- Always dispose the action on unmount to prevent memory leaks

#### B. Add Toolbar Button

Add a "Format" button in the cell header (next to existing Duplicate button). Use the same `editor.executeEdits()` pattern as the keyboard action:

```typescript
// In EditorCell.tsx JSX header area
<button
  onClick={() => {
    const editor = editorRef.current;
    if (!editor) return;

    const sql = editor.getValue();
    const formatted = formatSQL(sql);

    if (formatted !== sql) {
      // Use executeEdits to preserve undo history and trigger onChange
      const fullRange = editor.getModel()?.getFullModelRange();
      if (fullRange) {
        editor.executeEdits('sql-formatter', [{
          range: fullRange,
          text: formatted,
        }]);
        editor.pushUndoStop(); // Create undo checkpoint
      }

      // Show toast
      showToast('SQL formatted', 'success');
    }
  }}
  title="Format SQL (Shift+Alt+F)"
  className="icon-btn"
  disabled={!statement.code?.trim()} // Disable if no code
>
  ✨ Format
</button>
```

**Notes**:
- Use `editorRef.current` to access editor instance
- Use same `executeEdits()` + `pushUndoStop()` pattern as keyboard action
- Do NOT call `editor.setValue()` or manually dispatch to store
- Disable button if code is empty/whitespace-only
- Toast notification provides user feedback

### 3. Toast Notification

Assume a `showToast(message: string, type: string)` function exists in store or utils. If not, create a simple toast system or integrate with existing notification mechanism.

## Acceptance Criteria

### Functional
- [ ] `formatSQL()` function is pure (no side effects, deterministic output)
- [ ] Keyboard shortcut Shift+Alt+F triggers formatting in focused editor cell
- [ ] Format button appears in cell header and triggers formatting when clicked
- [ ] SQL keywords are uppercased correctly
- [ ] Newlines are inserted before major clauses (FROM, WHERE, JOIN, GROUP BY, ORDER BY, HAVING, LIMIT, UNION, EXCEPT, INTERSECT)
- [ ] Whitespace is normalized (multiple spaces → single space)
- [ ] String literals are preserved (content inside quotes unchanged)
- [ ] SQL comments (-- and /* */) are preserved
- [ ] Backtick identifiers are protected from uppercasing
- [ ] Toast notification "SQL formatted" appears on successful format
- [ ] No external npm dependencies added

### Edge Cases
- [ ] Empty code or whitespace-only code → no change
- [ ] Already-formatted code → idempotent (formatting twice produces same result)
- [ ] Multi-statement SQL (semicolon-separated) → formats each statement
- [ ] Nested subqueries with parentheses → preserves structure
- [ ] Complex JOINs (LEFT, RIGHT, INNER, OUTER, CROSS, FULL) → multi-word keywords treated as atomic units, newline before complete phrase
- [ ] JOIN keyword lookahead → `LEFT`, `RIGHT`, `INNER`, `OUTER`, `CROSS`, `FULL` alone do NOT trigger newline, only when followed by `JOIN`
- [ ] GROUP BY and ORDER BY → treated as atomic multi-word units, never split
- [ ] LATERAL TABLE and LATERAL JOIN → treated as atomic units
- [ ] MATCH_RECOGNIZE → handled as single keyword
- [ ] Window functions (TUMBLE, HOP, SESSION) → preserved inline, not preceded by newline
- [ ] CTEs with WITH clause → WITH keyword preserved inline, not preceded by newline
- [ ] Window definitions → WINDOW keyword preserved inline, not preceded by newline
- [ ] String literals containing keywords → don't uppercase
- [ ] Backtick identifiers containing reserved words → don't uppercase
- [ ] Comments with SQL-like syntax → preserved as-is
- [ ] Mixed case keywords (SeLeCt) → normalized to uppercase
- [ ] Trailing semicolons → preserved
- [ ] Cursor position → restored to a reasonable location after formatting (e.g., start of line or end of first clause)

### Performance
- [ ] Formatting should be near-instant (< 100ms) for queries up to 10,000 characters
- [ ] No lag when clicking format button or pressing shortcut

### UX
- [ ] Button is visible and intuitively labeled or iconified
- [ ] Keyboard shortcut is discoverable (tooltip, menu, docs)
- [ ] Toast feedback confirms action occurred
- [ ] No unexpected changes to working code

## Edge Cases & Handling

| Edge Case | Behavior |
|-----------|----------|
| Empty or null code | Return unchanged |
| Code with only whitespace | Return unchanged |
| Already formatted code | Idempotent (no change if formatted again) |
| Multi-statement (`;` separated) | Format each statement independently, preserve separators |
| String with SQL keywords: `'SELECT * FROM table'` | Preserve content, don't uppercase inside quotes |
| Comments: `-- SELECT FROM WHERE` | Preserve as-is, don't uppercase |
| Block comments: `/* SELECT FROM */` | Preserve as-is |
| Backtick identifiers: `` `SELECT` `` | Don't uppercase content inside backticks |
| Complex nested subqueries | Preserve all parentheses and structure, add newlines appropriately |
| JOIN variants: `LEFT JOIN`, `RIGHT OUTER JOIN`, `FULL JOIN` | Pre-process to atomic tokens (e.g., `LEFT_JOIN`), treat as units, newline before entire phrase |
| GROUP BY / ORDER BY | Pre-process to atomic tokens (`GROUP_BY`, `ORDER_BY`), treat as units, never split across lines |
| LATERAL TABLE / LATERAL JOIN | Pre-process to atomic tokens, treat as units |
| MATCH_RECOGNIZE | Treat as single keyword, insert newline before |
| Window functions: `TUMBLE(...)`, `HOP(...)`, `SESSION(...)` | Preserve inline, no newline inserted |
| CTE clauses: `WITH (...) AS` | Preserve WITH inline, no newline before WITH |
| Window definitions: `WINDOW ... AS` | Preserve WINDOW inline, no newline before WINDOW |
| LEFT/RIGHT/INNER/OUTER/CROSS/FULL without JOIN | Do NOT insert newline, preserve inline |
| LEFT/RIGHT/INNER/OUTER/CROSS/FULL followed by JOIN | Insert newline before the complete phrase |
| Trailing spaces/tabs | Trim trailing whitespace on each line |
| Mixed case keywords: `SeLeCt` | Normalize to uppercase: `SELECT` |
| Trailing semicolon | Preserve and keep on same line as last clause |
| Arithmetic/operators: `col1+col2` | No spaces added around operators (keep as-is) |
| Cursor position after format | Restore to a reasonable position (e.g., start of formatted code) |

## Testing Strategy

### Unit Tests (for `formatSQL()`)

Test each aspect independently:

1. **Keyword Uppercasing**
   - Input: `select * from users`
   - Expected: `SELECT * FROM users`

2. **Clause Newlines**
   - Input: `select * from users where id = 1 order by name`
   - Expected:
     ```
     SELECT *
     FROM users
     WHERE id = 1
     ORDER BY name
     ```

3. **String Literal Preservation**
   - Input: `select 'select' from users where name = 'john'`
   - Expected: Keywords outside quotes uppercased, inside preserved

4. **Comment Preservation**
   - Input: `select * -- select from where\nfrom users`
   - Expected: Keywords in main query uppercased, comment untouched

5. **Backtick Identifier Preservation**
   - Input: ``select `SELECT` from `USERS` ``
   - Expected: Backtick content unchanged, `from` uppercased to `FROM`

6. **Multi-statement**
   - Input: `select 1; select 2;`
   - Expected: Both statements formatted independently

7. **Idempotency**
   - Apply formatter twice, output should be identical

### Integration Tests (Monaco + UI)

1. **Keyboard Shortcut**
   - Focus editor cell
   - Press Shift+Alt+F
   - Verify code is formatted

2. **Format Button**
   - Click "Format" button in cell header
   - Verify code is formatted

3. **Toast Notification**
   - After formatting, verify "SQL formatted" toast appears

4. **Store Update**
   - After formatting, verify statement code in Zustand store is updated
   - Verify no other statements are affected

### Manual Testing Scenarios

1. **Real-world query**: Paste multi-join query, verify readability improves
2. **User workflow**: Write messy query, press Shift+Alt+F, verify immediate feedback
3. **No false positives**: Format a query with string literals, ensure no corruption
4. **Performance**: Format a large query (10,000 chars), measure time

## Implementation Notes

- **Zero dependencies**: Use only JavaScript string methods, regex, and Set for lookups
- **Pure function first**: Implement `formatSQL()` independently before integrating with UI
- **Test-driven**: Write unit tests for `formatSQL()` before hooking up Monaco
- **Incremental integration**: Get format button working before adding keyboard shortcut
- **Preservation rules**: String literals and comments are critical—test extensively
- **Multi-word keyword pre-processing**: Before applying NEWLINE_BEFORE rules, join multi-word phrases into atomic tokens (e.g., `LEFT_JOIN`), then restore spaces in output
- **Action disposal**: Always dispose Monaco actions on component unmount to prevent memory leaks
- **Editor mutation**: Use `editor.executeEdits()` + `editor.pushUndoStop()` for all mutations. NEVER use `editor.setValue()` as it breaks undo history and causes store desync
- **Store updates**: Do NOT manually dispatch store updates. The Monaco `onChange` handler will update state automatically when `executeEdits()` triggers it
- **Action uniqueness**: Include `statement.id` in action ID to ensure uniqueness per editor instance
- **Cursor restoration**: After formatting with `executeEdits()`, consider restoring cursor position to a meaningful location (e.g., end of SELECT clause or start of code)

## Success Metrics

- Users can format SQL with one keystroke (Shift+Alt+F) or button click
- Formatter handles 99% of Flink SQL syntax without corrupting code
- Zero external dependencies added
- < 50ms formatting time for queries under 10,000 characters
- Toast feedback confirms user intent was executed

## Future Considerations

- Config options for formatting style (indent width, line length limits)
- Integration with Prettier or similar (if user requests it later, would require npm dep)
- Per-statement formatting (if multi-statement handling becomes complex)
- Undo/redo support (already handled by Monaco editor)
- Format on save (optional post-MVP feature)
