# Phase 5: SQL Autocomplete / Intellisense for Monaco Editor

**Status**: Design Phase
**Date**: 2026-02-28

## Problem Statement

Users currently have no intelligent code completion in the Monaco SQL editor. They must manually type table and column names from memory, or frequently switch to the sidebar tree to look up exact names. This breaks the editing flow and increases cognitive load, especially when working with databases containing many tables or deeply nested schemas.

The catalog data (databases, tables, columns) is already available in the Zustand store (`treeNodes` and `selectedTableSchema`) and can be fetched via the `getTableSchema()` API, but it is not exposed to the editor as completions.

## Proposed Solution

Register a Monaco `CompletionItemProvider` for the SQL language that provides:

1. **SQL Keywords**: Flink-specific keywords that Monaco's built-in SQL mode does not provide (windowing, temporal, DDL, SHOW commands, etc.). Standard SQL keywords like SELECT, FROM, WHERE, JOIN are already handled by Monaco and will NOT be duplicated.

2. **Table Names & Views**: All tables and views from the catalog tree in `treeNodes`, extracted by walking the tree structure and filtering for nodes where `['table', 'view', 'externalTable'].includes(node.type)`

3. **Column Names**: Column suggestions from any cached schema data in `selectedTableSchema` or previously cached schemas

4. **Range Support**: Every completion item includes a `range` property for proper text replacement during acceptance

## Implementation Details

### Files to Modify

- **`src/components/EditorCell/EditorCell.tsx`**
  - Register the completion provider in the `handleEditorMount` callback
  - Extract helper functions to collect table names and prepare completion items
  - Ensure provider registration happens exactly once (globally, not per-editor mount)

### Provider Registration Strategy (Disposable Pattern)

- Use `monaco.languages.registerCompletionItemProvider('sql', providerConfig)` which returns an `IDisposable`
- Store the disposable at module-level: `let completionProviderDisposable: monaco.IDisposable | null = null`
- In `handleEditorMount`, dispose any previous registration before creating a new one:
  ```typescript
  if (completionProviderDisposable) {
    completionProviderDisposable.dispose();
  }
  completionProviderDisposable = monaco.languages.registerCompletionItemProvider('sql', provider);
  ```
- This ensures proper cleanup during Vite HMR and prevents duplicate providers

### Completion Logic

```
provideCompletionItems(model, position, context, cancelToken):
  1. Get word being completed via model.getWordUntilPosition(position)
  2. Compute range for replacement:
     - startColumn = word.startColumn
     - endColumn = word.endColumn
     - lineNumber = position.lineNumber
  3. Read store state: useWorkspaceStore.getState() (synchronous, no race conditions)
  4. Extract table/view/externalTable names via helper function (recursive tree walk)
  5. Extract column names via helper function (from selectedTableSchema.columns if available)
  6. Build completion items array with range and kind:
     - Flink SQL keywords with CompletionItemKind.Keyword
     - Table names with CompletionItemKind.Class
     - Views with CompletionItemKind.Interface
     - Column names with CompletionItemKind.Field
  7. Return { suggestions: items }
```

### Keyword List (Flink SQL Only)

Only include keywords that Monaco's built-in SQL mode does not provide:

```
TUMBLE, HOP, CUMULATE, SESSION (windowing functions)
MATCH_RECOGNIZE, WATERMARK, LATERAL TABLE
PROCTIME(), ROWTIME(), CURRENT_WATERMARK (temporal functions)
SHOW CATALOGS, SHOW DATABASES, SHOW TABLES, SHOW VIEWS, SHOW JOBS
SET, RESET, EXPLAIN, CALL (Flink DDL/control)
EXECUTE STATEMENT SET, END
DESCRIPTOR, TABLESAMPLE
```

**Note**: Standard SQL keywords (SELECT, FROM, WHERE, GROUP BY, ORDER BY, LIMIT, JOIN, etc.) are already provided by Monaco and should NOT be duplicated.

### Data Extraction (Helper Functions)

Extract tree walk and column extraction into separate helper functions (colocated in EditorCell.tsx or a utils file):

**Helper: extractTableNames(treeNodes)**:
- Walk tree recursively (depth-first)
- Collect all nodes where `['table', 'view', 'externalTable'].includes(node.type)`
- Return array of table/view names
- Optionally prefix with parent database name for disambiguation (e.g., `'db1.users'`)
- Example: if treeNodes has `[{ id: 'db1', type: 'database', children: [{ id: 'users', type: 'table' }] }]`, extract `['users']` or `['db1.users']`

**Helper: extractColumnNames(selectedTableSchema)**:
- Access the `columns` array from selectedTableSchema
- If present and has `columns: [{ name, type }, ...]`, extract all column names
- Return array of column names
- Example: `['id', 'name', 'email', 'created_at']`
- If no schema cached, return empty array

### Concurrency & Race Conditions

- `useWorkspaceStore.getState()` returns a synchronous snapshot of state at the moment of call
- No async/await or promise-based operations in the provider callback
- Therefore, no race conditions are possible when reading treeNodes and selectedTableSchema

### Error Handling

- Wrap store access in try-catch to handle undefined/null store state
- If `treeNodes` is undefined or null, return empty array (no table suggestions)
- If `selectedTableSchema` is undefined, skip column suggestions
- Never throw; always return valid completion array (may be empty)

## Type Changes

No new types needed. Use existing Monaco types:
- `monaco.languages.CompletionItemProvider<monaco.languages.CompletionItem>`
- `monaco.languages.CompletionItem`
- `monaco.languages.CompletionItemKind`

## API Changes

None. This feature is purely UI-side, reading existing store data and not making new API calls.

Future optimization: could call `getTableSchema()` to populate completions for tables the user hasn't clicked yet, but this is deferred for Phase 6.

## Acceptance Criteria

- [ ] Typing in the SQL editor shows Flink SQL keyword suggestions (TUMBLE, HOP, MATCH_RECOGNIZE, etc.)
- [ ] Typing a partial table name shows matching table names from the catalog
- [ ] Typing a partial view name shows matching views from the catalog
- [ ] Table names from all databases in the tree appear in suggestions
- [ ] Column names appear in suggestions after a table has been clicked in the sidebar
- [ ] Completion items have correct kind icons (keyword, class, interface for views, field)
- [ ] Each completion item includes a `range` property for proper text replacement
- [ ] No duplicate completion items are shown
- [ ] Provider disposable is properly cleaned up on mount/unmount and Vite HMR
- [ ] Provider gracefully handles undefined `treeNodes` or `selectedTableSchema` without throwing
- [ ] Completions work in all cursor positions within the editor

## Edge Cases

1. **Tree not yet loaded**: `treeNodes` is empty or undefined
   - Behavior: Return Flink keywords only, no table/view names
   - Test: Mount editor before loading catalog

2. **No schema cached**: User hasn't clicked any table yet
   - Behavior: Show keywords and table/view names, but no column names
   - Test: Type a partial table name without clicking sidebar

3. **Multiple databases with same table name**:
   - Behavior: Display both with database prefix (e.g., `db1.users`, `db2.users`)
   - Test: Create test tree with duplicate table names in different databases

4. **Special characters in names**: Tables/views with hyphens, underscores, or spaces
   - Behavior: Handle properly in suggestions (Monaco's fuzzy filter handles edge cases)
   - Test: Verify names with special chars are properly extracted and suggested

5. **Views and external tables**: Mixed with regular tables
   - Behavior: All three node types appear in completions with appropriate icons
   - Test: Create tree with tables, views, and externalTable nodes; verify all appear

6. **Very large catalogs**: 1000+ tables/views
   - Behavior: Completions remain performant (filtering is fast in-memory)
   - Test: Mock a large treeNodes structure

7. **Vite HMR during development**: Component hot-reloads
   - Behavior: Old disposable is cleaned up before registering new provider
   - Test: Edit source, verify no duplicate providers or memory leaks

8. **Store not accessible**: Zustand store is undefined
   - Behavior: Provider still works, returns keywords and empty table/column lists
   - Test: Ensure try-catch prevents crashes

9. **RangeError on very long files**: Editor with 10k+ lines
   - Behavior: No performance degradation; completions return instantly
   - Test: Performance test with large SQL files

10. **Known limitation - Table completions accuracy**: Table completions are best-effort based on expanded tree state
    - Only tables/views whose parent nodes have been expanded in the sidebar are present
    - Lazy-loaded children not yet fetched will not appear in completions
    - Behavior: Suggest tables that user has expanded; other tables require sidebar navigation to populate
    - Test: Verify suggestions match expanded tree state

11. **Known limitation - Column context**: Column suggestions are not per-query context-aware
    - Only columns from the last-clicked table appear (from selectedTableSchema)
    - No analysis of SELECT ... FROM clause to determine current context
    - Behavior: Show all columns from cached schema; user relies on typing to filter
    - Test: Click table A, type column name, verify columns from table A appear

## Performance Considerations

- **On-demand computation**: Extract table/column names only when `provideCompletionItems` is called
- **In-memory tree walk**: Tree is already in store, no API calls
- **Filtering**: Monaco handles filtering via fuzzy match; we just return all suggestions
- **Memory**: Completion items are lightweight objects; disposable cleanup ensures no memory leaks
- **Debouncing**: Monaco handles debounce of completion triggers; we don't need to
- **Helper functions**: Recursive tree walk is efficient for typical catalog sizes (<5000 nodes)
- **Range computation**: Lightweight operation per completion request

## Testing Strategy (for QA phase)

1. **Unit / Integration**:
   - Mock editor, store, and treeNodes
   - Call provideCompletionItems, verify Flink keyword suggestions (TUMBLE, HOP, etc.)
   - Verify table/view name extraction from sample tree structure
   - Verify column extraction from selectedTableSchema
   - Verify range property is present on all items

2. **UI Validation**:
   - Mount editor, type `TUM`, verify TUMBLE keyword appears with correct icon
   - Type partial table name (e.g., `user`), verify matching tables suggested
   - Type partial view name (e.g., `log`), verify matching views suggested with Interface icon
   - Click a table in sidebar, type partial column name, verify columns suggested
   - Click different table, verify column suggestions update
   - Type in different editors, verify no duplicate suggestions or provider conflicts

3. **Disposable & Cleanup**:
   - Mount editor, verify provider registers once
   - Trigger HMR (edit EditorCell.tsx), verify old provider is disposed
   - Verify no console errors about duplicate providers
   - Mount multiple editors, verify only one provider instance (not one per editor)

4. **Edge Case Coverage**:
   - Empty tree (no suggestions except Flink keywords)
   - Tree with mixed tables, views, externalTables
   - Tree with special characters in names
   - Very large tree (100+ tables)
   - Quick typing (repeated calls to provideCompletionItems)
   - Provider registered, then editor unmounts, then mounts again
   - Unexpanded tree nodes do not appear in completions

## Dependencies

- `monaco-editor` (already in project as peer dep of `@monaco-editor/react`)
- Zustand store (already initialized and available)
- No new npm packages required

## Success Metrics

- Users complete table/column names with 1-2 keystrokes instead of 10+
- Reduced sidebar switching; users can stay in editor longer
- Fewer typos in table/column names → fewer query errors
- User satisfaction (measured in future feedback/surveys)

## Known Limitations

- **Table completions are best-effort**: Based on expanded tree state in sidebar. Only tables/views/externalTables whose parent nodes have been expanded appear in suggestions.
- **Column completions reflect last-clicked table**: Not per-query context-aware. No analysis of SELECT...FROM clause; all columns from selectedTableSchema are suggested regardless of position in query.
- **No smart context filtering**: Monaco's built-in fuzzy filter handles UX (e.g., user typing "id" sees all matching fields), but the provider doesn't filter tables after FROM or columns after SELECT.

## Out of Scope (Deferred to Future Phases)

- **Lazy loading columns**: Fetch column schema on-demand for unexpanded tables
- **Smart context filtering**: Detect cursor position (after FROM vs SELECT vs WHERE) and filter appropriately
- **Function signatures**: Parameter hints for Flink SQL functions
- **Hover documentation**: Show table/column types on hover
- **Quickfix suggestions**: Auto-insert missing aliases or qualified names
- **Schema refresh**: Force refresh catalog in completions without page reload
