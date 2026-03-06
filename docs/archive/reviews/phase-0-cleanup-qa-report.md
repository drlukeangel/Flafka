# Phase 0 Cleanup — QA Validation Report

**Date:** 2026-02-28
**Validator:** QA Engineer (automated review)
**Files reviewed:**
- `src/store/workspaceStore.ts`
- `src/types/index.ts`
- `src/api/flink-api.ts`
- `src/components/EditorCell/EditorCell.tsx`
- `src/components/ResultsTable/ResultsTable.tsx` (read-only verify)
- `src/components/TreeNavigator/TreeNavigator.tsx` (read-only verify)
- `src/App.tsx` (read-only verify)

---

## 0.1 Store Cleanup

### [PASS] activeStatementId removed from interface
`WorkspaceState` interface in `workspaceStore.ts` contains no `activeStatementId` field.

### [PASS] activeStatementId removed from initial state
No `activeStatementId` key appears anywhere in the initial state object.

### [PASS] activeStatementId removed from addStatement
`addStatement` implementation does not set `activeStatementId`. The `set()` call returns only `{ statements: newStatements }` or `{ statements: [...state.statements, newStatement] }`.

### [PASS] activeStatementId removed from deleteStatement
`deleteStatement` returns `{ statements: ... }` with no `activeStatementId` reference.

### [PASS] activeStatementId removed from duplicateStatement
`duplicateStatement` returns `{ statements: [...state.statements, newStatement] }` only — no `activeStatementId`.

### [PASS] resultsFilter, resultsSort, resultsSearch, isLoading removed from interface
None of these fields appear in the `WorkspaceState` interface.

### [PASS] resultsFilter, resultsSort, resultsSearch, isLoading removed from initial state
No entries for these fields exist in the initial state object.

### [PASS] setActiveStatement, setResultsFilter, setResultsSort, setResultsSearch actions removed
None of these action functions appear anywhere in the store file.

### [PASS] No leftover references to removed fields
A full-codebase search for `activeStatementId`, `resultsFilter`, `resultsSort`, `resultsSearch`, `setActiveStatement`, `setResultsFilter`, `setResultsSort`, `setResultsSearch` returned zero matches across all files in `src/`.

### [PASS] isLoading (store-level) not confused with TreeNode.isLoading
The `isLoading` that remains in `src/types/index.ts` (line 34) is `TreeNode.isLoading?: boolean`, which is a separate per-node loading field. It is correctly used by `TreeNavigator.tsx` (line 157) to display a spinner on individual nodes. The store-level `isLoading: boolean` field has been removed. The PRD explicitly notes: "isLoading on TreeNode type (used by TreeNavigator) is a DIFFERENT field from store-level isLoading — do NOT touch TreeNode.isLoading." This is correct.

### [PASS] Filter and SortConfig removed from store imports
The import line in `workspaceStore.ts` (line 4) reads:
```ts
import type { SQLStatement, StatementStatus, TreeNode, Column, Toast } from '../types';
```
Neither `Filter` nor `SortConfig` appear in the store's import. They were correctly removed since they are no longer used inside the store.

---

## 0.2 Types Cleanup

### [PASS] ComputePoolStatus removed from types/index.ts
No `ComputePoolStatus` interface exists anywhere in `src/types/index.ts`. The file is 64 lines and contains no such definition.

### [PASS] parentId removed from TreeNode
The `TreeNode` interface (lines 29-40 of `types/index.ts`) has no `parentId` field.

### [PASS] readOnly removed from TreeNode.metadata
The `metadata` sub-object inside `TreeNode` contains only `catalog?: string` and `database?: string`. No `readOnly` field is present.

### [PASS] SortConfig still exists in types/index.ts
`SortConfig` is defined at lines 49-52:
```ts
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}
```

### [PASS] Filter still exists in types/index.ts
`Filter` is defined at lines 43-47:
```ts
export interface Filter {
  column: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'not_equals';
  value: string;
}
```

### [PASS] Duplicate Column removed from flink-api.ts
`flink-api.ts` contains no local `interface Column` definition. A search for `interface Column` in that file returns no matches.

### [PASS] Column imported from types in flink-api.ts
Line 3 of `flink-api.ts`:
```ts
import type { Column } from '../types';
```
`Column` is used in the `getTableSchema` return type (`Promise<Column[]>`) and in `workspaceStore.ts` for the polling accumulator variable.

---

## 0.3 addStatement Insert Position

### [PASS] Signature is (code?: string, afterId?: string) => void
Interface declaration (line 34):
```ts
addStatement: (code?: string, afterId?: string) => void;
```
Implementation (line 213):
```ts
addStatement: (code, afterId) => {
```
Both match the required signature.

### [PASS] When afterId provided and found: inserts after that statement using array copy + splice
```ts
if (afterId) {
  const index = state.statements.findIndex((s) => s.id === afterId);
  if (index !== -1) {
    const newStatements = [...state.statements];        // array copy
    newStatements.splice(index + 1, 0, newStatement);  // splice at index+1
    return { statements: newStatements };
  }
}
```
Correct: uses spread copy before mutating with splice.

### [PASS] When afterId not found (findIndex returns -1): falls back to append at end
The `if (index !== -1)` guard means a -1 result falls through to the shared `return { statements: [...state.statements, newStatement] }` at the end of the `set()` callback — appending at the end, not at index 0.

### [PASS] When afterId not provided: appends at end
When `afterId` is falsy the `if (afterId)` block is skipped entirely and execution reaches `return { statements: [...state.statements, newStatement] }`.

### [PASS] EditorCell handleAddCell passes statement.id as afterId
Line 83 of `EditorCell.tsx`:
```ts
addStatement(undefined, statement.id);
```
Correct: first argument is `undefined` (no pre-filled code), second is the current cell's id.

### [PASS] TreeNavigator still calls addStatement(query) without afterId
Line 38 of `TreeNavigator.tsx`:
```ts
addStatement(query);
```
No second argument — backward compatible, appends to end.

### [PASS] App.tsx toolbar button still calls addStatement() without afterId
Line 79 of `App.tsx`:
```ts
onClick={() => addStatement()}
```
No arguments — backward compatible, appends to end.

---

## 0.4 Delete Confirmation

### [PASS] No window.confirm() or confirm() calls remain
A search across all files in `src/` for `window\.confirm` and `confirm\(` returned zero matches.

### [PASS] showDeleteConfirm state added with useState
Line 36 of `EditorCell.tsx`:
```ts
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
```

### [PASS] useEffect cleans up auto-dismiss timer on unmount (returns clearTimeout)
Lines 42-46:
```ts
useEffect(() => {
  if (!showDeleteConfirm) return;
  const timer = setTimeout(() => setShowDeleteConfirm(false), 5000);
  return () => clearTimeout(timer);
}, [showDeleteConfirm]);
```
The cleanup function `() => clearTimeout(timer)` is correctly returned. The `if (!showDeleteConfirm) return` early-exit also prevents creating a timer when the state is false (including on the initial render or after dismissal).

### [PASS] Auto-dismiss timeout is 5 seconds (not 3)
`setTimeout(..., 5000)` — confirmed 5000 ms.

### [PASS] First click shows "Delete? Yes / No" inline UI
The `handleDelete` function sets `setShowDeleteConfirm(true)` when `showDeleteConfirm` is `false`. The render (lines 169-183) conditionally shows the inline confirmation:
```tsx
{showDeleteConfirm ? (
  <div className="delete-confirm">
    <span>Delete?</span>
    <button className="confirm-yes" onClick={handleDelete}>Yes</button>
    <button className="confirm-no" onClick={() => setShowDeleteConfirm(false)}>No</button>
  </div>
) : (
  <button className="icon-btn delete-btn" onClick={handleDelete} ...>
    <FiTrash2 size={14} />
  </button>
)}
```

### [PASS] "Yes" click actually deletes
The "Yes" button calls `handleDelete`. When `showDeleteConfirm` is `true`, `handleDelete` calls `deleteStatement(statement.id)` and then `setShowDeleteConfirm(false)`.

### [PASS] "No" click dismisses confirmation
The "No" button calls `() => setShowDeleteConfirm(false)` directly, hiding the confirmation UI.

### [FAIL] Auto-dismiss does NOT show "Cancelled" feedback
The PRD specifies: "Show brief 'Cancelled' feedback when auto-dismissed." When the 5-second timer fires, it calls `setShowDeleteConfirm(false)`, which simply reverts the UI back to the trash icon with no feedback text. There is no `Cancelled` or similar transient message displayed to the user after auto-dismiss. The `Cancelled` text in the file (line 123) is inside `getStatusBadge()` and refers to a query execution status — it is unrelated to delete confirmation feedback.

---

## General

### [PASS] TypeScript compiles clean
`npx tsc --noEmit` produced no output (exit 0, zero errors).

### [PASS] No orphaned imports in modified files
- `workspaceStore.ts`: imports `SQLStatement, StatementStatus, TreeNode, Column, Toast` — all are used in the store.
- `types/index.ts`: no imports (only exports).
- `flink-api.ts`: imports `Column` from `../types` — used by `getTableSchema` return type and the schema mapping in `workspaceStore.ts`.
- `EditorCell.tsx`: imports `useState`, `useEffect`, `useCallback`, `useRef` from React — all used. All icon imports from `react-icons/fi` are rendered in JSX.

### [PASS] ResultsTable still works (imports SortConfig from types, not store)
Line 2 of `ResultsTable.tsx`:
```ts
import type { Column, SortConfig } from '../../types';
```
`SortConfig` is imported from `../../types` (not from the store). `SortConfig` still exists in `types/index.ts`. `Column` also still exists. Both are used: `Column` in the `ResultsTableProps` interface, `SortConfig` in `useState<SortConfig | null>(null)`.

---

## Summary

| Check | Result |
|-------|--------|
| activeStatementId fully removed | PASS |
| resultsFilter/Sort/Search/isLoading removed | PASS |
| Dead actions removed | PASS |
| No leftover references to removed fields | PASS |
| Filter/SortConfig removed from store imports | PASS |
| ComputePoolStatus removed from types | PASS |
| parentId removed from TreeNode | PASS |
| readOnly removed from TreeNode.metadata | PASS |
| Filter and SortConfig kept in types/index.ts | PASS |
| Duplicate Column removed from flink-api.ts | PASS |
| Column imported from types in flink-api.ts | PASS |
| addStatement signature correct | PASS |
| Insert after found id (splice on copy) | PASS |
| Fallback to append when id not found | PASS |
| Append when no afterId given | PASS |
| EditorCell passes statement.id as afterId | PASS |
| TreeNavigator backward compatible | PASS |
| App.tsx backward compatible | PASS |
| No window.confirm() remains | PASS |
| showDeleteConfirm state added | PASS |
| useEffect with clearTimeout cleanup | PASS |
| Auto-dismiss is 5 seconds | PASS |
| First click shows inline confirmation | PASS |
| Yes deletes | PASS |
| No dismisses | PASS |
| Auto-dismiss shows "Cancelled" feedback | **FAIL** |
| TypeScript compiles clean | PASS |
| No orphaned imports | PASS |
| ResultsTable imports from types (not store) | PASS |

---

## Final Verdict: FAILURES FOUND

**1 failure detected:**

**0.4 — Auto-dismiss "Cancelled" feedback missing.** The PRD requires: "Show brief 'Cancelled' feedback when auto-dismissed." The current implementation sets `showDeleteConfirm(false)` on timeout, returning silently to the trash icon. No transient "Cancelled" message is shown. This is a minor UX omission that does not affect correctness of the deletion flow itself, but it is explicitly called out as a requirement in the PRD.

**Recommended fix:** Add a second state variable (e.g., `showCancelledFeedback`) that is set to `true` when the timer fires instead of calling `setShowDeleteConfirm(false)` directly. Render a brief "Cancelled" label in place of the confirm UI, with its own short timer (e.g., 1.5 seconds) to revert to the trash icon.
