# QA Report: Phase 2 Features — Status Bar, Table Schema Panel, Workspace Persistence

**QA Engineer:** Claude Code (QA Agent)
**Date:** 2026-02-28
**Commits Reviewed:** 0e73dcf (2.1 Status Bar), 307228b + 1d63e8c (2.2 Schema Panel), b3f2d5a (2.4 Persistence)
**TypeScript Compile:** `npx tsc --noEmit` — PASS (zero errors)

**Files Reviewed:**
- `src/components/EditorCell/EditorCell.tsx`
- `src/components/TreeNavigator/TreeNavigator.tsx`
- `src/store/workspaceStore.ts`
- `src/types/index.ts`
- `src/App.tsx`
- `src/App.css`
- `src/api/flink-api.ts`
- `src/index.css`

---

## Overall Verdict: PASS WITH BUGS

All three features are functionally correct at their core. TypeScript compiles cleanly. Two medium-severity bugs and several low-severity CSS/UX issues were found. No blocking defects.

---

## Feature 2.1 — Statement Status Bar

### Test Cases

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 1 | Status bar is conditionally rendered only when `startedAt` exists | PASS | Line 277 EditorCell.tsx: `{statement.startedAt && (` |
| 2 | START TIME field renders with `startedAt.toLocaleTimeString()` | PASS | Line 281: `{statement.startedAt.toLocaleTimeString()}` |
| 3 | STATUS field renders a colored dot with `status-dot ${status.toLowerCase()}` | PASS | Line 285: `` className={`status-dot ${statement.status.toLowerCase()}`} `` |
| 4 | STATEMENT NAME field renders conditionally when `statementName` exists | PASS | Line 288: `{statement.statementName && (` |
| 5 | `statement-status-bar` CSS class defined in App.css | PASS | App.css line 1009 |
| 6 | `status-bar-item` CSS class defined | PASS | App.css line 1020 |
| 7 | `status-bar-label` CSS class defined | PASS | App.css line 1026 |
| 8 | `statement-name` CSS class defined | PASS | App.css line 1050 |
| 9 | `status-dot` base class defined | PASS | App.css line 642 |
| 10 | `status-dot.completed` = green (`var(--color-success)`) | PASS | App.css line 1033 |
| 11 | `status-dot.running` = blue per spec | **FAIL** | App.css line 648: uses `var(--color-success)` (green), not blue. Spec requires blue for RUNNING. |
| 12 | `status-dot.pending` = yellow (`var(--color-warning)`) | PASS | App.css line 1041 |
| 13 | `status-dot.error` = red (`var(--color-error)`) | PASS | App.css line 1037 |
| 14 | `status-dot.cancelled` = red per spec | **FAIL** | App.css line 1045: uses `var(--color-text-tertiary)` (gray). Spec requires red for CANCELLED. |
| 15 | `status-dot.idle` CSS defined (defensive fallback) | PASS | App.css line 1046 |
| 16 | Status bar appears inside `!statement.isCollapsed` guard | PASS | Lines 245–295: entire block including status bar is inside `{!statement.isCollapsed && (` |
| 17 | `startedAt` field declared in `SQLStatement` type | PASS | types/index.ts line 17: `startedAt?: Date` |
| 18 | `startedAt` is set on `executeStatement` (PENDING transition) | PASS | workspaceStore.ts line 330: `startedAt: new Date()` |
| 19 | `duplicateStatement` clears `startedAt` from the new statement | **FAIL** | workspaceStore.ts lines 302–309: spreads source statement with `...statement` but does NOT reset `startedAt: undefined`. A duplicated statement that was previously executed will show a stale start time in the status bar immediately. |

---

## Feature 2.2 — Table Schema Panel

### Test Cases

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 20 | `selectedTableSchema`, `selectedTableName`, `schemaLoading` declared in store interface | PASS | workspaceStore.ts lines 20–22 |
| 21 | State initialized to `[]`, `null`, `false` respectively | PASS | workspaceStore.ts lines 72–74 |
| 22 | `selectTreeNode` action sets `selectedNodeId` | PASS | workspaceStore.ts line 231 |
| 23 | `selectTreeNode` triggers `loadTableSchema` for `table` type | PASS | workspaceStore.ts line 225–230 |
| 24 | `selectTreeNode` triggers `loadTableSchema` for `view` type | PASS | workspaceStore.ts line 225: checks `node.type === 'table' \|\| node.type === 'view'` |
| 25 | `selectTreeNode` does NOT trigger schema load for `catalog`, `database`, `tables` etc. | PASS | Condition is exclusive to table/view |
| 26 | `loadTableSchema` calls `flinkApi.getTableSchema(catalog, database, tableName)` | PASS | workspaceStore.ts line 242 |
| 27 | `loadTableSchema` sets `schemaLoading: true` and clears `selectedTableSchema: []` at start | PASS | workspaceStore.ts line 240 |
| 28 | `loadTableSchema` sets schema and `schemaLoading: false` on success | PASS | workspaceStore.ts line 243 |
| 29 | `loadTableSchema` sets `schemaLoading: false` on error (no crash) | PASS | workspaceStore.ts line 246 |
| 30 | `metadata?.catalog` and `metadata?.database` are null-checked before calling `loadTableSchema` | PASS | workspaceStore.ts line 228: `if (catalog && database)` |
| 31 | `findNodeById` returns `null` for empty tree | PASS | Verified: returns null for `[]` input |
| 32 | `findNodeById` handles nodes without `children` property (undefined) | PASS | Verified: `if (node.children)` guard at line 565 |
| 33 | `findNodeById` traverses deeply nested tree correctly | PASS | Verified: recursive DFS, finds nodes 4 levels deep |
| 34 | Schema panel renders in TreeNavigator only when `selectedTableName` is set | PASS | TreeNavigator.tsx line 74: `{selectedTableName && (` |
| 35 | Schema panel shows loading spinner when `schemaLoading` is true | PASS | TreeNavigator.tsx line 79: `{schemaLoading ? (` |
| 36 | Schema panel shows columns list when schema is loaded | PASS | TreeNavigator.tsx lines 86–91 |
| 37 | Schema panel shows empty state when schema is empty | PASS | TreeNavigator.tsx line 94: `No columns found` |
| 38 | `schema-panel` CSS class defined | PASS | App.css line 205 |
| 39 | `schema-header` CSS class defined | PASS | App.css line 213 |
| 40 | `schema-loading` CSS class defined | PASS | App.css line 258 |
| 41 | `schema-empty` CSS class defined | PASS | App.css line 267 |
| 42 | `schema-column` CSS class defined | PASS | App.css line 235 |
| 43 | `column-name` CSS class defined | PASS | App.css line 247 |
| 44 | `column-type` CSS class defined | PASS | App.css line 252 |
| 45 | `schema-section-title` CSS class defined | PASS | App.css line 227 |
| 46 | `schema-content` CSS class defined | **FAIL** | Missing from App.css. Used in TreeNavigator.tsx line 82. Renders unstyled but causes no runtime error. |
| 47 | `schema-section` (wrapper div) CSS class defined | **FAIL** | Missing from App.css. Used in TreeNavigator.tsx line 83. `schema-section-title` exists but `schema-section` wrapper has no styles. Renders unstyled. |
| 48 | Schema panel clears when a non-table tree node is clicked | **FAIL** | `selectTreeNode` only sets `selectedTableName` when a table/view is clicked. Clicking a catalog/database/tables folder node does NOT clear `selectedTableName` or `selectedTableSchema`. The panel persists showing the last table's schema, which is misleading when the user has moved focus away from a table. |
| 49 | `getTableSchema` API function has correct signature `(catalog, database, table)` | PASS | flink-api.ts line 226 |
| 50 | `Column` type imported correctly in both flink-api.ts and workspaceStore.ts | PASS | flink-api.ts line 3, workspaceStore.ts line 5 |
| 51 | `node-icon.model`, `node-icon.function`, `node-icon.external` CSS classes defined | **FAIL** | Missing from App.css. Only `catalog`, `database`, `table`, `view` icon colors are defined. Model/function/externalTable icons render in the default `var(--color-text-secondary)` color with no custom color. No runtime error. |

---

## Feature 2.4 — Workspace Persistence

### Test Cases

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 52 | Zustand `persist` middleware wraps the store | PASS | workspaceStore.ts line 60: `persist(...)` |
| 53 | Storage key is `'flink-workspace'` | PASS | workspaceStore.ts line 530: `name: 'flink-workspace'` |
| 54 | `partialize` persists `statements` array | PASS | workspaceStore.ts line 532 |
| 55 | `partialize` persists `catalog` | PASS | workspaceStore.ts line 541 |
| 56 | `partialize` persists `database` | PASS | workspaceStore.ts line 542 |
| 57 | `partialize` persists `lastSavedAt` as ISO string | PASS | workspaceStore.ts line 543: `new Date().toISOString()` |
| 58 | `partialize` does NOT persist `results` | PASS | Verified: only `id`, `code`, `status`, `createdAt`, `isCollapsed` are mapped |
| 59 | `partialize` does NOT persist `error` | PASS | Verified: field absent from partialize map |
| 60 | `partialize` does NOT persist `statementName` | PASS | Verified: field absent from partialize map |
| 61 | `partialize` does NOT persist `executionTime` | PASS | Verified: field absent from partialize map |
| 62 | `partialize` does NOT persist `treeNodes` | PASS | Verified: not included in returned object |
| 63 | `partialize` does NOT persist `selectedTableSchema` | PASS | Verified: not included |
| 64 | `partialize` does NOT persist `toasts` | PASS | Verified: not included |
| 65 | RUNNING statements reset to IDLE on persist | PASS | workspaceStore.ts line 535: ternary sets `'IDLE'` when status is `'RUNNING'` |
| 66 | PENDING statements reset to IDLE on persist | PASS | workspaceStore.ts line 535: ternary sets `'IDLE'` when status is `'PENDING'` |
| 67 | COMPLETED statements remain COMPLETED on persist | PASS | Verified: ternary passes through other statuses unchanged |
| 68 | ERROR statements remain ERROR on persist | PASS | Verified: pass-through |
| 69 | CANCELLED statements remain CANCELLED on persist | PASS | Verified: pass-through |
| 70 | `lastSavedAt` initialized to `null` in initial state | PASS | workspaceStore.ts line 87 |
| 71 | Footer shows "Last saved at {time}" only when `lastSavedAt` is set | PASS | App.tsx line 97: `{lastSavedAt && (` |
| 72 | Footer parses `lastSavedAt` as Date for `toLocaleTimeString()` | PASS | App.tsx line 99: `new Date(lastSavedAt).toLocaleTimeString()` — correct: wraps string in `new Date()` |
| 73 | `last-saved` CSS class defined | PASS | App.css line 914 |
| 74 | `cell-count` CSS class defined in App.css | **FAIL** | Missing from App.css. Used in App.tsx line 96. Renders as plain unstyled span. No runtime error. |
| 75 | `env-info` CSS class defined in App.css | **FAIL** | Missing from App.css. Used in App.tsx line 102. Renders as plain unstyled span. No runtime error. |
| 76 | `partialize` does NOT persist `startedAt` | PASS | Verified: not mapped in partialize. So `startedAt` is always `undefined` after page reload, preventing the `toLocaleTimeString()` crash on restore. |
| 77 | `createdAt` persisted as ISO string, not Date object | PASS (with note) | zustand persist serializes to JSON so `createdAt` becomes a string on restore. It is never called as a Date method in any component, so no runtime error. Type annotation says `Date` but actual value is `string` post-hydration — a latent type mismatch. |

---

## Bugs Summary

### BUG-01 — MEDIUM | Status Bar: RUNNING dot color is green instead of blue

**Feature:** 2.1 Status Bar
**File:** `src/App.css` line 648
**Severity:** Medium (visual spec deviation, not a crash)

**Description:** The specification states the RUNNING status should display a blue dot. The implementation sets `.status-dot.running` to `var(--color-success)` which is green — the same color as COMPLETED. This makes it visually impossible to distinguish a running query from a completed one in the status bar.

**Current code:**
```css
.status-dot.running {
  background-color: var(--color-success);  /* green */
  animation: pulse 2s ease-in-out infinite;
}
```

**Fix:**
```css
.status-dot.running {
  background-color: var(--color-info);  /* blue */
  animation: pulse 2s ease-in-out infinite;
}
```

---

### BUG-02 — MEDIUM | Status Bar: CANCELLED dot color is gray instead of red

**Feature:** 2.1 Status Bar
**File:** `src/App.css` line 1045
**Severity:** Medium (visual spec deviation)

**Description:** The specification states CANCELLED status should show a red dot. The implementation uses `var(--color-text-tertiary)` which is gray. This gives CANCELLED the same visual treatment as an unstyled/unknown state, losing the "something went wrong / was aborted" signal.

**Current code:**
```css
.status-dot.cancelled,
.status-dot.idle {
  background-color: var(--color-text-tertiary);  /* gray */
}
```

**Fix:** Separate the rules and assign red to cancelled:
```css
.status-dot.cancelled {
  background-color: var(--color-error);  /* red */
}
.status-dot.idle {
  background-color: var(--color-text-tertiary);  /* gray */
}
```

---

### BUG-03 — MEDIUM | `duplicateStatement` carries over `startedAt` from source statement

**Feature:** 2.1 Status Bar
**File:** `src/store/workspaceStore.ts` lines 302–309
**Severity:** Medium (incorrect UI state shown immediately on duplicate)

**Description:** `duplicateStatement` spreads the source statement with `...statement` and explicitly resets `status`, `results`, `error`, `statementName`, and `createdAt`, but does NOT reset `startedAt`. If you duplicate a statement that was previously executed, the new duplicate immediately renders a status bar showing the stale `startedAt` time from the original statement, even though the duplicate has never been run.

**Current code:**
```typescript
const newStatement: SQLStatement = {
  ...statement,
  id: generateId(),
  status: 'IDLE',
  results: undefined,
  error: undefined,
  statementName: undefined,
  createdAt: new Date(),
  // startedAt NOT cleared — BUG
};
```

**Fix:**
```typescript
const newStatement: SQLStatement = {
  ...statement,
  id: generateId(),
  status: 'IDLE',
  results: undefined,
  error: undefined,
  statementName: undefined,
  startedAt: undefined,   // add this
  executionTime: undefined, // also clear for consistency
  totalRowsReceived: undefined,
  columns: undefined,
  createdAt: new Date(),
};
```

---

### BUG-04 — LOW | Schema panel does not clear when a non-table tree node is selected

**Feature:** 2.2 Table Schema Panel
**File:** `src/store/workspaceStore.ts` lines 230–232
**Severity:** Low (UX issue, no crash)

**Description:** `selectTreeNode` only sets `selectedTableName` when the clicked node is a `table` or `view`. When the user clicks a `catalog`, `database`, `tables` folder, or `functions` folder node, `selectedTableName` and `selectedTableSchema` are not cleared. The schema panel remains visible showing the last table's schema, even though no table is currently selected. This is confusing — the panel header reads the previous table name while a folder is highlighted in the tree.

**Current code:**
```typescript
selectTreeNode: (nodeId) => {
  set({ selectedNodeId: nodeId });
  const node = findNodeById(get().treeNodes, nodeId);
  if (node && (node.type === 'table' || node.type === 'view')) {
    // ... load schema
  }
  // else: selectedTableName and selectedTableSchema are never cleared
},
```

**Fix:**
```typescript
selectTreeNode: (nodeId) => {
  set({ selectedNodeId: nodeId });
  const node = findNodeById(get().treeNodes, nodeId);
  if (node && (node.type === 'table' || node.type === 'view')) {
    const catalog = node.metadata?.catalog;
    const database = node.metadata?.database;
    if (catalog && database) {
      set({ selectedTableName: node.name });
      get().loadTableSchema(catalog, database, node.name);
    }
  } else {
    // Clear schema panel when a non-table node is selected
    set({ selectedTableName: null, selectedTableSchema: [] });
  }
},
```

---

### BUG-05 — LOW | Missing CSS classes: `schema-content`, `schema-section`

**Feature:** 2.2 Table Schema Panel
**File:** `src/App.css` (missing), `src/components/TreeNavigator/TreeNavigator.tsx` lines 82–84
**Severity:** Low (no runtime error, layout may be slightly off)

**Description:** Two CSS classes used as structural wrappers in the schema panel are not defined in `App.css`. The `schema-content` div wraps the entire loaded schema, and `schema-section` wraps the title row. Both render without styles, relying on browser defaults.

**Missing definitions to add to App.css:**
```css
.schema-content {
  /* wrapper for loaded schema columns */
}

.schema-section {
  margin-bottom: 4px;
}
```

---

### BUG-06 — LOW | Missing CSS classes: `cell-count`, `env-info` in footer

**Feature:** 2.4 Workspace Persistence (footer)
**File:** `src/App.css` (missing), `src/App.tsx` lines 96, 102
**Severity:** Low (no runtime error, footer spans are unstyled)

**Description:** Two span elements in the editor footer reference CSS classes that are not defined in `App.css`. The `cell-count` span shows the statement count, and `env-info` shows the cloud provider and region. Both render as plain inline text without the font-size and color styling consistent with the `last-saved` class next to them.

**Missing definitions to add to App.css:**
```css
.cell-count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.env-info {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
```

---

### BUG-07 — LOW | Missing CSS color classes for `node-icon.model`, `.function`, `.external`

**Feature:** 2.2 Table Schema Panel (TreeNavigator icons)
**File:** `src/App.css` (missing), `src/components/TreeNavigator/TreeNavigator.tsx` lines 138, 141, 144
**Severity:** Low (no runtime error, icons render in default secondary text color)

**Description:** The `getIcon()` function in `TreeNodeComponent` applies `className="node-icon model"`, `className="node-icon function"`, and `className="node-icon external"` to icons. While `node-icon.catalog`, `.database`, `.table`, and `.view` all have custom accent colors in `App.css`, the model/function/external variants have no CSS rules and fall through to the base `.node-icon` color (`var(--color-text-secondary)`).

**Missing definitions to add to App.css:**
```css
.node-icon.model {
  color: #F59E0B;  /* amber, distinct from table/view */
}

.node-icon.function {
  color: #EC4899;  /* pink */
}

.node-icon.external {
  color: #6B7280;  /* gray */
}
```

---

### BUG-08 — LOW | Missing CSS classes: `tree-node-wrapper`, `tree-children`, `collapse-btn`

**Feature:** 2.2 Table Schema Panel (TreeNavigator structure)
**File:** `src/App.css` (missing)
**Severity:** Low (no runtime error, structural layout works via browser defaults)

**Description:** Three CSS classes used in `TreeNavigator.tsx` have no corresponding rules in `App.css`:
- `tree-node-wrapper` (line 164): outer div for each tree node + its children
- `tree-children` (line 188): container for child nodes
- `collapse-btn` (line 232 in EditorCell.tsx): the collapse/expand icon button

`tree-node-wrapper` and `tree-children` rely on `display: block` by default (divs), so indentation still works via inline `paddingLeft` style. `collapse-btn` uses the base `.icon-btn` styles so it is functional. No visual regression but these are undefined style hooks.

---

## Notes on Non-Bug Observations

1. **`createdAt` type drift on hydration:** `SQLStatement.createdAt` is typed as `Date` in `types/index.ts`, but after Zustand hydrates from localStorage it becomes a `string` (JSON serialization). Currently no component calls `.getTime()` or other Date methods on `createdAt`, so there is no runtime crash. This is a latent type safety issue. Consider using `z.coerce.date()` (Zod) or mapping `createdAt: new Date(s.createdAt)` in a custom `storage` deserializer. Similarly `updatedAt` would have the same issue.

2. **`collapse-btn` CSS class absent:** The collapse button in `EditorCell` has `className="icon-btn collapse-btn"`. The `.collapse-btn` modifier has no rules in `App.css`, but because `.icon-btn` is defined, the button is fully functional and styled. Not a bug, just an unresolved class.

3. **`loadTreeData` called in `TreeNavigator` useEffect and also triggered by `setCatalog`/`setDatabase`:** There is no double-call issue because the TreeNavigator `useEffect` with `[loadTreeData]` dep runs only on mount, and `setCatalog`/`setDatabase` are triggered by user interaction. The dependency on `loadTreeData` is safe because Zustand actions are stable references.

4. **`lastSavedAt` updates on every state write:** The `partialize` function is called by Zustand persist on every state change, and it always sets `lastSavedAt: new Date().toISOString()`. This means `lastSavedAt` reflects the last time ANY state was written (including a keypress in the editor). This is consistent with "auto-save on change" semantics and is not a bug, but the label "Last saved at" may be misleading if users expect explicit save actions.

5. **Schema panel max-height overflow:** `.schema-panel` has `max-height: 250px` with `overflow-y: auto`. For wide tables with many columns this will scroll within the sidebar, which is the intended behavior.
